import { Payment, Device, Invoice } from '../models/index.js';
import mongoose from 'mongoose';
import { nanoid } from 'nanoid';
import { Transaction } from '../config/config.js';
import dayjs from '../config/dayjs.js';
import logger from '../config/logger.js';
import helper from '../utils/helpers.js';


const { PAYMENT_STATUS, PAYMENT_TYPE } = Transaction;


export class PaymentRepository {
    /**
     * Get total payments per day by device (Aggregation)
     */
    async getTotalPerDayByDevice(query) {
        try {
            return await Payment.totalPerDayByDevice(query);
        } catch (error) {
            logger.error('Error getting total payments per day:', error);
            throw error;
        }
    }


    /**
     * Create a payment for an invoice
     */
    async createPayment({ invoiceId, amount, currency = 'COP', companyId, companyName = null }) {
        const invoiceParts = invoiceId.split('-');
        const deviceIdName = invoiceParts[1]; // BIKE001

        // Use today's date for the payment
        const today = new Date();
        const date = today.toISOString().split('T')[0]; // YYYY-MM-DD format
        const shortId = nanoid(6); // Short random ID for uniqueness

        const paymentId = `PAY-${deviceIdName}-${date}-${shortId}`;

        // Use invoiceId as the payment reference - it's unique and deterministic
        // This way Wompi webhooks can directly reference the invoice
        const paymentReference = invoiceId; // e.g., "INV-BIKE001-2026-01-05"

        try {
            // Fetch Invoice to get company details
            // We need to import Invoice model dynamically or move it to top if no circular dep
            // For now, let's assume we can query Invoice.
            const Invoice = (await import('../models/index.js')).Invoice;
            const invoice = await Invoice.findById(invoiceId);

            // Prefer provided companyId, fallback to Invoice
            companyId = companyId || invoice?.companyId;
            companyName = companyName || invoice?.companyName;

            // If invoice doesn't have it (pre-migration), fallback to Device lookup?
            // Or just save undefined, migration script will fix it.
            // But for new payments we want it.
            // If invoice has it, great.

            const payment = await Payment.create({
                paymentId,
                invoiceId,
                paymentReference,
                amount,
                currency,
                status: PAYMENT_STATUS.S_PENDING,
                companyId,
                companyName
            });

            return payment.toObject();
        } catch (error) {
            // Check if duplicate invoice (1-to-1 constraint)
            if (error.code === 11000 && error.message.includes('invoiceId')) {
                return await this.getPaymentByInvoiceId(invoiceId);
            }
            throw error;
        }
    }
    async createLoanPayment(deviceIdName, contract, unpaidInvoice) {
        try {
            const reference = helper.generateReferenceLoan(unpaidInvoice._id);
            return await this.createStandarPayment(0, reference, deviceIdName, contract, unpaidInvoice, unpaidInvoice.companyId, PAYMENT_TYPE.LOAN);
        } catch (error) {
            logger.error('Error creating loan payment:', error);
            throw error;
        }
    }

    async createFreePayment(deviceIdName, contract, unpaidInvoice, companyId) {
        try {
            const paymentId = helper.generateReferenceFreeDay(unpaidInvoice.invoiceId);
            return await this.createStandarPayment(0, paymentId, deviceIdName, contract, unpaidInvoice, companyId, PAYMENT_TYPE.FREE);
        } catch (error) {
            logger.error('Error creating free payment:', error);
            throw error;
        }
    }
    async createManualPayment({ deviceIdName, contract, invoice, companyId, amount }) {
        try {
            const paymentId = helper.generateReferenceAdjustment(invoice.invoiceId);
            return await this.createStandarPayment(amount, paymentId, deviceIdName, contract, invoice, companyId, PAYMENT_TYPE.ADJUSTMENT);
        } catch (error) {
            logger.error('Error creating manual adjustment payment:', error);
            throw error;
        }
    }
    async createStandarPayment(amount, paymentId, deviceIdName, contract, unpaidInvoice, companyId, type) {
        const now = dayjs().toDate();
        const payment = {
            _id: paymentId,
            paymentId: paymentId,
            invoiceId: unpaidInvoice.invoiceId,
            companyId: companyId,
            reference: paymentId,
            amount: 0,
            amount_in_cents: 0,
            payment_method_type: type,
            type: type,
            deviceIdName: deviceIdName,
            deviceId: contract.deviceId,
            status: PAYMENT_STATUS.S_APPROVED,
            created_at: now,
            finalized_at: now,
            phoneNumber: contract.customerPhone || '',
            used: true,
            unpaidInvoiceId: unpaidInvoice._id,
            gpsId: unpaidInvoice.gpsId,
            invoiceDate: unpaidInvoice.invoiceDate,
        };
        return await Payment.create(payment);
    }

