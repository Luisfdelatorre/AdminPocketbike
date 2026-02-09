import express from 'express';
import invoiceController from '../controllers/invoiceController.js';
import { verifyToken } from '../middleware/authMiddleware.js';


const router = express.Router();



router.get('/history', verifyToken, invoiceController.getInvoiceHistory);


/**
 * POST /api/invoices/create
 * Create a daily invoice for a device
 */
router.post('/create', verifyToken, invoiceController.createInvoice);


/**
 * GET /api/invoices/all
 * Get all invoices with pagination
 * Query params: page (default: 1), limit (default: 50), status (optional filter)
 */
router.get('/all', verifyToken, invoiceController.getAllInvoices);

/**
 * GET /api/invoices/:deviceId
 * Get all invoices for a device
 */
router.get('/:deviceId', verifyToken, invoiceController.getInvoicesByDevice);

/**
 * GET /api/invoices/:deviceId/unpaid
 * Get unpaid invoices for a device
 */
router.get('/:deviceId/unpaid', invoiceController.getUnpaidInvoices);

export default router;
