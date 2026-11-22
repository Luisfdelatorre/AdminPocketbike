import express from 'express';
import paymentController from '../controllers/paymentController.js';
import { authenticate } from '../middleware/auth.js';
import { verifyToken, requireWriteRole } from '../middleware/authMiddleware.js';
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
router.post('/reconciliation/toggle', authenticate, requireWriteRole, paymentController.toggleReconciliation);

// Export payments as CSV (month/year via query params)
router.get('/export', authenticate, paymentController.exportCSV);

// Admin: apply a manual adjustment (REPAIR / DAMAGE / MAINTENANCE / WORKSHOP)
router.post('/admin/manual', authenticate, requireWriteRole, paymentController.manualAdjustment);

// Get payment history (Legacy/Device specific)
router.get('/history', authenticate, paymentController.getPaymentHistory);

export default router;