    /**
     * Create a manual admin adjustment payment (REPAIR / DAMAGE / MAINTENANCE / WORKSHOP)
     */


    async createInitialFeePayment(device, contract, invoice, initialFee, date) {
        try {
            const paymentId = helper.generateInvoiceIdInitialFee(device.name, date);
            return this.createStandarPayment(initialFee, paymentId, device.name, contract, invoice, device.companyId, PAYMENT_TYPE.INITIAL_FEE);
        } catch (error) {
            logger.error('Error creating initial fee payment:', error);
            throw error;
        }
    }

    /**
    * Claim payment for processing (Atomic Lock)
    * Returns the payment if successfully locked, or null if already used/not found.
    */
    async claimPaymentForProcessing(data) {
        try {

            // 2. Try to lock it
            const payment = await Payment.findOneAndUpdate(
                { _id: data._id, used: false },
                { $set: { used: true } },
                {
                    new: true,
                }
            );
            return payment;
        } catch (error) {
            logger.error('Error en claimPaymentForProcessing:', error);
            throw error;
        }
    }

    /**
    * Upsert payment
    */
    async upsertPayment(data) {
        try {
            const payment = await Payment.findOneAndUpdate(
                { _id: data._id },
                { $set: data },
                {
                    upsert: true,
                    new: true,
                    runValidators: false,
                }
            );
            return payment;
        } catch (error) {
            logger.error('Error en upsertPayment:', error);
            throw error;
        }
    }

    /**
     * Get payment by payment_id
     */
    async getPaymentById(paymentId) {
        return await Payment.findOne({ paymentId }).lean();
    }

    /**
     * Get payment by invoice_id (1-to-1 relationship)
     */
    async getPaymentByInvoiceId(invoiceId) {
        return await Payment.findOne({ invoiceId }).lean();
    }

    /**
     * Get payment by payment reference
     */
    async getPaymentByReference(paymentId) {
        return await Payment.findOne({ paymentId }).lean();
    }

    /**
     * Get payment by Wompi transaction ID
     */
    async getPaymentByTransactionId(transactionId) {
        return await Payment.findOne({ wompiTransactionId: transactionId }).lean();
    }

    /**
     * Update payment with Wompi response
     */
    async updatePaymentWithWompiResponse({
        paymentId,
        wompiTransactionId,
        checkoutUrl,
        wompiResponse
    }) {
        return await Payment.findOneAndUpdate(
            { paymentId },
            {
                wompiTransactionId,
                checkoutUrl,
                wompiResponse,
            },
            { new: true }
        ).lean();
    }

    /**
     * Update payment status from webhook
     */
    async updatePaymentStatus({
        paymentReference,
        status,
        paymentMethodType = null,
        payerEmail = null,
        payerPhone = null
    }) {
        const update = { status };

        if (paymentMethodType) update.paymentMethodType = paymentMethodType;
        if (payerEmail) update.payerEmail = payerEmail;
        if (payerPhone) update.payerPhone = payerPhone;

        return await Payment.findOneAndUpdate(
            { paymentReference },
            update,
            { new: true }
        ).lean();
    }

    /**
     * Get payments by status
     */
    async getPaymentsByStatus(status, limit = 100) {
        return await Payment.find({ status })
            .sort({ createdAt: -1 })
            .limit(limit)
            .lean();
    }

    /**
     * Get pending payments older than N minutes
     */
    async getPendingPaymentsOlderThan(minutes = 30) {
        const cutoffTime = new Date(Date.now() - minutes * 60 * 1000);

        return await Payment.find({
            status: PAYMENT_STATUS.PENDING,
            createdAt: { $lt: cutoffTime },
        })
            .sort({ createdAt: 1 })
            .lean();
    }

    async findPendingPayment(deviceName, pendingMilliseconds) {
        try {
            const cutoffTime = dayjs().subtract(pendingMilliseconds, 'milliseconds').toDate();
            const pendingPayment = await Payment.findOne({
                deviceIdName: deviceName,
                status: PAYMENT_STATUS.S_PENDING,
                createdAt: { $gte: cutoffTime }
            }).sort({ createdAt: -1 });
            return pendingPayment;
        } catch (error) {
            logger.error(`Error finding pending payment for ${deviceName}:`, error);
            throw error;
        }
    }



