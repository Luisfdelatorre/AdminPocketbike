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
                { contractId: null },
                { contractId: { $exists: false } }
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
    const adjustmentTypes = await settingRepository.getAdjustmentTypes();

    invoices.forEach(invoice => {
        const effectiveType = invoice.adjustmentType || (invoice.dayType === 'ADJUSTMENT' ? 'OFFICE' : invoice.dayType) || 'PENDING';
        const keyUpper = String(effectiveType).toUpperCase();
        const cfg = adjustmentTypes[keyUpper] || adjustmentTypes[effectiveType] || adjustmentTypes[invoice.dayType] || {};

        const badgeLabel = cfg.badgeLabel || invoice.dayType;
        invoice.adjustmentType = effectiveType;
        invoice.status = badgeLabel;
        invoice.badgeLabel = badgeLabel;
        invoice.color = cfg.color || '#6b7280';
        invoice.bg = cfg.bg || 'transparent';
        invoice.paymentDate = invoice.transaction?.finalized_at;
    });

    const clientAdjustmentTypes = {};
    Object.entries(adjustmentTypes).forEach(([k, cfg]) => {
        if (cfg.hidden) return;
        clientAdjustmentTypes[k] = {
            badgeLabel: cfg.badgeLabel || cfg.label || k,
            color: cfg.color || '#6b7280',
            bg: cfg.bg || 'transparent'
        };
    });

    return { invoices, month: targetMonth, year: targetYear, adjustmentTypes: clientAdjustmentTypes };
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
        const diffSeconds = d.lastUpdate ? dayjs().diff(dayjs(d.lastUpdate), 'second') : null;
        const online = diffSeconds !== null && diffSeconds < Transaction.DEVICE_ONLINE_TIMEOUT;

        deviceMap[d.name] = {
            _id: d._id,
            id: d._id,
            name: d.name,
            gpsId: d.gpsId,
            companyId: d.companyId,
            companyName: d.companyName,
            driverName: d.driverName,
            online,
            cutOff: Boolean(d.cutOff),
            ignition: d.ignition ?? false,
            batteryLevel: d.batteryLevel ?? 0,
            lastUpdate: d.lastUpdate || null,
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
            driverName: d.driverName || null,
            status: isMora ? 'MORA' : 'AL DÍA',
            color: isMora ? 'red' : 'green',
            cutOff: Boolean(d.cutOff),
            ignition: Boolean(d.ignition),
            batteryLevel: d.batteryLevel ?? null,
            hasActiveContract: Boolean(d.hasActiveContract),
            activeContractId: d.activeContractId || d.contractId || null,
            dailyRate: d.dailyRate || 0,
            monthPaid: d.monthPaid || 0,
            monthDebt: d.monthDebt || 0,
            freeDays: d.freeDays || 0,
            exemptFromCutOff: Boolean(d.exemptFromCutOff),
            exemptFromCurfew: Boolean(d.exemptFromCurfew),
            cutOffTime: d.cutOffTime || null,
            lastUpdate: d.lastUpdate || null
        };
    });

    return report;
};


export default {
    getInvoiceHistory,
    getStatusReportData
};

