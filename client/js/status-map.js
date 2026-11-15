/**
 * Static catalog of payment statuses and adjustment badges with their colors and backgrounds.
 * Cached directly by the browser inside the frontend bundle, avoiding per-request DB queries and HTML bloat.
 */
export const STATUS_CLASS_MAP = {
    PAID: { badgeLabel: 'PAGADO', color: '#0ea5e9', bg: '#f7fcff' },
    PAGADO: { badgeLabel: 'PAGADO', color: '#0ea5e9', bg: '#f7fcff' },

    FREE: { badgeLabel: 'GRATIS', color: '#22c55e', bg: 'rgba(34,197,94,0.05)' },
    GRATIS: { badgeLabel: 'GRATIS', color: '#22c55e', bg: 'rgba(34,197,94,0.05)' },

    PENDING: { badgeLabel: 'PENDIENTE', color: '#eab308', bg: 'rgba(234,179,8,0.05)' },
    PENDIENTE: { badgeLabel: 'PENDIENTE', color: '#eab308', bg: 'rgba(234,179,8,0.05)' },

    DEBT: { badgeLabel: 'DEUDA', color: '#d98181', bg: '#fcfcfc' },
    DEUDA: { badgeLabel: 'DEUDA', color: '#d98181', bg: '#fcfcfc' },

    INITIAL_FEE: { badgeLabel: 'CUOTA INICIAL', color: '#0d9488', bg: 'rgba(13,148,136,0.06)' },
    'CUOTA INICIAL': { badgeLabel: 'CUOTA INICIAL', color: '#0d9488', bg: 'rgba(13,148,136,0.06)' },

    EFECTIVO: { badgeLabel: 'EFECTIVO', color: '#16A34A', bg: '#F0FDF4' },

    TRANSFERENCIA: { badgeLabel: 'PAGO DIGITAL', color: '#2563EB', bg: '#EFF6FF' },
    'PAGO DIGITAL': { badgeLabel: 'PAGO DIGITAL', color: '#2563EB', bg: '#EFF6FF' },

    ACCIDENT_TRANSIT: { badgeLabel: 'TRANSITO', color: '#FB9678', bg: '#FFF4EF' },
    TRANSITO: { badgeLabel: 'TRANSITO', color: '#FB9678', bg: '#FFF4EF' },

    REPAIR: { badgeLabel: 'REPARACION', color: '#FB9678', bg: '#fffbfa' },
    REPARACION: { badgeLabel: 'REPARACION', color: '#FB9678', bg: '#fffbfa' },

    INCAPACITY: { badgeLabel: 'INCAPACIDAD', color: '#3b82f6', bg: '#EFF6FF' },
    INCAPACIDAD: { badgeLabel: 'INCAPACIDAD', color: '#3b82f6', bg: '#EFF6FF' },

    OFFICE: { badgeLabel: 'OFICINA', color: '#0891B2', bg: '#f5feff' },
    OFICINA: { badgeLabel: 'OFICINA', color: '#089fcd', bg: '#f5feff' },

    WORKSHOP: { badgeLabel: 'TALLER', color: '#A3A3A3', bg: '#F5F5F5' },
    TALLER: { badgeLabel: 'TALLER', color: '#A3A3A3', bg: '#F5F5F5' },

    MANTENIMIENTO: { badgeLabel: 'MANTENIMIENTO', color: '#7460EE', bg: '#F5F3FF' },

    INCUMPLIMIENTO: { badgeLabel: 'INCUMPLIMIENTO', color: '#bd3900', bg: '#f5dbdb' }
};

export default STATUS_CLASS_MAP;
