import mongoose from 'mongoose';
import { MongoDB } from '../config/config.js';

async function main() {
    await mongoose.connect(MongoDB.URI);
    const db = mongoose.connection.db;

    const invoices = await db.collection('invoices').find({
        deviceIdName: 'PMQ44I'
    }).sort({ date: 1 }).toArray();

    console.log(`Total invoices for PMQ44I: ${invoices.length}`);
    invoices.forEach(inv => {
        console.log({
            _id: inv._id,
            date: inv.date,
            amount: inv.amount,
            paid: inv.paid,
            dayType: inv.dayType,
            txId: inv.transaction?.id,
            txRef: inv.transaction?.reference,
            txType: inv.transaction?.type,
            finalized_at: inv.transaction?.finalized_at
        });
    });

    await mongoose.disconnect();
}

main();
