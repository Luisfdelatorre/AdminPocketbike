import mongoose from 'mongoose';
import { MongoDB } from '../config/config.js';

async function updateTheTwoPayments() {
    await mongoose.connect(MongoDB.URI);
    const db = mongoose.connection.db;

    // 1. IFJ93I
    const ifjDate = new Date('2026-11-12T15:22:03.821Z');
    await db.collection('payments').updateOne(
        { _id: '1362970-1794496020-33257' },
        {
            $set: {
                status: 'APPROVED',
                finalized_at: ifjDate,
                used: true,
                updatedAt: new Date()
            }
        }
    );
    await db.collection('invoices').updateOne(
        { _id: 'IFJ93I-2026-11-11' },
        {
            $set: {
                paid: true,
                'transaction.finalized_at': ifjDate,
                paymentDate: ifjDate
            }
        }
    );
    console.log('✅ IFJ93I sincronizado con éxito');

    // 2. XZQ63H
    const xzqDate = new Date('2026-11-12T23:47:28.691Z');
    await db.collection('payments').updateOne(
        { _id: '1362970-1794525444-33423' },
        {
            $set: {
                status: 'APPROVED',
                finalized_at: xzqDate,
                used: true,
                updatedAt: new Date()
            }
        }
    );
    await db.collection('invoices').updateOne(
        { _id: 'XZQ63H-2026-11-12' },
        {
            $set: {
                paid: true,
                'transaction.finalized_at': xzqDate,
                paymentDate: xzqDate
            }
        }
    );
    console.log('✅ XZQ63H sincronizado con éxito');

    await mongoose.disconnect();
}

updateTheTwoPayments().catch(console.error);

