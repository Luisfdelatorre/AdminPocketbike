import mongoose from 'mongoose';
import { Transaction } from '../config/config.js';
const { PAYMENT_STATUS } = Transaction;

const paymentSchema = new mongoose.Schema({
    _id: { type: String, required: true, },// wompiTransactionId
    paymentId: { type: String, required: true, unique: true, index: true, },
    invoiceId: { type: String, required: true, unique: true, index: true, },
    companyId: { type: mongoose.Schema.Types.ObjectId, ref: 'Company', index: true, },
    companyName: { type: String, },
    wompiTransactionId: { type: String, unique: true, sparse: true, index: true, },
    reference: { type: String, required: true, unique: true, index: true, },
    amount_in_cents: { type: Number },
    amount: { type: Number }, // Payment amount
    created_at: { type: Date, default: Date.now },
    payment_method_type: { type: String, required: true },
    phone_number: { type: String, default: null },
    currency: { type: String, default: 'COP', },
    status: { type: String, enum: Object.values(PAYMENT_STATUS), default: PAYMENT_STATUS.PENDING, index: true, },
    paymentMethodType: { type: String, },
    type: { type: String, required: true },
    finalized_at: { type: Date },
    //device data
    deviceIdName: { type: String, required: true },
    deviceId: { type: String, required: true },
    // invoice data
    invoiceDate: { type: Date, default: Date.now }, //fecha de la factura pagada
    invoiceId: { type: String, default: null }, // ID de la factura asociada
    unpaidInvoiceId: { type: String, default: null }, // ID de la posible factura no pagada asociada
    used: { type: Boolean, default: false }, // Indica si el pago ya fue aplicado



}, {
    timestamps: true,
});

paymentSchema.methods.getSimple = function () {
    return {
        reference: this.reference,
        deviceIdName: this.deviceIdName,
        amount: this.amount_in_cents / 100,
        finalized_at: this.finalized_at,
        invoiceId: this.invoiceId
    };
};

paymentSchema.methods.markAsUsed = async function (invoice = null) {
    if (this.used) return this; // already marked, no changes
    this.used = true;
    if (invoice) this.invoiceId = invoice._id;
    await this.save();

    return this;
};

// Index for finding payments by status
paymentSchema.index({ status: 1, createdAt: 1 });

export const Payment = mongoose.model('Payment', paymentSchema);
