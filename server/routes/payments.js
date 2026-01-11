import express from 'express';
import paymentController from '../controllers/paymentController.js';

const router = express.Router();

/**
 * GET /api/payments/all
 * Get all payments across all devices with pagination
 * Query params: page (default: 1), limit (default: 50), status (optional filter)
 */
router.get('/all', paymentController.getAllPayments);


/**
 * POST /api/payments/create-intent
 * Create payment intent for the oldest unpaid invoice
 */
router.post('/create-intent', paymentController.createPaymentIntent);

/**
 * POST /api/payments/create-batch-intent
 * Create payment intents for multiple invoices (sequentially)
 * Body: { deviceId, count, customerEmail }
 */
router.post('/create-batch-intent', paymentController.createBatchPaymentIntent);

/**
 * GET /api/payments/status/:reference
 * Get payment status by reference
 */
router.get('/status/:reference', paymentController.getPaymentStatus);

/**
 * GET /api/payments/unpaid/:deviceId
 * Get all unpaid invoices for a device
 */
router.get('/unpaid/:deviceId', paymentController.getUnpaidInvoices);

/**
 * GET /api/payments/history/:deviceId
 * Get payment history for a device
 */
router.get('/history/:deviceId', paymentController.getPaymentHistory);

/**
 * POST /api/payments/verify/:reference
 * Manually verify a transaction with Wompi
 */
router.post('/verify/:reference', paymentController.verifyTransaction);

export default router;
