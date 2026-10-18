import mongoose from 'mongoose';
import { Invoice } from '../models/Invoice.js';
import { MongoDB } from '../config/components/core.js';

await mongoose.connect(MongoDB.URI);
const sample = await Invoice.findOne({ paid: true }).lean();
console.log('Sample paid invoice:', JSON.stringify(sample ? { _id: sample._id, transaction: sample.transaction, adjustmentType: sample.adjustmentType, adjustmentReference: sample.adjustmentReference } : 'None found', null, 2));

const sampleTxId = await Invoice.findOne({ "transaction.id": { $exists: true, $ne: "" } }).lean();
console.log('Sample invoice with transaction.id:', JSON.stringify(sampleTxId ? { _id: sampleTxId._id, transaction: sampleTxId.transaction } : 'None found', null, 2));

await mongoose.disconnect();
