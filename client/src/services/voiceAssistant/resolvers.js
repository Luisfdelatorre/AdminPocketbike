/**
 * Local Response Resolvers & On-Demand Live Data Fetcher — UPay AI Voice Assistant
 *
 * Resolves approved `{{placeholder}}` tokens in assistant response templates
 * using real client-side state from `ScreenBridge` OR by querying the existing
 * authenticated API endpoints in `client/src/services/api.js` when a module's
 * metrics are not yet loaded in memory.
 *
 * Also constructs real visual data cards (`stats` and `list` of actual plates,
 * debtors, payments, contracts, alerts) so the assistant panel always displays
 * 100% live company data.
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

const isPaginatedPartial = (metrics = {}) =>
    Boolean(
        metrics.isPaginated &&
            typeof metrics.globalTotalCount === 'number' &&
            typeof metrics.loadedCount === 'number' &&
            metrics.globalTotalCount > metrics.loadedCount
    );

const buildCountResolution = (value, metrics = {}) => {
    if (typeof value !== 'number' || !Number.isFinite(value)) return null;
    const partial = isPaginatedPartial(metrics);
    return {
        value,
        formatted: String(value),
        kind: 'count',
        isComplete: !partial,
        loadedCount: typeof metrics.loadedCount === 'number' ? metrics.loadedCount : null,
        globalTotalCount:
            typeof metrics.globalTotalCount === 'number' ? metrics.globalTotalCount : null,
    };
};

const buildCurrencyResolution = (value, metrics = {}) => {
    if (typeof value !== 'number' || !Number.isFinite(value)) return null;
    const partial = isPaginatedPartial(metrics);
    return {
        value,
        formatted: formatCOP(value),
        kind: 'currency',
        isComplete: !partial,
        loadedCount: typeof metrics.loadedCount === 'number' ? metrics.loadedCount : null,
        globalTotalCount:
            typeof metrics.globalTotalCount === 'number' ? metrics.globalTotalCount : null,
    };
};

/**
 * Normalizes Spanish & English singular/plural and zero-count phrasing after numeric substitution
 * so templates never output "1 pagos rechazados", "1 registros", or "There are 1 payments".
 */
export const applyNaturalCountGrammar = (text = '', lang = 'es-CO') => {
    let out = String(text || '');
    if (!out) return '';

    if (lang === 'en-US') {
        out = out.replace(/\bThere are 1\b/gi, (m) =>
            m[0] === 'T' ? 'There is 1' : 'there is 1'
        );
        out = out.replace(
            /\b1\s+((?:rejected|approved|pending|active|suspended|offline|critical|failed|overdue)\s+)?(payments|records|motorcycles|devices|contracts|alerts|invoices|commands)\b/gi,
            (_, adj = '', noun) => {
                const singular = noun.replace(/s$/i, '');
                return `1 ${adj || ''}${singular}`;
            }
        );
        out = out.replace(/^There are 0 ([^.]+)\.$/i, 'There are no $1 right now.');
        return out;
    }

    // Zero-count natural phrasing for standalone count answers
    out = out.replace(
        /^(?:Hay|Existen|Veo|Se encontraron)\s+0\s+([^.]+)\.$/i,
        'No hay $1 en este momento.'
    );

    // Feminine singular nouns ("1 motos apagadas" -> "una moto apagada", "1 alertas activas" -> "una alerta activa")
    const femRules = [
        [/\b1\s+motos\s+apagadas\b/gi, 'una moto apagada'],
        [/\b1\s+motos\s+desconectadas\b/gi, 'una moto desconectada'],
        [/\b1\s+motos\s+activas\b/gi, 'una moto activa'],
        [/\b1\s+motos\s+disponibles\b/gi, 'una moto disponible'],
        [/\b1\s+motos\s+encendidas\b/gi, 'una moto encendida'],
        [/\b1\s+motos\s+filtradas\b/gi, 'una moto filtrada'],
        [/\b1\s+motos\s+en\s+deuda\b/gi, 'una moto en deuda'],
        [/\b1\s+motos\s+con\s+deuda\b/gi, 'una moto con deuda'],
        [/\b1\s+motos\s+en\s+mora\b/gi, 'una moto en mora'],
        [/\b1\s+motos\s+con\s+falla\b/gi, 'una moto con falla'],
        [/\b1\s+motos\b/gi, 'una moto'],
        [/\b1\s+alertas\s+activas\b/gi, 'una alerta activa'],
        [/\b1\s+alertas\s+cr[ií]ticas\b/gi, 'una alerta crítica'],
        [/\b1\s+alertas\b/gi, 'una alerta'],
        [/\b1\s+facturas\s+pendientes\b/gi, 'una factura pendiente'],
        [/\b1\s+facturas\s+pagadas\b/gi, 'una factura pagada'],
        [/\b1\s+facturas\s+sin\s+pagar\b/gi, 'una factura sin pagar'],
        [/\b1\s+facturas\b/gi, 'una factura'],
    ];
    for (const [pattern, replacement] of femRules) {
        out = out.replace(pattern, replacement);
    }

    // Masculine singular nouns ("1 pagos rechazados" -> "un pago rechazado", "1 registros" -> "un registro")
    const mascRules = [
        [/\b1\s+pagos\s+rechazados\b/gi, 'un pago rechazado'],
        [/\b1\s+pagos\s+aprobados\b/gi, 'un pago aprobado'],
        [/\b1\s+pagos\s+pendientes\b/gi, 'un pago pendiente'],
        [/\b1\s+pagos\s+fallidos\b/gi, 'un pago fallido'],
        [/\b1\s+pagos\b/gi, 'un pago'],
        [/\b1\s+contratos\s+activos\b/gi, 'un contrato activo'],
        [/\b1\s+contratos\s+finalizados\b/gi, 'un contrato finalizado'],
        [/\b1\s+contratos\s+cancelados\b/gi, 'un contrato cancelado'],
        [/\b1\s+contratos\s+semanales\b/gi, 'un contrato semanal'],
        [/\b1\s+contratos\s+en\s+deuda\b/gi, 'un contrato en deuda'],
        [/\b1\s+contratos\s+en\s+mora\b/gi, 'un contrato en mora'],
        [/\b1\s+contratos\b/gi, 'un contrato'],
        [/\b1\s+comandos\s+fallidos\b/gi, 'un comando fallido'],
        [/\b1\s+comandos\s+enviados\b/gi, 'un comando enviado'],
        [/\b1\s+comandos\b/gi, 'un comando'],
        [/\b1\s+registros\s+encontrados\b/gi, 'un registro encontrado'],
        [/\b1\s+registros\b/gi, 'un registro'],
    ];
    for (const [pattern, replacement] of mascRules) {
        out = out.replace(pattern, replacement);
    }

    return out;
};

