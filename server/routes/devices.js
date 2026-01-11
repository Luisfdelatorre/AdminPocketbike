import express from 'express';
import deviceController from '../controllers/deviceController.js';

const router = express.Router();

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
