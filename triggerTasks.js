import mongoose from 'mongoose';
import cronJobsServices from './server/services/cronJobsServices.js';
import { connectDatabase } from './server/database/connection.js';

async function runTriggers() {
    console.log('--- CONNECTING TO DB ---');
    await connectDatabase();

    console.log('\n--- 1. GENERATING DAILY INVOICES ---');
    await cronJobsServices.generateDailyInvoices();

    console.log('\n--- 2. PERFORMING DAILY CUT-OFF ---');
    await cronJobsServices.performDailyCutOff();

    console.log('\n--- DONE ---');
    process.exit(0);
}

runTriggers().catch(console.error);
