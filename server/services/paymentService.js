import invoiceRepository from '../repositories/invoiceRepository.js';
import paymentRepository from '../repositories/paymentRepository.js';
import wompiService from './wompiService.js';
import { INVOICE_STATUS, PAYMENT_STATUS } from '../config/config.js';

export class PaymentService {
    /**
     * Create payment intent for the oldest unpaid invoice
     */
    async createPaymentIntent(deviceId, customerEmail = null) {
        // Get oldest unpaid invoice
        const invoice = await invoiceRepository.getOldestUnpaidInvoice(deviceId);

        if (!invoice) {
            throw new Error('No unpaid invoices found for this device');
        }

        // Check if payment already exists for this invoice
        let payment = await paymentRepository.getPaymentByInvoiceId(invoice.invoiceId);

        if (payment) {
            // Payment already exists
            if (payment.status === PAYMENT_STATUS.APPROVED) {
                throw new Error('Invoice already paid');
            }

            if (payment.status === PAYMENT_STATUS.PENDING && payment.checkoutUrl) {
                // Return existing pending payment
                return {
                    invoice,
                    payment,
                    checkoutUrl: payment.checkoutUrl,
                    isExisting: true,
                };
            }
        }

        // Create new payment if none exists
        if (!payment) {
            payment = await paymentRepository.createPayment({
                invoiceId: invoice.invoiceId,
                amount: invoice.amount,
            });
        }

        // Create Wompi transaction
        try {
            const wompiResult = await wompiService.createTransaction({
                reference: payment.paymentReference,
                amount: payment.amount,
                currency: payment.currency,
                customerEmail,
                redirectUrl: `${process.env.FRONTEND_URL}/payment/callback?ref=${payment.paymentReference}`,
            });

            // Update payment with Wompi details
            payment = await paymentRepository.updatePaymentWithWompiResponse({
                paymentId: payment.paymentId,
                wompiTransactionId: wompiResult.transactionId,
                checkoutUrl: wompiResult.checkoutUrl,
                wompiResponse: wompiResult.response,
            });

            // Update invoice status to PENDING
            await invoiceRepository.updateInvoiceStatus(
                invoice.invoiceId,
                INVOICE_STATUS.PENDING,
                payment.paymentReference
            );

            return {
                invoice,
                payment,
                checkoutUrl: wompiResult.checkoutUrl,
                isExisting: false,
            };
        } catch (error) {
            console.error('Error creating Wompi transaction:', error);
            throw new Error('Failed to create payment: ' + error.message);
        }
    }

    /**
     * Create payment intents for multiple invoices (sequentially)
     * @param {string} deviceId - Device ID
     * @param {number} count - Number of invoices to pay (e.g., 3)
     * @param {string} customerEmail - Customer email
     * @returns {Array} Array of payment results
     */
    async createBatchPaymentIntents(deviceId, count = 3, customerEmail = null) {
        const results = [];
        const errors = [];

        // Get unpaid invoices (oldest first)
        const unpaidInvoices = await invoiceRepository.getUnpaidInvoicesByDevice(deviceId);

        if (unpaidInvoices.length === 0) {
            throw new Error('No unpaid invoices found for this device');
        }

        // Limit to available invoices
        const invoicesToPay = unpaidInvoices.slice(0, Math.min(count, unpaidInvoices.length));

        console.log(`📦 Creating batch payment for ${invoicesToPay.length} invoices sequentially...`);

        // Process invoices ONE BY ONE (sequentially)
        for (let i = 0; i < invoicesToPay.length; i++) {
            const invoice = invoicesToPay[i];

            try {
                console.log(`  ${i + 1}/${invoicesToPay.length} Processing invoice: ${invoice.invoiceId}`);

                // Check if payment already exists
                let payment = await paymentRepository.getPaymentByInvoiceId(invoice.invoiceId);

                if (payment && payment.status === PAYMENT_STATUS.APPROVED) {
                    console.log(`  ⏭️  Invoice ${invoice.invoiceId} already paid, skipping...`);
                    continue;
                }

                // Create new payment if none exists
                if (!payment) {
                    payment = await paymentRepository.createPayment({
                        invoiceId: invoice.invoiceId,
                        amount: invoice.amount,
                    });
                }

                // Create Wompi transaction
                const wompiResult = await wompiService.createTransaction({
                    reference: payment.paymentReference,
                    amount: payment.amount,
                    currency: payment.currency,
                    customerEmail,
                    redirectUrl: `${process.env.FRONTEND_URL}/payment/callback?ref=${payment.paymentReference}`,
                });

                // Update payment with Wompi details
                payment = await paymentRepository.updatePaymentWithWompiResponse({
                    paymentId: payment.paymentId,
                    wompiTransactionId: wompiResult.transactionId,
                    checkoutUrl: wompiResult.checkoutUrl,
                    wompiResponse: wompiResult.response,
                });

                // Update invoice status to PENDING
                await invoiceRepository.updateInvoiceStatus(
                    invoice.invoiceId,
                    INVOICE_STATUS.PENDING,
                    payment.paymentReference
                );

                results.push({
                    success: true,
                    invoice,
                    payment,
                    checkoutUrl: wompiResult.checkoutUrl,
                });

                console.log(`  ✅ Payment created for ${invoice.invoiceId}: ${payment.paymentReference}`);

            } catch (error) {
                console.error(`  ❌ Error creating payment for invoice ${invoice.invoiceId}:`, error.message);
                errors.push({
                    success: false,
                    invoice,
                    error: error.message,
                });
            }
        }

        console.log(`📦 Batch payment complete: ${results.length} successful, ${errors.length} failed`);

        return {
            results,
            errors,
            totalProcessed: invoicesToPay.length,
            successCount: results.length,
            errorCount: errors.length,
        };
    }

    /**
     * Get payment status
     */
    async getPaymentStatus(paymentReference) {
        const payment = await paymentRepository.getPaymentByReference(paymentReference);

        if (!payment) {
            throw new Error('Payment not found');
        }

        const invoice = await invoiceRepository.getInvoiceById(payment.invoiceId);

        return {
            payment,
            invoice,
        };
    }

    /**
     * Get all unpaid invoices for a device
     */
    async getUnpaidInvoices(deviceId) {
        return await invoiceRepository.getUnpaidInvoicesByDevice(deviceId);
    }

    /**
     * Get payment history for a device
     */
    async getPaymentHistory(deviceId, limit = 50) {
        const invoices = await invoiceRepository.getInvoicesByDevice(deviceId, limit);

        // Enrich with payment data
        const enriched = await Promise.all(
            invoices.map(async (invoice) => {
                if (invoice.paymentReference) {
                    const payment = await paymentRepository.getPaymentByReference(invoice.paymentReference);
                    return { ...invoice, payment };
                }
                return invoice;
            })
        );

        return enriched;
    }

    /**
     * Manually verify a transaction with Wompi
     */
    async verifyTransaction(paymentReference) {
        const payment = await paymentRepository.getPaymentByReference(paymentReference);

        if (!payment) {
            throw new Error('Payment not found');
        }

        if (!payment.wompiTransactionId) {
            throw new Error('No Wompi transaction ID associated with this payment');
        }

        try {
            const wompiData = await wompiService.verifyTransaction(payment.wompiTransactionId);

            const localStatus = payment.status;
            const wompiStatus = wompiService.mapStatus(wompiData.status);
            const match = localStatus === wompiStatus;

            return {
                match,
                localStatus,
                wompiStatus,
                wompiData,
                payment,
            };
        } catch (error) {
            console.error('Transaction verification error:', error);
            throw error;
        }
    }
}

export default new PaymentService();
