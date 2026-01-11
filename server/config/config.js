import dotenv from 'dotenv';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

export const config = {
    server: {
        port: process.env.PORT || 3000,
        env: process.env.NODE_ENV || 'development',
    },
    wompi: {
        publicKey: process.env.WOMPI_PUBLIC_KEY,
        privateKey: process.env.WOMPI_PRIVATE_KEY,
        integritySecret: process.env.WOMPI_INTEGRITY_SECRET,
        apiUrl: process.env.WOMPI_API_URL || 'https://sandbox.wompi.co/v1',
    },
    database: {
        uri: process.env.MONGODB_URI || 'mongodb://localhost:27017/payments-wompi',
    },
    jwt: {
        secret: process.env.JWT_SECRET || 'your-secret-key-change-in-production',
        expiresIn: process.env.JWT_EXPIRES_IN || '7d',
    },
    app: {
        frontendUrl: process.env.FRONTEND_URL || 'http://localhost:3000',
        currency: process.env.CURRENCY || 'COP',
    },
    traccar: {
        baseUrl: process.env.TRACCAR_API_URL || 'https://pocketbike.app/api',
        auth: {
            Authorization: 'Basic ' + Buffer.from(process.env.TRACCAR_CREDENTIALS || 'admin:Medalla6571*').toString('base64'),
        },
        urls: {
            devices: 'devices',
            kms: 'reports/summary',
            positions: 'positions',
            command: 'commands/send',
        },
    },
};

// Payment status enum
export const PAYMENT_STATUS = {
    PENDING: 'PENDING',
    APPROVED: 'APPROVED',
    DECLINED: 'DECLINED',
    ERROR: 'ERROR',
    VOIDED: 'VOIDED',
};

// Invoice status enum
export const INVOICE_STATUS = {
    UNPAID: 'UNPAID',
    PENDING: 'PENDING',
    PAID: 'PAID',
    FAILED: 'FAILED',
    VOIDED: 'VOIDED',
};

// Wompi event types
export const WOMPI_EVENTS = {
    TRANSACTION_UPDATED: 'transaction.updated',
};

// Wompi transaction status mapping
export const WOMPI_STATUS_MAP = {
    PENDING: PAYMENT_STATUS.PENDING,
    APPROVED: PAYMENT_STATUS.APPROVED,
    DECLINED: PAYMENT_STATUS.DECLINED,
    VOIDED: PAYMENT_STATUS.VOIDED,
    ERROR: PAYMENT_STATUS.ERROR,
};

export default config;
