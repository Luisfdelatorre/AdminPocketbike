import mongoose from 'mongoose';
import { MongoDB } from '../config/config.js';

async function main() {
    await mongoose.connect(MongoDB.URI, { serverSelectionTimeoutMS: 5000 });
    const db = mongoose.connection.db;

    const total = await db.collection('devices').countDocuments();
    const cutOffOn = await db.collection('devices').countDocuments({ cutOff: true });
    const cutOffOff = await db.collection('devices').countDocuments({ cutOff: false });

    const byCompany = await db.collection('devices').aggregate([
        {
            $lookup: {
                from: 'companies',
                localField: 'companyId',
                foreignField: '_id',
                as: 'company'
            }
        },
        { $unwind: { path: '$company', preserveNullAndEmptyArrays: true } },
        {
            $group: {
                _id: { companyId: '$companyId', name: '$company.name' },
                totalMotos: { $sum: 1 },
                apagadas: { $sum: { $cond: [{ $eq: ['$cutOff', true] }, 1, 0] } },
                encendidas: { $sum: { $cond: [{ $eq: ['$cutOff', false] }, 1, 0] } }
            }
        },
        { $sort: { totalMotos: -1 } }
    ]).toArray();

    const activeContracts = await db.collection('contracts').countDocuments({ status: 'ACTIVE' });
    const totalContracts = await db.collection('contracts').countDocuments();

    // List of plate names
    const company = await db.collection('companies').findOne({ _id: new mongoose.Types.ObjectId('698c0c6c08d205baad1d206b') });
    console.log('Company Name:', company?.name, 'ID:', company?._id);

    const cutOffDist = await db.collection('devices').aggregate([
        { $group: { _id: '$cutOff', count: { $sum: 1 } } }
    ]).toArray();
    console.log('cutOff distribution:', cutOffDist);

    console.log(JSON.stringify({
        totalDevices: total,
        encendidas: cutOffOff,
        apagadas: cutOffOn,
        totalContracts,
        activeContracts,
        byCompany,
        samplePlates: devices.map(d => d.name)
    }, null, 2));

    await mongoose.disconnect();
}

main().catch(console.error);
