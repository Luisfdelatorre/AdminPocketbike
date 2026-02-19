import { Invoice, Device } from '../models/index.js';
import mongoose from 'mongoose';
import { Transaction } from '../config/config.js';
import logger from '../utils/logger.js';
import helpers from '../utils/helpers.js';
const { generateInvoiceId, getToday } = helpers;
import dayjs from '../config/dayjs.js';

const { INVOICE_DAYTYPE } = Transaction;

// Helper to map old status to new dayTypes if needed, 
// though we should strictly use dayType now.
// UNPAID -> DEBT

export class InvoiceRepository {
    /**
     * Create a daily invoice for a device
     */
    async createInvoice({ deviceIdName, date, amount, companyId }) {
        try {
            // Need numeric deviceId for the new Invoice schema
            const device = await Device.findOne({ name: deviceIdName });
            if (!device) {
                throw new Error(`Device not found for name: ${deviceIdName}`);
            }

            // Use the new model's static method
            // It handles _id generation (plate-date) internally
            const invoice = await Invoice.createInvoice({
                amount,
                date,
                deviceIdName,
                deviceId: device.deviceId, // Numeric ID
                companyId: companyId || device.companyId,
                companyName: device.companyName
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
     * Helper to create next day invoice
     */
    async createNextDayInvoice(deviceIdName, amount, deviceId, companyId, date = null) {
        // Find last paid invoice to determine next date
        let nextDate;
        if (!date) {
            const lastPaid = await Invoice.findLastPaid(deviceIdName);
            nextDate = lastPaid
                ? dayjs(lastPaid.date).add(1, 'day').toDate()
                : dayjs().startOf('day').toDate();
        } else {
            nextDate = dayjs(date).toDate();
        }

        // Check by Name+Date (ID)
        let invoice = await Invoice.findByDate(deviceIdName, nextDate);
        if (invoice) {
            logger.info(`Invoice ${invoice.id} already exists (by ID), returning it.`);
            return invoice;
        }

        invoice = await Invoice.createInvoice({
            amount,
            date: nextDate,
            deviceIdName,
            deviceId,
            companyId
        });
        return invoice;
    }
    /**
     * Find or create unpaid invoice
     */
    async findOrCreateUnpaidInvoice(deviceIdName, contract, companyId, maxAttempts = 3) {
        for (let attempt = 1; attempt <= maxAttempts; attempt++) {
            try {
                // 1️⃣ Check for existing unpaid invoice
                const existingInvoice = await Invoice.findLastUnPaid(deviceIdName);
                if (existingInvoice) return existingInvoice;
                // 2️⃣ Create next day invoice
                return await this.createNextDayInvoice(deviceIdName, contract.dailyRate, contract.deviceId, companyId);
            } catch (err) {
                // Duplicate key → another process created it → retry
                if (err?.code === 11000) {
                    continue; // retry
                }
                // Other errors → propagate
                logger.error(`Error finding/creating unpaid invoice for ${deviceIdName}:`, err);
                throw err;
            }
        }
        throw new Error('Create Next Day Invoice failed.');
    }

    async findOrCreateInvoiceByName(deviceIdName, deviceId, amount, date, companyId) {
        try {

            let invoice = await Invoice.findOne({ deviceIdName, date: date });
            if (!invoice) {
                invoice = await Invoice.createInvoice({
                    deviceIdName,
                    amount,
                    date,
                    deviceId,
                    companyId
                });
            }
            return invoice;
        } catch (error) {
            logger.error(`Error finding/creating invoice for ${deviceIdName}:`, error);
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
        return await Invoice.findOne({ deviceIdName, date });
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

    /**
     * Generic find invoices by query
     */
    async findInvoices(query) {
        try {
            return await Invoice.find(query).lean();
        } catch (error) {
            logger.error('Error finding invoices:', error);
            throw error;
        }
    }


    async setCutOff(invoiceId, isCutOff = true) {
        return await Invoice.findByIdAndUpdate(
            invoiceId,
            { $set: { cutOff: isCutOff } },
            { new: true }
        ).lean();
    }

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
     * Count pending invoices for a company
     */
    async countPendingInvoicesByCompany(companyId) {
        return await Invoice.countDocuments({
            companyId,
            dayType: INVOICE_DAYTYPE.PENDING
        });
    }

    /**
     * Get monthly revenue for a company (last N months)
     */
    async getMonthlyRevenueByCompany(companyId, limitMonths = 6) {
        const now = new Date();
        const startStateDate = new Date(now.getFullYear(), now.getMonth() - limitMonths + 1, 1);

        return await Invoice.aggregate([
            {
                $match: {
                    companyId: new mongoose.Types.ObjectId(companyId),
                    paid: true,
                    date: { $gte: startStateDate }
                }
            },
            {
                $group: {
                    _id: {
                        month: { $month: "$date" },
                        year: { $year: "$date" }
                    },
                    totalRevenue: { $sum: "$amount" }
                }
            },
            { $sort: { "_id.year": 1, "_id.month": 1 } }
        ]);
    }

    /**
     * Get free days status for a device
     * @param {string} deviceIdName 
     * @param {number} limit 
     * @returns {Promise<{used: number, available: number, limit: number}>}
     */
    async getFreeDaysStatus(deviceIdName, limit = 4) {
        const used = await this.countFreeDaysUsedThisMonth(deviceIdName);
        const monthlyFreeDaysAvailable = Math.max(0, limit - used);
        return { monthlyFreeDaysAvailable };
    }

    /**
     * Get overdue status for a device
     * @param {string} deviceIdName 
     * @returns {Promise<{isOverdue: boolean, lastPaidDate: Date|null}>}
     */
    async getOverdueStatus(deviceIdName) {
        const lastPaidInvoice = await this.findLastPaid(deviceIdName);
        let isOverdue = false;
        let lastPaidDate = null;

        if (lastPaidInvoice) {
            lastPaidDate = dayjs(lastPaidInvoice.date).startOf('day');
            const todayMoment = dayjs().startOf('day');
            isOverdue = todayMoment.isAfter(lastPaidDate);
        }

        return { isOverdue, lastPaidDate: lastPaidDate ? lastPaidDate.toDate() : null };
    }

    /**
     * Find or create unpaid invoice for today
     */

    async processInvoicePaymentAtomically(payment, maxAttempts = 5) {
        const { deviceIdName, amount_in_cents, deviceId, unpaidInvoiceId } = payment;
        let attempts = maxAttempts;
        const amount = amount_in_cents / 100;
        while (attempts > 0) {
            try {
                // 1️⃣ Intentar pagar la factura no pagada específica
                if (unpaidInvoiceId) {
                    const invoice = await Invoice.findOne({ _id: unpaidInvoiceId, paid: false });
                    if (invoice) {
                        logger.info(`Paying specific invoice: ${unpaidInvoiceId}`);
                        const result = await invoice.applyPayment(payment);
                        return result;
                    } else {
                        logger.warn(`Specific invoice ${unpaidInvoiceId} not found or already paid. Falling back.`);
                    }
                }

                // 2️⃣ Más vieja sin pagar
                const lastUnpaid = await Invoice.findLastUnPaid(deviceIdName);
                if (lastUnpaid) {
                    logger.info(`Paying oldest unpaid invoice: ${lastUnpaid._id}`);
                    return await lastUnpaid.applyPayment(payment);
                }
                logger.info(`No unpaid invoices found, creating new one.`);
                const invoice = await this.createNextDayInvoice(deviceIdName, amount, deviceId);
                logger.info(`invoice 2: ${invoice}`);
                return await invoice.applyPayment(payment);

            } catch (err) {
                if (err?.code === 11000) {
                    logger.warn(`Duplicate key error, retrying... (${maxAttempts - attempts + 1}/${maxAttempts})`);
                    attempts--;
                    continue;
                }
                logger.error(`Error processing invoice payment--:`, err);
                throw err;
            }
        }

        throw new Error('Max retry attempts reached while creating/paying invoice.');
    }
}

export default new InvoiceRepository();
