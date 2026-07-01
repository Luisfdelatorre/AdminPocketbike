import mongoose from 'mongoose';
import { connectDatabase } from './server/database/connection.js';
import { Device } from './server/models/Device.js';

async function run() {
    await connectDatabase();

    const names = ['DQR57I', 'DQV73I', 'DQY62I'];
    const devices = await Device.find({ name: { $in: names } });

    console.log('Devices found:');
    devices.forEach(d => {
        console.log(`- _id: ${d._id}, name: ${d.name}, gpsId: ${d.gpsId}, traccarId: ${d.traccarId}, cutOff: ${d.cutOff}, isDeleted: ${d.isDeleted}`);
    });

    await mongoose.disconnect();
}

run().catch(console.error);
