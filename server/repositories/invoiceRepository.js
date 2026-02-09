import { Invoice, Device } from '../models/index.js';
import { Transaction } from '../config/config.js';

const { INVOICE_DAYTYPE } = Transaction;

// Helper to map old status to new dayTypes if needed, 
// though we should strictly use dayType now.
// UNPAID -> DEBT

export class InvoiceRepository {
    /**
     * Create a daily invoice for a device
     */
    async createInvoice({ deviceIdName, date, amount }) {
        try {
            // Need numeric deviceId for the new Invoice schema
            const device = await Device.findOne({ deviceName: deviceIdName }).select('_id');
            if (!device) {
                throw new Error(`Device not found for name: ${deviceIdName}`);
            }

            // Use the new model's static method
            // It handles _id generation (plate-date) internally
            const invoice = await Invoice.createInvoice({
                amount,
                date,
                deviceIdName,
                deviceId: device._id // Numeric ID
            });

            return invoice.toObject();
        } catch (error) {
            // Check if duplicate (device + date already exists)
            if (error.code === 11000) {
                return await this.getInvoiceByDeviceAndDate(deviceIdName, date);
            }
            throw error;
        }
    }

    /**
     * Get invoice by invoice_id
     * Old: invoiceId field
     * New: _id field
     */
    async getInvoiceById(invoiceId) {
        return await Invoice.findById(invoiceId).lean();
    }

    /**
     * Get invoice by device and date
     */
    async getInvoiceByDeviceAndDate(deviceIdName, date) {
        // Use the new static method, or just findOne
        // The static findByDate builds the ID and finds by _id
        return await Invoice.findByDate(deviceIdName, date);
    }

    /**
     * Get all unpaid invoices for a device
     * Unpaid means paid: false, or dayType: DEBT?
     * The model has `findLastUnPaid`.
     * For ALL unpaid, we query { paid: false } or { dayType: DEBT }
     */
    async getUnpaidInvoicesByDevice(deviceIdName) {
        return await Invoice.find({
            deviceIdName,
            paid: false // Using generic boolean flag from new model
        })
            .sort({ date: 1 })
            .lean();
    }

    /**
     * Get the oldest unpaid invoice for a device
     */
    async getOldestUnpaidInvoice(deviceIdName) {
        const doc = await Invoice.findLastUnPaid(deviceIdName);
        return doc ? doc.toObject() : null;
    }

    /**
     * Update invoice status
     * Adapting old "status" to new fields (dayType, paid)
     */
    async updateInvoiceStatus(invoiceId, status, paymentReference = null) {
        const update = {};

        // Map old status to new dayTypes
        if (status === 'PAID') {
            update.paid = true;
            update.dayType = INVOICE_DAYTYPE.PAID;
        } else if (status === 'PENDING') {
            update.dayType = INVOICE_DAYTYPE.PENDING;
        } else if (status === 'UNPAID') {
            update.paid = false;
            update.dayType = INVOICE_DAYTYPE.DEBT;
        }

        if (paymentReference) {
            // New model stores reference in nested transaction object
            // We need to match the structure: transaction.reference
            update['transaction.reference'] = paymentReference;
        }

        return await Invoice.findByIdAndUpdate(
            invoiceId,
            { $set: update },
            { new: true }
        ).lean();
    }

    /**
     * Get invoice by payment reference
     */
    async getInvoiceByPaymentReference(paymentReference) {
        // Query nested transaction.reference
        return await Invoice.findOne({ 'transaction.reference': paymentReference }).lean();
    }

    /**
     * Get all invoices for a device
     */
    async getInvoicesByDevice(deviceIdName, limit = 50) {
        return await Invoice.find({ deviceIdName })
            .sort({ date: -1 })
            .limit(limit)
            .lean();
    }

    /**
     * Get invoices by status
     * Mapping status -> dayType or paid
     */
    async getInvoicesByStatus(status, limit = 100) {
        const query = {};
        if (status === 'PAID') {
            query.dayType = INVOICE_DAYTYPE.PAID;
        } else if (status === 'UNPAID') {
            query.paid = false; // Covers DEBT, LOAN, etc?
        } else {
            query.dayType = status;
        }

        return await Invoice.find(query)
            .sort({ date: -1 })
            .limit(limit)
            .lean();
    }

    /**
     * Delete invoice by ID (for testing/cleanup)
     */
    async deleteInvoiceById(invoiceId) {
        return await Invoice.findByIdAndDelete(invoiceId).lean();
    }

    // --- New Methods for Payment Logic ---

    /**
     * Find last paid invoice
     */
    async findLastPaid(deviceIdName) {
        return await Invoice.findOne({
            deviceIdName,
            paid: true
        }).sort({ date: -1 }).lean();
    }

    /**
     * Find last unpaid invoice
     */
    async findLastUnPaid(deviceIdName) {
        return await Invoice.findOne({
            deviceIdName,
            paid: false
        }).sort({ date: -1 }).lean();
    }

    /**
     * Count free days used in current month
     */
    async countFreeDaysUsedThisMonth(deviceIdName) {
        const startOfMonth = new Date();
        startOfMonth.setDate(1);
        startOfMonth.setHours(0, 0, 0, 0);

        const endOfMonth = new Date(startOfMonth);
        endOfMonth.setMonth(endOfMonth.getMonth() + 1);

        const count = await Invoice.countDocuments({
            deviceIdName,
            paid: true,
            dayType: { $in: [INVOICE_DAYTYPE.FREE, INVOICE_DAYTYPE.FREEPASS] },
            date: { $gte: startOfMonth, $lt: endOfMonth }
        });

        return count;
    }

    /**
     * Find or create unpaid invoice for today
     */
    async findOrCreateUnpaidInvoice(deviceIdName, contract) {
        // Check for existing unpaid invoice
        let invoice = await this.findLastUnPaid(deviceIdName);

        if (invoice) {
            return await Invoice.findById(invoice._id); // Return Mongoose document for methods
        }

        // Create new one for today/tomorrow based on logic?
        // User logic implies just getting one to pay. 
        // If none exists, we create one for today.
        const today = new Date().toISOString().split('T')[0];

        // Ensure not creating duplicate if one for today is already paid?
        // If today is paid, maybe create for tomorrow? 
        // For simplicity reusing createInvoice logic which handles conflicts.

        try {
            const newInvoice = await this.createInvoice({
                deviceIdName,
                date: today,
                amount: contract.dailyRate
            });
            // Return document (createInvoice returns object, need to fetch doc if we need methods)
            return await Invoice.findById(newInvoice._id);
        } catch (error) {
            // Race condition or valid duplicate, try fetching again
            invoice = await this.findLastUnPaid(deviceIdName);
            if (invoice) return await Invoice.findById(invoice._id);
            throw error;
        }
    }
}

export default new InvoiceRepository();
