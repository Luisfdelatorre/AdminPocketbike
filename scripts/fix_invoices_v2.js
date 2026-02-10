
import mongoose from 'mongoose';
import { Invoice } from '../server/models/Invoice.js';
import { connectDatabase } from '../server/database/connection.js';

async function run() {
    await connectDatabase();

    const deviceIdName = 'XZQ67H';

    console.log(`Checking invoices for ${deviceIdName}...`);
    // Find "broken" 10th
    const invoice10 = await Invoice.findOne({ _id: 'XZQ67H-2026-02-10' });
    let shouldOverwrite10 = false;

    if (!invoice10) {
        console.log('Invoice 10th MISSING. Will populate.');
        shouldOverwrite10 = true;
    } else {
        // Check if "broken"
        if (invoice10.paid && !invoice10.transaction?.id) {
            console.log('Invoice 10th BROKEN (paid but no tx). Will overwrite.');
            shouldOverwrite10 = true;
            // Delete the broken one first 
            await Invoice.deleteOne({ _id: invoice10._id });
        } else {
            console.log('Invoice 10th Valid (or unpaid).', invoice10);
        }
    }

    if (shouldOverwrite10) {
        const invoice11 = await Invoice.findOne({ _id: 'XZQ67H-2026-02-11' });
        const invoice12 = await Invoice.findOne({ _id: 'XZQ67H-2026-02-12' });

        if (invoice11 && invoice11.paid) {
            console.log('Moving 11th data to 10th...');

            const newId10 = 'XZQ67H-2026-02-10';
            // Keep the time buffer logic? Or simple date? 2026-02-10T12:00:00Z
            const newDate10 = new Date('2026-02-10T12:00:00Z');

            const invoice10Data = invoice11.toObject();
            invoice10Data._id = newId10;
            invoice10Data.date = newDate10;
            delete invoice10Data.__v;

            // Create new 10th
            await Invoice.create(invoice10Data);
            console.log(`Created ${newId10} from 11th data.`);

            // Delete 11th
            await Invoice.deleteOne({ _id: invoice11._id });
            console.log(`Deleted ${invoice11._id}.`);

            // Now check 12th -> 11th
            if (invoice12 && invoice12.paid) {
                console.log('Moving 12th data to 11th...');
                const newId11 = 'XZQ67H-2026-02-11';
                const newDate11 = new Date('2026-02-11T12:00:00Z');

                const invoice11Data = invoice12.toObject();
                invoice11Data._id = newId11;
                invoice11Data.date = newDate11;
                delete invoice11Data.__v;

                await Invoice.create(invoice11Data);
                console.log(`Created ${newId11} from 12th data.`);

                await Invoice.deleteOne({ _id: invoice12._id });
                console.log(`Deleted ${invoice12._id}.`);
            }
        } else {
            console.log('Invoice 11th not found or not paid. Cannot perform shift.');
        }
    }

    process.exit();
}

run().catch(err => console.error(err));
