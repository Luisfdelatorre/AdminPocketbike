import mongoose from 'mongoose';
import { MongoDB } from '../config/config.js';

async function reassignDRO88IPayments() {
    await mongoose.connect(MongoDB.URI);
    const db = mongoose.connection.db;

    console.log('=== INICIANDO REASIGNACIÓN DE PAGOS PARA DRO88I ===');

    // 1. Los 9 pagos realizados hoy para DRO88I
    const paymentIds = [
        '1362970-1794706787-49083', // LH
        '1362970-1794706905-49442', // KQ
        '1362970-1794706988-24239', // XR
        '1362970-1794708216-43045', // SX
        '1362970-1794709213-65162', // RC
        '1362970-1794709301-96203', // JH
        '1362970-1794709377-43971', // AT
        '1362970-1794709452-40609', // AO
        '1362970-1794709571-32837', // JG
    ];

    const payments = await db.collection('payments').find({ _id: { $in: paymentIds } }).sort({ finalized_at: 1 }).toArray();
    console.log(`Pagos a reasignar: ${payments.length}`);

    // 2. Facturas destino reales en mora (Octubre 19 al 28, omitiendo domingo 25 FREE)
    const targetInvoiceIds = [
        'DRO88I-2026-10-19',
        'DRO88I-2026-10-20',
        'DRO88I-2026-10-21',
        'DRO88I-2026-10-22',
        'DRO88I-2026-10-23',
        'DRO88I-2026-10-24',
        // 'DRO88I-2026-10-25' es domingo FREE (ya está pagada con $0)
        'DRO88I-2026-10-26',
        'DRO88I-2026-10-27',
        'DRO88I-2026-10-28',
    ];

    console.log(`Facturas destino: ${targetInvoiceIds.length}`);

    // 3. Aplicar cada pago a su factura destino correcta
    for (let i = 0; i < payments.length; i++) {
        const payment = payments[i];
        const invoiceId = targetInvoiceIds[i];

        // Actualizar la factura destino
        await db.collection('invoices').updateOne(
            { _id: invoiceId },
            {
                $set: {
                    paid: true,
                    paidAmount: payment.amount,
                    dayType: 'PAID',
                    cutOff: false,
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

        // Actualizar el pago con su invoiceId real
        await db.collection('payments').updateOne(
            { _id: payment._id },
            {
                $set: {
                    invoiceId: invoiceId,
                    unpaidInvoiceId: invoiceId,
                    used: true
                }
            }
        );

        console.log(`✅ Pago ${payment.reference} (${payment.amount}) -> Asignado a factura ${invoiceId}`);
    }

    // 4. Restaurar las facturas de Noviembre 12, 13, 14 a DEBT / impagas
    const pastNovInvoices = ['DRO88I-2026-11-12', 'DRO88I-2026-11-13', 'DRO88I-2026-11-14'];
    for (const invId of pastNovInvoices) {
        await db.collection('invoices').updateOne(
            { _id: invId },
            {
                $set: {
                    paid: false,
                    paidAmount: 0,
                    dayType: 'DEBT',
                    cutOff: false,
                    paymentDate: null,
                    transaction: null
                }
            }
        );
        console.log(`🔄 Factura ${invId} restaurada a estado DEBT (impaga)`);
    }

    // 5. Eliminar facturas futuras indebidas (Nov 16 al 21)
    const futureDeleteResult = await db.collection('invoices').deleteMany({
        deviceIdName: 'DRO88I',
        date: { $gte: new Date('2026-11-16T00:00:00.000Z') }
    });
    console.log(`🗑️ Facturas futuras eliminadas (>= 2026-11-16): ${futureDeleteResult.deletedCount}`);

    // 6. Recalcular progreso del contrato CIDRO88IKM
    // Contrato: dailyRate 35000. Sumar todas las facturas pagadas (excluyendo FREE)
    const paidInvoicesCount = await db.collection('invoices').countDocuments({
        contractId: 'CIDRO88IKM',
        paid: true,
        dayType: 'PAID'
    });
    const paidAmountTotal = paidInvoicesCount * 35000;

    await db.collection('contracts').updateOne(
        { contractId: 'CIDRO88IKM' },
        {
            $set: {
                paidDays: paidInvoicesCount,
                paidAmount: paidAmountTotal,
                remainingDays: Math.max(0, 500 - paidInvoicesCount)
            }
        }
    );
    console.log(`📊 Contrato CIDRO88IKM actualizado: paidDays=${paidInvoicesCount}, paidAmount=${paidAmountTotal}`);

    console.log('\n=== REASIGNACIÓN COMPLETADA EXITOSAMENTE ===');
    await mongoose.disconnect();
}

reassignDRO88IPayments().catch(console.error);

