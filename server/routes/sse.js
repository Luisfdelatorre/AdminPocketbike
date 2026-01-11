import express from 'express';
import sseController from '../controllers/sseController.js';

const router = express.Router();

/**
 * GET /api/sse/subscribe
 * Subscribe to Server-Sent Events for real-time updates
 */
router.get('/subscribe', sseController.subscribe);

/**
 * GET /api/sse/status
 * Get SSE service status
 */
router.get('/status', sseController.getStatus);

export default router;
