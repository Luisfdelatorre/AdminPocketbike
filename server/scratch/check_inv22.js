import mongoose from 'mongoose';
import { MongoDB } from '../config/config.js';

async function main() {
    await mongoose.connect(MongoDB.URI);
    const db = mongoose.connection.db;

    const inv22 = await db.collection('invoices').findOne({ _id: 'PMQ44I-2026-11-22' });
    console.log('Invoice 22:', JSON.stringify(inv22, null, 2));

    const allPayments = await db.collection('payments').find({
        deviceIdName: 'PMQ44I'
    }).sort({ created_at: 1 }).toArray();

    console.log('\n--- ALL PMQ44I PAYMENTS (Total: ' + allPayments.length + ') ---');
    allPayments.forEach(p => {
        console.log(`Ref: ${p.reference} | Status: ${p.status} | Amount: ${p.amount} | Created: ${p.created_at || p.createdAt} | finalized_at: ${p.finalized_at} | unpaidInvoiceId: ${p.unpaidInvoiceId}`);
    });

    await mongoose.disconnect();
}

main();
