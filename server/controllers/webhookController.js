import webhookService from '../services/webhookService.js';
import WompiAdapter from '../adapters/wompiAdapter/wompiAdapter.js';
import logger from '../config/logger.js';

/**
 * Receive Wompi webhook events
 */
const handleWompiWebhook = async (req, res) => {
    try {
        // Adapter is attached by middleware, or create new if not present (defensive)
        const wompiAdapter = req.wompiAdapter || new WompiAdapter(req.body);

        // 1️⃣ Responder inmediatamente (evita timeout en Wompi)
        res.status(200).json({
            success: true,
            message: 'Webhook received',
        });

        // 2️⃣ Procesar en segundo plano
        setImmediate(async () => {
            try {
                const result = await webhookService.processWebhook(wompiAdapter);
                logger.info('Wompi webhook processed', result);
            } catch (err) {
                logger.error('Error processing Wompi webhook asynchronously', {
                    error: err.message,
                    stack: err.stack,
                });
            }
        });
    } catch (err) {
        // ⚠️ Errores esperados del adapter
        if (
            err.message === 'Missing fields' ||
            err.message === 'Invalid reference format'
        ) {
            return res.status(400).send(`Bad Request: ${err.message}`);
        }

        // ⚠️ Errores internos inesperados
        logger.error('Unhandled error in handleWompiWebhook', {
            error: err.message,
            stack: err.stack,
            body: req.body,
        });

        // Wompi espera SIEMPRE 200 — pero acá es error de tu server
        return res.status(500).send('Internal Server Error');
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
