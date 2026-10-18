import mongoose from 'mongoose';
import { MongoDB } from '../config/components/core.js';

async function updateCompanyTypes() {
    try {
        await mongoose.connect(MongoDB.URI);
        const db = mongoose.connection.db;
        const collection = db.collection('companies');

        // 1. Set type = 'system' for System company (nit '000000000' or name 'System')
        const systemRes = await collection.updateMany(
            { $or: [{ nit: '000000000' }, { name: 'System' }] },
            { $set: { type: 'system' } }
        );
        console.log(`Updated system companies: ${systemRes.modifiedCount}`);

        // 2. Set type = 'company' for all other companies where type is not set or not 'system'
        const companyRes = await collection.updateMany(
            { type: { $ne: 'system' } },
            { $set: { type: 'company' } }
        );
        console.log(`Updated client companies: ${companyRes.modifiedCount}`);

        // 3. Verify
        const allCompanies = await collection.find({}, { projection: { name: 1, nit: 1, type: 1 } }).toArray();
        console.log('Current companies in DB:', allCompanies);
    } catch (err) {
        console.error('Error updating company types:', err);
    } finally {
        await mongoose.disconnect();
    }
}

updateCompanyTypes();
