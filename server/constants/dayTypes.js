/**
 * Server-driven day types configuration for the Payment Summary grid.
 * Single source of truth for how each summary dayType is rendered on the client.
 *
 * renderMode:
 *   - static              → always show defaultText
 *   - currency_or_default → show the paid amount when > 0, otherwise defaultText
 */
export const DEFAULT_DAY_TYPES_CONFIG = Object.freeze({
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
        renderMode: 'currency_or_default',
    },
    PENDING: {
        label: 'Pendiente',
        cellClass: 'status-cell pending',
        defaultText: '-',
        renderMode: 'currency_or_default',
    },
});

export default DEFAULT_DAY_TYPES_CONFIG;
