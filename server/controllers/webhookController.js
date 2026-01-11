import webhookService from '../services/webhookService.js';

/**
 * Receive Wompi webhook events
 */
const handleWompiWebhook = async (req, res) => {
    try {
        const payload = req.body;

        if (!payload.signature || !payload.timestamp) {
            return res.status(400).json({
                success: false,
                error: 'Missing signature or timestamp headers',
            });
        }

        const result = await webhookService.processWebhook(payload);

        res.json({
            success: true,
            message: result.message,
        });
    } catch (error) {
        console.error('Webhook processing error:', error);
        res.status(500).json({
            success: false,
            error: error.message,
        });
    }
};

/**
 * Manually trigger recovery of pending payments
 */
const recoverPending = async (req, res) => {
    try {
        const { olderThanMinutes = 30 } = req.body;

        const results = await webhookService.recoverPendingPayments(olderThanMinutes);

        res.json({
            success: true,
            data: results,
        });
    } catch (error) {
        console.error('Recover pending payments error:', error);
        res.status(500).json({
            success: false,
            error: error.message,
        });
    }
};

export default {
    handleWompiWebhook,
    recoverPending
};
