import express from 'express';
import { verifyToken } from '../middleware/authMiddleware.js';
import companyController from '../controllers/companyController.js';

const router = express.Router();

// Apply middleware to all routes
router.use(verifyToken);

router.post('/', companyController.createCompany);
router.put('/:id', companyController.updateCompany);
router.get('/', companyController.getAllCompanies);

export default router;
