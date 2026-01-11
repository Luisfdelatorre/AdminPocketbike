import mongoose from 'mongoose';
import { PAYMENT_STATUS } from '../config/config.js';

const paymentSchema = new mongoose.Schema({
    paymentId: {
        type: String,
        required: true,
        unique: true,
        index: true,
    },
    invoiceId: {
        type: String,
        required: true,
        unique: true, // 1-to-1 relationship with invoice
        index: true,
    },
    wompiTransactionId: {
        type: String,
        unique: true,
        sparse: true,
        index: true,
    },
    paymentReference: {//This is the invoiceId
        type: String,
        required: true,
        unique: true,
        index: true,
    },
    amount: {
        type: Number, // Amount in cents
        required: true,
    },
    currency: {
        type: String,
        default: 'COP',
    },
    status: {
        type: String,
        enum: Object.values(PAYMENT_STATUS),
        default: PAYMENT_STATUS.PENDING,
        index: true,
    },
    paymentMethodType: {//
        type: String,
    },
    payerEmail: {
        type: String,
    },
    payerPhone: {
        type: String,
    },
    wompiResponse: {
        type: mongoose.Schema.Types.Mixed, // Store full Wompi response
    },
    checkoutUrl: {
        type: String,
    },
}, {
    timestamps: true,
});

// Index for finding payments by status
paymentSchema.index({ status: 1, createdAt: 1 });

export const Payment = mongoose.model('Payment', paymentSchema);
