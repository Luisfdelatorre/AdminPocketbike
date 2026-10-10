import invoiceServices from '../services/invoiceServices.js';
import mongoose from 'mongoose';
import { MongoDB } from '../config/components/core.js';

await mongoose.connect(MongoDB.URI);
const res = await invoiceServices.getAllInvoices({ month: 7, year: 2026 }, null, true);
console.log('Sample enriched clean invoice output:', JSON.stringify(res.invoices.find(inv => inv.transactionId || inv.transaction?.id) || res.invoices[0], null, 2));
await mongoose.disconnect();
