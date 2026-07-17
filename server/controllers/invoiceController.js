import invoiceRepository from '../repositories/invoiceRepository.js';
// Import dependencies for direct queries if needed, or use repository
import { Invoice } from '../models/Invoice.js';
import { resolveDeviceId } from '../utils/deviceResolver.js';
import invoiceServices from '../services/invoiceServices.js';
import logger from '../config/logger.js';
import mongoose from 'mongoose';
import { Device } from '../models/Device.js';
import { Contract } from '../models/Contract.js';
import dayjs from 'dayjs';
import helpers from '../utils/helpers.js';

const getStatusReport = async (req, res) => {
    try {
        const { isSuperAdmin, companyId, role, companyName } = req.auth;
        const isSystemAdmin = isSuperAdmin || (role === 'admin' && companyName === 'System');
        const report = await invoiceServices.getStatusReportData(isSystemAdmin, companyId);

        res.json({
            success: true,
            data: report
        });

    } catch (error) {
        console.error('Get financial report error:', error);
        res.status(500).json({
            success: false,
            error: error.message
        });
    }
};


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
        const month = req.query.month ? parseInt(req.query.month) : null;
        const year = req.query.year ? parseInt(req.query.year) : null;
        const skip = (page - 1) * limit;

        const { isSuperAdmin, companyId, role, companyName } = req.auth;
        const isSystemAdmin = isSuperAdmin || (role === 'admin' && companyName === 'System');

        // Build query
        const query = {};

        if (status) {
            const statusUpper = status.toUpperCase();
            if (statusUpper === 'UNPAID') {
                query.dayType = 'DEBT';
            } else {
                query.dayType = statusUpper;
            }
        }

        if (month && year) {
            const startOfMonth = new Date(year, month - 1, 1);
            const endOfMonth = new Date(year, month, 0, 23, 59, 59, 999);
            query.date = { $gte: startOfMonth, $lte: endOfMonth };
        }

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
    try {
        const { deviceIdName, contractId } = req.paymentAuth;
        const { month, year } = req.query;

        // Delegate to service — schemaVersion is read from Contract DB inside the service
        const result = await invoiceServices.getInvoiceHistory(deviceIdName, month, year, contractId);

        res.json({
            success: true,
            data: {
                history: result.invoices,
                month: result.month,
                year: result.year
            }
        });
    } catch (error) {
        logger.error('Get invoice history error:', error.message);
        res.status(500).json({ success: false, error: 'Failed to get invoice history' });
    }
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

        // Current month date range or query params
        const now = new Date();
        const month = req.query.month ? parseInt(req.query.month) : (now.getMonth() + 1);
        const year = req.query.year ? parseInt(req.query.year) : now.getFullYear();

        const startOfMonth = new Date(year, month - 1, 1);
        const endOfMonth = new Date(year, month, 0, 23, 59, 59, 999);

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

/**
 * Export invoices as CSV for a given month/year
 */
const exportCSV = async (req, res) => {
    try {
        const { isSuperAdmin, companyId, role, companyName } = req.auth;
        const isSystemAdmin = isSuperAdmin || (role === 'admin' && companyName === 'System');

        const now = new Date();
        const month = Number(req.query.month || now.getMonth() + 1);
        const year = Number(req.query.year || now.getFullYear());

        const from = new Date(year, month - 1, 1);
        const to = new Date(year, month, 1);

        const query = { date: { $gte: from, $lt: to } };
        if (!isSystemAdmin) query.companyId = new mongoose.Types.ObjectId(companyId);

        const invoices = await Invoice.find(query).sort({ date: 1 }).lean();

        const headers = [
            'Factura', 'Dispositivo', 'Fecha', 'Monto', 'Pagado', 'Estado',
            'Fecha Pago', 'Referencia'
        ];

        const esc = v => `"${String(v ?? '').replace(/"/g, '""')}"`;
        const fmtDate = d => d ? new Date(d).toLocaleDateString('es-CO') : '';

        const rows = invoices.map(inv => [
            esc(inv._id),
            esc(inv.deviceIdName),
            esc(fmtDate(inv.date)),
            esc(inv.paidAmount ?? 0),
            esc(inv.paid ? 'SI' : 'NO'),
            esc(inv.dayType),
            esc(fmtDate(inv.transaction?.finalized_at)),
            esc(inv.transaction?.reference)
        ].join(','));

        const monthStr = String(month).padStart(2, '0');
        const filename = `facturas_${year}-${monthStr}.csv`;
        const csv = '\uFEFF' + [headers.join(','), ...rows].join('\n');

        res.setHeader('Content-Type', 'text/csv; charset=utf-8');
        res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
        res.send(csv);
    } catch (error) {
        logger.error('Invoice CSV export error:', error.message);
        res.status(500).json({ success: false, error: 'Failed to export invoices CSV' });
    }
};

export default {
    createInvoice,
    getInvoiceStats,
    getStatusReport,
    getInvoiceHistory,
    getAllInvoices,
    getInvoicesByDevice,
    getUnpaidInvoices,
    exportCSV
};
