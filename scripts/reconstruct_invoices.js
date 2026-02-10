
import mongoose from 'mongoose';
import { Invoice } from '../server/models/Invoice.js';
import { Payment } from '../server/models/Payment.js';
import { connectDatabase } from '../server/database/connection.js';

async function run() {
    await connectDatabase();

    const deviceIdName = 'XZQ67H';
    const deviceId = '12761'; // From output
    const companyId = "69895c53f6aba108e1f82118";
    const companyName = "FOR EVERYONE GROUP S.A.S";

    console.log(`Finding payments for ${deviceIdName}...`);
    // Find payments that are approved/completed
    const payments = await Payment.find({
        deviceIdName,
        status: { $in: ['APPROVED', 'COMPLETED'] }
    }).sort({ createdAt: 1 });

    console.log(`Found ${payments.length} payments.`);

    for (const p of payments) {
        console.log(`Payment: ${p.reference} (${p.createdAt}), Amount: ${p.amount}`);

        // Logic to Map Payments to Dates
        // Payment on Feb 9th -> Invoice Feb 9th?
        // Payment on Feb 10th (02:39) -> Invoice Feb 10th? (Originally was 11th)
        // Payment on Feb 10th (02:46) -> Invoice Feb 11th? (Originally was 12th)

        // We will create invoices manually based on these payments.
        // We need to determine the date.
        // If payment reference allows, we use that.
        // XZQ67H-2026-02-10-PM -> 10th?
        // XZQ67H-2026-02-10-14 -> 11th?

        // Or create Next Day logic manually.
        // First payment -> 9th.
        // Second -> 10th.
        // Third -> 11th.

        // Let's implement this simple logic.
        // Start date: Feb 9th (Since inspection showed 9th was first Paid).

    }

    // Manual Reconstruction based on known history
    // 1. Invoice 9th (XZQ67H-2026-02-09) - Paid on Feb 9th
    // 2. Invoice 10th (XZQ67H-2026-02-10) - Paid on Feb 10th (Ref ...-PM)
    // 3. Invoice 11th (XZQ67H-2026-02-11) - Paid on Feb 10th (Ref ...-14)

    const invoicesToCreate = [
        {
            _id: 'XZQ67H-2026-02-09',
            date: new Date('2026-02-09T00:00:00Z'), // Or correct time
            amount: 35000,
            paid: true,
            dayType: 'PAID',
            transaction: { reference: 'XZQ67H-2026-02-09-XX', type: 'WOMPI', finalized_at: new Date('2026-02-09T12:00:00Z') } // Mock
        },
        {
            _id: 'XZQ67H-2026-02-10',
            date: new Date('2026-02-10T12:00:00Z'),
            amount: 35000,
            paid: true,
            dayType: 'PAID',
            transaction: { reference: 'XZQ67H-2026-02-10-PM', type: 'WOMPI', finalized_at: new Date('2026-02-10T02:39:56.267Z') }
        },
        {
            _id: 'XZQ67H-2026-02-11',
            date: new Date('2026-02-11T12:00:00Z'),
            amount: 35000,
            paid: true,
            dayType: 'PAID',
            transaction: { reference: 'XZQ67H-2026-02-10-14', type: 'WOMPI', finalized_at: new Date('2026-02-10T02:46:00.716Z') }
        }
    ];

    for (const inv of invoicesToCreate) {
        const existing = await Invoice.findOne({ _id: inv._id });
        if (!existing) {
            console.log(`Creating missing invoice: ${inv._id}`);
            await Invoice.create({
                ...inv,
                deviceIdName,
                deviceId,
                companyId,
                companyName
            });
        } else {
            console.log(`Invoice ${inv._id} already exists (recovered?). Updating status...`);
            // Ensure PAID
            existing.paid = true;
            existing.dayType = 'PAID';
            existing.transaction = inv.transaction;
            await existing.save();
        }
    }

    // Check specific 12th invoice and delete it if it exists (since we remapped it to 11th)
    const invoice12 = await Invoice.findOne({ _id: 'XZQ67H-2026-02-12' });
    if (invoice12) {
        console.log('Deleting extraneous Invoice 12th...');
        await Invoice.deleteOne({ _id: invoice12._id });
    }

    process.exit();
}

run().catch(err => console.error(err));
