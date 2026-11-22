/**
 * Assistant Demo Service
 *
 * Resolves assistant queries against a static, fictional dataset.
 * It never touches MongoDB, external providers or real company data.
 * Capability IDs must stay aligned with client/src/services/voiceAssistant/capabilities.js.
 */

const formatCOP = (value) =>
    new Intl.NumberFormat('es-CO', { style: 'currency', currency: 'COP', maximumFractionDigits: 0 }).format(value);

// Fictional demo dataset (plates, names and amounts are invented).
const DEMO_DATA = Object.freeze({
    collectionsToday: { collected: 1250000, expected: 1800000, approvedPayments: 23, pendingPayments: 9 },
    fleet: { total: 48, online: 41, offline: 7, ignitionOn: 12, cutOff: 3 },
    cutOffDevices: [
        { plate: 'DMO-101', driver: 'Conductor Demo A', daysOverdue: 3 },
        { plate: 'DMO-214', driver: 'Conductor Demo B', daysOverdue: 2 },
        { plate: 'DMO-332', driver: 'Conductor Demo C', daysOverdue: 5 },
    ],
    topDebtors: [
        { plate: 'DMO-332', driver: 'Conductor Demo C', debt: 175000, daysOverdue: 5 },
        { plate: 'DMO-101', driver: 'Conductor Demo A', debt: 105000, daysOverdue: 3 },
        { plate: 'DMO-214', driver: 'Conductor Demo B', debt: 70000, daysOverdue: 2 },
    ],
    openAlerts: [
        { type: 'Encendido no autorizado', plate: 'DMO-118', minutesAgo: 12 },
        { type: 'Batería baja', plate: 'DMO-205', minutesAgo: 34 },
        { type: 'Desconexión GPS', plate: 'DMO-077', minutesAgo: 58 },
        { type: 'Exceso de velocidad', plate: 'DMO-150', minutesAgo: 95 },
    ],
    contracts: { active: 48, finishingThisMonth: 5, newThisMonth: 4, averageProgress: 62 },
});

// Server-side intent table used when the client sends free text.
const INTENTS = [
    { id: 'help', keywords: ['ayuda', 'que puedes hacer', 'que sabes hacer', 'comandos', 'opciones'] },
    { id: 'query.collections_today', keywords: ['recaudo', 'recaudado', 'cobrado', 'cobros de hoy', 'ingresos', 'cuanto se ha pagado', 'pagos de hoy'] },
    { id: 'query.fleet_status', keywords: ['estado de la flota', 'flota', 'en linea', 'conectadas', 'desconectadas'] },
    { id: 'query.cutoff_devices', keywords: ['apagadas', 'apagados', 'cortadas', 'corte', 'bloqueadas'] },
    { id: 'query.top_debtors', keywords: ['deudores', 'deben', 'morosos', 'deuda', 'mora'] },
    { id: 'query.open_alerts', keywords: ['alertas abiertas', 'alertas activas', 'incidentes', 'que alertas'] },
    { id: 'query.contracts_overview', keywords: ['resumen de contratos', 'contratos activos', 'cuantos contratos'] },
    { id: 'nav.dashboard', keywords: ['dashboard', 'inicio', 'panel principal'] },
    { id: 'nav.devices', keywords: ['dispositivos', 'lista de motos', 'pagina de motos'] },
    { id: 'nav.contracts', keywords: ['contratos', 'ir a contratos'] },
    { id: 'nav.payments', keywords: ['pagos', 'ir a pagos'] },
    { id: 'nav.summary', keywords: ['resumen de pagos', 'resumen semanal', 'resumen'] },
    { id: 'nav.invoices', keywords: ['facturas', 'ir a facturas'] },
    { id: 'nav.alerts', keywords: ['centro de alertas', 'alertas'] },
    { id: 'nav.commands', keywords: ['historial de comandos', 'comandos enviados'] },
    { id: 'nav.reports', keywords: ['reportes', 'informes'] },
];

export const SUPPORTED_CAPABILITIES = new Set(INTENTS.map((intent) => intent.id));

export const normalizeText = (text = '') =>
    String(text)
        .toLowerCase()
        .normalize('NFD')
        .replace(/[\u0300-\u036f]/g, '')
        .replace(/[^a-z0-9ñ\s]/g, ' ')
        .replace(/\s+/g, ' ')
        .trim();

/**
 * Keyword matcher: longer keyword matches weigh more so that
 * "resumen de contratos" wins over "contratos".
 */
