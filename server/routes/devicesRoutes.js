import express from 'express';
import deviceController from '../controllers/deviceController.js';

import { verifyToken, requireWriteRole, requireSuperAdmin } from '../middleware/authMiddleware.js';

const router = express.Router();

// Apply middleware to all routes
router.use(verifyToken);

/**
 * GET /api/devices
 * Get all devices
 */
router.get('/', deviceController.getAllDevices);

/**
 * POST /api/devices
 * Create a new device
 */
router.post('/', requireWriteRole, deviceController.createDevice);

/**
 * POST /api/devices/sync
 * Sync devices from external GPS platform
 */
router.post('/sync', requireWriteRole, deviceController.syncDevices);
router.post('/assign-to-company', requireSuperAdmin, deviceController.assignDevicesToCompany);

/**
 * GET /api/devices/status
 * Get device online/cutoff status
 */
router.get('/status', deviceController.getDeviceStatus);

/**
 * POST /api/devices/cutoff-debtors
 * Cut off engines of all devices with unpaid debt
 */
router.post('/cutoff-debtors', requireWriteRole, deviceController.cutoffDebtors);

/**
 * PUT /api/devices/:deviceId
 * Update device information
 */
router.put('/:deviceId', requireWriteRole, deviceController.updateDevice);

/**
 * POST /api/devices/:deviceId/engine
 * Control device engine (stop/resume)
 */
router.post('/:id/engine', requireWriteRole, deviceController.controlEngine);

/**
 * DELETE /api/devices/:deviceId
 * Delete a device (soft delete - set inactive)
 */
router.delete('/:deviceId', requireWriteRole, deviceController.deleteDevice);

export default router;