/**
 * Canonical Resolver Registry.
 * Every resolver supplies structured numerical/currency data without injecting descriptive
 * strings into numerical placeholders.
 */
export const RESOLVER_REGISTRY = Object.freeze({
    'payments.count': {
        module: 'payments',
        isGlobal: false,
        resolveStructured: (metrics) => buildCountResolution(metrics.filteredCount, metrics),
        resolve: (metrics) =>
            typeof metrics.filteredCount === 'number' ? String(metrics.filteredCount) : null,
        fallback: (lang) => (lang === 'en-US' ? 'unavailable' : 'no disponible'),
    },
    'payments.total': {
        module: 'payments',
        isGlobal: false,
        resolveStructured: (metrics) => buildCurrencyResolution(metrics.filteredTotal, metrics),
        resolve: (metrics) =>
            typeof metrics.filteredTotal === 'number' ? formatCOP(metrics.filteredTotal) : null,
        fallback: (lang) => (lang === 'en-US' ? 'unavailable' : 'no disponible'),
    },
    'payments.globalTotalCount': {
        module: 'payments',
        isGlobal: true,
        resolveStructured: (metrics) =>
            typeof metrics.globalTotalCount === 'number'
                ? {
                      value: metrics.globalTotalCount,
                      formatted: String(metrics.globalTotalCount),
                      kind: 'count',
                      isComplete: true,
                  }
                : null,
        resolve: (metrics) =>
            typeof metrics.globalTotalCount === 'number' ? String(metrics.globalTotalCount) : null,
        fallback: (lang) => (lang === 'en-US' ? 'unavailable' : 'no disponible'),
    },
    'devices.count': {
        module: 'devices',
        isGlobal: true,
        resolveStructured: (metrics) => buildCountResolution(metrics.filteredCount),
        resolve: (metrics) =>
            typeof metrics.filteredCount === 'number' ? String(metrics.filteredCount) : null,
        fallback: (lang) => (lang === 'en-US' ? 'unavailable' : 'no disponible'),
    },
    'devices.offlineCount': {
        module: 'devices',
        isGlobal: true,
        resolveStructured: (metrics) => buildCountResolution(metrics.offlineCount),
        resolve: (metrics) =>
            typeof metrics.offlineCount === 'number' ? String(metrics.offlineCount) : null,
        fallback: (lang) => (lang === 'en-US' ? 'unavailable' : 'no disponible'),
    },
    'devices.cutoffCount': {
        module: 'devices',
        isGlobal: true,
        resolveStructured: (metrics) => buildCountResolution(metrics.cutoffCount),
        resolve: (metrics) =>
            typeof metrics.cutoffCount === 'number' ? String(metrics.cutoffCount) : null,
        fallback: (lang) => (lang === 'en-US' ? 'unavailable' : 'no disponible'),
    },
    'contracts.count': {
        module: 'contracts',
        isGlobal: true,
        resolveStructured: (metrics) => buildCountResolution(metrics.filteredCount),
        resolve: (metrics) =>
            typeof metrics.filteredCount === 'number' ? String(metrics.filteredCount) : null,
        fallback: (lang) => (lang === 'en-US' ? 'unavailable' : 'no disponible'),
    },
    'contracts.totalValue': {
        module: 'contracts',
        isGlobal: true,
        resolveStructured: (metrics) => buildCurrencyResolution(metrics.filteredTotalValue),
        resolve: (metrics) =>
            typeof metrics.filteredTotalValue === 'number' ? formatCOP(metrics.filteredTotalValue) : null,
        fallback: (lang) => (lang === 'en-US' ? 'unavailable' : 'no disponible'),
    },
    'summary.count': {
        module: 'summary',
        isGlobal: true,
        resolveStructured: (metrics) => buildCountResolution(metrics.filteredCount),
        resolve: (metrics) =>
            typeof metrics.filteredCount === 'number' ? String(metrics.filteredCount) : null,
        fallback: (lang) => (lang === 'en-US' ? 'unavailable' : 'no disponible'),
    },
    'summary.debtorsCount': {
        module: 'summary',
        isGlobal: true,
        resolveStructured: (metrics) => buildCountResolution(metrics.debtorsCount),
        resolve: (metrics) =>
            typeof metrics.debtorsCount === 'number' ? String(metrics.debtorsCount) : null,
        fallback: (lang) => (lang === 'en-US' ? 'unavailable' : 'no disponible'),
    },
    'summary.debtTotal': {
        module: 'summary',
        isGlobal: true,
        resolveStructured: (metrics) => buildCurrencyResolution(metrics.filteredDebtTotal),
        resolve: (metrics) =>
            typeof metrics.filteredDebtTotal === 'number' ? formatCOP(metrics.filteredDebtTotal) : null,
        fallback: (lang) => (lang === 'en-US' ? 'unavailable' : 'no disponible'),
    },
    'summary.weeklyDebtorsCount': {
        module: 'summary',
        isGlobal: true,
        resolveStructured: (metrics) => buildCountResolution(metrics.weeklyDebtorsCount),
        resolve: (metrics) =>
            typeof metrics.weeklyDebtorsCount === 'number' ? String(metrics.weeklyDebtorsCount) : null,
        fallback: (lang) => (lang === 'en-US' ? 'unavailable' : 'no disponible'),
    },
    'summary.weeklyDebtTotal': {
        module: 'summary',
        isGlobal: true,
        resolveStructured: (metrics) => buildCurrencyResolution(metrics.weeklyDebtTotal),
        resolve: (metrics) =>
            typeof metrics.weeklyDebtTotal === 'number' ? formatCOP(metrics.weeklyDebtTotal) : null,
        fallback: (lang) => (lang === 'en-US' ? 'unavailable' : 'no disponible'),
    },
    'invoices.count': {
        module: 'invoices',
        isGlobal: false,
        resolveStructured: (metrics) =>
            buildCountResolution(
                typeof metrics.filteredCount === 'number' ? metrics.filteredCount : metrics.totalCount,
                metrics
            ),
        resolve: (metrics) =>
            typeof metrics.filteredCount === 'number'
                ? String(metrics.filteredCount)
                : typeof metrics.totalCount === 'number'
                ? String(metrics.totalCount)
                : null,
        fallback: (lang) => (lang === 'en-US' ? 'unavailable' : 'no disponible'),
    },
    'invoices.unpaidCount': {
        module: 'invoices',
        isGlobal: true,
        resolveStructured: (metrics) => buildCountResolution(metrics.unpaidCount),
        resolve: (metrics) =>
            typeof metrics.unpaidCount === 'number' ? String(metrics.unpaidCount) : null,
        fallback: (lang) => (lang === 'en-US' ? 'unavailable' : 'no disponible'),
    },
    'invoices.unpaidAmount': {
        module: 'invoices',
        isGlobal: true,
        resolveStructured: (metrics) => buildCurrencyResolution(metrics.unpaidAmount),
        resolve: (metrics) =>
            typeof metrics.unpaidAmount === 'number' ? formatCOP(metrics.unpaidAmount) : null,
        fallback: (lang) => (lang === 'en-US' ? 'unavailable' : 'no disponible'),
    },
    'invoices.totalAmount': {
        module: 'invoices',
        isGlobal: true,
        resolveStructured: (metrics) => buildCurrencyResolution(metrics.totalAmount),
        resolve: (metrics) =>
            typeof metrics.totalAmount === 'number' ? formatCOP(metrics.totalAmount) : null,
        fallback: (lang) => (lang === 'en-US' ? 'unavailable' : 'no disponible'),
    },
    'alerts.count': {
        module: 'alerts',
        isGlobal: false,
        resolveStructured: (metrics) =>
            buildCountResolution(
                typeof metrics.filteredCount === 'number' ? metrics.filteredCount : metrics.totalCount,
                metrics
            ),
        resolve: (metrics) =>
            typeof metrics.filteredCount === 'number'
                ? String(metrics.filteredCount)
                : typeof metrics.totalCount === 'number'
                ? String(metrics.totalCount)
                : null,
        fallback: (lang) => (lang === 'en-US' ? 'unavailable' : 'no disponible'),
    },
    'alerts.activeCount': {
        module: 'alerts',
        isGlobal: true,
        resolveStructured: (metrics) => buildCountResolution(metrics.activeCount),
        resolve: (metrics) =>
            typeof metrics.activeCount === 'number' ? String(metrics.activeCount) : null,
        fallback: (lang) => (lang === 'en-US' ? 'unavailable' : 'no disponible'),
    },
    'alerts.criticalCount': {
        module: 'alerts',
        isGlobal: true,
        resolveStructured: (metrics) => buildCountResolution(metrics.criticalCount),
        resolve: (metrics) =>
            typeof metrics.criticalCount === 'number' ? String(metrics.criticalCount) : null,
        fallback: (lang) => (lang === 'en-US' ? 'unavailable' : 'no disponible'),
    },
    'commands.count': {
        module: 'commands',
        isGlobal: true,
        resolveStructured: (metrics) => buildCountResolution(metrics.totalCount),
        resolve: (metrics) =>
            typeof metrics.totalCount === 'number' ? String(metrics.totalCount) : null,
        fallback: (lang) => (lang === 'en-US' ? 'unavailable' : 'no disponible'),
    },
    'commands.failedCount': {
        module: 'commands',
        isGlobal: true,
        resolveStructured: (metrics) => buildCountResolution(metrics.failedCount),
        resolve: (metrics) =>
            typeof metrics.failedCount === 'number' ? String(metrics.failedCount) : null,
        fallback: (lang) => (lang === 'en-US' ? 'unavailable' : 'no disponible'),
    },
    'dashboard.totalRevenue': {
        module: 'dashboard',
        isGlobal: true,
        resolveStructured: (metrics) => buildCurrencyResolution(metrics.totalRevenue),
        resolve: (metrics) =>
            typeof metrics.totalRevenue === 'number' ? formatCOP(metrics.totalRevenue) : null,
        fallback: (lang) => (lang === 'en-US' ? 'unavailable' : 'no disponible'),
    },
    'dashboard.collectionRate': {
        module: 'dashboard',
        isGlobal: true,
        resolveStructured: (metrics) =>
            typeof metrics.collectionRate === 'number'
                ? {
                      value: Math.round(metrics.collectionRate),
                      formatted: `${Math.round(metrics.collectionRate)}%`,
                      kind: 'percent',
                      isComplete: true,
                  }
                : null,
        resolve: (metrics) =>
            typeof metrics.collectionRate === 'number' ? `${Math.round(metrics.collectionRate)}%` : null,
        fallback: (lang) => (lang === 'en-US' ? 'unavailable' : 'no disponible'),
    },
});

