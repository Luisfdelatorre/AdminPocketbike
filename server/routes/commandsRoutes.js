import express from 'express';
import { verifyToken } from '../middleware/authMiddleware.js';
import * as commandController from '../controllers/commandController.js';

const router = express.Router();

/**
 * GET /api/v1/commands
 * Get paginated command history
 */
router.get('/', verifyToken, commandController.getCommandHistory);

/**
 * GET /api/v1/commands/stats
 * Get telemetry metrics for active period
 */
router.get('/stats', verifyToken, commandController.getCommandStats);

/**
 * POST /api/v1/commands/send
 * Issue a new engine command
 */
router.post('/send', verifyToken, commandController.sendCommand);

export default router;

