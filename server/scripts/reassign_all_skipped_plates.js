import mongoose from 'mongoose';
import { MongoDB } from '../config/config.js';

async function reassignAllSkippedPlates() {
    await mongoose.connect(MongoDB.URI);
    const db = mongoose.connection.db;

    console.log('================================================================');
    console.log(`CONECTADO A: ${MongoDB.URI}`);
    console.log('INICIANDO REASIGNACIÓN DE PAGOS Y CONCILIACIÓN PARA LAS 9 MOTOS');
    console.log('================================================================\n');

    const plates = [
        'IFG81I',
        'DPW20I',
        'IFI90I',
        'IFX27I',
        'IGE18I',
        'XZQ63H',
        'XZQ69H',
        'XZQ86H',
        'YAG34H'
    ];

    const results = [];

    for (const plate of plates) {
        console.log(`>>> PROCESANDO MOTO: [${plate}] <<<`);
        const contract = await db.collection('contracts').findOne({ deviceIdName: plate, status: 'ACTIVE' });
        if (!contract) {
            console.error(`❌ No se encontró contrato activo para ${plate}`);
            continue;
        }

        const contractId = contract.contractId;
        const dailyRate = contract.dailyRate || 35000;
        const totalContractDays = contract.totalContractDays || 500;

        // 1. Obtener todas las facturas de la moto hasta 2026-11-15 ordenadas por fecha
        const allInvoices = await db.collection('invoices').find({
            deviceIdName: plate,
            date: { $lte: new Date('2026-11-15T23:59:59.999Z') }
        }).sort({ date: 1 }).toArray();

        // 2. Identificar facturas pagadas con fechas >= 2026-11-12 que saltaron la mora
        const paidNewerInvoices = allInvoices.filter(inv => 
            inv.paid === true && 
            inv.dayType === 'PAID' && 
            inv.date >= new Date('2026-11-12T00:00:00.000Z')
        );

        // 3. Buscar los objetos payment correspondientes
        const paymentsToReassign = [];
        for (const inv of paidNewerInvoices) {
            const p = await db.collection('payments').findOne({
                $or: [
                    { _id: inv.transaction?.id },
                    { reference: inv.transaction?.reference }
                ]
            });
            if (p) {
                paymentsToReassign.push({
                    originalInvoiceId: inv._id,
                    payment: p
                });
            } else {
                console.warn(`⚠️ Pago no encontrado en colección payments para factura ${inv._id}`);
                // Si no está en payments, usar datos de transaction embebidos
                paymentsToReassign.push({
                    originalInvoiceId: inv._id,
                    payment: {
                        _id: inv.transaction?.id || `GEN-${inv._id}`,
                        reference: inv.transaction?.reference,
                        amount: inv.paidAmount || dailyRate,
                        finalized_at: inv.transaction?.finalized_at || inv.paymentDate || new Date()
                    }
                });
            }
        }

        console.log(`- Pagos encontrados a reasignar: ${paymentsToReassign.length}`);

        // 4. Identificar las facturas destino en orden cronológico:
        // Todas las facturas que deberían estar pagadas secuencialmente.
        // Buscamos todas las facturas dayType != 'FREE', ordenadas cronológicamente.
        // Las primeras N que estaban pagadas antes de 2026-11-12 se mantienen.
        // Las siguientes paymentsToReassign.length facturas impagas (o que estaban incorrectamente sin pagar) son las destinatarias.
        const payableInvoices = allInvoices.filter(inv => inv.dayType !== 'FREE');
        
        // Facturas impagas antes del salto o a partir del punto de ruptura
        const unpaidCandidates = payableInvoices.filter(inv => {
            // No estaba pagada o estaba pagada pero es una de las que se pagaron después del salto (>= 2026-11-12)
            const wasPaidBeforeJump = inv.paid && inv.date < new Date('2026-11-12T00:00:00.000Z');
            return !wasPaidBeforeJump;
        });

        // Las primeras paymentsToReassign.length candidatas son las que deben quedar pagadas con estos pagos
        const targetInvoices = unpaidCandidates.slice(0, paymentsToReassign.length);

        console.log(`- Facturas destino: ${targetInvoices.map(t => t._id).join(', ')}`);

        // 5. Aplicar cada pago a su factura destino
        for (let i = 0; i < paymentsToReassign.length; i++) {
            const { payment } = paymentsToReassign[i];
            const targetInv = targetInvoices[i];

            await db.collection('invoices').updateOne(
                { _id: targetInv._id },
                {
                    $set: {
                        paid: true,
                        paidAmount: payment.amount,
                        dayType: 'PAID',
                        cutOff: false,
                        contractId: contractId,
                        paymentDate: payment.finalized_at,
                        transaction: {
                            id: payment._id,
                            reference: payment.reference,
                            finalized_at: payment.finalized_at,
                            type: 'WOMPI'
                        }
                    }
                }
            );

            // Actualizar registro en payments
            await db.collection('payments').updateOne(
                { _id: payment._id },
                {
                    $set: {
                        invoiceId: targetInv._id,
                        unpaidInvoiceId: targetInv._id,
                        used: true
                    }
                }
            );

            console.log(`  ✅ Pago ${payment.reference} (${payment.amount}) -> Reasignado a factura ${targetInv._id}`);
        }

        // 6. Todas las facturas restantes de las candidatas (que no recibieron pago) deben quedar en DEBT
        const remainingUnpaid = unpaidCandidates.slice(paymentsToReassign.length);
        for (const inv of remainingUnpaid) {
            await db.collection('invoices').updateOne(
                { _id: inv._id },
                {
                    $set: {
                        paid: false,
                        paidAmount: 0,
                        dayType: 'DEBT',
                        cutOff: false,
                        contractId: contractId,
                        paymentDate: null,
                        transaction: null
                    }
                }
            );
            console.log(`  🔄 Factura ${inv._id} reseteada a estado DEBT (impaga)`);
        }

        // 7. Eliminar facturas creadas prematuramente para fechas futuras (>= 2026-11-16)
        const deleteFuture = await db.collection('invoices').deleteMany({
            deviceIdName: plate,
            date: { $gte: new Date('2026-11-16T00:00:00.000Z') }
        });
        if (deleteFuture.deletedCount > 0) {
            console.log(`  🗑️ Facturas futuras eliminadas (>= 2026-11-16): ${deleteFuture.deletedCount}`);
        }

        // 8. Recalcular progreso del contrato
        const totalPaidCount = await db.collection('invoices').countDocuments({
            contractId: contractId,
            paid: true,
            dayType: 'PAID'
        });
        const totalPaidAmount = totalPaidCount * dailyRate;
        const remainingDays = Math.max(0, totalContractDays - totalPaidCount);

        await db.collection('contracts').updateOne(
            { contractId: contractId },
            {
                $set: {
                    paidDays: totalPaidCount,
                    paidAmount: totalPaidAmount,
                    remainingDays: remainingDays
                }
            }
        );
        console.log(`  📊 Contrato ${contractId} actualizado: paidDays=${totalPaidCount}, paidAmount=${totalPaidAmount}, remainingDays=${remainingDays}`);

        // 9. Verificar próxima factura a cobrar
        const nextUnpaid = await db.collection('invoices').findOne({
            deviceIdName: plate,
            paid: false,
            dayType: { $ne: 'FREE' }
        }, { sort: { date: 1 } });

        results.push({
            plate,
            contractId,
            reassignedCount: paymentsToReassign.length,
            targetInvoices: targetInvoices.map(t => t._id),
            nextUnpaidInvoice: nextUnpaid?._id,
            nextUnpaidDate: nextUnpaid?.date?.toISOString()?.slice(0, 10),
            totalPaidDays: totalPaidCount
        });

        console.log(`  🎯 Próxima factura en mora: ${nextUnpaid?._id} (${nextUnpaid?.date?.toISOString()?.slice(0, 10)})\n`);
    }

    console.log('================================================================');
    console.log('RESUMEN DE REASIGNACIONES COMPLETADAS');
    console.log('================================================================');
    console.table(results);

    await mongoose.disconnect();
}

reassignAllSkippedPlates().catch(console.error);

