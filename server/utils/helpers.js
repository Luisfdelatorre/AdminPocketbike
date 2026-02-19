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
function generateInvoiceIdInitialFee(name, day) {
    const today = dayjs(day).startOf('day');
    const formatted = today.format('YYYY-MM-DD');
    const invoiceId = `IF-${name}-${formatted}`;

    return invoiceId;
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
function calculateBatteryLevel(lastUpdate, maxBatteryLevel = 600) {
    const diffSeconds = dayjs().diff(dayjs(lastUpdate), 'second');
    if (diffSeconds > 600) return 0;
    return Math.max(0, ((maxBatteryLevel - diffSeconds) / maxBatteryLevel) * 100);
}

function generateEmail(deviceIdName) {
    return `${deviceIdName}@${defaultCustomer.emailDomain}`;
}

function generateDeviceId(plate) {
    const p = String(plate).toUpperCase().replace(/[^A-Z0-9]/g, "");
    if (!p) return null; // Return null if no valid chars, let caller handle fallback

    const r = p.split("").reverse().join(""); // e.g. G83JHZ
    const a = r.charCodeAt(0) - 55;     // base36
    const d5 = r.charCodeAt(1) - 48; // base10
    const d4 = r.charCodeAt(2) - 48; // base10
    const c = r.charCodeAt(3) - 55;     // base36
    const b = r.charCodeAt(4) - 55;     // base36
    const z = r.charCodeAt(5) - 55;     // base36

    return (((((a * 10 + d5) * 10 + d4) * 36 + c) * 36 + b) * 36 + z);
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
    calculateBatteryLevel,
    generateInvoiceIdInitialFee,
    generateDeviceId,
};
