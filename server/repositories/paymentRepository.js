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
     * Get monthly payment summary for matrix view
     */
    async getMonthlyPaymentSummary({ month, year, companyId }) {
        try {
            const devices = await Device.find({ hasActiveContract: true }).lean();
            const deviceMap = devices.reduce((acc, dev) => {
                acc[dev.name] = {
                    device: {
                        name: dev.name,
                        deviceId: dev.deviceId || dev._id,
                        driverName: dev.driverName || 'Sin Conductor',
                        unpaidTotal: 0
                    },
                    days: {}
                };
                return acc;
            }, {});

            const startDate = dayjs().year(year).month(month - 1).startOf('month').toDate();
            const endDate = dayjs().year(year).month(month - 1).endOf('month').toDate();
            const deviceQuery = { date: { $gte: startDate, $lte: endDate } };
            if (companyId) deviceQuery.companyId = companyId;

            const invoices = await Invoice.find(deviceQuery).lean();
            const payments = await Payment.totalPerDayByDevice(startDate, endDate, companyId);
            const paymentsObj = payments.length > 0 ? payments[0] : {};
            console.log(paymentsObj);

            // 4. Group by device and calculate unpaid amounts
            invoices.forEach((invoice) => {
                const devName = invoice.deviceIdName;

                // Skip if device not in active devices map
                if (!deviceMap[devName]) {
                    return;
                }

                const dateKey = dayjs(invoice.date).format('YYYY-MM-DD');
                const day = new Date(invoice.date).getUTCDate();

                // Safely get totalPaid from nested object
                const totalPaid = paymentsObj[devName]?.[dateKey]?.totalPaid || 0;


                // Initialize unpaidTotal if not exists
                if (!deviceMap[devName].device.unpaidTotal) {
                    deviceMap[devName].device.unpaidTotal = 0;
                }

                // Add to device's total unpaid amount
                if (invoice.dayType !== 'FREE') {
                    deviceMap[devName].device.unpaidTotal += invoice.amount - invoice.paidAmount;
                }

                deviceMap[devName].days[day] = {
                    ...invoice,
                    totalPaid,
                };
            });

            return Object.values(deviceMap);

        } catch (error) {
            logger.error('Error getting monthly payment summary:', error);
            throw error;
        }
    }


    /**
     * Create a payment for an invoice
     */
    async createPayment({ invoiceId, amount, currency = 'COP', companyId, companyName = null }) {
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

            // Use local timezone (default: America/Bogota)
            const now = dayjs().toDate();

            const payment = {
                _id: reference,
                type: PAYMENT_TYPE.LOAN,
                deviceIdName: deviceIdName,
                deviceId: contract.deviceId,
                amount_in_cents: 0,
                amount: 0,
                reference: reference,
                status: PAYMENT_STATUS.S_APPROVED,
                created_at: now,
                finalized_at: now,
                phoneNumber: contract.customerPhone || '',
                used: true,
                unpaidInvoiceId: unpaidInvoice._id,
                invoiceId: unpaidInvoice._id,
                payment_method_type: PAYMENT_TYPE.LOAN,
                companyId: unpaidInvoice.companyId
            };

            const newPayment = await Payment.create(payment);
            return newPayment;
        } catch (error) {
            logger.error('Error creating loan payment:', error);
            throw error;
        }
    }

    async createFreePayment(deviceIdName, contract, unpaidInvoice, companyId) {
        try {
            const reference = helper.generateReferenceFreeDay(unpaidInvoice._id);

            // Use local timezone (default: America/Bogota)
            const now = dayjs().toDate();

            const payment = {
                _id: reference,
                paymentId: reference,
                type: PAYMENT_TYPE.FREE,
                deviceIdName: deviceIdName,
                deviceId: contract.deviceId,
                amount_in_cents: 0,
                amount: 0,
                reference: reference,
                status: PAYMENT_STATUS.S_APPROVED,
                created_at: now,
                finalized_at: now,
                phoneNumber: contract.customerPhone || '',
                used: false,
                unpaidInvoiceId: unpaidInvoice._id,
                invoiceId: unpaidInvoice.invoiceId,
                payment_method_type: PAYMENT_TYPE.FREE,
                companyId: companyId,
            };
            console.log("***payment", payment);

            const newPayment = await Payment.create(payment);
            return newPayment;
        } catch (error) {
            logger.error('Error creating free payment:', error);
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
        const skip = (page - 1) * limit;
        let query = {};
        if (filter) {
            query = { ...filter };
        } else if (status) {
            query.status = status;
        }

        const [payments, total] = await Promise.all([
            Payment.find(query)
                .sort({ createdAt: -1 })
                .skip(skip)
                .limit(limit)
                .lean(),
            Payment.countDocuments(query)
        ]);
        console.log("Payments:", payments);

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

        return {
            payments: normalizedPayments,
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


}

export default new PaymentRepository();
