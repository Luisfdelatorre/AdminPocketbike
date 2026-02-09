import dayjs from '../config/dayjs.js';
import { nanoid } from 'nanoid';
import { Transaction } from '../config/config.js';

const { defaultCustomer } = Transaction;
// TIMEZONE is handled by dayjs config already

// Explicit helper to ensure 'today' is always interpreted in the project timezone
function getToday() {
    return dayjs();
}

function sleep(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
}

function normalizeName(name) {
    return name.trim().toUpperCase().replace(/\s+/g, '');
}

function generateReference(invoiceId) {
    return `${invoiceId}-${nanoid(2).toUpperCase()}`;
}

function generateReferenceFreeDay(invoiceId) {
    return `FREE-${invoiceId}-${nanoid(2).toUpperCase()}`;
}
function generateReferenceLoan(invoiceId) {
    return `LOAN-${invoiceId}-${nanoid(2).toUpperCase()}`;
}
function generateInvoiceId(name, day) {
    // dayjs object is already configured with timezone in config/dayjs.js
    const today = dayjs(day).startOf('day');
    const formatted = today.format('YYYY-MM-DD');
    const invoiceId = `${name}-${formatted}`;

    return invoiceId;
}
function formatDate(date) {
    const today = dayjs(date).startOf('day');
    const formatted = today.format('DD MMM');
    return formatted;
}
function generateEmail(deviceIdName) {
    return `${deviceIdName}@${defaultCustomer.emailDomain}`;
}


export default {
    getToday,
    sleep,
    normalizeName,
    generateReference,
    generateReferenceFreeDay,
    generateReferenceLoan,
    generateInvoiceId,
    formatDate,
    generateEmail,
};
