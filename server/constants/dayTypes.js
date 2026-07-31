/**
 * Server-driven Day Types Configuration Registry.
 * Serves as the single source of truth for payment status metadata across the system.
 */
export const DEFAULT_DAY_TYPES_CONFIG = {
    LOAN: {
        label: 'Prestada',
        cellClass: 'status-cell loand',
        defaultText: '--',
        renderMode: 'static',
    },
    PAID: {
        label: 'Pagado',
        cellClass: 'status-cell approved',
        defaultText: '✓',
        renderMode: 'currency_or_default',
    },
    FREE: {
        label: 'Día Gratis',
        cellClass: 'status-cell free',
        defaultText: '✓',
        renderMode: 'currency_or_default',
    },
    ADJUSTMENT: {
        label: 'Ajuste',
        cellClass: 'status-cell adjusted',
        defaultText: '🔧',
        renderMode: 'static',
    },
    PENDING: {
        label: 'Pendiente',
        cellClass: 'status-cell pending',
        defaultText: '-',
        renderMode: 'currency_or_dash',
    },
};

export default DEFAULT_DAY_TYPES_CONFIG;
