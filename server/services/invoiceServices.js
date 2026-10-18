import invoiceRepository from '../repositories/invoiceRepository.js';
import settingRepository from '../repositories/settingRepository.js';
import { Invoice } from '../models/Invoice.js';
import { Contract } from '../models/Contract.js';
import { Transaction, PAYMENTMESSAGES as PM } from '../config/config.js';
import { Device } from '../models/Device.js';
import mongoose from 'mongoose';

// Centralized Day.js
import dayjs from '../config/dayjs.js';

const {
    JWT_SECRET, JWT_EXPIRY,
    PAYMENT_STATUS: PS,
    PAYMENT_TYPE,
    INVOICE_DAYTYPE,
    MAX_NEQUI_PAYMENT_TIMEOUT,
    TEMPORARY_RESERVATION_TIMEOUT,
    MAX_RETRY_ATTEMPTS,
    RETRY_CHECK_INTERVAL,
    INVOICE_DAYTYPE_TRANSLATION
} = Transaction;


const getInvoiceHistory = async (deviceIdName, month, year, contractId = null) => {
    // Default to current month/year if not provided
    const now = dayjs();
    const targetMonth = month ? Number(month) : now.month() + 1; // dayjs month is 0-indexed
    const targetYear = year ? Number(year) : now.year();

    const startOfMonth = dayjs(`${targetYear}-${String(targetMonth).padStart(2, '0')}-01`).startOf('month').toDate();
    const endOfMonth = dayjs(`${targetYear}-${String(targetMonth).padStart(2, '0')}-01`).endOf('month').toDate();

    const query = {
        deviceIdName,
        date: { $gte: startOfMonth, $lte: endOfMonth }
    };

    if (contractId) {
        // Read schemaVersion directly from the Contract in DB — the source of truth.
        // This works correctly even if a company has a mix of v1 and v2 contracts.
        const contract = await Contract.findOne({ contractId }, { schemaVersion: 1 }).lean();
        const schemaVersion = contract?.schemaVersion ?? 1;

        if (schemaVersion >= 2) {
            // v2+ contracts: match contractId OR legacy invoices for this device with null/missing contractId
            query.$or = [
                { contractId: contractId },
                { contractId: null }
            ];
        }
        // v1 legacy: skip contractId filter, query by device+date only
    }

    const invoices = await Invoice.find(
        query,
        {
            date: 1,
            amount: 1,
            dayType: 1,
            adjustmentType: 1,
            adjustmentReference: 1,
            paidAmount: 1,
            "transaction.finalized_at": 1,
            "transaction.reference": 1,
            _id: 0
        }
    ).sort({ date: -1 }).limit(62).lean();
    console.log('invoices', invoices);
    const allConfigs = await settingRepository.getAllStatusConfigs();

    invoices.forEach(invoice => enrichInvoice(invoice, allConfigs));

    const clientAdjustmentTypes = {};
    Object.entries(allConfigs).forEach(([k, cfg]) => {
        if (cfg.hidden) return;
        clientAdjustmentTypes[k] = {
            badgeLabel: cfg.badgeLabel || cfg.label || k,
            color: cfg.color || '#6b7280',
            bg: cfg.bg || 'transparent'
        };
    });

    return { invoices, month: targetMonth, year: targetYear, adjustmentTypes: clientAdjustmentTypes };
};

const MONTH_NAMES_ES = ['ene', 'feb', 'mar', 'abr', 'may', 'jun', 'jul', 'ago', 'sep', 'oct', 'nov', 'dic'];

const formatInvoiceId = (invoiceId) => {
    if (!invoiceId) return { formatted: 'N/A', main: 'N/A', sub: '' };
    const parts = String(invoiceId).split('-');
    if (parts.length >= 4) {
        const deviceName = parts[0];
        const monthNum = parseInt(parts[2], 10);
        const day = parseInt(parts[3], 10);
        const monthName = (monthNum >= 1 && monthNum <= 12) ? MONTH_NAMES_ES[monthNum - 1] : parts[2];
        const sub = `${monthName}-${day}`;
        return {
            formatted: `${deviceName}-${sub}`,
            main: deviceName,
            sub
        };
    }
    const firstDash = String(invoiceId).indexOf('-');
    if (firstDash !== -1) {
        return {
            formatted: invoiceId,
            main: invoiceId.slice(0, firstDash),
            sub: invoiceId.slice(firstDash + 1)
        };
    }
    return {
        formatted: invoiceId,
        main: invoiceId,
        sub: ''
    };
};