/**
 * Synchronous placeholder resolver (used when `metricsOverride` or `ScreenBridge` is already ready).
 * Separates numerical placeholder values from partial-scope explanations and never fabricates 0
 * when metrics are missing.
 */
export const resolveTemplatePlaceholders = (
    template = '',
    { user = null, lang = 'es-CO', metricsOverride = null, hasUiActions = false } = {}
) => {
    const cleanTemplate = sanitizePlainText(template);
    if (!cleanTemplate.includes('{{')) {
        return {
            text: cleanTemplate,
            resolvedPlaceholders: {},
            resolvedData: {},
            hasUnresolved: false,
            hasPartialScope: false,
            hasMissingMetrics: false,
        };
    }

    const resolvedPlaceholders = {};
    const resolvedData = {};
    let hasUnresolved = false;
    let hasUnknownOrRestricted = false;
    let hasMissingMetrics = false;
    let partialMeta = null;

    const rawReplaced = cleanTemplate.replace(/\{\{([^{}]*)\}\}/g, (_, rawKey) => {
        const key = String(rawKey).trim();
        const def = RESOLVER_REGISTRY[key];

        if (!def) {
            hasUnresolved = true;
            hasUnknownOrRestricted = true;
            return lang === 'en-US' ? '[unavailable]' : '[no disponible]';
        }

        if (user && !canUserAccessModule(def.module, user)) {
            hasUnresolved = true;
            hasUnknownOrRestricted = true;
            return lang === 'en-US' ? '[restricted]' : '[restringido]';
        }

        const bridge = getScreenBridge(def.module);
        const override = metricsOverride && metricsOverride[def.module];
        const metrics = override || bridge?.metrics || null;
        if ((!override && bridge?.loading) || !metrics || Object.keys(metrics).length === 0) {
            hasUnresolved = true;
            hasMissingMetrics = true;
            return sanitizePlainText(def.fallback(lang));
        }

        try {
            const structured = def.resolveStructured
                ? def.resolveStructured(metrics, lang)
                : (() => {
                      const v = def.resolve(metrics, lang);
                      return v !== null && v !== undefined && v !== ''
                          ? { value: v, formatted: String(v), kind: 'count', isComplete: true }
                          : null;
                  })();

            if (!structured || structured.formatted === '') {
                hasUnresolved = true;
                hasMissingMetrics = true;
                return sanitizePlainText(def.fallback(lang));
            }

            const safeVal = sanitizePlainText(structured.formatted);
            resolvedPlaceholders[key] = safeVal;
            resolvedData[key] = structured;

            if (!structured.isComplete && !partialMeta) {
                partialMeta = structured;
            }
            return safeVal;
        } catch {
            hasUnresolved = true;
            hasMissingMetrics = true;
            return sanitizePlainText(def.fallback(lang));
        }
    });

    // If ANY required metric was missing and there were no security markers to surface,
    // use a clean safe fallback instead of fabricating 0 or leaking "no disponible" mid-sentence.
    if (hasMissingMetrics && !hasUnknownOrRestricted) {
        const missingMsg = hasUiActions
            ? lang === 'en-US'
                ? 'Here is the filtered view on screen.'
                : 'Ya apliqué el filtro en pantalla.'
            : lang === 'en-US'
            ? "I don't have the complete data loaded on screen yet to confirm that figure."
            : 'Todavía no tengo los datos cargados en pantalla para confirmarte ese valor con exactitud.';
        return {
            text: missingMsg,
            resolvedPlaceholders,
            resolvedData,
            hasUnresolved,
            hasPartialScope: false,
            hasMissingMetrics: true,
        };
    }

    let text = applyNaturalCountGrammar(rawReplaced, lang);

    // Handle partial/paginated scope naturally OUTSIDE the numerical placeholder slot
    if (partialMeta) {
        const allEntries = Object.values(resolvedData);
        const onlyPartialCurrency =
            allEntries.length === 1 &&
            allEntries[0].kind === 'currency' &&
            !allEntries[0].isComplete;

        if (onlyPartialCurrency) {
            // Do not state a partial page sum as a complete total (Section 2)
            text =
                lang === 'en-US'
                    ? `Right now only ${partialMeta.loadedCount} of ${partialMeta.globalTotalCount} monthly records are loaded (${partialMeta.formatted} in that sample), so I don't have the complete total yet.`
                    : `Por ahora solo tengo cargados ${partialMeta.loadedCount} de los ${partialMeta.globalTotalCount} registros del mes (${partialMeta.formatted} en esa muestra), así que todavía no tengo el total completo.`;
        } else if (lang === 'es-CO' && /^Hay\s+(.+)\.$/i.test(text)) {
            const inner = text.replace(/^Hay\s+/i, '').replace(/\.$/, '');
            text = `Por ahora veo ${inner} entre los registros cargados (${partialMeta.loadedCount} de ${partialMeta.globalTotalCount} del mes). Todavía no tengo el total completo.`;
        } else if (lang === 'es-CO' && /^No hay\s+(.+)\s+en este momento\.$/i.test(text)) {
            const inner = text
                .replace(/^No hay\s+/i, '')
                .replace(/\s+en este momento\.$/i, '');
            text = `Por ahora no veo ${inner} entre los ${partialMeta.loadedCount} registros cargados (de ${partialMeta.globalTotalCount} del mes). Todavía no tengo el total completo.`;
        } else {
            const scopeExplanation =
                lang === 'en-US'
                    ? `This reflects ${partialMeta.loadedCount} currently loaded records out of ${partialMeta.globalTotalCount} monthly records; the full total is not loaded yet.`
                    : `Por ahora esto corresponde a ${partialMeta.loadedCount} registros cargados de ${partialMeta.globalTotalCount} en el mes; todavía no tengo el total completo.`;
            text = `${text.replace(/\.*\s*$/, '.')} ${scopeExplanation}`;
        }
    }

    // Hard guarantee (Section 11): never expose any residual `{{` or `}}` marker to the user
    text = text.replace(/\{\{[^{}]*\}\}/g, lang === 'en-US' ? '[unavailable]' : '[no disponible]');

    return {
        text,
        resolvedPlaceholders,
        resolvedData,
        hasUnresolved,
        hasPartialScope: Boolean(partialMeta),
        hasMissingMetrics,
    };
};

