import mongoose from 'mongoose';
import { MongoDB } from '../config/config.js';

async function main() {
    await mongoose.connect(MongoDB.URI);
    const db = mongoose.connection.db;

    const count = await db.collection('invoices').countDocuments({
        date: { $gte: new Date('2026-11-09T00:00:00.000Z') },
        paid: true,
        $or: [
            { 'transaction.finalized_at': null },
            { 'transaction.finalized_at': { $exists: false } }
        ]
    });

    console.log('Facturas pendientes de esta semana con finalized_at nulo:', count);
    await mongoose.disconnect();
}

main().catch(console.error);

