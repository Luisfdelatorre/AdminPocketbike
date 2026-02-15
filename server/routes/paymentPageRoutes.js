import express from 'express';
import paymentPageController from '../controllers/paymentPageController.js';

const router = express.Router();

/**
 * PUBLIC ROUTE
 * Serve payment page with company branding based on device ID
 */
router.get('/:id', paymentPageController.servePaymentPage);

export default router;
