import invoiceRepository from '../repositories/invoiceRepository.js';
import { Invoice } from '../models/Invoice.js';
import { Transaction, PAYMENTMESSAGES as PM } from '../config/config.js';
import { Device } from '../models/Device.js';
import mongoose from 'mongoose';
import helpers from '../utils/helpers.js';

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


const getInvoiceHistory = async (deviceIdName) => {
    const startOfMonth = dayjs().startOf('month').toDate();
    const endOfMonth = dayjs().endOf('month').toDate();
    const invoices = await Invoice.find(
        {
            deviceIdName,
            date: { $gte: startOfMonth, $lte: endOfMonth }
        },
        {
            date: 1,
            amount: 1,
            dayType: 1,
            paidAmount: 1,
            "transaction.finalized_at": 1,
            "transaction.reference": 1,
            _id: 0
        }
    ).sort({ date: -1 }).limit(50).lean();

    invoices.forEach(invoice => {
        invoice.status = INVOICE_DAYTYPE_TRANSLATION[invoice.dayType];
        invoice.paymentDate = invoice.transaction?.finalized_at;
    });
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

    const maxBatteryLevel = 600;
    const devices = await Device.find(deviceQuery).lean();
    const deviceMap = {};

    devices.forEach(d => {
        deviceMap[d.name] = {
            deviceId: d._id,
            name: d.name,
            driverName: d.driverName,
            cutOff: d.cutOff,
            lastUpdate: d.lastUpdate,
            ignition: d.ignition,
            batteryLevel: helpers.calculateBatteryLevel(d.lastUpdate, maxBatteryLevel),
            companyId: d.companyId,
            hasActiveContract: d.hasActiveContract,
            isActive: d.isActive,
            nequiNumber: d.nequiNumber,
            phone: d.phone,
            contractId: d.activeContractId || d.contractId,
            monthPaid: 0,
            monthDebt: 0,
            freeDays: 0,
            dailyRate: 0,
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
                    $sum: { $cond: [{ $eq: ['$paid', false] }, '$paidAmount', 0] }
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

    // 4. Determine Status
    const report = Object.values(deviceMap).map(d => {
        if (d.monthDebt > 0) {
            d.status = 'MORA';
            d.color = 'red';
        } else {
            d.status = 'AL DÍA';
            d.color = 'green';
        }
        return d;
    });

    return report;
};

export default {
    getInvoiceHistory,
    getStatusReportData
};