    /**
     * Get all payments with pagination and optional status filter
     */
    async getAllPaymentsPaginated({ page = 1, limit = 50, status = null, filter = null }) {
        let query = {};
        if (filter) {
            query = { ...filter };
        }
        if (status) {
            query.status = status;
        }

        // Convert companyId string to ObjectId if present, as aggregation pipelines bypass Mongoose schema casting
        if (query.companyId && typeof query.companyId === 'string' && mongoose.Types.ObjectId.isValid(query.companyId)) {
            query.companyId = new mongoose.Types.ObjectId(query.companyId);
        }

        const companyTz = 'America/Bogota';
        const tzOffsetMs = dayjs().tz(companyTz).utcOffset() * 60000;

        const [daysResult, totalPaymentsCount] = await Promise.all([
            Payment.aggregate([
                { $match: query },
                {
                    $group: {
                        _id: {
                            $dateToString: {
                                format: "%Y-%m-%d",
                                date: { $add: ["$createdAt", tzOffsetMs] }
                            }
                        }
                    }
                },
                { $sort: { _id: -1 } }
            ]),
            Payment.countDocuments(query)
        ]);

        if (daysResult.length === 0) {
            return {
                payments: [],
                pagination: {
                    page: 1,
                    limit: 0,
                    total: 0,
                    totalPages: 0,
                    hasNext: false,
                    hasPrev: false
                }
            };
        }

        const currentPage = Math.max(1, Math.min(Number(page), daysResult.length));
        const selectedDayStr = daysResult[currentPage - 1]._id;

        const startOfDay = dayjs.tz(selectedDayStr, companyTz).startOf('day').toDate();
        const endOfDay = dayjs.tz(selectedDayStr, companyTz).endOf('day').toDate();

        query.createdAt = { $gte: startOfDay, $lte: endOfDay };

        const payments = await Payment.find(query)
            .sort({ createdAt: -1 })
            .lean();

        // Normalize legacy data
        const normalizedPayments = payments.map(p => ({
            ...p,
            amount: p.amount,
            paymentReference: p.paymentReference || p.reference,
            invoiceId: p.invoiceId || p.unpaidInvoiceId,
            paymentId: p.paymentId || p._id,
            status: p.type === PAYMENT_TYPE.FREE ? 'Free' : (p.status || (p.response === 'APPROVED' ? 'APPROVED' : 'PENDING')), // Fallback if status missing
            deviceId: p.deviceIdName || p.deviceId // Prefer name, fallback to ID
        }));

        const totalDays = daysResult.length;

        return {
            payments: normalizedPayments,
            pagination: {
                page: currentPage,
                limit: payments.length,
                total: totalPaymentsCount,
                totalPages: totalDays,
                hasNext: currentPage < totalDays,
                hasPrev: currentPage > 1
            }
        };
    }

    /**
     * Get payment history for a device
     */
    async getPaymentHistory(deviceIdName, limit = 50) {
        // Get invoices for this device
        const Invoice = (await import('../models/index.js')).Invoice;
        const invoices = await Invoice.find({ deviceIdName }).select('invoiceId').lean();
        const invoiceIds = invoices.map(inv => inv.invoiceId);

        const payments = await Payment.find({ invoiceId: { $in: invoiceIds } })
            .sort({ createdAt: -1 })
            .limit(limit)
            .lean();

        return payments.map(p => ({
            ...p,
            amount: p.amount !== undefined ? p.amount : p.amount_in_cents,
            paymentReference: p.paymentReference || p.reference,
            invoiceId: p.invoiceId || p.unpaidInvoiceId,
            paymentId: p.paymentId || p._id,
            deviceId: p.deviceIdName || p.deviceId
        }));
    }
    /**
     * Recalculate total revenue from actual APPROVED payments for a company.
     * @param {string|ObjectId} companyId
     * @param {{ month?: number, year?: number }} options  — scope to a month or year
     * @returns {Promise<number>} total amount in COP
     */
    async getTotalRevenueByCompany(companyId, { month, year } = {}) {
        const match = {
            companyId: new mongoose.Types.ObjectId(companyId),
            status: { $in: ['APPROVED', 'COMPLETED'] },
        };

        if (month && year) {
            match.createdAt = { $gte: new Date(year, month - 1, 1), $lt: new Date(year, month, 1) };
        } else if (year) {
            match.createdAt = { $gte: new Date(year, 0, 1), $lt: new Date(year + 1, 0, 1) };
        }

        const result = await Payment.aggregate([
            { $match: match },
            { $group: { _id: null, total: { $sum: '$amount' } } }
        ]);
        return result[0]?.total ?? 0;
    }
}

export default new PaymentRepository();