const enrichInvoice = (invoice, adjustmentTypes = {}) => {
    if (!invoice) return invoice;
    const effectiveType = invoice.adjustmentType || (invoice.dayType === 'ADJUSTMENT' ? 'OFFICE' : invoice.dayType) || 'PENDING';
    const keyUpper = String(effectiveType).toUpperCase();
    const cfg = adjustmentTypes[keyUpper] || adjustmentTypes[effectiveType] || adjustmentTypes[invoice.dayType] || {};

    const rawLabel = cfg.badgeLabel || cfg.label || invoice.dayType || '';
    const badgeLabel = rawLabel ? String(rawLabel).trim().toUpperCase() : invoice.dayType;
    const isPayable = (invoice.dayType === 'PENDING' || invoice.dayType === 'DEBT') && !invoice.paid;
    const isPaidOrFree = invoice.dayType === 'PAID' || invoice.dayType === 'FREE';

    const statusClass = `status-badge--${String(effectiveType).toLowerCase()}`;
    const idDisplay = formatInvoiceId(invoice.invoiceId);

    invoice.adjustmentType = effectiveType;
    invoice.status = badgeLabel;
    invoice.badgeLabel = badgeLabel;
    invoice.label = badgeLabel;
    invoice.statusClass = statusClass;
    invoice.color = cfg.color || '#6b7280';
    invoice.bg = cfg.bg || 'transparent';
    invoice.paymentDate = invoice.transaction?.finalized_at || null;
    invoice.transactionId = invoice.transaction?.id || null;
    invoice.isPayable = Boolean(isPayable);
    invoice.isPaidOrFree = Boolean(isPaidOrFree);
    invoice.formattedInvoiceId = idDisplay.formatted;
    invoice.invoiceIdMain = idDisplay.main;
    invoice.invoiceIdSub = idDisplay.sub;
    invoice.badge = {
        label: badgeLabel,
        statusClass,
        color: cfg.color || '#6b7280',
        bg: cfg.bg || 'transparent'
    };

    return invoice;
};

const enrichInvoices = async (invoices, cachedConfigs = null) => {
    if (!Array.isArray(invoices) || invoices.length === 0) return invoices;
    const allConfigs = cachedConfigs || await settingRepository.getAllStatusConfigs();
    invoices.forEach(inv => enrichInvoice(inv, allConfigs));
    return invoices;
};

const getStatusReportData = async (isSystemAdmin, companyId) => {
    // Current month date range using dayjs for consistency
    const startOfMonth = dayjs().startOf('month').toDate();
    const endOfMonth = dayjs().endOf('month').toDate();

    // 1. Get all relevant devices first
    let deviceQuery = { isDeleted: { $ne: true } };
    if (!isSystemAdmin) {
        deviceQuery.companyId = companyId;
    }

    const devices = await Device.find(deviceQuery).lean();
    const deviceMap = {};

    devices.forEach(d => {
        const lastUpdate = d.telemetry?.lastUpdate;
        const diffSeconds = lastUpdate ? dayjs().diff(dayjs(lastUpdate), 'second') : null;
        const online = diffSeconds !== null && diffSeconds < Transaction.DEVICE_ONLINE_TIMEOUT;

        deviceMap[d.name] = {
            _id: d._id,
            id: d._id,
            name: d.name,
            gpsId: d.gpsId,
            companyId: d.companyId,
            companyName: d.companyName,
            customerName: d.customerName || d.driverName || null,
            driverName: d.customerName || d.driverName || null,
            online,
            cutOff: Boolean(d.telemetry?.cutOff),
            ignition: Boolean(d.telemetry?.ignition),
            batteryLevel: d.telemetry?.batteryLevel ?? 0,
            lastUpdate: d.telemetry?.lastUpdate || null,
            activeContractId: d.activeContractId || null,
            hasActiveContract: Boolean(d.hasActiveContract),
            dailyRate: d.dailyRate || 0,
            exemptFromCutOff: Boolean(d.exemptFromCutOff),
            monthPaid: 0,
            monthDebt: 0,
            freeDays: 0,
            contractStatus: 'NONE'
        };
    });

    // 2. Aggregate Invoices for Current Month
    const matchStage = {
        date: { $gte: startOfMonth, $lte: endOfMonth }
    };

    if (!isSystemAdmin) {
        matchStage.companyId = new mongoose.Types.ObjectId(companyId);
    }

    const invoiceStats = await Invoice.aggregate([
        { $match: matchStage },
        {
            $group: {
                _id: '$deviceIdName',
                monthPaid: {
                    $sum: { $cond: [{ $eq: ['$paid', true] }, '$paidAmount', 0] }
                },
                monthDebt: {
                    $sum: { $cond: [{ $eq: ['$paid', false] }, '$amount', 0] }
                },
                freeDays: {
                    $sum: { $cond: [{ $eq: ['$dayType', 'FREE'] }, 1, 0] }
                }
            }
        }
    ]);

    // Merge invoice stats into device map
    invoiceStats.forEach(stat => {
        if (deviceMap[stat._id]) {
            deviceMap[stat._id].monthPaid = stat.monthPaid;
            deviceMap[stat._id].monthDebt = stat.monthDebt;
            deviceMap[stat._id].freeDays = stat.freeDays;
        }
    });

    // 4. Return lightweight, clean report DTO
    const report = Object.values(deviceMap).map(d => {
        const isMora = d.monthDebt > 0;
        return {
            id: d.deviceId || d._id,
            _id: d._id,
            name: d.name,
            model: d.model || 'PocketBike',
            deviceId: d.deviceId,
            gpsId: d.gpsId,
            customerName: d.customerName || d.driverName || null,
            driverName: d.customerName || d.driverName || null,
            status: isMora ? 'MORA' : 'AL DÍA',
            color: isMora ? 'red' : 'green',
            cutOff: Boolean(d.telemetry?.cutOff),
            ignition: Boolean(d.telemetry?.ignition),
            batteryLevel: d.telemetry?.batteryLevel ?? null,
            hasActiveContract: Boolean(d.hasActiveContract),
            activeContractId: d.activeContractId || d.contractId || null,
            dailyRate: d.dailyRate || 0,
            monthPaid: d.monthPaid || 0,
            monthDebt: d.monthDebt || 0,
            freeDays: d.freeDays || 0,
            exemptFromCutOff: Boolean(d.exemptFromCutOff),
            exemptFromCurfew: Boolean(d.exemptFromCurfew),
            cutOffTime: d.cutOffTime || null,
            lastUpdate: d.telemetry?.lastUpdate || null
        };
    });

    return report;
};

