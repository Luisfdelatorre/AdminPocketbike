import express from 'express';
import dashboardController from '../controllers/dashboardController.js';

const router = express.Router();

/**
 * GET /api/dashboard/stats
 * Get dashboard statistics including revenue, contracts, payments, devices
 */
router.get('/stats', dashboardController.getDashboardStats);

export default router;
