
import mongoose from 'mongoose';
import { Invoice } from '../server/models/Invoice.js';
import { connectDatabase } from '../server/database/connection.js';

async function run() {
    await connectDatabase();

    // Replace with the device ID from the user's screenshot/logs
    const deviceIdName = 'XZQ67H';

    console.log(`Checking SPECIFIC invoice for ${deviceIdName}...`);
    const invoice10 = await Invoice.findOne({ _id: 'XZQ67H-2026-02-10' });
    const invoice11 = await Invoice.findOne({ _id: 'XZQ67H-2026-02-11' });
    const invoice12 = await Invoice.findOne({ _id: 'XZQ67H-2026-02-12' });

    console.log('10th:', invoice10);
    console.log('11th:', invoice11);
    console.log('12th:', invoice12);

    process.exit();
}

run().catch(err => console.error(err));
