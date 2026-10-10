import mongoose from 'mongoose';
import { Device } from '../models/Device.js';
import { Company } from '../models/Company.js';
import { Contract } from '../models/Contract.js';

async function checkDetails() {
    try {
        await mongoose.connect('mongodb://127.0.0.1:27018/pocketbike');

        const device = await Device.findById(131).lean() || await Device.findOne({ $or: [{ _id: '131' }, { id: 131 }] }).lean();
        console.log('--- DEVICE 131 DETAILS ---');
        console.log(device);

        const activeContract = await Contract.findOne({
            $or: [
                { deviceId: device._id },
                { deviceId: '131' },
                { deviceIdName: device.name },
                { deviceIdName: device.plate }
            ]
        }).lean();
        console.log('\n--- ACTIVE CONTRACT FOR DEVICE 131 ---');
        console.log(activeContract);

        const companies = await Company.find({}).lean();
        console.log('\n--- COMPANIES IN DB ---');
        companies.forEach(c => {
            console.log(`Company ID: ${c._id}, Name: ${c.name}, gpsService: ${c.gpsService}, gpsConfig:`, c.gpsConfig);
        });

    } catch (e) {
        console.error(e);
    } finally {
        await mongoose.disconnect();
    }
}

checkDetails();
