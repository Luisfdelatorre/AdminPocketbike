import mongoose from 'mongoose';
import { Invoice } from '../models/Invoice.js';

const MONGODB_URI = process.env.MONGODB_URI || 'mongodb://127.0.0.1:27018/payments-wompi-pocketbike';

async function inspectInvoice() {
    await mongoose.connect(MONGODB_URI);
    
    const invoices = await Invoice.find({ 
        deviceIdName: 'IGI50I',
        date: { 
            $gte: new Date('2026-09-01T00:00:00.000Z'),
            $lte: new Date('2026-09-12T23:59:59.999Z')
        }
    }).sort({ date: 1 }).lean();

    console.log('📄 Invoices September 2026 for IGI50I:', JSON.stringify(invoices, null, 2));

    await mongoose.disconnect();
    process.exit(0);
}

inspectInvoice().catch(err => {
    console.error('Error:', err);
    mongoose.disconnect();
    process.exit(1);
});
