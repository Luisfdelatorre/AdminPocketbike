import mongoose from 'mongoose';
import invoiceServices from '../services/invoiceServices.js';
import { Invoice } from '../models/Invoice.js';
import { Contract } from '../models/Contract.js';

const MONGODB_URI = process.env.MONGODB_URI || 'mongodb://127.0.0.1:27018/pocketbike';

async function runQVM55HTest() {
    console.log('Connecting to database...');
    try {
        await mongoose.connect(MONGODB_URI);
    } catch (e) {
        console.error('Failed to connect to MongoDB. Is the tunnel running on 127.0.0.1:27018?');
        process.exit(1);
    }
    console.log('Database connected!\n');

    const deviceIdName = 'QVM55H';
    console.log(`=== Testing Invoice Query for Device: ${deviceIdName} ===`);

    // 1. Check active contract for QVM55H
    const activeContract = await Contract.findOne({ deviceIdName, status: 'ACTIVE' }).lean();
    console.log('\n--- 1. Active Contract ---');
    console.log(activeContract ? {
        contractId: activeContract.contractId,
        schemaVersion: activeContract.schemaVersion,
        status: activeContract.status,
        companyId: activeContract.companyId
    } : 'No active contract found');

    const contractId = activeContract?.contractId || null;

    // 2. Run invoiceServices.getInvoiceHistory for August 2026 (month 8, year 2026)
    console.log('\n--- 2. Calling invoiceServices.getInvoiceHistory("QVM55H", 8, 2026, contractId) ---');
    const result = await invoiceServices.getInvoiceHistory(deviceIdName, 8, 2026, contractId);

    console.log(`Returned invoices count: ${result.invoices.length}`);
    console.log(`Month: ${result.month}, Year: ${result.year}`);
    console.log('Invoices returned with dynamic metadata:');
    console.dir(result.invoices, { depth: null });

    // 3. Raw MongoDB query inspection
    console.log('\n--- 3. Direct Invoice.find() raw documents in DB ---');
    const rawInvoices = await Invoice.find({ deviceIdName }).sort({ date: -1 }).limit(10).lean();
    console.log(`Total raw invoices in DB for ${deviceIdName}: ${rawInvoices.length}`);
    rawInvoices.forEach(inv => {
        console.log(`Date: ${inv.date?.toISOString().split('T')[0]} | dayType: ${inv.dayType} | adjustmentType: ${inv.adjustmentType || 'null'} | paidAmount: ${inv.paidAmount} | ref: ${inv.transaction?.reference || 'N/A'}`);
    });

    console.log('\n=== TEST COMPLETED SUCCESSFULLY ===');
    await mongoose.disconnect();
    process.exit(0);
}

runQVM55HTest().catch(err => {
    console.error('Test error:', err);
    mongoose.disconnect();
    process.exit(1);
});
