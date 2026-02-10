
import mongoose from 'mongoose';
import { Invoice } from '../server/models/Invoice.js';
import { connectDatabase } from '../server/database/connection.js';

async function run() {
    await connectDatabase();

    const deviceIdName = 'XZQ67H';

    console.log(`Checking invoices for ${deviceIdName}...`);
    // Find missing 10th
    const invoice10 = await Invoice.findOne({ _id: 'XZQ67H-2026-02-10' });
    if (!invoice10) {
        console.log('Invoice for 10th MISSING. Checking 11th and 12th...');
        const invoice11 = await Invoice.findOne({ _id: 'XZQ67H-2026-02-11' });
        const invoice12 = await Invoice.findOne({ _id: 'XZQ67H-2026-02-12' });

        if (invoice11 && invoice11.paid) {
            console.log('Invoice 11th Found and PAID. Moving it to 10th?');
            // If 11th is paid, it likely means it covered the debt of the 10th but got categorized as 11th.
            // We can rename it to 10th to fill the gap.
            const newId10 = 'XZQ67H-2026-02-10';
            const newDate10 = new Date('2026-02-10T12:00:00Z'); // Or 00:00 depending on your system, usually 12:00 for nextDay

            // Create new copy for 10th with same data
            const invoice10Data = invoice11.toObject();
            invoice10Data._id = newId10;
            invoice10Data.date = newDate10;
            delete invoice10Data.__v;

            await Invoice.create(invoice10Data);
            console.log(`Created ${newId10} from 11th data.`);

            // Delete 11th
            await Invoice.deleteOne({ _id: invoice11._id });
            console.log(`Deleted ${invoice11._id}.`);

            // Now handle 12th -> 11th if needed?
            if (invoice12) {
                console.log('Invoice 12th Found. Moving to 11th...');
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
            console.log('Invoice 11th not found or not paid. No action taken.');
        }
    } else {
        console.log('Invoice 10th ALREADY EXISTS. No action needed.');
    }

    process.exit();
}

run().catch(err => console.error(err));
