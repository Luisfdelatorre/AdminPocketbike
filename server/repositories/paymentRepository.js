import { Payment } from '../models/index.js';
import { nanoid } from 'nanoid';
import { Transaction } from '../config/config.js';
import helpers from '../utils/helpers.js';
const { getToday } = helpers;
import logger from '../config/logger.js';

const { PAYMENT_STATUS } = Transaction;

export class PaymentRepository {
    /**
     * Create a payment for an invoice
     */
    async createPayment({ invoiceId, amount, currency = 'COP' }) {
        // Parse invoiceId to extract device ID
        // Format: INV-BIKE001-2026-01-05
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
            const payment = await Payment.create({
                paymentId,
                invoiceId,
                paymentReference,
                amount,
                currency,
                status: PAYMENT_STATUS.PENDING,
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
    async getPaymentByReference(paymentReference) {
        return await Payment.findOne({ paymentReference }).lean();
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
            const cutoffTime = getToday().subtract(pendingMilliseconds, 'milliseconds').toDate();
            const pendingPayment = await Payment.findOne({
                deviceIdName: deviceName,
                status: PAYMENT_STATUS.PENDING,
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
    async getAllPaymentsPaginated({ page = 1, limit = 50, status = null }) {
        const skip = (page - 1) * limit;
        const query = status ? { status } : {};

        const [payments, total] = await Promise.all([
            Payment.find(query)
                .sort({ createdAt: -1 })
                .skip(skip)
                .limit(limit)
                .lean(),
            Payment.countDocuments(query)
        ]);

        return {
            payments,
            pagination: {
                page,
                limit,
                total,
                totalPages: Math.ceil(total / limit),
                hasNext: page < Math.ceil(total / limit),
                hasPrev: page > 1
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

        return await Payment.find({ invoiceId: { $in: invoiceIds } })
            .sort({ createdAt: -1 })
            .limit(limit)
            .lean();
    }
}

export default new PaymentRepository();
