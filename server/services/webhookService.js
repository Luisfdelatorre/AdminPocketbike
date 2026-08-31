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
        console.log("eventData", eventData);

        if (eventData.eventType === WOMPI_EVENTS.TRANSACTION_UPDATED) {
            const paymentData = wompiAdapter.getPaymentData();
            let processingResult = { success: true };
            const dummyOnUpdate = () => { };

            if (paymentData.status === PAYMENT_STATUS.S_APPROVED) {
                try {
                    processingResult = await paymentService.processApprovedPayment(paymentData, dummyOnUpdate);
                    sseService.broadcast('payment-updated', {
                        type: 'payment',
                        reference: paymentData.reference,
                        amount: paymentData.amountInCents ? paymentData.amountInCents / 100 : paymentData.amount,
                        status: paymentData.status,
                        timestamp: new Date().toISOString()
                    });
                } catch (err) {
                    console.error(`[WEBHOOK] processApprovedPayment failed for ${eventData.paymentReference}: ${err.message}`);
                    processingResult = { success: false, error: err.message };
                }
            } else if (
                paymentData.status === PAYMENT_STATUS.S_DECLINED ||
                paymentData.status === PAYMENT_STATUS.S_VOIDED  ||
                paymentData.status === PAYMENT_STATUS.S_ERROR
            ) {
                // Safely handle declined/failed payments: free up the reserved invoice
                try {
                    if (paymentData.reference) {
                        // Update the payment status in DB to mirror Wompi's final status
                        await paymentRepository.updatePaymentStatus({
                            paymentReference: paymentData.reference,
                            status: paymentData.status,
                        });
                        console.log(`[WEBHOOK] Payment ${paymentData.reference} marked as ${paymentData.status}`);
                    }
                } catch (statusErr) {
                    console.error(`[WEBHOOK] Failed to update declined payment status for ${paymentData.reference}: ${statusErr.message}`);
                }

                try {
                    // Unreserve the invoice so the customer can retry payment
                    if (paymentData.invoiceId || paymentData.unpaidInvoiceId) {
                        const invoiceId = paymentData.invoiceId || paymentData.unpaidInvoiceId;
                        await invoiceRepository.unreserveInvoice(invoiceId);
                        console.log(`[WEBHOOK] Invoice ${invoiceId} unreserved after ${paymentData.status}`);
                    }
                } catch (unreserveErr) {
                    console.error(`[WEBHOOK] Failed to unreserve invoice for ${paymentData.reference}: ${unreserveErr.message}`);
                }

                processingResult = { success: true, status: paymentData.status };
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
     * Recover pending payments (delegates to paymentService domain logic)
     */
    async recoverPendingPayments(olderThanMinutes = 0) {
        return await paymentService.reconcilePendingPayments(olderThanMinutes);
    }
}

export default new WebhookService();
