import express from 'express';
import { verifyToken, requireWriteRole, requireSuperAdmin } from '../middleware/authMiddleware.js';
import companyController from '../controllers/companyController.js';

const router = express.Router();

// Public endpoint for branding (no auth required)
router.get('/branding', companyController.getBranding);


// Authenticated routes
router.use(verifyToken);

router.post('/', requireSuperAdmin, companyController.createCompany);
router.post('/validate-traccar', requireWriteRole, companyController.validateTraccar);
router.get('/settings', companyController.getSettings);
router.put('/settings', requireWriteRole, companyController.updateSettings);
router.get('/:id/traccar-notifications', companyController.getTraccarNotifications);
router.put('/:id/traccar-notifications', requireWriteRole, companyController.updateTraccarNotifications);
router.put('/branding/update', requireWriteRole, companyController.updateBranding); // Specific route first
router.put('/:id', requireSuperAdmin, companyController.updateCompany); // Param route last
router.get('/', companyController.getAllCompanies);

export default router;