/**
 * Fetches live module metrics and visual card data on-demand from the authenticated API
 * when running in the browser and a placeholder's module is not yet loaded in `ScreenBridge`.
 */
export const fetchLiveModuleData = async (moduleId, activeFilters = {}) => {
    if (typeof window === 'undefined') return null;

    try {
        const api = await import('../api.js');
        const now = new Date();
        const month = Number(activeFilters.month) || now.getMonth() + 1;
        const year = Number(activeFilters.year) || now.getFullYear();

        switch (moduleId) {
            case 'dashboard': {
                const res = await api.getDashboardStats({ month, year });
                const st = res?.data?.stats || {};
                const metrics = {
                    totalRevenue: Number(st.totalRevenue || 0),
                    totalInvoiced: Number(st.totalInvoiced || 0),
                    collectionRate: Number(st.collectionRate || 0),
                    activeDevices: Number(st.activeDevices || 0),
                    totalDevices: Number(st.totalDevices || 0),
                };
                const summarySentence = `En el período seleccionado el recaudo es de ${formatCOP(metrics.totalRevenue)} sobre ${formatCOP(metrics.totalInvoiced)} facturados (${Math.round(metrics.collectionRate)}% de efectividad), con ${metrics.activeDevices} de ${metrics.totalDevices} motos activas.`;
                return {
                    metrics,
                    summarySentence,
                    cardsData: {
                        kind: 'stats',
                        stats: [
                            { label: 'Recaudado', value: formatCOP(metrics.totalRevenue) },
                            { label: 'Facturado', value: formatCOP(metrics.totalInvoiced) },
                            { label: 'Efectividad', value: `${Math.round(metrics.collectionRate)}%` },
                            { label: 'Motos activas', value: `${metrics.activeDevices}/${metrics.totalDevices}` },
                        ],
                    },
                };
            }

            case 'devices': {
                const res = await api.getAllDevices();
                const list = Array.isArray(res?.devices) ? res.devices : [];
                const isOffline = (d) => {
                    if (!d?.lastUpdate) return true;
                    const ms = new Date(d.lastUpdate).getTime();
                    return Number.isNaN(ms) || Date.now() - ms >= 3 * 60 * 1000;
                };
                const status = activeFilters.status || 'all';
                const query = (activeFilters.searchQuery || '').toLowerCase();
                const filtered = list.filter((d) => {
                    if (query) {
                        const name = (d.name || d.deviceName || '').toLowerCase();
                        const id = String(d.id || '').toLowerCase();
                        if (!name.includes(query) && !id.includes(query)) return false;
                    }
                    if (status === 'active' && !d.hasActiveContract) return false;
                    if (status === 'available' && (d.hasActiveContract || d.isActive === false)) return false;
                    if (status === 'off' && !d.cutOff) return false;
                    if (status === 'on' && !d.ignition) return false;
                    if (status === 'offline' && !isOffline(d)) return false;
                    return true;
                });
                const offlineCount = list.filter(isOffline).length;
                const cutoffList = list.filter((d) => Boolean(d.cutOff));
                const metrics = {
                    filteredCount: filtered.length,
                    totalCount: list.length,
                    offlineCount,
                    cutoffCount: cutoffList.length,
                };
                const itemsToShow = (status === 'off' ? cutoffList : filtered).slice(0, 5);
                const samplePlates = itemsToShow
                    .map((d) => d.name || d.deviceName)
                    .filter(Boolean)
                    .slice(0, 4)
                    .join(', ');
                const summarySentence =
                    status === 'off'
                        ? cutoffList.length > 0
                            ? `Hay ${cutoffList.length} motos apagadas con corte activo (de ${list.length} en la flota)${samplePlates ? `: ${samplePlates}` : ''}.`
                            : `No hay motos apagadas con corte activo en este momento (total flota: ${list.length}).`
                        : status === 'offline'
                        ? `Hay ${offlineCount} motos desconectadas de un total de ${list.length}${samplePlates ? ` (ej. ${samplePlates})` : ''}.`
                        : query
                        ? `Se encontraron ${filtered.length} motos que coinciden con "${activeFilters.searchQuery}"${samplePlates ? `: ${samplePlates}` : ''}.`
                        : `La flota cuenta con ${list.length} motos en total: ${Math.max(0, list.length - offlineCount)} en línea, ${offlineCount} desconectadas y ${cutoffList.length} con corte activo.`;
                const cardsData =
                    status === 'off' || status === 'offline' || query
                        ? {
                              kind: 'list',
                              items: itemsToShow.map((d) => ({
                                  title: d.name || d.deviceName || String(d.id || 'Moto'),
                                  subtitle: d.customerName || (d.hasActiveContract ? 'Con contrato' : 'Disponible'),
                                  value: d.cutOff ? 'Apagada' : isOffline(d) ? 'Offline' : 'En línea',
                              })),
                          }
                        : {
                              kind: 'stats',
                              stats: [
                                  { label: 'Total flota', value: String(list.length) },
                                  { label: 'En línea', value: String(Math.max(0, list.length - offlineCount)) },
                                  { label: 'Offline', value: String(offlineCount) },
                                  { label: 'Con corte', value: String(cutoffList.length) },
                              ],
                          };
                return { metrics, summarySentence, cardsData };
            }

            case 'payments': {
                const res = await api.getAllPayments({ page: 1, limit: 50, month, year });
                const payments = Array.isArray(res?.payments) ? res.payments : [];
                const pagination = res?.pagination || {};
                const statusFilter = activeFilters.status || 'all';
                const datePreset = activeFilters.datePreset || 'all';
                const query = (activeFilters.searchQuery || '').toLowerCase();

                const filtered = payments.filter((p) => {
                    if (statusFilter !== 'all') {
                        const st = (p.status || '').toUpperCase();
                        const tp = (p.type || '').toUpperCase();
                        const isFreeOrAdj =
                            p.amount === 0 ||
                            tp === 'FREE' ||
                            p.isFree ||
                            st === 'FREE' ||
                            p.adjustmentType ||
                            tp === 'ADJUSTMENT' ||
                            st === 'ADJUSTMENT';
                        const isApproved = !isFreeOrAdj && (st === 'APPROVED' || st === 'COMPLETED');
                        const isPending = !isFreeOrAdj && (st === 'PENDING' || st === 'VERIFYING');
                        const isFailed =
                            !isFreeOrAdj &&
                            (st === 'DECLINED' || st === 'ERROR' || st === 'FAILED' || st === 'REJECTED');
                        if (statusFilter === 'completed' && !isApproved) return false;
                        if (statusFilter === 'pending' && !isPending) return false;
                        if (statusFilter === 'failed' && !isFailed) return false;
                        if (statusFilter === 'free' && !isFreeOrAdj) return false;
                    }
                    if (datePreset !== 'all' && p.createdAt) {
                        const pDate = new Date(p.createdAt);
                        if (!Number.isNaN(pDate.getTime())) {
                            const startOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate());
                            const startOfYesterday = new Date(startOfToday);
                            startOfYesterday.setDate(startOfYesterday.getDate() - 1);
                            const startOfLast7Days = new Date(startOfToday);
                            startOfLast7Days.setDate(startOfLast7Days.getDate() - 7);
                            if (datePreset === 'today' && pDate < startOfToday) return false;
                            if (
                                datePreset === 'yesterday' &&
                                (pDate < startOfYesterday || pDate >= startOfToday)
                            )
                                return false;
                            if (datePreset === 'last_7_days' && pDate < startOfLast7Days) return false;
                        }
                    }
                    if (query) {
                        const dev = String(p.deviceId || '').toLowerCase();
                        const inv = String(p.invoiceId || p.unpaidInvoiceId || p.paymentReference || '').toLowerCase();
                        if (!dev.includes(query) && !inv.includes(query)) return false;
                    }
                    return true;
                });

                const filteredTotal = filtered.reduce((s, p) => s + (Number(p.amount) || 0), 0);
                const globalTotalCount = Number(pagination.total || payments.length);
                const statusLabel =
                    statusFilter === 'failed'
                        ? 'rechazados'
                        : statusFilter === 'completed'
                        ? 'aprobados'
                        : statusFilter === 'pending'
                        ? 'pendientes'
                        : statusFilter === 'free'
                        ? 'gratis o de ajuste'
                        : 'registrados';
                const summarySentence = `En la página actual hay ${filtered.length} pagos ${statusLabel} por un total de ${formatCOP(filteredTotal)} (de ${globalTotalCount} pagos totales en el mes).`;
                const metrics = {
                    filteredCount: filtered.length,
                    filteredTotal,
                    loadedCount: payments.length,
                    globalTotalCount,
                    isPaginated: Number(pagination.totalPages || 1) > 1,
                };
                const paymentStatusEs = (raw) => {
                    const st = String(raw || '').toUpperCase();
                    if (st === 'APPROVED' || st === 'COMPLETED') return 'Aprobado';
                    if (st === 'PENDING' || st === 'VERIFYING') return 'Pendiente';
                    if (st === 'DECLINED' || st === 'FAILED' || st === 'REJECTED') return 'Rechazado';
                    if (st === 'ERROR') return 'Error';
                    return raw || '';
                };
                const cardsData =
                    filtered.length > 0
                        ? {
                              kind: 'list',
                              items: filtered.slice(0, 5).map((p) => {
                                  const dateShort = p.createdAt
                                      ? new Date(p.createdAt).toLocaleDateString('es-CO', {
                                            day: '2-digit',
                                            month: 'short',
                                        })
                                      : '';
                                  const sub = [
                                      paymentStatusEs(p.status),
                                      p.paymentMethod || p.type || '',
                                      dateShort,
                                  ]
                                      .filter(Boolean)
                                      .join(' · ');
                                  return {
                                      title: p.deviceId || p.deviceIdName || 'Pago',
                                      subtitle: sub || p.invoiceId || p.paymentReference || '',
                                      value: formatCOP(p.amount || 0),
                                  };
                              }),
                          }
                        : null;
                return { metrics, summarySentence, cardsData };
            }

            case 'summary': {
                const res = await api.getPaymentSummary({ month, year });
                const list = Array.isArray(res?.data) ? res.data : [];
                const statusFilter = activeFilters.status || 'all';
                const query = (activeFilters.searchQuery || '').toLowerCase();

                const debtors = list
                    .filter((item) => (Number(item.device?.unpaidTotal) || 0) > 0)
                    .sort((a, b) => (Number(b.device?.unpaidTotal) || 0) - (Number(a.device?.unpaidTotal) || 0));

                const weeklyDebtors = debtors.filter(
                    (item) => (Number(item.device?.paymentFrequency) || 1) > 1
                );
                const weeklyDebtTotal = weeklyDebtors.reduce(
                    (s, item) => s + (Number(item.device?.unpaidTotal) || 0),
                    0
                );

                const filtered = list.filter((item) => {
                    if (query) {
                        const nm = (item.device?.name || '').toLowerCase();
                        const dr = (item.device?.customerName || item.device?.driverName || '').toLowerCase();
                        if (!nm.includes(query) && !dr.includes(query)) return false;
                    }
                    if (statusFilter === 'debt') return (Number(item.device?.unpaidTotal) || 0) > 0;
                    if (statusFilter === 'ok') return (Number(item.device?.unpaidTotal) || 0) === 0;
                    if (statusFilter === 'cutoff') return Boolean(item.device?.cutOff);
                    if (statusFilter === 'weekly') return (Number(item.device?.paymentFrequency) || 1) > 1;
                    return true;
                });

                const filteredDebtTotal = filtered.reduce(
                    (s, item) => s + (Number(item.device?.unpaidTotal) || 0),
                    0
                );
                const topDebtor = debtors[0]?.device;
                const summarySentence =
                    statusFilter === 'weekly'
                        ? `De las ${filtered.length} motos con contrato semanal, ${weeklyDebtors.length} están en mora con una deuda de ${formatCOP(weeklyDebtTotal)}.`
                        : debtors.length > 0
                        ? `Hay ${debtors.length} motos con deuda pendiente por un total de ${formatCOP(filteredDebtTotal)} (${weeklyDebtors.length} de modalidad semanal por ${formatCOP(weeklyDebtTotal)}).${topDebtor ? ` El mayor saldo es ${topDebtor.name || topDebtor.deviceId} con ${formatCOP(topDebtor.unpaidTotal)}.` : ''}`
                        : `Todas las ${list.length} motos están al día sin deuda pendiente.`;
                const metrics = {
                    filteredCount: filtered.length,
                    debtorsCount: debtors.length,
                    filteredDebtTotal,
                    weeklyDebtorsCount: weeklyDebtors.length,
                    weeklyDebtTotal,
                };
                const cardsData =
                    debtors.length > 0
                        ? {
                              kind: 'list',
                              items: debtors.slice(0, 5).map((item) => ({
                                  title: item.device?.name || item.device?.deviceId || 'Moto',
                                  subtitle:
                                      item.device?.customerName ||
                                      item.device?.driverName ||
                                      `${item.device?.unpaidCount || 1} días pendientes`,
                                  value: formatCOP(item.device?.unpaidTotal || 0),
                              })),
                          }
                        : null;
                return { metrics, summarySentence, cardsData };
            }

            case 'contracts': {
                const res = await api.getAllContracts();
                const contracts = Array.isArray(res?.contracts) ? res.contracts : [];
                const statusFilter = activeFilters.status || 'all';
                const query = (activeFilters.searchQuery || '').toLowerCase();

                const filtered = contracts.filter((c) => {
                    if (statusFilter === 'weekly') {
                        if ((Number(c.paymentFrequency) || 1) <= 1) return false;
                    } else if (statusFilter !== 'all' && (c.status || '').toLowerCase() !== statusFilter.toLowerCase()) {
                        return false;
                    }
                    if (query) {
                        return (
                            (c.deviceId || '').toLowerCase().includes(query) ||
                            (c.contractId || '').toLowerCase().includes(query) ||
                            (c.customerName || '').toLowerCase().includes(query)
                        );
                    }
                    return true;
                });

                const filteredTotalValue = filtered.reduce((s, c) => s + (Number(c.totalAmount) || 0), 0);
                const activeCount = contracts.filter((c) => c.status === 'ACTIVE').length;
                const completedCount = contracts.filter((c) => c.status === 'COMPLETED').length;
                const statusBreakdown =
                    completedCount > 0
                        ? `${activeCount} activos y ${completedCount} finalizados`
                        : `${activeCount} activos`;
                const summarySentence = `Tienes ${filtered.length} contratos (${statusBreakdown}) por un valor total de ${formatCOP(filteredTotalValue)}.`;
                const metrics = {
                    filteredCount: filtered.length,
                    filteredTotalValue,
                    totalCount: contracts.length,
                    activeCount,
                    completedCount,
                };
                const cardsData = {
                    kind: 'stats',
                    stats: [
                        { label: 'Mostrados', value: String(filtered.length) },
                        { label: 'Activos', value: String(activeCount) },
                        { label: 'Finalizados', value: String(completedCount) },
                        { label: 'Valor', value: formatCOP(filteredTotalValue) },
                    ],
                };
                return { metrics, summarySentence, cardsData };
            }

            case 'invoices': {
                const res = await api.getAllInvoices({ month, year, status: activeFilters.status !== 'all' ? activeFilters.status : undefined });
                const st = res?.stats || {};
                const invoices = Array.isArray(res?.invoices) ? res.invoices : [];
                const metrics = {
                    filteredCount: invoices.length,
                    totalCount: Number(st.total || invoices.length || 0),
                    paidCount: Number(st.paid || 0),
                    unpaidCount: Number(st.unpaid || 0),
                    totalAmount: Number(st.totalAmount || 0),
                    unpaidAmount: Number(st.unpaidAmount || 0),
                };
                const summarySentence = `En el mes hay ${metrics.totalCount} facturas diarias: ${metrics.paidCount} pagadas y ${metrics.unpaidCount} pendientes, por un monto total de ${formatCOP(metrics.totalAmount)}.`;
                const cardsData = {
                    kind: 'stats',
                    stats: [
                        { label: 'Total mes', value: String(metrics.totalCount) },
                        { label: 'Pagadas', value: String(metrics.paidCount) },
                        { label: 'Pendientes', value: String(metrics.unpaidCount) },
                        { label: 'Monto total', value: formatCOP(metrics.totalAmount) },
                    ],
                };
                return { metrics, summarySentence, cardsData };
            }

            case 'alerts': {
                const alertTypeFilter = activeFilters.alertType || 'ALL';
                const statusFilterVal = activeFilters.status || 'ALL';
                const [statsRes, histRes] = await Promise.all([
                    api.getAlertsStats({ month, year }).catch(() => null),
                    api
                        .getAlertsHistory({
                            month,
                            year,
                            type: alertTypeFilter,
                            status: statusFilterVal,
                            page: 1,
                            limit: 10,
                            grouped: true,
                        })
                        .catch(() => null),
                ]);
                const st = statsRes?.data?.stats || statsRes?.stats || {};
                const histData = histRes?.data || histRes || {};
                const alerts = Array.isArray(histData?.alerts) ? histData.alerts : [];
                const filteredCount = Number(histData?.pagination?.total ?? alerts.length);
                const metrics = {
                    filteredCount,
                    totalCount: Number(st.total || 0),
                    activeCount: Number(st.active || 0),
                    criticalCount: Number(st.critical || 0),
                };

                const ALERT_TYPE_LABELS = {
                    UNAUTHORIZED_DRIVING: 'sabotaje (conducción en corte)',
                    POWER_CUT: 'corte de energía / batería',
                    UNAUTHORIZED_MOVEMENT: 'movimiento no autorizado',
                    UNAUTHORIZED_IGNITION: 'ignición en corte',
                    GEOFENCE_EXIT: 'salida de geocerca',
                    EXTENDED_OFFLINE: 'offline prolongado',
                };
                const typeLabel = ALERT_TYPE_LABELS[alertTypeFilter] || null;
                const uniquePlates = [...new Set(alerts.map((a) => a.deviceIdName).filter(Boolean))];
                const platesPreview = uniquePlates.slice(0, 6).join(', ');
                const latestAlert = alerts[0];

                let summarySentence;
                if (typeLabel) {
                    summarySentence =
                        filteredCount > 0
                            ? `Se encontraron ${filteredCount} alertas de ${typeLabel} en ${uniquePlates.length} motos${platesPreview ? `: ${platesPreview}` : ''}.`
                            : `No hay motos con alertas de ${typeLabel} en el período seleccionado.`;
                } else {
                    summarySentence =
                        metrics.activeCount > 0
                            ? `Hay ${metrics.activeCount} alertas activas (${metrics.criticalCount} críticas) de ${metrics.totalCount} en el mes.${latestAlert ? ` La más reciente es ${latestAlert.title || latestAlert.alertType} en la moto ${latestAlert.deviceIdName}.` : ''}`
                            : `No hay alertas activas pendientes en este momento (${metrics.totalCount} registradas en el mes).`;
                }

                const cardsData =
                    alerts.length > 0
                        ? {
                              kind: 'list',
                              items: alerts.slice(0, 6).map((a) => ({
                                  title: a.deviceIdName || 'Vehículo',
                                  subtitle: a.title || ALERT_TYPE_LABELS[a.alertType] || a.alertType || 'Alerta',
                                  value: a.count > 1 ? `${a.count} eventos` : a.status || 'ACTIVA',
                              })),
                          }
                        : {
                              kind: 'stats',
                              stats: [
                                  { label: 'Activas', value: String(metrics.activeCount) },
                                  { label: 'Críticas', value: String(metrics.criticalCount) },
                                  { label: 'Total mes', value: String(metrics.totalCount) },
                              ],
                          };
                return { metrics, summarySentence, cardsData };
            }

            case 'commands': {
                const statsRes = await api.getCommandStats({ month, year });
                const st = statsRes?.stats || {};
                const metrics = {
                    totalCount: Number(st.total || st.counts?.all || 0),
                    failedCount: Number(st.counts?.failed || 0),
                };
                const summarySentence = `Este mes se han enviado ${metrics.totalCount} comandos IoT con una tasa de éxito de ${st.successRate || '100%'} y ${metrics.failedCount} fallidos.`;
                const cardsData = {
                    kind: 'stats',
                    stats: [
                        { label: 'Total enviados', value: String(metrics.totalCount) },
                        { label: 'Fallidos', value: String(metrics.failedCount) },
                        { label: 'Éxito', value: String(st.successRate || '100%') },
                        { label: 'En cola', value: String(st.queuedCount || 0) },
                    ],
                };
                return { metrics, summarySentence, cardsData };
            }

            default:
                return null;
        }
    } catch {
        return null;
    }
};

