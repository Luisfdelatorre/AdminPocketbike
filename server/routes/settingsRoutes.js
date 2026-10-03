import express from 'express';
import settingController from '../controllers/settingController.js';
import { verifyToken } from '../middleware/authMiddleware.js';

const router = express.Router();

// GET /apinode/settings/adjustment-types
router.get('/adjustment-types', verifyToken, settingController.getAdjustmentTypes);

// PUT /apinode/settings/adjustment-types (Admin only)
router.put('/adjustment-types', verifyToken, settingController.updateAdjustmentTypes);

// GET /apinode/settings/payment-status
router.get('/payment-status', verifyToken, settingController.getPaymentStatuses);

// PUT /apinode/settings/payment-status (Admin only)
router.put('/payment-status', verifyToken, settingController.updatePaymentStatuses);

export default router;
