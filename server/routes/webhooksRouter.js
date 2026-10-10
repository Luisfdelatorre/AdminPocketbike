import express from 'express';
import webhookController from '../controllers/webhookController.js';
import { validateWompiSignature } from '../middleware/wompiMiddleware.js';

const router = express.Router();

/**
 * POST /api/webhooks/wompi
 * Receive Wompi webhook events
 */
router.post('/wompi', validateWompiSignature, webhookController.handleWompiWebhook);

export default router;
