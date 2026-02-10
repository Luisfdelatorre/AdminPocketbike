import express from 'express';
import deviceController from '../controllers/deviceController.js';

import { verifyToken } from '../middleware/authMiddleware.js';

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
router.post('/', deviceController.createDevice);

/**
 * POST /api/devices/sync
 * Sync devices from external GPS platform
 */
router.post('/sync', deviceController.syncDevices);
router.post('/assign-to-company', deviceController.assignDevicesToCompany);

/**
 * PUT /api/devices/:deviceId
 * Update device information
 */
router.put('/:deviceId', deviceController.updateDevice);

/**
 * DELETE /api/devices/:deviceId
 * Delete a device (soft delete - set inactive)
 */
router.delete('/:deviceId', deviceController.deleteDevice);

export default router;
