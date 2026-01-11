import express from 'express';
import deviceAccessController from '../controllers/deviceAccessController.js';

const router = express.Router();

/**
 * POST /api/device-access/create
 * Create or update PIN for a device
 */
router.post('/create', deviceAccessController.createDeviceAccess);

/**
 * GET /api/device-access/:deviceId
 * Get device access info (without PIN)
 */
router.get('/:deviceId', deviceAccessController.getDeviceAccess);

/**
 * DELETE /api/device-access/:deviceId
 * Deactivate device access
 */
router.delete('/:deviceId', deviceAccessController.deactivateDeviceAccess);

export default router;
