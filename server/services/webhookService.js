import paymentRepository from '../repositories/paymentRepository.js';
import invoiceRepository from '../repositories/invoiceRepository.js';
import webhookRepository from '../repositories/webhookRepository.js';
import wompiService from './wompiService.js';
import paymentService from './paymentService.js';
import { sseService } from '../utils/sseService.js';
import { Transaction, WOMPI_EVENTS } from '../config/config.js';


const { PAYMENT_STATUS, INVOICE_DAYTYPE: INVOICE_STATUS } = Transaction;

export class WebhookService {
    /**
     * Process incoming Wompi webhook
     */
    async processWebhook(wompiAdapter) {
        const eventData = wompiAdapter.getEventData();

        if (eventData.eventType === WOMPI_EVENTS.TRANSACTION_UPDATED) {
            const paymentData = wompiAdapter.getPaymentData();
            const dummyOnUpdate = () => { };
            if (paymentData.status === PAYMENT_STATUS.APPROVED) {
                await paymentService.processApprovedPayment(paymentData, dummyOnUpdate);
            }
            await webhookRepository.recordWebhookEvent(eventData);
        }

        return {
            success: true,
            message: 'Webhook processed successfully',
            duplicate: false,
        };
    }

    /**
     * Handle transaction.updated event
     */

    /**
     * Recover pending payments (check status with Wompi)
     */
    async recoverPendingPayments(olderThanMinutes = 30) {
        const pendingPayments = await paymentRepository.getPendingPaymentsOlderThan(olderThanMinutes);

        console.log(`🔍 Found ${pendingPayments.length} pending payments older than ${olderThanMinutes} minutes`);

        const results = [];

        for (const payment of pendingPayments) {
            if (!payment.wompiTransactionId) {
                console.log(`⏭️  Skipping payment ${payment.paymentReference} - no transaction ID`);
                continue;
            }

            try {
                const verification = await wompiService.verifyTransaction(payment.wompiTransactionId);
                const wompiStatus = wompiService.mapStatus(verification.status);

                if (wompiStatus !== payment.status) {
                    console.log(`🔄 Status mismatch for ${payment.paymentReference}: local=${payment.status}, wompi=${wompiStatus}`);

                    // Update payment
                    await paymentRepository.updatePaymentStatus({
                        paymentReference: payment.paymentReference,
                        status: wompiStatus,
                    });

                    // Update invoice
                    let invoiceStatus;
                    if (wompiStatus === PAYMENT_STATUS.APPROVED) {
                        invoiceStatus = INVOICE_STATUS.PAID;
                    } else if (wompiStatus === PAYMENT_STATUS.DECLINED || wompiStatus === PAYMENT_STATUS.ERROR) {
                        invoiceStatus = INVOICE_STATUS.FAILED;
                    }

                    if (invoiceStatus) {
                        await invoiceRepository.updateInvoiceStatus(
                            payment.invoiceId,
                            invoiceStatus,
                            payment.paymentReference
                        );
                    }

                    results.push({
                        paymentReference: payment.paymentReference,
                        oldStatus: payment.status,
                        newStatus: wompiStatus,
                        updated: true,
                    });
                } else {
                    results.push({
                        paymentReference: payment.paymentReference,
                        status: wompiStatus,
                        updated: false,
                    });
                }

                // Record verification
                await webhookRepository.recordVerification({
                    paymentReference: payment.paymentReference,
                    verificationType: 'scheduled',
                    wompiStatus,
                    localStatus: payment.status,
                    match: wompiStatus === payment.status,
                    response: verification.response,
                });

            } catch (error) {
                console.error(`❌ Error verifying payment ${payment.paymentReference}:`, error.message);
                results.push({
                    paymentReference: payment.paymentReference,
                    error: error.message,
                });
            }
        }

        return results;
    }
}

export default new WebhookService();
