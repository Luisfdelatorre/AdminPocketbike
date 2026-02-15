import { connectDatabase, disconnectDatabase } from '../server/database/connection.js';
import { Payment } from '../server/models/index.js';
import mongoose from 'mongoose';
import dayjs from 'dayjs';

async function inspectPayments() {
    try {
        await connectDatabase();

        const deviceName = 'XZQ78H';
        const dateStr = '2026-02-14';

        // Find all payments for this device and date (using the same logic as the aggregation usually would catch)
        // The aggregation uses invoiceDate
        const start = dayjs(dateStr).startOf('day').toDate();
        const end = dayjs(dateStr).endOf('day').toDate();

        console.log(`Searching payments for ${deviceName} with finalized_at between ${start} and ${end}`);

        const payments = await Payment.find({
            deviceIdName: deviceName,
            finalized_at: { $gte: start, $lte: end }
        }).lean();

        console.log(`Found ${payments.length} payments:`);
        payments.forEach((p, index) => {
            console.log(`[${index}] ID: ${p._id}, Amount: ${p.amount}, Status: ${p.status}, Type: ${p.type}, CreatedAt: ${p.createdAt}`);
        });

    } catch (error) {
        console.error('Test failed:', error);
    } finally {
        await mongoose.disconnect();
    }
}

inspectPayments();
