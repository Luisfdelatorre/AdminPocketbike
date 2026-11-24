import mongoose from 'mongoose';
import { MongoDB } from '../config/config.js';

async function main() {
    await mongoose.connect(MongoDB.URI, { serverSelectionTimeoutMS: 5000 });
    const db = mongoose.connection.db;

    // Buscar todas las facturas de esta semana (>= 2026-11-09) que estén pagadas
    const startOfWeek = new Date('2026-11-09T00:00:00.000Z');

    const invoices = await db.collection('invoices').find({
        date: { $gte: startOfWeek },
        paid: true
    }).sort({ date: 1, deviceIdName: 1 }).toArray();

    const affected = [];

    for (const inv of invoices) {
        const txFinalized = inv.transaction?.finalized_at;
        // Si no tiene finalized_at
        if (!txFinalized) {
            // Buscar el pago correspondiente
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

            affected.push({
                plate: inv.deviceIdName,
                invoiceId: inv._id,
                invoiceDate: inv.date?.toISOString()?.slice(0, 10),
                amount: inv.amount,
                paidAmount: inv.paidAmount,
                dayType: inv.dayType,
                txRef: txRef || payment?.reference,
                invFinalizedAt: txFinalized,
                paymentFinalizedAt: payment?.finalized_at ? payment.finalized_at.toISOString() : (payment?.finalized_at || 'NO_FINALIZED_AT_EN_PAYMENT'),
                paymentId: payment?._id || txId,
                paymentFound: !!payment
            });
        }
    }

    console.log(`=== TOTAL FACTURAS DE ESTA SEMANA PAGADAS CON finalized_at NULO: ${affected.length} ===`);
    console.log(JSON.stringify(affected, null, 2));

    await mongoose.disconnect();
}

main().catch(console.error);

