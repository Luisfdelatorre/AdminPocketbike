
import mongoose from 'mongoose';
import { Invoice } from '../server/models/Invoice.js';
import { connectDatabase } from '../server/database/connection.js';

async function run() {
    await connectDatabase();

    // Replace with the device ID from the user's screenshot/logs
    const deviceIdName = 'XZQ67H';

    console.log(`Finding invoices for ${deviceIdName}...`);
    const invoices = await Invoice.find({ deviceIdName }).sort({ date: 1 });

    console.log(`Found ${invoices.length} invoices:`);
    invoices.forEach(inv => {
        console.log(`ID: ${inv._id}, Date: ${inv.date.toISOString()}, Paid: ${inv.paid}, DayType: ${inv.dayType}, CreatedAt: ${inv.createdAt || 'N/A'}`);
    });

    // Also check findLastUnPaid
    const lastUnpaid = await Invoice.findOne({ deviceIdName, paid: false }).sort({ date: 1 });
    console.log('---');
    console.log('findLastUnPaid result:', lastUnpaid ? lastUnpaid._id : 'null');

    // Check findLastPaid
    const lastPaid = await Invoice.findOne({ deviceIdName, paid: true }).sort({ date: -1 });
    console.log('findLastPaid result:', lastPaid ? lastPaid._id : 'null');

    process.exit();
}

run().catch(err => console.error(err));
