/**
 * Day types registry for Payment Summary cells.
 * Defaults mirror server/constants/dayTypes.js; the server can override them
 * through the `dayTypesConfig` field of GET /payments/allPayments.
 */
const DEFAULT_DAY_TYPES_CONFIG = {
    LOAN: { cellClass: 'status-cell loand', defaultText: '--', renderMode: 'static' },
    PAID: { cellClass: 'status-cell approved', defaultText: '✓', renderMode: 'currency_or_default' },
    FREE: { cellClass: 'status-cell free', defaultText: '✓', renderMode: 'currency_or_default' },
    ADJUSTMENT: { cellClass: 'status-cell adjusted', defaultText: '🔧', renderMode: 'currency_or_default' },
    PENDING: { cellClass: 'status-cell pending', defaultText: '-', renderMode: 'currency_or_default' },
};

let activeConfig = DEFAULT_DAY_TYPES_CONFIG;

export function setDayTypesConfig(serverConfig) {
    if (!serverConfig || typeof serverConfig !== 'object') return;
    activeConfig = { ...DEFAULT_DAY_TYPES_CONFIG, ...serverConfig };
}

/**
 * Resolve the CSS class and text for a summary day.
 * Unknown dayTypes fall back to PENDING, matching the previous if/else chain.
 */
export function resolveDayCell(dayData, formatFn) {
    if (!dayData) return { cellClass: 'status-cell empty', content: '--' };
    const meta = activeConfig[dayData.dayType] || activeConfig.PENDING;
    const showAmount = meta.renderMode === 'currency_or_default' && dayData.totalPaid > 0;
    return {
        cellClass: meta.cellClass || 'status-cell pending',
        content: showAmount ? formatFn(dayData.totalPaid) : (meta.defaultText ?? '-'),
    };
}
