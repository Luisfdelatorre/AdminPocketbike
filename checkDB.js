import mongoose from 'mongoose';
import { Device } from './server/models/Device.js';
import { Contract } from './server/models/Contract.js';
import { Invoice } from './server/models/Invoice.js';
import { connectDatabase } from './server/database/connection.js';

async function check() {
    await connectDatabase();

    const device = await Device.findOne({ name: 'XZQ63H' });
    console.log('Device found:', device ? 'Yes' : 'No');
    if (device) {
        console.log('hasActiveContract:', device.hasActiveContract);
        const contract = await Contract.findOne({ deviceId: device._id });
        console.log('Contract:', contract);

        const company = await mongoose.model('Company').findById(device.companyId);
        console.log('Company Name:', company?.name);
        console.log('automaticCutOff:', company?.automaticCutOff);
        console.log('cutOffStrategy:', company?.cutOffStrategy);
        const invoices = await Invoice.find({ deviceIdName: 'XZQ63H' });
        console.log('Invoices count:', invoices.length, 'Paid:', invoices[0]?.paid, 'Date:', invoices[0]?.date);
    }

    process.exit(0);
}

check().catch(console.error);
