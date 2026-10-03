export const DEFAULT_PAYMENT_STATUSES = {
    PAID: {
        label: 'Día Pagado',
        badgeLabel: 'PAGADO',
        color: '#0ea5e9',
        bg: 'rgba(14,165,233,0.08)',
        description: 'Factura pagada.',
        isRealPayment: true,
        isFree: false,
        category: 'STATUS'
    },
    FREE: {
        label: 'Día Gratis',
        badgeLabel: 'GRATIS',
        color: '#22c55e',
        bg: 'rgba(34,197,94,0.05)',
        description: 'Día libre de cobro.',
        isRealPayment: false,
        isFree: true,
        category: 'STATUS'
    },
    PENDING: {
        label: 'Día Pendiente',
        badgeLabel: 'PENDIENTE',
        color: '#eab308',
        bg: 'rgba(234,179,8,0.05)',
        description: 'Factura pendiente por cobro.',
        isRealPayment: false,
        isFree: false,
        category: 'STATUS'
    },
    DEBT: {
        label: 'Día en Deuda',
        badgeLabel: 'DEUDA',
        color: '#ef4444',
        bg: 'rgba(239,68,68,0.03)',
        description: 'Día no pagado en mora / deuda.',
        isRealPayment: false,
        isFree: false,
        category: 'STATUS'
    },
    INITIAL_FEE: {
        label: 'Cuota Inicial',
        badgeLabel: 'CUOTA INICIAL',
        color: '#0d9488',
        bg: 'rgba(13,148,136,0.06)',
        description: 'Cuota inicial del contrato.',
        isRealPayment: true,
        isFree: false,
        category: 'STATUS'
    }
};

