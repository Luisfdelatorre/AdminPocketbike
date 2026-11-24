import mongoose from 'mongoose';
import { MongoDB } from '../config/config.js';

async function main() {
    await mongoose.connect(MongoDB.URI, { serverSelectionTimeoutMS: 5000 });
    const db = mongoose.connection.db;

    const startOfWeek = new Date('2026-11-09T00:00:00.000Z');

    const invoices = await db.collection('invoices').find({
        date: { $gte: startOfWeek },
        paid: true,
        $or: [
            { 'transaction.finalized_at': null },
            { 'transaction.finalized_at': { $exists: false } }
        ]
    }).sort({ deviceIdName: 1, date: 1 }).toArray();

    const byPlate = {};
    for (const inv of invoices) {
        const plate = inv.deviceIdName;
        if (!byPlate[plate]) {
            byPlate[plate] = [];
        }

        // Buscar payment
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

        byPlate[plate].push({
            invoiceId: inv._id,
            invoiceDate: inv.date?.toISOString()?.slice(0, 10),
            amount: inv.amount,
            paidAmount: inv.paidAmount,
            txRef: txRef || payment?.reference,
            paymentFinalizedAt: payment?.finalized_at || 'NO_EN_PAYMENT'
        });
    }

    const summary = Object.entries(byPlate).map(([plate, list]) => ({
        plate,
        count: list.length,
        invoices: list
    })).sort((a, b) => b.count - a.count);

    console.log(`Motos afectadas: ${summary.length}`);
    console.log(`Total facturas afectadas: ${invoices.length}`);
    console.log(JSON.stringify(summary, null, 2));

    await mongoose.disconnect();
}

main().catch(console.error);

