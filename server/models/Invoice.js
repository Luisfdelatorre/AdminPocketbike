import mongoose from 'mongoose';
import { INVOICE_STATUS } from '../config/config.js';

const invoiceSchema = new mongoose.Schema({
    invoiceId: { type: String, required: true, unique: true, index: true, },
    contractId: { type: String, index: true, }, // ← Link to Contract (optional for backward compatibility)
    deviceId: { type: String, required: true, index: true, },
    date: { type: String, required: true, index: true, },
    amount: { type: Number, required: true, },
    status: { type: String, enum: Object.values(INVOICE_STATUS), default: INVOICE_STATUS.UNPAID, index: true, },
    paymentReference: { type: String, unique: true, sparse: true, index: true, },
}, {
    timestamps: true,
});

// Compound index for unique invoice per device per day
invoiceSchema.index({ deviceId: 1, date: 1 }, { unique: true });

// Index for querying unpaid invoices by device
invoiceSchema.index({ deviceId: 1, status: 1, date: 1 });

export const Invoice = mongoose.model('Invoice', invoiceSchema);
