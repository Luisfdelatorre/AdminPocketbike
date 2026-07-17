import { Invoice, Device, Contract } from '../models/index.js';
import mongoose from 'mongoose';
import { Transaction } from '../config/config.js';
import logger from '../utils/logger.js';
import helpers from '../utils/helpers.js';
import dayjs from '../config/dayjs.js';
import contractRepository from './contractRepository.js';
import paymentRepository from './paymentRepository.js';

const { INVOICE_DAYTYPE, PAYMENT_TYPE } = Transaction;

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
            const device = await Device.findOne({ name: deviceIdName });
            if (!device) {
                throw new Error(`Device not found for name: ${deviceIdName}`);
            }

            const invoice = await Invoice.createInvoice({
                amount,
                date,
                deviceIdName,
                deviceId: device.deviceId,
                gpsId: device.gpsId,
                companyId: device.companyId
            });

            return invoice.toObject();
        } catch (error) {
            // Check if duplicate (device + date already exists)
            if (error.code === 11000) {
                return await Invoice.findByDate(deviceIdName, date);
            }
            throw error;
        }
    }

    /**
     * Helper to create next day invoice
     */
    async createNextDayInvoice(deviceIdName, amount, deviceId, companyId, date = null, gpsId = null, megaDeviceId = null) {
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

        if (!gpsId) {
            const device = await Device.findOne({ name: deviceIdName });
            if (device) {
                gpsId = device.gpsId;
                if (!megaDeviceId) megaDeviceId = device.megaDeviceId;
            }
        }

        invoice = await Invoice.createInvoice({
            amount,
            date: nextDate,
            deviceIdName,
            deviceId,
            gpsId,
            megaDeviceId,
            companyId
        });
        return invoice;
    }
    /**
     * Find or create unpaid invoice
     */
    async findOrCreateUnpaidInvoice(deviceIdName, contract, maxAttempts = 3) {
        for (let attempt = 1; attempt <= maxAttempts; attempt++) {
            try {
                // 1️⃣ Check for existing unpaid invoice
                const existingInvoice = await Invoice.findLastUnPaid(deviceIdName);
                if (existingInvoice) return existingInvoice;
                // 2️⃣ Create next day invoice
                return await this.createNextDayInvoice(deviceIdName, contract.dailyRate, contract.deviceId, contract.companyId);
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

    async findOrCreateInvoiceByName(contract, date) {
        const { deviceIdName, deviceId, dailyRate: amount, companyId, gpsId = null } = contract;
        try {
            let invoice = await Invoice.findByDate(deviceIdName, date);
            if (!invoice) {
                invoice = await Invoice.createInvoice({
                    deviceIdName,
                    amount,
                    date,
                    deviceId,
                    gpsId,
                    companyId
                });
            }
            return invoice;
        } catch (error) {
            if (error.code === 11000) {
                logger.info(`Invoice ${deviceIdName} on date ${date} already exists (Duplicate Key caught). Returning it.`);
                return await Invoice.findByDate(deviceIdName, date);
            }
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
        // Use the fast deterministic _id lookup
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

    /**
     * Lightweight projection for the payment summary grid.
     * Only fetches the 7 fields the frontend actually renders,
     * drastically reducing data transferred over the SSH tunnel.
     */
    async findInvoicesForSummary(query) {
        try {
            return await Invoice.find(query)
                .select('date deviceIdName dayType amount paidAmount cutOff')
                .lean();
        } catch (error) {
            logger.error('Error finding invoices for summary:', error);
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
     * Find last unpaid invoice
     */
    async findLastUnPaid(deviceIdName) {
        return await Invoice.findLastUnPaid(deviceIdName);
    }
    /**
     * Find last paid invoice
    */
    async findLastPaid(deviceIdName) {
        return await Invoice.findLastPaid(deviceIdName);
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
     * Get stats on paid vs total invoices for the current month
     */
    async getInvoiceStatsThisMonthByCompany(companyId) {
        const now = new Date();
        const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);

        const companyObjId = new mongoose.Types.ObjectId(companyId);

        const totalInvoices = await Invoice.countDocuments({
            companyId: companyObjId,
            date: { $gte: startOfMonth }
        });

        const paidInvoices = await Invoice.countDocuments({
            companyId: companyObjId,
            date: { $gte: startOfMonth },
            paid: true
        });

        return { totalInvoices, paidInvoices };
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
     * Ensure all invoices for the full payment cycle exist.
     * Creates missing invoices up to `contract.paymentFrequency` unpaid days ahead.
     * FREE days are created as paid invoices directly — no payment record needed at pre-generation time.
     */
    async ensureCycleInvoicesExist(deviceIdName, contract, multiplier) {
        const frequency = contract.paymentFrequency || 1;
        const targetLimit = typeof multiplier === 'number'
            ? multiplier
            : Contract.getBillingMultiplier(frequency, contract.freeDayPolicy);

        let unpaidInvoices = await Invoice.findUnpaidCycleInvoices(deviceIdName);
        let coveredDays = unpaidInvoices.length;
        if (coveredDays >= targetLimit) {
            logger.info(`[CYCLE] Already ${unpaidInvoices.length} unpaid invoices for ${deviceIdName}, skipping`);
            return unpaidInvoices.slice(0, targetLimit);
        }
        // Start pre-creating invoices from the day after the latest paid invoice in the database
        const latestInvoice = await Invoice.findLastPaid(deviceIdName);
        let currentDate = latestInvoice
            ? dayjs(latestInvoice.date).add(1, 'day')
            : dayjs().startOf('day');

        // Loop until exactly `targetLimit` calendar cycle unpaid days are pre-created
        while (coveredDays < targetLimit) {
            const dateVal = currentDate.toDate();
            const invoice = await this.findOrCreateInvoiceByName(contract, dateVal);

            const isFixedFreeDay = contract.freeDayPolicy === 'FIXED_WEEKDAY' &&
                contract.fixedFreeDayOfWeek !== undefined &&
                currentDate.day() === contract.fixedFreeDayOfWeek;

            if (isFixedFreeDay) {
                // Create a $0 Payment record for fixed free day audit trail
                const payment = await paymentRepository.createFreePayment(
                    deviceIdName,
                    contract,
                    invoice,
                    contract.companyId
                );
                await invoice.applyPayment(payment);
                logger.info(`[CYCLE] Pre-created FREE invoice + payment for ${deviceIdName} on ${currentDate.format('YYYY-MM-DD')}`);
            } else {
                coveredDays++;
                logger.info(`[CYCLE] Pre-created DEBT invoice for ${deviceIdName} on ${currentDate.format('YYYY-MM-DD')}`);
            }
            currentDate = currentDate.add(1, 'day');
        }
        unpaidInvoices = await Invoice.findUnpaidCycleInvoices(deviceIdName);
        return unpaidInvoices.slice(0, targetLimit);
    }

    /**
     * Bulk-mark all pre-created cycle invoices as PAID in a single bulkWrite.
     * Expects invoices to have been pre-created by ensureCycleInvoicesExist at checkout time.
     */
    async processInvoicePaymentAtomically(payment) {
        const { deviceIdName } = payment;

        let contract = await contractRepository.getActiveContractByDevice(deviceIdName);;
        let frequency = payment.paymentFrequency;
        let multiplier = payment.billingMultiplier;

        if (!frequency || !multiplier) {
            frequency = frequency || contract.paymentFrequency || 1;
            multiplier = multiplier || Contract.getBillingMultiplier(frequency, contract.freeDayPolicy);
        }
        const unpaidInvoicesToPay = await this.ensureCycleInvoicesExist(deviceIdName, contract);
        await Promise.all(unpaidInvoicesToPay.map(invoice => invoice.applyPayment(payment)));
        logger.info(`[PAYMENT FLOW] bulkWrite complete — invoices marked PAID for ${deviceIdName}.`);

        // 5. Return both the oldest invoice (anchor) and the newest paid invoice (latestPaid)
        return {
            anchorInvoice: unpaidInvoicesToPay[0],
            latestPaid: unpaidInvoicesToPay[unpaidInvoicesToPay.length - 1]
        };
    }

    /**
     * Compare invoiced vs paid amounts for a company in a given period.
     * @param {string|ObjectId} companyId
     * @param {{ month?: number, year?: number }} options
     * @returns {Promise<{ totalInvoiced: number, totalPaid: number, totalUnpaid: number }>}
     */
    async getTotalInvoicedByCompany(companyId, { month, year } = {}) {
        const match = { companyId: new mongoose.Types.ObjectId(companyId) };

        if (month && year) {
            match.date = { $gte: new Date(year, month - 1, 1), $lt: new Date(year, month, 1) };
        } else if (year) {
            match.date = { $gte: new Date(year, 0, 1), $lt: new Date(year + 1, 0, 1) };
        }

        const result = await Invoice.aggregate([
            { $match: match },
            {
                $group: {
                    _id: null,
                    totalInvoiced: { $sum: '$amount' },
                    totalPaid: { $sum: { $cond: ['$paid', '$amount', 0] } },
                    totalUnpaid: { $sum: { $cond: ['$paid', 0, '$amount'] } }
                }
            }
        ]);

        return result[0] ?? { totalInvoiced: 0, totalPaid: 0, totalUnpaid: 0 };
    }


}

export default new InvoiceRepository();
