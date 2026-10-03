import 'dotenv/config';
import mongoose from 'mongoose';
import { SystemJob } from '../models/SystemJob.js';
import * as config from '../config/config.js';

const seedData = [
    {
        name: 'textMessage',
        time: '0 9 * * *',
        log: 'Call Message at 9',
        flag: false,
        job: 'sendTextMessage',
    },
    {
        name: 'dailyInvoicesCreation',
        time: '1 0 * * *',
        log: 'Call one time a day payment creation',
        flag: true,
        job: 'generateDailyInvoices',
    },
    {
        name: 'dailyPaymentValidation',
        time: '*/5 * * * *',
        log: 'Call payment validation every 5 minutes',
        flag: true,
        job: 'validatePayments',
    },
    {
        name: 'periodicDeviceStatusReview',
        time: '0,30 * * * *',
        log: 'Call Device Status Review every 30 minutes',
        flag: false,
        job: 'DeviceStatusUpdate',
    },
    {
        name: 'syncDailyKm',
        time: '59 23 * * *',
        log: 'Call one time a day daily km sync at 23:59',
        flag: true,
        job: 'syncDailyKm',
    },
];

const seedDB = async () => {
    try {
        await mongoose.connect(config.MongoDB.URI);
        console.log('Connected to DB');

        for (const job of seedData) {
            await SystemJob.findOneAndUpdate(
                { job: job.job }, // find by job function to avoid duplicate entries with same name
                {
                    name: job.name,
                    time: job.time,
                    log: job.log,
                    flag: job.flag,
                    job: job.job
                },
                { upsert: true, new: true }
            );
            console.log(`Upserted SystemJob: ${job.name}`);
        }

        console.log('Seeding complete.');
        process.exit(0);
    } catch (err) {
        console.error('Error seeding DB:', err);
        process.exit(1);
    }
};

seedDB();
