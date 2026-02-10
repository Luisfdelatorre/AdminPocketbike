export const MongoDB = {
    URI: 'mongodb://127.0.0.1:27017/payments-wompi',
};

export const server = {
    port: process.env.PORT || 3000,
    env: process.env.NODE_ENV || 'development',
};

export const Collections = {
    DEVICES: 'devices',
    NEQUI2TAG: 'nequi2tag',
    CONTRACTS: 'contracts',
    PLATE2NEQUI: 'plate2nequi',
    DEVICEACCESSES: 'deviceaccesses',
    INVOICES: 'invoices',
    PAYMENTS: 'payments',
    TRANSACTIONVERIFICATIONS: 'transactionverifications',
    USERS: 'users',
    WEBHOOKEVENTS: 'webhookevents',
};

export const Transaction = {
    defaultCustomer: {
        nameSuffix: 'PocketBike',
        emailDomain: 'PocketBike.app',
    },
    csvHeader: [
        'cellphone',
        'firstName',
        'lastName',
        'value',
        'commission',
        'tax',
        'date',
        'reference',
        'product',
        'messageId',
        'document',
        'number',
    ],
    status: {
        A: 'success', //"Asignado"
        D: 'danger', //"Pendiente"
        P: 'Asignar', //para el valor pendiente
    },
    updateType: ['Pico y placa', 'Descanso', 'Reparación', 'Varada'],
    PAYMENT_TYPE: {
        WOMPI: 'WOMPI',
        FREEPASS: 'FREEPASS',
        FREE: 'FREE',
        NEQUI: 'NEQUI',
        LOAN: 'LOAN',
    },
    INVOICE_DAYTYPE: {
        PENDING: 'PENDING',        // No hay pago iniciado
        CONFIRMING: 'CONFIRMING',  // Pago iniciado / aprobado por cliente, esperando confirmación final
        VERIFYING: 'VERIFYING',    // Estado intermedio durante el polling final
        PAID: 'PAID',              // Pago confirmado y aplicado
        DEBT: 'DEBT',              // Deuda vencida
        FREEPASS: 'FREEPASS',      // Pase libre temporal (ej: 24h)
        FREE: 'FREE',              // Día completamente gratis
        LOAN: 'LOAN',              // Préstamo - trabajar hoy, pagar después
        ERROR: 'ERROR',
        VOIDED: 'VOIDED',
        DECLINED: 'DECLINED'
    },
    INVOICE_DAYTYPE_TRANSLATION: {
        PENDING: 'Pendiente',
        CONFIRMING: 'Confirmando',
        VERIFYING: 'Verificando',
        PAID: 'Pagado',
        DEBT: 'Deuda',
        FREEPASS: 'Pase Libre',
        FREE: 'Gratis',
        LOAN: 'Préstamo',
        ERROR: 'Error',
        VOIDED: 'Anulado',
        DECLINED: 'Rechazado'
    },

    PAYMENT_STATUS: {
        S_PENDING: 'PENDING',
        S_CONFIRMING: 'CONFIRMING',
        S_PROCESSING: 'PROCESSING',
        S_INVOICE_UPDATED: 'INVOICE_UPDATED',
        S_APPROVED: 'APPROVED',
        S_PAYMENT_RECEIVED: 'PAYMENT_RECEIVED',
        S_DECLINED: 'DECLINED',
        S_VOIDED: 'VOIDED',
        S_ERROR: 'ERROR',
        S_CREATED: 'CREATED',
        S_EXPIRED: 'EXPIRED',
        S_INITIATED: 'INITIATED',
        S_TIMEOUT: 'TIMEOUT',
        S_DEVICE_ACTIVATING: 'DEVICE_ACTIVATING',
        S_DEVICE_ACTIVE: 'DEVICE_ACTIVE',
        S_DEVICE_QUEUED: 'DEVICE_QUEUED',
        S_DEVICE_CHECKING: 'DEVICE_CHECKING',
        S_COMPLETED: 'COMPLETED',
    },
    INVOICE_LIMIT: 30,
    MAX_NEQUI_PAYMENT_TIMEOUT: 45 * 60 * 1000,
    TEMPORARY_RESERVATION_TIMEOUT: 15 * 60 * 1000, // Updated to 15 mins to match previous config
    DELAY_CHECK_STATUS: 1 * 40 * 1000,
    MAX_RETRY_ATTEMPTS: 12,
    RETRY_CHECK_INTERVAL: 5000,
    MAX_POLL_TIMEOUT: 1 * 300 * 1000, // 5 minutos
    POLL_INTERVAL: 5 * 1000,
    maxPagesToShow: 10,
    maxItemsPerPage: 10,
    currencyCode: 'COP',
    DEFAULTAMOUNT: 35000,
    googlesheetActive: true,
    DEFAULT_PAYMENT_EMAIL_DOMAIN: '@pocketbike.app',
    JWT_SECRET: process.env.JWT_SECRET || 'payment-app-secret-key-change-in-production',
    JWT_EXPIRY: '24h',
    DEVICE_ONLINE_TIMEOUT: 3 * 60 * 1000,
    DEFAULTAMOUNT: 30000,
};
