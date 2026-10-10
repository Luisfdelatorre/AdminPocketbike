import mongoose from 'mongoose';
import { Invoice } from '../models/Invoice.js';
import { Company } from '../models/Company.js';
import { Device } from '../models/Device.js';
import { Payment } from '../models/Payment.js';
import { Contract } from '../models/Contract.js';
import paymentService from '../services/paymentService.js';
import companyService from '../services/companyService.js';

const MONGODB_URI = process.env.MONGODB_URI || 'mongodb://127.0.0.1:27018/payments-wompi-pocketbike';

async function checkIGI50I() {
    console.log('=== DIAGNOSTICO DETALLADO DE DISPOSITIVO IGI50I ===\n');
    await mongoose.connect(MONGODB_URI);

    const deviceName = 'IGI50I';
    const device = await Device.findOne({ name: deviceName }).lean();
    console.log('📱 Device Info:', device);

    const contracts = await Contract.find({ deviceIdName: deviceName }).lean();
    console.log('\n📜 Contracts for IGI50I:', contracts);

    console.log('\n📄 All Invoices for IGI50I:');
    const allInvoices = await Invoice.find({ deviceIdName: deviceName }).sort({ date: 1 }).lean();
    allInvoices.forEach(inv => {
        console.log(`  - Date: ${inv.date?.toISOString().split('T')[0]} | dayType: ${inv.dayType} | paid: ${inv.paid} | amount: ${inv.amount} | paidAmount: ${inv.paidAmount} | status: ${inv.status}`);
    });

    console.log('\n💳 All Payments for IGI50I:');
    const allPayments = await Payment.find({
        $or: [{ deviceName: deviceName }, { deviceIdName: deviceName }, { deviceId: device?._id }]
    }).sort({ created_at: 1 }).lean();
    allPayments.forEach(p => {
        console.log(`  - Ref: ${p.reference} | amount: ${p.amount} | amountInCents: ${p.amountInCents} | status: ${p.status} | finalized_at: ${p.finalized_at?.toISOString()}`);
    });

    await mongoose.disconnect();
    process.exit(0);
}

checkIGI50I().catch(err => {
    console.error('Error:', err);
    mongoose.disconnect();
    process.exit(1);
});
