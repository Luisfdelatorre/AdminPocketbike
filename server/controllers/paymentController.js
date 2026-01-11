import paymentService from '../services/paymentService.js';
import paymentRepository from '../repositories/paymentRepository.js';

/**
 * Get all payments across all devices with pagination
 * Query params: page (default: 1), limit (default: 50), status (optional filter)
 */
const getAllPayments = async (req, res) => {
    try {
        const page = parseInt(req.query.page) || 1;
        const limit = parseInt(req.query.limit) || 50;
        const status = req.query.status; // optional: APPROVED, PENDING, DECLINED, etc.

        // Use repository method for paginated query
        const result = await paymentRepository.getAllPaymentsPaginated({
            page,
            limit,
            status
        });

        res.json({
            success: true,
            payments: result.payments,
            pagination: result.pagination
        });
    } catch (error) {
        console.error('Error fetching all payments:', error);
        res.status(500).json({
            success: false,
            error: 'Failed to fetch payments'
        });
    }
};

/**
 * Create payment intent for the oldest unpaid invoice
 */
const createPaymentIntent = async (req, res) => {
    try {
        const { deviceId, customerEmail } = req.body;

        if (!deviceId) {
            return res.status(400).json({
                success: false,
                error: 'deviceId is required',
            });
        }

        const result = await paymentService.createPaymentIntent(deviceId, customerEmail);

        res.json({
            success: true,
            data: result,
        });
    } catch (error) {
        console.error('Create payment intent error:', error);
        res.status(500).json({
            success: false,
            error: error.message,
        });
    }
};

/**
 * Create payment intents for multiple invoices (sequentially)
 * Body: { deviceId, count, customerEmail }
 */
const createBatchPaymentIntent = async (req, res) => {
    try {
        const { deviceId, count = 3, customerEmail } = req.body;

        if (!deviceId) {
            return res.status(400).json({
                success: false,
                error: 'deviceId is required',
            });
        }

        if (count < 1 || count > 10) {
            return res.status(400).json({
                success: false,
                error: 'count must be between 1 and 10',
            });
        }

        const result = await paymentService.createBatchPaymentIntents(deviceId, count, customerEmail);

        res.json({
            success: true,
            data: result,
        });
    } catch (error) {
        console.error('Create batch payment intent error:', error);
        res.status(500).json({
            success: false,
            error: error.message,
        });
    }
};

/**
 * Get payment status by reference
 */
const getPaymentStatus = async (req, res) => {
    try {
        const { reference } = req.params;

        const result = await paymentService.getPaymentStatus(reference);

        res.json({
            success: true,
            data: result,
        });
    } catch (error) {
        console.error('Get payment status error:', error);
        res.status(404).json({
            success: false,
            error: error.message,
        });
    }
};

/**
 * Get all unpaid invoices for a device
 */
const getUnpaidInvoices = async (req, res) => {
    try {
        const { deviceId } = req.params;

        const invoices = await paymentService.getUnpaidInvoices(deviceId);

        res.json({
            success: true,
            data: invoices,
        });
    } catch (error) {
        console.error('Get unpaid invoices error:', error);
        res.status(500).json({
            success: false,
            error: error.message,
        });
    }
};

/**
 * Get payment history for a device
 */
const getPaymentHistory = async (req, res) => {
    try {
        const { deviceId } = req.params;
        const limit = parseInt(req.query.limit) || 50;

        const history = await paymentService.getPaymentHistory(deviceId, limit);

        res.json({
            success: true,
            data: history,
        });
    } catch (error) {
        console.error('Get payment history error:', error);
        res.status(500).json({
            success: false,
            error: error.message,
        });
    }
};

/**
 * Manually verify a transaction with Wompi
 */
const verifyTransaction = async (req, res) => {
    try {
        const { reference } = req.params;

        const result = await paymentService.verifyTransaction(reference);

        res.json({
            success: true,
            data: result,
        });
    } catch (error) {
        console.error('Verify transaction error:', error);
        res.status(500).json({
            success: false,
            error: error.message,
        });
    }
};

export default {
    getAllPayments,
    createPaymentIntent,
    createBatchPaymentIntent,
    getPaymentStatus,
    getUnpaidInvoices,
    getPaymentHistory,
    verifyTransaction
};
