import mongoose from 'mongoose';
import { Payment } from '../models/Payment.js';

const MONGODB_URI = process.env.MONGODB_URI || 'mongodb://127.0.0.1:27018/payments-wompi-pocketbike';

async function inspectPayment() {
    await mongoose.connect(MONGODB_URI);
    
    const payment = await Payment.findOne({ 
        reference: 'IGI50I-2026-08-31-ZO'
    }).lean();

    console.log('💳 Payment IGI50I-2026-08-31-ZO:', JSON.stringify(payment, null, 2));

    await mongoose.disconnect();
    process.exit(0);
}

inspectPayment().catch(err => {
    console.error('Error:', err);
    mongoose.disconnect();
    process.exit(1);
});
