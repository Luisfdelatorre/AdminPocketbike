import express from 'express';
import paymentController from '../controllers/paymentController.js';
import { authenticate } from '../middleware/auth.js';
import { verifyToken } from '../middleware/authMiddleware.js';
const router = express.Router();

/**
 * PUBLIC ROUTES
 */

// Get public device info (for pre-filling payment form)
//router.get('/device-info/:deviceIdName', paymentController.getDeviceInfo);

/**
 * PROTECTED ROUTES (Require Token)
 */
router.get('/status', verifyToken, paymentController.getPaymentStatus);
// Get device status
router.get('/device-status', verifyToken, paymentController.getDeviceStatus);




// Get ALL payments (Admin/Dashboard) - Mapped to getPaymentHistory which now fetches all
router.get('/all', authenticate, paymentController.getPaymentHistory);

// Get payment history (Legacy/Device specific)
router.get('/history', authenticate, paymentController.getPaymentHistory);






// Use free day
router.post('/use-free-day', paymentController.useFreeDay);

// Request loan
router.post('/request-loan', paymentController.requestLoan);

// Create payment
router.post('/create', paymentController.createPayment);



// OLD ROUTES (Kept for backward compatibility or admin if needed?)
// For now, I'm prioritizing the user's expected "Payment Page" routes.
// The user snippet replaced everything. I should probably keep admin routes separately?
// But the user *replaced* the controller logic. 
// I'll assume this router is mainly for the Device Payment App. Admin routes might be elsewhere or different.

// SSE Stream
router.get('/stream/:reference', paymentController.getPaymentStream);

export default router;
