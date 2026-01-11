import { Invoice } from '../models/index.js';
import { nanoid } from 'nanoid';
import { INVOICE_STATUS } from '../config/config.js';

export class InvoiceRepository {
    /**
     * Create a daily invoice for a device
     */
    async createInvoice({ deviceId, date, amount }) {
        // Deterministic invoiceId: one invoice per device per day
        // Format: INV-BIKE001-2026-01-05
        const invoiceId = `INV-${deviceId}-${date}`;

        try {
            const invoice = await Invoice.create({
                invoiceId,
                deviceId,
                date,
                amount,
                status: INVOICE_STATUS.UNPAID,
            });

            return invoice.toObject();
        } catch (error) {
            // Check if duplicate (device + date already exists)
            if (error.code === 11000) {
                return await this.getInvoiceByDeviceAndDate(deviceId, date);
            }
            throw error;
        }
    }

    /**
     * Get invoice by invoice_id
     */
    async getInvoiceById(invoiceId) {
        return await Invoice.findOne({ invoiceId }).lean();
    }

    /**
     * Get invoice by device and date
     */
    async getInvoiceByDeviceAndDate(deviceId, date) {
        return await Invoice.findOne({ deviceId, date }).lean();
    }

    /**
     * Get all unpaid invoices for a device
     */
    async getUnpaidInvoicesByDevice(deviceId) {
        return await Invoice.find({
            deviceId,
            status: INVOICE_STATUS.UNPAID,
        })
            .sort({ date: 1 })
            .lean();
    }

    /**
     * Get the oldest unpaid invoice for a device
     */
    async getOldestUnpaidInvoice(deviceId) {
        return await Invoice.findOne({
            deviceId,
            status: INVOICE_STATUS.UNPAID,
        })
            .sort({ date: 1 })
            .lean();
    }

    /**
     * Update invoice status
     */
    async updateInvoiceStatus(invoiceId, status, paymentReference = null) {
        const update = { status };
        if (paymentReference) {
            update.paymentReference = paymentReference;
        }

        return await Invoice.findOneAndUpdate(
            { invoiceId },
            update,
            { new: true }
        ).lean();
    }

    /**
     * Get invoice by payment reference
     */
    async getInvoiceByPaymentReference(paymentReference) {
        return await Invoice.findOne({ paymentReference }).lean();
    }

    /**
     * Get all invoices for a device
     */
    async getInvoicesByDevice(deviceId, limit = 50) {
        return await Invoice.find({ deviceId })
            .sort({ date: -1 })
            .limit(limit)
            .lean();
    }

    /**
     * Get invoices by status
     */
    async getInvoicesByStatus(status, limit = 100) {
        return await Invoice.find({ status })
            .sort({ date: -1 })
            .limit(limit)
            .lean();
    }

    /**
     * Delete invoice by ID (for testing/cleanup)
     */
    async deleteInvoiceById(invoiceId) {
        return await Invoice.findOneAndDelete({ invoiceId }).lean();
    }
}

export default new InvoiceRepository();
