import mongoose from 'mongoose';
import { connectDatabase } from '../database/connection.js';
import { Invoice } from '../models/Invoice.js';

async function fixFreeInvoices() {
    try {
        await connectDatabase();
        console.log('Connected to DB:', mongoose.connection.name);

        const filter = { dayType: 'FREE', amount: { $ne: 0 } };
        const countBefore = await Invoice.countDocuments(filter);
        console.log(`Invoices to update: ${countBefore}`);

        if (countBefore === 0) {
            console.log('No invoices require updating.');
            return;
        }

        const result = await Invoice.updateMany(
            filter,
            { $set: { amount: 0, paidAmount: 0, paid: true } }
        );

        console.log('Update result:', {
            matchedCount: result.matchedCount,
            modifiedCount: result.modifiedCount,
            acknowledged: result.acknowledged
        });

        const countAfter = await Invoice.countDocuments(filter);
        console.log(`Remaining invoices with dayType FREE and amount != 0: ${countAfter}`);

        const totalFreeWithZero = await Invoice.countDocuments({ dayType: 'FREE', amount: 0 });
        console.log(`Total FREE invoices with amount == 0 now: ${totalFreeWithZero}`);

    } catch (err) {
        console.error('Error executing update:', err);
    } finally {
        await mongoose.disconnect();
    }
}

fixFreeInvoices();
