import { WebhookEvent, TransactionVerification } from '../models/index.js';

export class WebhookRepository {
    /**
     * Record incoming webhook event (idempotent)
     * Returns true if event was newly inserted, false if already exists
     */
    async recordWebhookEvent({
        eventId,
        eventType,
        transactionId,
        paymentReference,
        status,
        signature,
        payload
    }) {
        try {
            await WebhookEvent.create({
                eventId,
                eventType,
                transactionId,
                paymentReference,
                status,
                signature,
                payload,
            });

            // Successfully inserted, it's a new event
            return true;
        } catch (error) {
            // Duplicate event_id (already processed)
            if (error.code === 11000) {
                return false;
            }
            throw error;
        }
    }

    /**
     * Mark webhook event as processed
     */
    async markEventAsProcessed(eventId) {
        await WebhookEvent.findOneAndUpdate(
            { eventId },
            {
                processed: true,
                processedAt: new Date(),
            }
        );
    }

    /**
     * Get webhook event by event_id
     */
    async getEventById(eventId) {
        return await WebhookEvent.findOne({ eventId }).lean();
    }

    /**
     * Get unprocessed webhook events
     */
    async getUnprocessedEvents(limit = 100) {
        return await WebhookEvent.find({ processed: false })
            .sort({ createdAt: 1 })
            .limit(limit)
            .lean();
    }

    /**
     * Get webhook events for a payment reference
     */
    async getEventsByPaymentReference(paymentReference) {
        return await WebhookEvent.find({ paymentReference })
            .sort({ createdAt: -1 })
            .lean();
    }

    /**
     * Record transaction verification
     */
    async recordVerification({
        paymentReference,
        verificationType,
        wompiStatus,
        localStatus,
        match,
        response
    }) {
        await TransactionVerification.create({
            paymentReference,
            verificationType,
            wompiStatus,
            localStatus,
            match,
            response,
        });
    }

    /**
     * Get verification history for a payment
     */
    async getVerificationHistory(paymentReference, limit = 10) {
        return await TransactionVerification.find({ paymentReference })
            .sort({ createdAt: -1 })
            .limit(limit)
            .lean();
    }
}

export default new WebhookRepository();
