import express from 'express';
import { verifyToken } from '../middleware/authMiddleware.js';
import companyController from '../controllers/companyController.js';

const router = express.Router();

// Public endpoint for branding (no auth required)
router.get('/branding', companyController.getBranding);


// Authenticated routes
router.use(verifyToken);

router.post('/', companyController.createCompany);
router.get('/settings', companyController.getSettings);
router.put('/settings', companyController.updateSettings);
router.put('/branding/update', companyController.updateBranding); // Specific route first
router.put('/:id', companyController.updateCompany); // Param route last
router.get('/', companyController.getAllCompanies);

export default router;
