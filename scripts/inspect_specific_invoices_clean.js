
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

    console.log('10th Details:');
    if (invoice10) console.log(JSON.stringify(invoice10, null, 2));
    else console.log('10th: MISSING');

    console.log('11th Details:');
    if (invoice11) console.log(JSON.stringify(invoice11, null, 2));
    else console.log('11th: MISSING');

    console.log('12th Details:');
    if (invoice12) console.log(JSON.stringify(invoice12, null, 2));
    else console.log('12th: MISSING');

    process.exit();
}

run().catch(err => console.error(err));
