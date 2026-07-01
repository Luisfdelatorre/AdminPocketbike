import mongoose from 'mongoose';

const companyInvoiceSchema = new mongoose.Schema({
    invoiceNumber: {
        type: String,
        required: true,
        unique: true
    },
    companyId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Company',
        required: true
    },
    month: {
        type: Number,
        required: true
    },
    year: {
        type: Number,
        required: true
    },
    totalTransactions: {
        type: Number,
        default: 0
    },
    totalPaymentsAmount: {
        type: Number,
        default: 0
    },
    subtotal: {
        type: Number,
        default: 0
    },
    tax: {
        type: Number,
        default: 0
    },
    amountDue: {
        type: Number,
        default: 0
    },
    status: {
        type: String,
        enum: ['PENDING', 'PAID', 'VOIDED'],
        default: 'PENDING'
    },
    issuedAt: {
        type: Date,
        default: Date.now
    },
    dueDate: {
        type: Date
    },
    notes: {
        type: String
    }
}, {
    timestamps: true
});

// Ensure a company only has one invoice per month/year (unless voided/re-generated, but let's enforce one active)
// We'll handle this in the service logic rather than a strict index to allow voiding.

export const CompanyInvoice = mongoose.model('CompanyInvoice', companyInvoiceSchema);
