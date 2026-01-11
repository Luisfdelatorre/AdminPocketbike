import express from 'express';
import invoiceController from '../controllers/invoiceController.js';

const router = express.Router();

/**
 * POST /api/invoices/create
 * Create a daily invoice for a device
 */
router.post('/create', invoiceController.createInvoice);

/**
 * GET /api/invoices/all
 * Get all invoices with pagination
 * Query params: page (default: 1), limit (default: 50), status (optional filter)
 */
router.get('/all', invoiceController.getAllInvoices);

/**
 * GET /api/invoices/:deviceId
 * Get all invoices for a device
 */
router.get('/:deviceId', invoiceController.getInvoicesByDevice);

/**
 * GET /api/invoices/:deviceId/unpaid
 * Get unpaid invoices for a device
 */
router.get('/:deviceId/unpaid', invoiceController.getUnpaidInvoices);

export default router;
