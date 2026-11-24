import mongoose from 'mongoose';
import { MongoDB } from '../config/config.js';

async function main() {
    await mongoose.connect(MongoDB.URI);
    const db = mongoose.connection.db;

    const invoices = await db.collection('invoices').find({
        _id: { $in: ['PMQ44I-2026-11-21', 'PMQ44I-2026-11-22', 'PMQ44I-2026-11-23'] }
    }).toArray();

    console.log('--- INVOICES 21, 22, 23 ---');
    console.log(JSON.stringify(invoices, null, 2));

    const payments = await db.collection('payments').find({
        $or: [
            { reference: 'PMQ44I-2026-11-21-IT' },
            { reference: 'PMQ44I-2026-11-22-BR' },
            { reference: 'PMQ44I-2026-11-23-8H' }
        ]
    }).toArray();

    console.log('\n--- PAYMENTS ---');
    console.log(JSON.stringify(payments, null, 2));

    await mongoose.disconnect();
}

main();