/**
 * Verifies that a mounted `ScreenBridge` matches the expected tenant (`companyId`)
 * and requested filter scope (`status`, `alertType`, `datePreset`, `month`, `year`, `query`)
 * before trusting its cached `metrics` for local placeholder enrichment.
 */
export const doesBridgeMatchScope = (bridge, { activeFilters = {}, user = null } = {}) => {
    if (!bridge || bridge.loading || !bridge.metrics || Object.keys(bridge.metrics).length === 0) {
        return false;
    }

    const userCompanyId = user?.companyId ? String(user.companyId) : null;
    const bridgeCompanyId =
        bridge.companyId || bridge.activeFilters?.companyId
            ? String(bridge.companyId || bridge.activeFilters.companyId)
            : null;
    if (userCompanyId && bridgeCompanyId && userCompanyId !== bridgeCompanyId) {
        return false;
    }

    const bridgeFilters = bridge.activeFilters || {};
    const requested = activeFilters || {};

    const compareStringKey = (reqVal, bridgeVal) => {
        if (reqVal === undefined || reqVal === null || reqVal === '') return true;
        if (bridgeVal === undefined || bridgeVal === null || bridgeVal === '') return true;
        return String(reqVal).trim().toLowerCase() === String(bridgeVal).trim().toLowerCase();
    };

    if (!compareStringKey(requested.status, bridgeFilters.status)) return false;
    if (!compareStringKey(requested.alertType, bridgeFilters.alertType)) return false;
    if (!compareStringKey(requested.datePreset, bridgeFilters.datePreset)) return false;
    if (!compareStringKey(requested.query, bridgeFilters.searchQuery ?? bridgeFilters.query)) {
        return false;
    }
    if (
        requested.month !== undefined &&
        requested.month !== null &&
        bridgeFilters.month !== undefined &&
        bridgeFilters.month !== null &&
        Number(requested.month) !== Number(bridgeFilters.month)
    ) {
        return false;
    }
    if (
        requested.year !== undefined &&
        requested.year !== null &&
        bridgeFilters.year !== undefined &&
        bridgeFilters.year !== null &&
        Number(requested.year) !== Number(bridgeFilters.year)
    ) {
        return false;
    }

    return true;
};

