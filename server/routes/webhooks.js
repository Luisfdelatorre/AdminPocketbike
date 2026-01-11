import express from 'express';
import webhookController from '../controllers/webhookController.js';

const router = express.Router();

/**
 * POST /api/webhooks/wompi
 * Receive Wompi webhook events
 */
router.post('/wompi', webhookController.handleWompiWebhook);

/**
 * POST /api/webhooks/recover-pending
 * Manually trigger recovery of pending payments
 */
router.post('/recover-pending', webhookController.recoverPending);

export default router;
