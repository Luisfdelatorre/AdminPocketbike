import mongoose from 'mongoose';
import { MongoDB } from '../config/config.js';

async function main() {
    await mongoose.connect(MongoDB.URI);
    const db = mongoose.connection.db;

    const p1 = await db.collection('payments').findOne({
        $or: [{ _id: '1362970-1794496020-33257' }, { reference: 'IFJ93I-2026-11-11-JS' }]
    });
    const p2 = await db.collection('payments').findOne({
        $or: [{ _id: '1362970-1794525444-33423' }, { reference: 'XZQ63H-2026-11-10-EI' }]
    });

    console.log('Payment 1:', p1 ? { _id: p1._id, status: p1.status, finalized_at: p1.finalized_at, reference: p1.reference } : 'NOT FOUND');
    console.log('Payment 2:', p2 ? { _id: p2._id, status: p2.status, finalized_at: p2.finalized_at, reference: p2.reference } : 'NOT FOUND');

    await mongoose.disconnect();
}

main().catch(console.error);