export const matchIntent = (text) => {
    const normalized = ` ${normalizeText(text)} `;
    if (!normalized.trim()) return null;

    let best = null;
    for (const intent of INTENTS) {
        let score = 0;
        for (const keyword of intent.keywords) {
            if (normalized.includes(` ${keyword} `)) {
                score += keyword.split(' ').length;
            }
        }
        if (score > 0 && (!best || score > best.score)) {
            best = { id: intent.id, score };
        }
    }
    return best?.id ?? null;
};

const buildQueryResult = (capabilityId) => {
    switch (capabilityId) {
        case 'query.collections_today': {
            const c = DEMO_DATA.collectionsToday;
            const pct = Math.round((c.collected / c.expected) * 100);
            return {
                reply: `Hoy se han recaudado ${formatCOP(c.collected)} de ${formatCOP(c.expected)} esperados, un ${pct} por ciento. Hay ${c.approvedPayments} pagos aprobados y ${c.pendingPayments} pendientes.`,
                data: {
                    kind: 'stats',
                    stats: [
                        { label: 'Recaudado', value: formatCOP(c.collected) },
                        { label: 'Esperado', value: formatCOP(c.expected) },
                        { label: 'Aprobados', value: String(c.approvedPayments) },
                        { label: 'Pendientes', value: String(c.pendingPayments) },
                    ],
                },
            };
        }
        case 'query.fleet_status': {
            const f = DEMO_DATA.fleet;
            return {
                reply: `La flota tiene ${f.total} motos: ${f.online} en línea y ${f.offline} desconectadas. ${f.ignitionOn} están encendidas y ${f.cutOff} tienen corte activo.`,
                data: {
                    kind: 'stats',
                    stats: [
                        { label: 'En línea', value: String(f.online) },
                        { label: 'Desconectadas', value: String(f.offline) },
                        { label: 'Encendidas', value: String(f.ignitionOn) },
                        { label: 'Con corte', value: String(f.cutOff) },
                    ],
                },
            };
        }
        case 'query.cutoff_devices': {
            const list = DEMO_DATA.cutOffDevices;
            return {
                reply: `Hay ${list.length} motos apagadas por mora: ${list.map((d) => d.plate).join(', ')}.`,
                data: {
                    kind: 'list',
                    items: list.map((d) => ({ title: d.plate, subtitle: d.driver, value: `${d.daysOverdue} días` })),
                },
            };
        }
        case 'query.top_debtors': {
            const list = DEMO_DATA.topDebtors;
            const top = list[0];
            return {
                reply: `El mayor deudor es ${top.plate} con ${formatCOP(top.debt)} y ${top.daysOverdue} días de mora. Te muestro los ${list.length} principales.`,
                data: {
                    kind: 'list',
                    items: list.map((d) => ({ title: d.plate, subtitle: `${d.driver} · ${d.daysOverdue} días`, value: formatCOP(d.debt) })),
                },
            };
        }
        case 'query.open_alerts': {
            const list = DEMO_DATA.openAlerts;
            return {
                reply: `Hay ${list.length} alertas abiertas. La más reciente es ${list[0].type.toLowerCase()} en ${list[0].plate}, hace ${list[0].minutesAgo} minutos.`,
                data: {
                    kind: 'list',
                    items: list.map((a) => ({ title: a.type, subtitle: a.plate, value: `hace ${a.minutesAgo} min` })),
                },
            };
        }
        case 'query.contracts_overview': {
            const c = DEMO_DATA.contracts;
            return {
                reply: `Hay ${c.active} contratos activos, ${c.newThisMonth} nuevos este mes y ${c.finishingThisMonth} terminan este mes. El avance promedio es del ${c.averageProgress} por ciento.`,
                data: {
                    kind: 'stats',
                    stats: [
                        { label: 'Activos', value: String(c.active) },
                        { label: 'Nuevos', value: String(c.newThisMonth) },
                        { label: 'Terminan', value: String(c.finishingThisMonth) },
                        { label: 'Avance', value: `${c.averageProgress}%` },
                    ],
                },
            };
        }
        default:
            // Navigation and help capabilities are resolved by the client dispatcher.
            return { reply: null, data: null };
    }
};

/**
 * Resolves a query either by explicit capabilityId or by matching free text.
 * @param {{ text?: string, capabilityId?: string }} input
 */
export const resolveQuery = ({ text, capabilityId } = {}) => {
    const resolvedId = capabilityId || matchIntent(text);

    if (!resolvedId) {
        return {
            capabilityId: null,
            matched: false,
            reply: 'No entendí la solicitud. Prueba con "recaudo de hoy", "motos apagadas" o "abre contratos".',
            data: null,
            demo: true,
        };
    }

    return {
        capabilityId: resolvedId,
        matched: true,
        ...buildQueryResult(resolvedId),
        demo: true,
    };
};

export default { resolveQuery, matchIntent, normalizeText, SUPPORTED_CAPABILITIES };
