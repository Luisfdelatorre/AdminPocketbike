/**
 * Local Response Resolvers — UPay AI Voice Assistant
 *
 * Resolves approved `{{placeholder}}` tokens in assistant response templates
 * using real client-side state from `ScreenBridge` (or fallback demo data when
 * a module hasn't been visited yet).
 *
 * Security & accuracy guarantees:
 *  - Only placeholders in `RESOLVER_REGISTRY` can be resolved.
 *  - Never evaluates dynamic JS or accesses arbitrary object paths.
 *  - Plain-text output only; strips/escapes any HTML characters.
 *  - Never claims a paginated page total is a global total.
 */

import { canUserAccessModule } from './capabilities.js';
import { getScreenBridge } from './screenBridge.js';

export const formatCOP = (value) => {
    const num = Number(value);
    if (!Number.isFinite(num)) return '$ 0';
    return new Intl.NumberFormat('es-CO', {
        style: 'currency',
        currency: 'COP',
        maximumFractionDigits: 0,
    }).format(num);
};

export const sanitizePlainText = (val) =>
    String(val ?? '')
        .replace(/</g, '‹')
        .replace(/>/g, '›');

/**
 * Canonical Resolver Registry.
 */
export const RESOLVER_REGISTRY = Object.freeze({
    'payments.count': {
        module: 'payments',
        isGlobal: false,
        resolve: (metrics, lang) => {
            if (typeof metrics.filteredCount !== 'number') return null;
            if (metrics.isPaginated && metrics.globalTotalCount > metrics.loadedCount) {
                return lang === 'en-US'
                    ? `${metrics.filteredCount} in the currently loaded page (${metrics.loadedCount} of ${metrics.globalTotalCount} monthly records loaded)`
                    : `${metrics.filteredCount} en las páginas cargadas (${metrics.loadedCount} de ${metrics.globalTotalCount} registros del mes)`;
            }
            return String(metrics.filteredCount);
        },
        fallback: (lang) =>
            lang === 'en-US'
                ? 'not available from the currently loaded data'
                : 'no disponible en los datos cargados actualmente',
    },
    'payments.total': {
        module: 'payments',
        isGlobal: false,
        resolve: (metrics, lang) => {
            if (typeof metrics.filteredTotal !== 'number') return null;
            const formatted = formatCOP(metrics.filteredTotal);
            if (metrics.isPaginated && metrics.globalTotalCount > metrics.loadedCount) {
                return lang === 'en-US'
                    ? `${formatted} (across the ${metrics.loadedCount} loaded payments)`
                    : `${formatted} (en los ${metrics.loadedCount} pagos cargados en pantalla)`;
            }
            return formatted;
        },
        fallback: (lang) =>
            lang === 'en-US'
                ? 'not available from the currently loaded data'
                : 'no disponible en los datos cargados actualmente',
    },
    'payments.globalTotalCount': {
        module: 'payments',
        isGlobal: true,
        resolve: (metrics) =>
            typeof metrics.globalTotalCount === 'number' ? String(metrics.globalTotalCount) : null,
        fallback: () => '0',
    },
    'devices.count': {
        module: 'devices',
        isGlobal: true,
        resolve: (metrics) =>
            typeof metrics.filteredCount === 'number' ? String(metrics.filteredCount) : null,
        fallback: (lang) => (lang === 'en-US' ? 'not loaded yet' : 'aún no cargado'),
    },
    'devices.offlineCount': {
        module: 'devices',
        isGlobal: true,
        resolve: (metrics) =>
            typeof metrics.offlineCount === 'number' ? String(metrics.offlineCount) : null,
        fallback: () => '0',
    },
    'devices.cutoffCount': {
        module: 'devices',
        isGlobal: true,
        resolve: (metrics) =>
            typeof metrics.cutoffCount === 'number' ? String(metrics.cutoffCount) : null,
        fallback: () => '0',
    },
    'contracts.count': {
        module: 'contracts',
        isGlobal: true,
        resolve: (metrics) =>
            typeof metrics.filteredCount === 'number' ? String(metrics.filteredCount) : null,
        fallback: (lang) => (lang === 'en-US' ? 'not loaded yet' : 'aún no cargado'),
    },
    'contracts.totalValue': {
        module: 'contracts',
        isGlobal: true,
        resolve: (metrics) =>
            typeof metrics.filteredTotalValue === 'number' ? formatCOP(metrics.filteredTotalValue) : null,
        fallback: (lang) =>
            lang === 'en-US' ? 'not available' : 'no disponible',
    },
    'summary.count': {
        module: 'summary',
        isGlobal: true,
        resolve: (metrics) =>
            typeof metrics.filteredCount === 'number' ? String(metrics.filteredCount) : null,
        fallback: () => '0',
    },
    'summary.debtorsCount': {
        module: 'summary',
        isGlobal: true,
        resolve: (metrics) =>
            typeof metrics.debtorsCount === 'number' ? String(metrics.debtorsCount) : null,
        fallback: () => '0',
    },
    'summary.debtTotal': {
        module: 'summary',
        isGlobal: true,
        resolve: (metrics) =>
            typeof metrics.filteredDebtTotal === 'number' ? formatCOP(metrics.filteredDebtTotal) : null,
        fallback: (lang) => (lang === 'en-US' ? 'not available' : 'no disponible'),
    },
    'invoices.count': {
        module: 'invoices',
        isGlobal: false,
        resolve: (metrics) =>
            typeof metrics.filteredCount === 'number'
                ? String(metrics.filteredCount)
                : typeof metrics.totalCount === 'number'
                ? String(metrics.totalCount)
                : null,
        fallback: () => '0',
    },
    'invoices.unpaidCount': {
        module: 'invoices',
        isGlobal: true,
        resolve: (metrics) =>
            typeof metrics.unpaidCount === 'number' ? String(metrics.unpaidCount) : null,
        fallback: () => '0',
    },
    'invoices.totalAmount': {
        module: 'invoices',
        isGlobal: true,
        resolve: (metrics) =>
            typeof metrics.totalAmount === 'number' ? formatCOP(metrics.totalAmount) : null,
        fallback: (lang) => (lang === 'en-US' ? 'not available' : 'no disponible'),
    },
    'alerts.count': {
        module: 'alerts',
        isGlobal: false,
        resolve: (metrics) =>
            typeof metrics.filteredCount === 'number'
                ? String(metrics.filteredCount)
                : typeof metrics.totalCount === 'number'
                ? String(metrics.totalCount)
                : null,
        fallback: () => '0',
    },
    'alerts.activeCount': {
        module: 'alerts',
        isGlobal: true,
        resolve: (metrics) =>
            typeof metrics.activeCount === 'number' ? String(metrics.activeCount) : null,
        fallback: () => '0',
    },
    'alerts.criticalCount': {
        module: 'alerts',
        isGlobal: true,
        resolve: (metrics) =>
            typeof metrics.criticalCount === 'number' ? String(metrics.criticalCount) : null,
        fallback: () => '0',
    },
    'commands.count': {
        module: 'commands',
        isGlobal: true,
        resolve: (metrics) =>
            typeof metrics.totalCount === 'number' ? String(metrics.totalCount) : null,
        fallback: () => '0',
    },
    'commands.failedCount': {
        module: 'commands',
        isGlobal: true,
        resolve: (metrics) =>
            typeof metrics.failedCount === 'number' ? String(metrics.failedCount) : null,
        fallback: () => '0',
    },
    'dashboard.totalRevenue': {
        module: 'dashboard',
        isGlobal: true,
        resolve: (metrics) =>
            typeof metrics.totalRevenue === 'number' ? formatCOP(metrics.totalRevenue) : null,
        fallback: (lang) => (lang === 'en-US' ? 'not available' : 'no disponible'),
    },
    'dashboard.collectionRate': {
        module: 'dashboard',
        isGlobal: true,
        resolve: (metrics) =>
            typeof metrics.collectionRate === 'number' ? `${Math.round(metrics.collectionRate)}%` : null,
        fallback: () => '0%',
    },
});