const getAllInvoices = async (queryParams = {}, companyId = null, isSystemAdmin = false) => {
    const {
        page = 1,
        limit,
        search,
        status,
        month,
        year
    } = queryParams;

    const pageNum = parseInt(page) || 1;
    const searchTrim = search ? String(search).trim() : null;
    let limitNum = parseInt(limit) || (searchTrim ? 500 : 100);
    if (searchTrim && limitNum < 500) limitNum = 500;

    const monthNum = month ? parseInt(month) : null;
    const yearNum = year ? parseInt(year) : null;
    const skip = (pageNum - 1) * limitNum;

    // Build query filter
    const query = {};

    if (monthNum && yearNum) {
        const startOfMonth = new Date(yearNum, monthNum - 1, 1);
        const endOfMonth = new Date(yearNum, monthNum, 0, 23, 59, 59, 999);
        query.date = { $gte: startOfMonth, $lte: endOfMonth };
    }

    if (searchTrim) {
        const searchRegex = new RegExp(searchTrim.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'i');
        query.$or = [
            { deviceIdName: searchRegex },
            { invoiceId: searchRegex },
            { contractId: searchRegex },
            { paymentReference: searchRegex },
            { adjustmentReference: searchRegex }
        ];
    }

    const [adjustmentTypes, allStatusConfigs] = await Promise.all([
        settingRepository.getAdjustmentTypes(),
        settingRepository.getAllStatusConfigs()
    ]);

    if (status && status !== 'all') {
        const statusKey = String(status).trim().toUpperCase();

        if (adjustmentTypes[statusKey]) {
            query.adjustmentType = statusKey;
        } else {
            query.dayType = statusKey;
        }
    }

    if (!isSystemAdmin && companyId) {
        query.companyId = companyId;
    }

    const invoiceProjection = {
        _id: 1,
        invoiceId: 1,
        date: 1,
        amount: 1,
        paidAmount: 1,
        paid: 1,
        dayType: 1,
        deviceIdName: 1,
        deviceId: 1,
        contractId: 1,
        adjustmentType: 1,
        adjustmentReference: 1,
        adjustmentComment: 1,
        transaction: 1,
        createdAt: 1
    };

    const { invoices, total } = await invoiceRepository.getPaginatedInvoices({
        query,
        projection: invoiceProjection,
        skip,
        limit: limitNum
    });

    await enrichInvoices(invoices, allStatusConfigs);

    const cleanInvoices = invoices.map(inv => {
        const clean = {
            invoiceId: inv.invoiceId,
            invoiceIdSub: inv.invoiceIdSub,
            deviceIdName: inv.deviceIdName,
            amount: inv.amount,
            paidAmount: inv.paidAmount,
            dayType: inv.dayType,
            paymentDate: inv.paymentDate || inv.transaction?.finalized_at || inv.createdAt || null,
            label: inv.label,
            statusClass: inv.statusClass,
            isPayable: inv.isPayable,
            isPaidOrFree: inv.isPaidOrFree,
            adjustmentType: inv.adjustmentType
        };
        if (inv.contractId) clean.contractId = inv.contractId;
        if (inv.adjustmentReference) clean.adjustmentReference = inv.adjustmentReference;
        if (inv.adjustmentComment) clean.adjustmentComment = inv.adjustmentComment;
        if (inv.transactionId) clean.transactionId = inv.transactionId;
        if (inv.transaction) clean.transaction = inv.transaction;
        return clean;
    });

    return {
        success: true,
        invoices: cleanInvoices,
        pagination: {
            page: pageNum,
            limit: limitNum,
            total,
            totalPages: Math.ceil(total / limitNum),
            hasNext: pageNum < Math.ceil(total / limitNum),
            hasPrev: pageNum > 1
        }
    };
};

export default {
    getInvoiceHistory,
    getStatusReportData,
    enrichInvoice,
    enrichInvoices,
    getAllInvoices
};

