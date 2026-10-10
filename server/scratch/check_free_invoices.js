import mongoose from 'mongoose';
import { connectDatabase } from '../database/connection.js';
import { Invoice } from '../models/Invoice.js';

async function inspectInvoice() {
    try {
        await connectDatabase();
        const inv = await Invoice.findById('DRS32I-2026-08-02').lean();
        console.log('Invoice DRS32I-2026-08-02:', JSON.stringify(inv, null, 2));

        const pmt = await mongoose.connection.db.collection('payments').findOne({
            deviceIdName: 'DRS32I',
            date: { $gte: new Date('2026-08-02T00:00:00Z'), $lte: new Date('2026-08-02T23:59:59Z') }
        });
        console.log('Payment on that date:', JSON.stringify(pmt, null, 2));
    } catch (e) {
        console.error(e);
    } finally {
        await mongoose.disconnect();
    }
}
inspectInvoice();
