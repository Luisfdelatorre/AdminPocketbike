import express from 'express';
import contractController from '../controllers/contractController.js';

const router = express.Router();

/**
 * GET /api/contracts/devices
 * Get all devices with contracts for device selector
 */
router.get('/devices', contractController.getDevicesWithContracts);

/**
 * GET /api/contracts/all
 * Get all contracts (for contracts management page)
 */
router.get('/all', contractController.getAllContracts);

/**
 * POST /api/contracts/create
 * Create a new 500-day contract
 */
router.post('/create', contractController.createContract);

/**
 * GET /api/contracts/expiring/:daysThreshold
 * Get contracts expiring within N days
 */
router.get('/expiring/:daysThreshold', contractController.getExpiringContracts);

/**
 * GET /api/contracts/:deviceId
 * Get active contract for a device
 */
router.get('/:deviceId', contractController.getActiveContract);

/**
 * GET /api/contracts/:deviceId/stats
 * Get contract statistics
 */
router.get('/:deviceId/stats', contractController.getContractStats);

/**
 * GET /api/contracts/:deviceId/all
 * Get all contracts for a device (including completed/cancelled)
 */
router.get('/:deviceId/all', contractController.getAllContractsForDevice);

/**
 * PUT /api/contracts/:contractId/status
 * Update contract status
 */
router.put('/:contractId/status', contractController.updateContractStatus);

/**
 * PUT /api/contracts/:contractId/update
 * Update contract details (customer info, notes, etc.)
 */
router.put('/:contractId/update', contractController.updateContract);

export default router;
