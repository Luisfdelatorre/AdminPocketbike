import express from 'express';
import { companyBillingController } from '../controllers/companyBillingController.js';
import { authenticate } from '../middleware/auth.js';

const router = express.Router();

// Get list of invoices (filtered by companyId if admin, or restricted to user's company)
router.get('/', authenticate, companyBillingController.getInvoices);

// Generate a new monthly invoice (System Admin only)
router.post('/generate', authenticate, companyBillingController.generateInvoice);

export default router;
