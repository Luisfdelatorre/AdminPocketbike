import mongoose from 'mongoose';
import { MongoDB } from '../config/config.js';

async function checkMissing() {
    await mongoose.connect(MongoDB.URI);
    const db = mongoose.connection.db;

    const missing = await db.collection('invoices').find({
        contractId: { $in: [null, undefined, ''] }
    }).toArray();

    console.log(`Facturas sin contractId en toda la BD: ${missing.length}`);
    if (missing.length > 0) {
        console.log(missing.slice(0, 10).map(m => ({ plate: m.deviceIdName, date: m.date?.toISOString()?.slice(0,10), id: m._id })));
    }

    await mongoose.disconnect();
}

checkMissing().catch(console.error);