/**
 * Asynchronous resolver that inspects all `{{module.key}}` placeholders in `template`
 * (plus the target module of the executed plan), fetches any missing live data from the API,
 * and returns both the resolved text and real visual `cardsData`.
 */
export const resolveTemplateWithLiveData = async (
    template = '',
    {
        targetModule = null,
        activeFilters = {},
        user = null,
        lang = 'es-CO',
        metricsOverride = null,
        onDemandDataUsed = false,
        hasUiActions = false,
    } = {}
) => {
    const combinedOverrides = { ...(metricsOverride || {}) };
    let cardsData = null;
    let targetSummarySentence = null;

    // Identify modules referenced by placeholders or targetModule
    const modulesToCheck = new Set();
    if (targetModule) modulesToCheck.add(targetModule);

    const hadPlaceholders = /\{\{\s*[a-zA-Z0-9_.-]+\s*\}\}/.test(String(template || ''));
    const placeholderMatches = String(template || '').matchAll(/\{\{\s*([a-zA-Z0-9_.-]+)\s*\}\}/g);
    for (const m of placeholderMatches) {
        const key = String(m[1] || '').trim();
        const def = RESOLVER_REGISTRY[key];
        if (def?.module) {
            modulesToCheck.add(def.module);
        }
    }

    for (const modId of modulesToCheck) {
        if (user && !canUserAccessModule(modId, user)) continue;
        if (combinedOverrides[modId]) continue;

        const bridge = getScreenBridge(modId);
        const isTargetMod = modId === targetModule;
        const hasValidBridge = doesBridgeMatchScope(bridge, {
            activeFilters: isTargetMod ? activeFilters : {},
            user,
        });

        if (hasValidBridge) {
            combinedOverrides[modId] = bridge.metrics;
            if (isTargetMod && bridge.cardsData) {
                cardsData = bridge.cardsData;
            }
        }

        // Fetch live data from the API when placeholders need metrics not mounted or stale in ScreenBridge
        if (!hasValidBridge && (hadPlaceholders || !template)) {
            const effectiveFilters =
                isTargetMod && Object.keys(activeFilters || {}).length > 0
                    ? { ...(bridge?.activeFilters || {}), ...activeFilters }
                    : bridge?.activeFilters || {};
            const live = await fetchLiveModuleData(modId, effectiveFilters);
            if (live?.metrics) {
                combinedOverrides[modId] = live.metrics;
                if (isTargetMod) {
                    if (live.cardsData) cardsData = live.cardsData;
                    if (live.summarySentence) targetSummarySentence = live.summarySentence;
                }
            }
        }
    }

    const resolved = resolveTemplatePlaceholders(template, {
        user,
        lang,
        metricsOverride: combinedOverrides,
        hasUiActions,
    });

    // Do NOT mechanically append summarySentence statistics onto non-empty confirmations,
    // analytical answers, or clarification prompts (Path A / Path B conversational rule).
    const finalText = resolved.text || (!onDemandDataUsed && targetSummarySentence ? targetSummarySentence : '');

    return {
        ...resolved,
        text: finalText,
        cardsData,
        // Metrics already gathered for this turn, so sibling templates (speechTemplate) resolve without refetching.
        metricsUsed: combinedOverrides,
    };
};

export default {
    RESOLVER_REGISTRY,
    applyNaturalCountGrammar,
    doesBridgeMatchScope,
    resolveTemplatePlaceholders,
    resolveTemplateWithLiveData,
    fetchLiveModuleData,
    formatCOP,
    sanitizePlainText,
};
