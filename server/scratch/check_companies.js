import mongoose from 'mongoose';
import { Company } from '../models/Company.js';

async function checkCompanies() {
    try {
        await mongoose.connect('mongodb://127.0.0.1:27018/pocketbike');
        const db = mongoose.connection.db;
        const collections = await db.listCollections().toArray();
        console.log('Collections in DB:', collections.map(c => c.name));

        const compColl = await db.collection('companies').find({}).toArray();
        console.log('Raw companies collection count:', compColl.length);
        console.log('Raw companies:', compColl);
    } catch (e) {
        console.error(e);
    } finally {
        await mongoose.disconnect();
    }
}

checkCompanies();
