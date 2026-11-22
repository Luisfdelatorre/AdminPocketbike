import express from 'express';
import settingController from '../controllers/settingController.js';
import { verifyToken, requireSuperAdmin } from '../middleware/authMiddleware.js';

const router = express.Router();

// GET /apinode/settings/adjustment-types
router.get('/adjustment-types', verifyToken, settingController.getAdjustmentTypes);

// PUT /apinode/settings/adjustment-types (SuperAdmin only)
router.put('/adjustment-types', verifyToken, requireSuperAdmin, settingController.updateAdjustmentTypes);

// GET /apinode/settings/payment-status
router.get('/payment-status', verifyToken, settingController.getPaymentStatuses);

// PUT /apinode/settings/payment-status (SuperAdmin only)
router.put('/payment-status', verifyToken, requireSuperAdmin, settingController.updatePaymentStatuses);

// GET /apinode/settings/ocr-templates
router.get('/ocr-templates', verifyToken, settingController.getOcrTemplates);

// PUT /apinode/settings/ocr-templates (SuperAdmin only)
router.put('/ocr-templates', verifyToken, requireSuperAdmin, settingController.updateOcrTemplates);

// POST /apinode/settings/ocr-templates/reset (SuperAdmin only)
router.post('/ocr-templates/reset', verifyToken, requireSuperAdmin, settingController.resetOcrTemplates);

export default router;
