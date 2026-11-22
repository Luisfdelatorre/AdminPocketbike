import express from 'express';
import { companyBillingController } from '../controllers/companyBillingController.js';
import { authenticate } from '../middleware/auth.js';
import { requireWriteRole } from '../middleware/authMiddleware.js';

const router = express.Router();

// Get list of invoices (filtered by companyId if admin, or restricted to user's company)
router.get('/', authenticate, companyBillingController.getInvoices);

// Generate a new monthly invoice (Admin/Manager/SuperAdmin only)
router.post('/generate', authenticate, requireWriteRole, companyBillingController.generateInvoice);

export default router;
