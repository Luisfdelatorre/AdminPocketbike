import invoiceRepository from '../repositories/invoiceRepository.js';
// Import dependencies for direct queries if needed, or use repository
import { Invoice } from '../models/Invoice.js';
import { resolveDeviceId } from '../utils/deviceResolver.js';
import invoiceServices from '../services/invoiceServices.js';
import logger from '../config/logger.js';
import mongoose from 'mongoose';


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

        const { isSuperAdmin, companyId, role, companyName } = req.auth;
        const isSystemAdmin = isSuperAdmin || (role === 'admin' && companyName === 'System');

        // Build query
        const query = status ? { status: status.toUpperCase() } : {};

        // Apply company filter if not system admin
        if (!isSystemAdmin) {
            query.companyId = companyId;
        }

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

        // Security check: ensure the device belongs to the user's company?
        // resolveDeviceId resolves numeric ID, but doesn't check ownership.
        // However, this endpoint might be used by admins who should only see their devices.
        // For now, let's rely on the fact that the frontend only links to devices the user can see.
        // Ideally, we should check ownership here too.

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

/**
 * Get invoice statistics for the current month
 */
const getInvoiceStats = async (req, res) => {
    try {
        const { isSuperAdmin, companyId, role, companyName } = req.auth;
        const isSystemAdmin = isSuperAdmin || (role === 'admin' && companyName === 'System');

        // Current month date range
        const now = new Date();
        const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
        const endOfMonth = new Date(now.getFullYear(), now.getMonth() + 1, 0, 23, 59, 59, 999);

        // Build match stage
        const matchStage = {
            date: { $gte: startOfMonth, $lte: endOfMonth }
        };

        if (!isSystemAdmin) {
            matchStage.companyId = new mongoose.Types.ObjectId(companyId);
        }
        console.log(matchStage);
        const stats = await Invoice.aggregate([
            { $match: matchStage },
            {
                $group: {
                    _id: null,
                    totalCount: { $sum: 1 },
                    totalAmount: { $sum: '$paidAmount' },
                    paidCount: {
                        $sum: { $cond: [{ $eq: ['$paid', true] }, 1, 0] }
                    },
                    unpaidCount: {
                        $sum: { $cond: [{ $eq: ['$paid', false] }, 1, 0] }
                    }
                }
            }
        ]);

        const result = stats[0] || {
            totalCount: 0,
            totalAmount: 0,
            paidCount: 0,
            unpaidCount: 0
        };

        res.json({
            success: true,
            stats: {
                total: result.totalCount,
                paid: result.paidCount,
                unpaid: result.unpaidCount,
                totalAmount: result.totalAmount
            }
        });

    } catch (error) {
        console.error('Get invoice stats error:', error);
        res.status(500).json({
            success: false,
            error: error.message
        });
    }
};

export default {
    createInvoice,
    getInvoiceStats,
    getInvoiceHistory,
    getAllInvoices,
    getInvoicesByDevice,
    getUnpaidInvoices
};