export const DEFAULT_ADJUSTMENT_TYPES = {
    NEQUI: {
        label: 'Pago Real - Nequi',
        badgeLabel: 'NEQUI',
        color: '#E11D48',
        bg: '#FFF1F2',
        description: 'Pago real recibido vía Nequi.',
        autoAmount: null,
        autoReference: 'NEQUI - {deviceName} ({date})',
        isRealPayment: true,
        isFree: false
    },
    EFECTIVO: {
        label: 'Pago Real - Efectivo',
        badgeLabel: 'EFECTIVO',
        color: '#16A34A',
        bg: '#F0FDF4',
        description: 'Pago real recibido en efectivo.',
        autoAmount: null,
        autoReference: 'EFECTIVO - {deviceName} ({date})',
        isRealPayment: true,
        isFree: false
    },
    TRANSFERENCIA: {
        label: 'Pago Real - Transferencia Bancaria',
        badgeLabel: 'TRANSFERENCIA',
        color: '#2563EB',
        bg: '#EFF6FF',
        description: 'Pago real recibido por transferencia bancaria.',
        autoAmount: null,
        autoReference: 'TRANSFERENCIA - {deviceName} ({date})',
        isRealPayment: true,
        isFree: false
    },
    ACCIDENT_TRANSIT: {
        label: 'Ajuste - Retenida en tránsito por accidente ($0)',
        badgeLabel: 'TRANSITO',
        color: '#FB9678',
        bg: '#FFF4EF',
        description: 'Vehículo retenido en tránsito por accidente — día sin cobro al cliente.',
        autoAmount: 0,
        autoReference: 'TRANSITO - {deviceName} ({date})',
        isRealPayment: false,
        isFree: true
    },
    REPAIR: {
        label: 'Ajuste - Retenida en tránsito por accidente ($0)',
        badgeLabel: 'RETENIDA',
        color: '#FB9678',
        bg: '#FFF4EF',
        description: 'Vehículo retenido en tránsito por accidente — día sin cobro al cliente.',
        autoAmount: 0,
        autoReference: 'RETENIDA - {deviceName} ({date})',
        hidden: true,
        isRealPayment: false,
        isFree: true
    },
    INCAPACITY: {
        label: 'Ajuste - Incapacidad ($0)',
        badgeLabel: 'INCAPACIDAD',
        color: '#3b82f6',
        bg: '#EFF6FF',
        description: 'Incapacidad médica del cliente — día sin cobro al cliente.',
        autoAmount: 0,
        autoReference: 'INCAPACIDAD - {deviceName} ({date})',
        isRealPayment: false,
        isFree: true
    },
    MAINTENANCE: {
        label: 'Ajuste - Mantenimiento ($0)',
        badgeLabel: 'MANTENIMIENTO',
        color: '#7460EE',
        bg: '#F5F3FF',
        description: 'Mantenimiento programado — día sin cobro al cliente.',
        autoAmount: 0,
        autoReference: 'MANTENIMIENTO - {deviceName} ({date})',
        isRealPayment: false,
        isFree: true
    },
    ADJUSTMENT: {
        label: 'Ajuste - Oficina ($0)',
        badgeLabel: 'OFICINA',
        color: '#0891B2',
        bg: '#ECFEFF',
        description: 'Ajuste realizado en oficina — día sin cobro al cliente.',
        autoAmount: 0,
        autoReference: 'OFICINA - {deviceName} ({date})',
        isRealPayment: false,
        isFree: true
    },
    OFFICE: {
        label: 'Ajuste - Oficina ($0)',
        badgeLabel: 'OFICINA',
        color: '#0891B2',
        bg: '#ECFEFF',
        description: 'Ajuste realizado en oficina — día sin cobro al cliente.',
        autoAmount: 0,
        autoReference: 'OFICINA - {deviceName} ({date})',
        hidden: true,
        isRealPayment: false,
        isFree: true
    },
    OFICINA: {
        label: 'Ajuste - Oficina ($0)',
        badgeLabel: 'OFICINA',
        color: '#0891B2',
        bg: '#ECFEFF',
        description: 'Ajuste realizado en oficina — día sin cobro al cliente.',
        autoAmount: 0,
        autoReference: 'OFICINA - {deviceName} ({date})',
        hidden: true,
        isRealPayment: false,
        isFree: true
    },
    WORKSHOP: {
        label: 'Ajuste - Taller ($0)',
        badgeLabel: 'TALLER',
        color: '#A3A3A3',
        bg: '#F5F5F5',
        description: 'Dispositivo en taller — día sin cobro al cliente.',
        autoAmount: 0,
        autoReference: 'TALLER - {deviceName} ({date})',
        isRealPayment: false,
        isFree: true
    },
    TALLER: {
        label: 'Ajuste - Taller ($0)',
        badgeLabel: 'TALLER',
        color: '#A3A3A3',
        bg: '#F5F5F5',
        description: 'Dispositivo en taller — día sin cobro al cliente.',
        autoAmount: 0,
        autoReference: 'TALLER - {deviceName} ({date})',
        hidden: true,
        isRealPayment: false,
        isFree: true
    },
    MANTENIMIENTO: {
        label: 'Ajuste - Mantenimiento ($0)',
        badgeLabel: 'MANTENIMIENTO',
        color: '#7460EE',
        bg: '#F5F3FF',
        description: 'Mantenimiento programado — día sin cobro al cliente.',
        autoAmount: 0,
        autoReference: 'MANTENIMIENTO - {deviceName} ({date})',
        hidden: true,
        isRealPayment: false,
        isFree: true
    },
    INCAPACIDAD: {
        label: 'Ajuste - Incapacidad ($0)',
        badgeLabel: 'INCAPACIDAD',
        color: '#3b82f6',
        bg: '#EFF6FF',
        description: 'Incapacidad médica del cliente — día sin cobro al cliente.',
        autoAmount: 0,
        autoReference: 'INCAPACIDAD - {deviceName} ({date})',
        hidden: true,
        isRealPayment: false,
        isFree: true
    },
    TRANSITO: {
        label: 'Ajuste - Retenida en tránsito por accidente ($0)',
        badgeLabel: 'TRANSITO',
        color: '#FB9678',
        bg: '#FFF4EF',
        description: 'Vehículo retenido en tránsito por accidente — día sin cobro al cliente.',
        autoAmount: 0,
        autoReference: 'TRANSITO - {deviceName} ({date})',
        hidden: true,
        isRealPayment: false,
        isFree: true
    }
};

export const SETTING_KEYS = {
    ADJUSTMENT_TYPES: 'adjustment_types',
    PAYMENT_STATUS: 'payment_status'
};

export const SETTINGS_DEFINITIONS = {
    [SETTING_KEYS.ADJUSTMENT_TYPES]: {
        defaultValue: DEFAULT_ADJUSTMENT_TYPES,
        description: 'Tipos de pagos y ajustes de facturas'
    },
    [SETTING_KEYS.PAYMENT_STATUS]: {
        defaultValue: DEFAULT_PAYMENT_STATUSES,
        description: 'Estados contables del ciclo de facturación'
    }
};