/**
 * Resolves all `{{placeholder}}` tokens in `template`.
 *
 * @param {string} template
 * @param {{ user?: object, lang?: 'es-CO'|'en-US', metricsOverride?: Record<string, object> }} options
 * @returns {{ text: string, resolvedPlaceholders: Record<string, string>, hasUnresolved: boolean }}
 */
export const resolveTemplatePlaceholders = (
    template = '',
    { user = null, lang = 'es-CO', metricsOverride = null } = {}
) => {
    const cleanTemplate = sanitizePlainText(template);
    if (!cleanTemplate.includes('{{')) {
        return { text: cleanTemplate, resolvedPlaceholders: {}, hasUnresolved: false };
    }

    const resolvedPlaceholders = {};
    let hasUnresolved = false;

    const text = cleanTemplate.replace(/\{\{\s*([a-zA-Z0-9_.-]+)\s*\}\}/g, (_, rawKey) => {
        const key = String(rawKey).trim();
        const def = RESOLVER_REGISTRY[key];

        if (!def) {
            hasUnresolved = true;
            return lang === 'en-US' ? '[unavailable]' : '[no disponible]';
        }

        if (user && !canUserAccessModule(def.module, user)) {
            hasUnresolved = true;
            return lang === 'en-US' ? '[restricted]' : '[restringido]';
        }

        const bridge = getScreenBridge(def.module);
        const metrics = (metricsOverride && metricsOverride[def.module]) || bridge?.metrics || {};
        if (bridge?.loading) {
            hasUnresolved = true;
            return def.fallback(lang);
        }

        try {
            const value = def.resolve(metrics, lang);
            if (value === null || value === undefined || value === '') {
                hasUnresolved = true;
                return sanitizePlainText(def.fallback(lang));
            }
            const safeVal = sanitizePlainText(value);
            resolvedPlaceholders[key] = safeVal;
            return safeVal;
        } catch {
            hasUnresolved = true;
            return sanitizePlainText(def.fallback(lang));
        }
    });

    return { text, resolvedPlaceholders, hasUnresolved };
};

export default {
    RESOLVER_REGISTRY,
    resolveTemplatePlaceholders,
    formatCOP,
    sanitizePlainText,
};
