import mongoose from 'mongoose';
import { MongoDB } from '../config/config.js';

async function check4() {
    await mongoose.connect(MongoDB.URI);
    const db = mongoose.connection.db;
    const invs = await db.collection('invoices').find({ date: { $gte: new Date('2026-11-16T00:00:00.000Z') } }).toArray();
    console.log(invs.map(i => ({ id: i._id, plate: i.deviceIdName, date: i.date?.toISOString()?.slice(0, 10), paid: i.paid, contractId: i.contractId })));
    await mongoose.disconnect();
}
check4().catch(console.error);

