import dayjs from '../config/dayjs.js';
import { nanoid } from 'nanoid';
import { Transaction } from '../config/config.js';

const { defaultCustomer } = Transaction;

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

// Generates reference for free day payments
function generateReferenceFreeDay(invoiceId) {
    return `FREE-${invoiceId}-${nanoid(2).toUpperCase()}`;
}
function generateReferenceAdjustment(invoiceId) {
    return `ADJ-${invoiceId}-${nanoid(2).toUpperCase()}`;
}
function generateReferenceLoan(invoiceId) {
    return `LOAN-${invoiceId}-${nanoid(2).toUpperCase()}`;
}

function formatDate(date) {
    const today = dayjs(date).startOf('day');
    const formatted = today.format('DD MMM');
    return formatted;
}

// Generates customer email for devices
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
    generateReferenceAdjustment,
    formatDate,
    generateEmail,
};
