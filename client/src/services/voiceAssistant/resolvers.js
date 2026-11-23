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
        fallback: (lang) => (lang === 'en-US' ? '0' : '0'),
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
        fallback: () => '0',
    },
    'contracts.totalValue': {
        module: 'contracts',
        isGlobal: true,
        resolve: (metrics) =>
            typeof metrics.filteredTotalValue === 'number' ? formatCOP(metrics.filteredTotalValue) : null,
        fallback: () => '$ 0',
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
        fallback: () => '$ 0',
    },
    'summary.weeklyDebtorsCount': {
        module: 'summary',
        isGlobal: true,
        resolve: (metrics) =>
            typeof metrics.weeklyDebtorsCount === 'number' ? String(metrics.weeklyDebtorsCount) : null,
        fallback: () => '0',
    },
    'summary.weeklyDebtTotal': {
        module: 'summary',
        isGlobal: true,
        resolve: (metrics) =>
            typeof metrics.weeklyDebtTotal === 'number' ? formatCOP(metrics.weeklyDebtTotal) : null,
        fallback: () => '$ 0',
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
        fallback: () => '$ 0',
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
        fallback: () => '$ 0',
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
 * Synchronous placeholder resolver (used when `metricsOverride` or `ScreenBridge` is already ready).
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
        const override = metricsOverride && metricsOverride[def.module];
        const metrics = override || bridge?.metrics || {};
        if (!override && bridge?.loading) {
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
                const cardsData =
                    filtered.length > 0
                        ? {
                              kind: 'list',
                              items: filtered.slice(0, 5).map((p) => ({
                                  title: p.deviceId || p.deviceIdName || 'Pago',
                                  subtitle: p.invoiceId || p.paymentReference || p.status || '',
                                  value: formatCOP(p.amount || 0),
                              })),
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
                const summarySentence = `Se muestran ${filtered.length} contratos (${activeCount} activos y ${completedCount} finalizados de ${contracts.length} totales) por un valor de ${formatCOP(filteredTotalValue)}.`;
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
 * Asynchronous resolver that inspects all `{{module.key}}` placeholders in `template`
 * (plus the target module of the executed plan), fetches any missing live data from the API,
 * and returns both the resolved text and real visual `cardsData`.
 */
export const resolveTemplateWithLiveData = async (
    template = '',
    { targetModule = null, activeFilters = {}, user = null, lang = 'es-CO', metricsOverride = null } = {}
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
        const hasLoadedBridge =
            bridge &&
            !bridge.loading &&
            bridge.metrics &&
            Object.keys(bridge.metrics).length > 0;

        if (hasLoadedBridge) {
            combinedOverrides[modId] = bridge.metrics;
            if (modId === targetModule && bridge.cardsData) {
                cardsData = bridge.cardsData;
            }
        }

        // Fetch live data from the API if the bridge is still loading, not mounted,
        // or when we want rich list/stats cards and spoken data summary for the target module
        if (!hasLoadedBridge || (modId === targetModule && (!cardsData || !hadPlaceholders))) {
            const effectiveFilters =
                bridge?.activeFilters && Object.keys(bridge.activeFilters).length > 0
                    ? { ...bridge.activeFilters, ...activeFilters }
                    : activeFilters;
            const live = await fetchLiveModuleData(modId, effectiveFilters);
            if (live?.metrics) {
                if (!hasLoadedBridge) {
                    combinedOverrides[modId] = live.metrics;
                }
                if (modId === targetModule) {
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
    });

    // If the model's responseTemplate didn't contain a placeholder (e.g. "He navegado a motos apagadas."),
    // append the live data summary sentence so the written chat message and TTS voice both include the real numbers!
    let finalText = resolved.text;
    if (!hadPlaceholders && targetSummarySentence) {
        finalText = finalText
            ? `${finalText.replace(/\.*\s*$/, '.')} ${targetSummarySentence}`
            : targetSummarySentence;
    }

    return {
        ...resolved,
        text: finalText,
        cardsData,
    };
};

export default {
    RESOLVER_REGISTRY,
    resolveTemplatePlaceholders,
    resolveTemplateWithLiveData,
    fetchLiveModuleData,
    formatCOP,
    sanitizePlainText,
};
