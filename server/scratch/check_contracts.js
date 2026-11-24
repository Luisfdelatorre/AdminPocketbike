import mongoose from 'mongoose';
import { MongoDB } from '../config/config.js';

async function main() {
    await mongoose.connect(MongoDB.URI, { serverSelectionTimeoutMS: 5000 });
    const db = mongoose.connection.db;

    const devices = await db.collection('devices').find({}).sort({ name: 1 }).toArray();
    const activeContracts = await db.collection('contracts').find({ status: 'ACTIVE' }).toArray();
    const activePlates = new Set(activeContracts.map(c => c.deviceIdName));

    const withoutActiveContract = devices.filter(d => !activePlates.has(d.name)).map(d => d.name);

    console.log('Without active contract:', withoutActiveContract);
    await mongoose.disconnect();
}

main().catch(console.error);

