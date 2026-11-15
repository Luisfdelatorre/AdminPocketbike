import mongoose from 'mongoose';
import { MongoDB } from '../config/config.js';

async function reconcileInvoices() {
    console.log('Iniciando conexión a MongoDB:', MongoDB.URI);
    await mongoose.connect(MongoDB.URI, { serverSelectionTimeoutMS: 5000 });
    const db = mongoose.connection.db;

    const startOfWeek = new Date('2026-11-09T00:00:00.000Z');

    console.log('Buscando facturas de esta semana con finalized_at nulo...');
    const invoices = await db.collection('invoices').find({
        date: { $gte: startOfWeek },
        paid: true,
        $or: [
            { 'transaction.finalized_at': null },
            { 'transaction.finalized_at': { $exists: false } }
        ]
    }).sort({ deviceIdName: 1, date: 1 }).toArray();

    console.log(`Total facturas encontradas: ${invoices.length}`);

    let updatedCount = 0;
    let skippedCount = 0;
    const updateLogs = [];

    for (const inv of invoices) {
        const txId = inv.transaction?.id;
        const txRef = inv.transaction?.reference;

        const payment = await db.collection('payments').findOne({
            $or: [
                { _id: txId },
                { paymentId: txId },
                { reference: txRef },
                { unpaidInvoiceId: inv._id },
                { invoiceId: inv._id }
            ],
            status: { $in: ['APPROVED', 'S_APPROVED'] }
        });

        if (payment && payment.finalized_at) {
            const finalizedAtDate = new Date(payment.finalized_at);

            await db.collection('invoices').updateOne(
                { _id: inv._id },
                {
                    $set: {
                        'transaction.finalized_at': finalizedAtDate,
                        paymentDate: finalizedAtDate
                    }
                }
            );

            updatedCount++;
            updateLogs.push({
                status: 'UPDATED',
                invoiceId: inv._id,
                plate: inv.deviceIdName,
                invoiceDate: inv.date?.toISOString()?.slice(0, 10),
                txRef: txRef || payment.reference,
                finalizedAt: finalizedAtDate.toISOString()
            });
            console.log(`[ACTUALIZADA] ${inv._id} (${inv.deviceIdName}) -> finalized_at: ${finalizedAtDate.toISOString()}`);
        } else {
            skippedCount++;
            updateLogs.push({
                status: 'SKIPPED',
                invoiceId: inv._id,
                plate: inv.deviceIdName,
                reason: payment ? 'Pago no tiene finalized_at' : 'Pago aprobado no encontrado'
            });
            console.warn(`[OMITIDA] ${inv._id} (${inv.deviceIdName}) -> ${payment ? 'Pago sin finalized_at' : 'Sin pago encontrado'}`);
        }
    }

    console.log('\n=============================================');
    console.log(`RESUMEN DE CONCILIACIÓN:`);
    console.log(`Total facturas evaluadas: ${invoices.length}`);
    console.log(`Total actualizadas exitosamente: ${updatedCount}`);
    console.log(`Total omitidas: ${skippedCount}`);
    console.log('=============================================\n');

    await mongoose.disconnect();
}

reconcileInvoices().catch(err => {
    console.error('Error durante la conciliación:', err);
    process.exit(1);
});

