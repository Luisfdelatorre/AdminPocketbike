import express from 'express';
import { verifyToken } from '../middleware/authMiddleware.js';
import * as alertController from '../controllers/alertController.js';

const router = express.Router();

/**
 * GET /apinode/alerts
 * Get paginated telemetry alerts history
 */
router.get('/', verifyToken, alertController.getAlertsHistory);

/**
 * GET /apinode/alerts/stats
 * Get telemetry alerts summary stats
 */
router.get('/stats', verifyToken, alertController.getAlertsStats);

/**
 * PATCH /apinode/alerts/:id/status
 * Acknowledge or resolve an alert
 */
router.patch('/:id/status', verifyToken, alertController.updateAlertStatus);

export default router;
