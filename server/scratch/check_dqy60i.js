import mongoose from 'mongoose';
import { Invoice } from '../models/Invoice.js';
import { Company } from '../models/Company.js';
import { Device } from '../models/Device.js';
import paymentService from '../services/paymentService.js';
import companyService from '../services/companyService.js';

const MONGODB_URI = process.env.MONGODB_URI || 'mongodb://127.0.0.1:27018/payments-wompi-pocketbike';

async function checkDQY60I() {
    console.log('=== DIAGNOSTICO DE DISPOSITIVO DQY60I ===\n');
    await mongoose.connect(MONGODB_URI);

    const deviceName = 'DQY60I';
    const device = await Device.findOne({ name: deviceName }).lean();
    console.log('📱 Device Info:', device ? {
        _id: device._id,
        name: device.name,
        companyId: device.companyId,
        cutOff: device.cutOff
    } : 'No encontrado');

    const companyId = device?.companyId;
    const company = companyId ? await Company.findById(companyId).lean() : null;
    console.log('\n🏢 Company Info:', company ? {
        _id: company._id,
        name: company.name,
        cutOffTime: company.cutOffTime,
        cutOffStrategy: company.cutOffStrategy
    } : 'No encontrada');

    console.log('\n📄 Invoices para DQY60I (Agosto 2026):');
    const invoices = await Invoice.find({ deviceIdName: deviceName }).sort({ date: 1 }).lean();
    invoices.forEach(inv => {
        const isDue = companyService.isInvoiceDue(company, inv.date);
        console.log(`  - Fecha: ${inv.date?.toISOString().split('T')[0]} | dayType: ${inv.dayType} | paid: ${inv.paid} | amount: ${inv.amount} | paidAmount: ${inv.paidAmount} | isDue: ${isDue}`);
    });

    console.log('\n📊 Ejecutando getPaymentSummary en paymentService...');
    const summary = await paymentService.getPaymentSummary({ month: 8, year: 2026, companyId: companyId?.toString() });
    const dqySummary = summary.find(s => s.device.name === deviceName);

    console.log('\nResult para DQY60I en getPaymentSummary:');
    console.dir(dqySummary?.device, { depth: null });

    await mongoose.disconnect();
    process.exit(0);
}

checkDQY60I().catch(err => {
    console.error('Error:', err);
    mongoose.disconnect();
    process.exit(1);
});
