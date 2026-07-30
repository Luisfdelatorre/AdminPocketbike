import express from 'express';
import paymentController from '../controllers/paymentController.js';
import { authenticate } from '../middleware/auth.js';
import { verifyToken } from '../middleware/authMiddleware.js';
const router = express.Router();

router.get('/status', verifyToken, paymentController.getPaymentStatus);
router.post("/request", verifyToken, paymentController.createPayment);
router.get("/stream/:reference", verifyToken, paymentController.getPaymentStream);
router.post('/use-free-day', verifyToken, paymentController.useFreeDay);
router.post('/request-loan', verifyToken, paymentController.requestLoan);

/*
router.get('/status', authenticatePaymentApp, paymentController.getPaymentStatus);
router.get('/history', authenticatePaymentApp, paymentController.getPaymentHistory);

router.post('/request-loan', authenticatePaymentApp, paymentController.requestLoan);

router.get('/device-status', authenticatePaymentApp, paymentController.getDeviceStatus);
*/




// Get ALL payments (Admin/Dashboard) - Mapped to getPaymentHistory which now fetches all
router.get('/all', authenticate, paymentController.getPaymentHistory);

// Get payment summary matrix
router.get('/allPayments', authenticate, paymentController.getPaymentSummary);

// Get daily reconciliation report
router.get('/reconciliation', authenticate, paymentController.getDailyReconciliationReport);
router.post('/reconciliation/toggle', authenticate, paymentController.toggleReconciliation);

// Export payments as CSV (month/year via query params)
router.get('/export', authenticate, paymentController.exportCSV);

// Admin: apply a manual adjustment (REPAIR / DAMAGE / MAINTENANCE / WORKSHOP)
router.post('/admin/manual', authenticate, paymentController.manualAdjustment);

// Get payment history (Legacy/Device specific)
router.get('/history', authenticate, paymentController.getPaymentHistory);







// Request loan


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
