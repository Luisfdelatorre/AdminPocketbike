import invoiceRepository from '../repositories/invoiceRepository.js';
import { Invoice } from '../models/Invoice.js';
import { Transaction, PAYMENTMESSAGES as PM } from '../config/config.js';


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
    )
        .sort({ date: -1 })
        .limit(50)
        .lean();
    invoices.forEach(invoice => {
        invoice.status = INVOICE_DAYTYPE_TRANSLATION[invoice.dayType];
        invoice.paymentDate = invoice.transaction?.finalized_at;

    });
    return invoices;
};

export default {
    getInvoiceHistory
};

