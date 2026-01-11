import paymentRepository from '../repositories/paymentRepository.js';
import invoiceRepository from '../repositories/invoiceRepository.js';
import webhookRepository from '../repositories/webhookRepository.js';
import wompiService from './wompiService.js';
import { PAYMENT_STATUS, INVOICE_STATUS, WOMPI_EVENTS } from '../config/config.js';
import { sseService } from '../utils/sseService.js';

export class WebhookService {
    /**
     * Process incoming Wompi webhook
     */
    async processWebhook(payload) {
        wompiService.init(payload);
        // Generate event ID for idempotency
        // Validate signature
        if (!wompiService.validateWebhookSignature()) {
            console.error('❌ Invalid webhook signature');
            throw new Error('Invalid webhook signature');
        }

        // Record webhook event (idempotent)
        const eventData = wompiService.getEventData()
        const isNewEvent = await webhookRepository.recordWebhookEvent(eventData);

        if (!isNewEvent) {
            console.log(`ℹ️  Webhook event ${eventData.eventId} already processed (idempotent)`);
            return {
                success: true,
                message: 'Event already processed',
                duplicate: true,
            };
        }

        console.log(`📩 Processing webhook event: ${eventData.eventId}`);

        // Process based on event type
        if (eventData.eventType === WOMPI_EVENTS.TRANSACTION_UPDATED) {
            await this.handleTransactionUpdated(eventData);
        }

        // Mark event as processed
        await webhookRepository.markEventAsProcessed(eventData.eventId);

        return {
            success: true,
            message: 'Webhook processed successfully',
            duplicate: false,
        };
    }

    /**
     * Handle transaction.updated event
     */
    async handleTransactionUpdated(data) {
        const transaction = data.transaction;
        const reference = transaction.reference;
        const wompiStatus = wompiService.mapStatus(transaction.status);

        console.log(`🔄 Transaction updated: ${reference} -> ${wompiStatus}`);

        // Find payment by reference
        const payment = await paymentRepository.getPaymentByReference(reference);

        if (!payment) {
            console.warn(`⚠️  Payment not found for reference: ${reference}`);
            return;
        }

        // Prevent downgrade from APPROVED to other statuses (safety check)
        if (payment.status === PAYMENT_STATUS.APPROVED && wompiStatus !== PAYMENT_STATUS.APPROVED) {
            console.warn(`⚠️  Attempted to change APPROVED payment ${reference} to ${wompiStatus}`);
            return;
        }

        // Update payment status
        const updatedPayment = await paymentRepository.updatePaymentStatus({
            paymentReference: reference,
            status: wompiStatus,
            paymentMethodType: transaction.payment_method_type,
            payerEmail: transaction.customer_email,
            payerPhone: transaction.customer_data?.phone_number,
        });

        // Update corresponding invoice
        let invoiceStatus;
        switch (wompiStatus) {
            case PAYMENT_STATUS.APPROVED:
                invoiceStatus = INVOICE_STATUS.PAID;
                break;
            case PAYMENT_STATUS.DECLINED:
            case PAYMENT_STATUS.ERROR:
                invoiceStatus = INVOICE_STATUS.FAILED;
                break;
            case PAYMENT_STATUS.VOIDED:
                invoiceStatus = INVOICE_STATUS.VOIDED;
                break;
            default:
                invoiceStatus = INVOICE_STATUS.PENDING;
        }

        const updatedInvoice = await invoiceRepository.updateInvoiceStatus(
            payment.invoiceId,
            invoiceStatus,
            reference
        );

        console.log(`✅ Payment ${reference} updated to ${wompiStatus}, invoice ${payment.invoiceId} -> ${invoiceStatus}`);

        // Emit SSE event for real-time updates
        sseService.broadcast('payment-updated', {
            paymentReference: reference,
            paymentStatus: wompiStatus,
            invoiceId: payment.invoiceId,
            invoiceStatus,
            payment: updatedPayment,
            invoice: updatedInvoice,
        });

        // Record verification
        await webhookRepository.recordVerification({
            paymentReference: reference,
            verificationType: 'webhook',
            wompiStatus,
            localStatus: updatedPayment.status,
            match: true,
            response: transaction,
        });
    }

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
