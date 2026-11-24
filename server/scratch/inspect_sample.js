import mongoose from 'mongoose';
import { MongoDB } from '../config/config.js';

async function main() {
    await mongoose.connect(MongoDB.URI, { serverSelectionTimeoutMS: 5000 });
    const db = mongoose.connection.db;

    const sampleInv = await db.collection('invoices').findOne({ _id: 'IFX22I-2026-11-13' });
    console.log('Sample Invoice (IFX22I-2026-11-13):', JSON.stringify(sampleInv, null, 2));

    const samplePayment = await db.collection('payments').findOne({ reference: 'IFX22I-2026-11-13-ZF' });
    console.log('Sample Payment (IFX22I-2026-11-13-ZF):', JSON.stringify(samplePayment, null, 2));

    await mongoose.disconnect();
}

main().catch(console.error);

