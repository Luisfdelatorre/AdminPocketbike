import mongoose from 'mongoose';
import { Device } from '../models/Device.js';
import { Company } from '../models/Company.js';

async function checkDevice() {
    try {
        await mongoose.connect('mongodb://127.0.0.1:27018/pocketbike');
        console.log('Connected to DB');

        const allDevs = await Device.find({}).lean();
        console.log('Sample devices in DB:');
        allDevs.slice(0, 10).forEach(d => {
            console.log(`_id: ${d._id}, name: ${d.name}, gpsId: ${d.gpsId}, companyId: ${d.companyId}`);
        });

        // Search for device with ID 131
        const found = allDevs.find(d => String(d._id) === '131' || String(d.gpsId) === '131' || String(d.name).includes('131'));
        console.log('\nFound matching device:', found);

        if (found && found.companyId) {
            const comp = await Company.findById(found.companyId).lean();
            console.log('\nCompany details:', {
                _id: comp._id,
                name: comp.name,
                gpsService: comp.gpsService,
                gpsConfig: comp.gpsConfig
            });
        }

    } catch (e) {
        console.error('Error:', e);
    } finally {
        await mongoose.disconnect();
    }
}

checkDevice();
