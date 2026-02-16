
import mongoose from 'mongoose';
import dotenv from 'dotenv';
import cronJobsServices from '../server/services/cronJobsServices.js';
import { Device } from '../server/models/Device.js';
import { Company } from '../server/models/Company.js';
import { Invoice } from '../server/models/Invoice.js';
import logger from '../server/config/logger.js';

dotenv.config();

import { connectDatabase } from '../server/database/connection.js';

const testAutomation = async () => {
    try {
        console.log(`--- STARTING AUTOMATION TEST FOR YAG19H ---`);

        await connectDatabase();
        console.log('✅ Connected to MongoDB');

        const deviceId = '69820474ccab39e9a27b6645'; // YAG19H
        const testDevice = await Device.findById(deviceId);

        if (!testDevice) {
            console.error('❌ Test device YAG19H not found in DB!');
            process.exit(1);
        }
        console.log(`✅ Found Device: ${testDevice.name} (hasActiveContract: ${testDevice.hasActiveContract})`);

        // 1. Test Invoicing
        console.log('\nStep 1: Running generateDailyInvoices...');
        await cronJobsServices.generateDailyInvoices();
        console.log('✅ generateDailyInvoices execution finished.');

        // Check if invoice was created for YAG19H
        const dayjs = (await import('dayjs')).default;
        const today = dayjs().startOf('day').toDate();
        const inv = await Invoice.findOne({ deviceIdName: 'YAG19H', date: today });

        if (inv) {
            console.log(`✅ Invoice created for YAG19H: ID=${inv._id}, Amount=${inv.amount}, Paid=${inv.paid}`);
        } else {
            console.error('❌ Invoice NOT created for YAG19H!');
        }

        // 2. Test Cut-Off
        console.log('\nStep 2: Running performDailyCutOff...');

        await cronJobsServices.performDailyCutOff();
        console.log('✅ performDailyCutOff execution finished.');

        // Final check
        const updatedDevice = await Device.findById(deviceId);
        console.log(`\nFinal Device Status: cutOff=${updatedDevice.cutOff} (Expected 1 or 2 if GPS command sent)`);

        console.log('\n--- TEST COMPLETED ---');
        process.exit(0);
    } catch (error) {
        console.error('Test failed:', error);
        process.exit(1);
    }
};

testAutomation();
