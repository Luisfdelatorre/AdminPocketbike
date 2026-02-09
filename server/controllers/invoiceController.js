import invoiceRepository from '../repositories/invoiceRepository.js';
// Import dependencies for direct queries if needed, or use repository
import { Invoice } from '../models/Invoice.js';
import { resolveDeviceId } from '../utils/deviceResolver.js';
import invoiceServices from '../services/invoiceServices.js';
import logger from '../config/logger.js';


/**
 * Create a daily invoice for a device
 */
const createInvoice = async (req, res) => {
    try {
        const { deviceId, date, amount } = req.body;

        if (!deviceId || !date || !amount) {
            return res.status(400).json({
                success: false,
                error: 'deviceId, date, and amount are required',
            });
        }

        const invoice = await invoiceRepository.createInvoice({
            deviceId,
            date,
            amount,
        });

        res.json({
            success: true,
            data: invoice,
        });
    } catch (error) {
        console.error('Create invoice error:', error);
        res.status(500).json({
            success: false,
            error: error.message,
        });
    }
};

/**
 * Get all invoices with pagination
 * Query params: page (default: 1), limit (default: 50), status (optional filter)
 */
const getAllInvoices = async (req, res) => {
    try {
        const page = parseInt(req.query.page) || 1;
        const limit = parseInt(req.query.limit) || 50;
        const status = req.query.status; // optional: PAID, UNPAID, PENDING
        const skip = (page - 1) * limit;

        // Build query
        const query = status ? { status: status.toUpperCase() } : {};

        // Get invoices and total count in parallel
        const [invoices, total] = await Promise.all([
            Invoice.find(query)
                .sort({ date: -1, createdAt: -1 })
                .skip(skip)
                .limit(limit)
                .lean(),
            Invoice.countDocuments(query)
        ]);

        res.json({
            success: true,
            invoices,
            pagination: {
                page,
                limit,
                total,
                totalPages: Math.ceil(total / limit),
                hasNext: page < Math.ceil(total / limit),
                hasPrev: page > 1
            }
        });
    } catch (error) {
        console.error('Get all invoices error:', error);
        res.status(500).json({
            success: false,
            error: error.message
        });
    }
};

/**
 * Get all invoices for a device
 */
const getInvoicesByDevice = async (req, res) => {
    try {
        const identifier = req.params.deviceId;
        const deviceId = await resolveDeviceId(identifier);
        const limit = parseInt(req.query.limit) || 50;

        const invoices = await invoiceRepository.getInvoicesByDevice(deviceId, limit);

        res.json({
            success: true,
            data: invoices,
        });
    } catch (error) {
        console.error('Get invoices error:', error);
        res.status(500).json({
            success: false,
            error: error.message,
        });
    }
};

const getInvoiceHistory = async (req, res) => {
    // try {
    const { deviceIdName } = req.paymentAuth;

    // Delegate to service
    const history = await invoiceServices.getInvoiceHistory(deviceIdName);

    res.json({ history });

    // } catch (error) {
    //     logger.error('Get payment history error:', error.message);
    //     res.status(500).json({ error: 'Failed to get payment history' });
    // }
};

/**
 * Get unpaid invoices for a device
 */
const getUnpaidInvoices = async (req, res) => {
    try {
        const identifier = req.params.deviceId;
        const deviceId = await resolveDeviceId(identifier);

        const invoices = await invoiceRepository.getUnpaidInvoicesByDevice(deviceId);

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

export default {
    createInvoice,
    getInvoiceHistory,
    getAllInvoices,
    getInvoicesByDevice,
    getUnpaidInvoices
};
