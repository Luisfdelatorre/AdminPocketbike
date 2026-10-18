import mongoose from 'mongoose';
import { Invoice } from '../models/Invoice.js';
import { Payment } from '../models/Payment.js';
import { MongoDB } from '../config/components/core.js';

await mongoose.connect(MongoDB.URI);
const julInvoices = await Invoice.find({ _id: { $regex: '^IFG87I-2026-07' } }).lean();
console.log('--- JUL INVOICES FOR IFG87I ---');
julInvoices.forEach(inv => {
    console.log(`Invoice _id: ${inv._id}, paid: ${inv.paid}, dayType: ${inv.dayType}, adjType: ${inv.adjustmentType}`);
    console.log(`  transaction:`, inv.transaction);
    console.log(`  paymentId:`, inv.paymentId);
    console.log(`  adjustmentReference:`, inv.adjustmentReference);
});

// Search payments for these invoices
const julPayments = await Payment.find({ deviceIdName: 'IFG87I', date: { $regex: '^2026-07' } }).lean();
console.log('--- JUL PAYMENTS FOR IFG87I ---');
julPayments.forEach(p => {
    console.log(`Payment paymentId: ${p.paymentId || p._id}, type: ${p.type}, reference: ${p.reference}, invoiceId: ${p.invoiceId}, wompiTxId: ${p.wompiTransactionId || p.transactionId}`);
});

await mongoose.disconnect();
