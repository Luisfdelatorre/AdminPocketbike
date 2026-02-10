import mongoose from 'mongoose';
import dayjs from '../config/dayjs.js';
import { Transaction } from '../config/config.js';
import helpers from '../utils/helpers.js';

const { generateInvoiceId, getToday } = helpers;
import logger from '../config/logger.js';
import Traccar from '../adapters/traccarAdapter.js';

const { INVOICE_DAYTYPE, PAYMENT_TYPE, TEMPORARY_RESERVATION_TIMEOUT } = Transaction;

/**
 * Schema para facturas diarias de renta  
 * Cada factura tiene UN SOLO pago asociado
 */
const InvoiceSchema = new mongoose.Schema(
    {
        _id: { type: String, required: true }, // ID formato: plate-yyyy-mm-dd
        invoiceId: { type: String, required: true }, // ID formato: plate-yyyy-mm-dd
        date: { type: Date, required: true },
        amount: { type: Number, required: true },
        paidAmount: { type: Number, default: 0 },
        distance: { type: Number },
        transaction: {
            id: { type: String, default: '' },
            reference: { type: String, default: '' },
            finalized_at: { type: Date },
            type: { type: String, enum: Object.values(PAYMENT_TYPE) }, // Ej: "APPROVED"
        },
        paid: { type: Boolean, default: false },
        deviceIdName: { type: String, required: true },//this is device name
        deviceId: { type: String, required: true },//this is device id
        companyId: { type: mongoose.Schema.Types.ObjectId, ref: 'Company', index: true },
        companyName: { type: String },
        dayType: {
            type: String,
            enum: Object.values(INVOICE_DAYTYPE),
            required: true,
        }, // Ej: "APPROVED"
        reservedUntil: { type: Date },
    },
    { collection: 'invoices' }
);

// Indexes
// _id is name-date. So unique _id ensures unique name-date.
// We only need deviceIdName index for query performance.
InvoiceSchema.index({ deviceIdName: 1, date: 1 });

// ════════════════════════════════════════════
// statics
// ════════════════════════════════════════════
InvoiceSchema.statics.buildId = function (name, date) {
    return generateInvoiceId(name, date);
};

InvoiceSchema.statics.findLastPaid = function (deviceIdName) {
    return this.findOne({ deviceIdName, paid: true }).sort({ date: -1 });
};
InvoiceSchema.statics.findByDate = function (deviceIdName, date) {
    var invoiceId = this.buildId(deviceIdName, date);
    return this.findOne({ _id: invoiceId });
};

InvoiceSchema.statics.findLastUnPaid = function (deviceIdName) {
    return this.findOne({ deviceIdName, paid: false }).sort({ date: 1 });
};

InvoiceSchema.statics.countFreeDaysUsedThisMonth = function (deviceId) {
    const startOfMonth = getToday().startOf('month').toDate();
    const endOfMonth = getToday().endOf('month').toDate();

    return this.countDocuments({
        deviceIdName: deviceId,
        dayType: INVOICE_DAYTYPE.FREE,
        date: { $gte: startOfMonth, $lte: endOfMonth },
    });
};


InvoiceSchema.statics.createInvoice = async function ({
    amount,
    date,
    deviceIdName,
    deviceId,
    companyId,
    companyName
}) {
    const id = this.buildId(deviceIdName, date);
    const invoice = await this.create({
        _id: id,
        invoiceId: id,
        date,
        amount,
        deviceIdName,
        deviceId,
        companyId,
        companyName,
        paid: false,
        dayType: INVOICE_DAYTYPE.DEBT,
    });

    return invoice;
};

// ════════════════════════════════════════════
// MÉTODOS DE INSTANCIA
// ════════════════════════════════════════════
// Add instance method
InvoiceSchema.methods.applyPayment = async function (payment) {
    // Aplicar lógica según tipo de evento
    switch (payment.type) {
        case PAYMENT_TYPE.WOMPI:
            this.paid = true;
            this.dayType = INVOICE_DAYTYPE.PAID;
            this.paidAmount = this.amount;
            this.transaction.id = payment._id;
            this.transaction.reference = payment.reference;
            this.transaction.finalized_at = payment.finalized_at;
            this.transaction.type = payment.type;
            break;

        case PAYMENT_TYPE.FREE:
            this.paid = true; // no genera deuda
            this.dayType = INVOICE_DAYTYPE.FREE;
            this.paidAmount = 0;
            this.transaction.id = payment._id;
            this.transaction.reference = payment.reference;
            this.transaction.finalized_at = payment.finalized_at;
            this.transaction.type = payment.type;
            break;

        case PAYMENT_TYPE.FREEPASS:
            this.paid = false; // la deuda sigue
            this.dayType = INVOICE_DAYTYPE.FREEPASS;
            break;

        case PAYMENT_TYPE.LOAN:
            this.paid = false; // Debt remains
            this.dayType = INVOICE_DAYTYPE.LOAN;
            this.paidAmount = 0;
            this.transaction.id = payment._id;
            this.transaction.reference = payment.reference;
            this.transaction.finalized_at = payment.finalized_at;
            this.transaction.type = payment.type;
            break;

        default:
            console.log(`Unknown event type: ${payment.type}`);
    }

    return await this.save();
};

InvoiceSchema.methods.applyTransaction = function (transaction) {
    this.transaction = transaction;
    this.paid = true;
    this.dayType = INVOICE_DAYTYPE.PAID;
    this.paidAmount = this.amount;
    return this;
};
InvoiceSchema.methods.reserve = function (payment) {
    this.transaction = payment.transaction;
    this.dayType = INVOICE_DAYTYPE.PENDING;
    this.reservedUntil = new Date(Date.now() + TEMPORARY_RESERVATION_TIMEOUT);

    return this.save();
};

InvoiceSchema.methods.unReserve = function () {
    this.dayType = INVOICE_DAYTYPE.DEBT;
    this.transaction = { id: '', reference: '' };
    this.reservedUntil = null;
    return this.save();
};

InvoiceSchema.methods.markAsVerifying = function () {
    if (this.dayType === INVOICE_DAYTYPE.PENDING) {
        this.dayType = INVOICE_DAYTYPE.VERIFYING;
        return this.save();
    }
    return Promise.resolve(this);
};


InvoiceSchema.methods.getId = function () {
    return this._id;
};

// ════════════════════════════════════════════
// CREAR MODELO
// ════════════════════════════════════════════
export const Invoice = mongoose.model('Invoice', InvoiceSchema);
