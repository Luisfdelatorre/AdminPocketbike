/**
 * Assistant Query Service (Live MongoDB + Static Fallback)
 *
 * When MongoDB is connected (`mongoose.connection.readyState === 1`), resolves
 * queries against real company-scoped records (`Device`, `Contract`, `Payment`,
 * `Invoice`, `AlertLog`). Falls back to the static dataset only when disconnected
 * (e.g., offline unit tests).
 */

import mongoose from 'mongoose';

const formatCOP = (value) =>
    new Intl.NumberFormat('es-CO', { style: 'currency', currency: 'COP', maximumFractionDigits: 0 }).format(
        Number(value) || 0
    );

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

const INTENTS = [
    { id: 'help', keywords: ['ayuda', 'que puedes hacer', 'que sabes hacer', 'comandos', 'opciones'] },
    { id: 'query.collections_today', keywords: ['recaudo', 'recaudado', 'cobrado', 'cobros de hoy', 'ingresos', 'cuanto se ha pagado', 'pagos de hoy', 'pagos aprobados'] },
    { id: 'query.rejected_payments', keywords: ['pagos rechazados', 'rejected payments', 'pagos fallidos'] },
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

const buildStaticQueryResult = (capabilityId) => {
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
            return { reply: null, data: null };
    }
};

/**
 * Synchronous resolver used by offline unit tests.
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
        ...buildStaticQueryResult(resolvedId),
        demo: true,
    };
};

/**
 * Live MongoDB query resolver scoped by `auth.companyId`.
 */
export const resolveLiveQuery = async ({ text, capabilityId, auth = null } = {}) => {
    const resolvedId = capabilityId || matchIntent(text);
    if (!resolvedId) {
        return resolveQuery({ text, capabilityId });
    }

    if (mongoose.connection.readyState !== 1) {
        return resolveQuery({ text, capabilityId: resolvedId });
    }

    try {
        const [{ Device, Contract, Payment, Invoice }, { default: AlertLog }] = await Promise.all([
            import('../models/index.js'),
            import('../models/AlertLog.js').catch(() => ({ default: null })),
        ]);

        const companyId = auth?.companyId || null;
        const companyFilter = companyId ? { companyId } : {};
        const companyStrFilter = companyId ? { companyId: String(companyId) } : {};

        switch (resolvedId) {
            case 'query.collections_today': {
                const now = new Date();
                const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
                const payments = await Payment.find({
                    ...companyFilter,
                    createdAt: { $gte: startOfMonth },
                })
                    .select('amount status type adjustmentType createdAt')
                    .lean();

                let collected = 0;
                let approvedCount = 0;
                let pendingCount = 0;
                for (const p of payments) {
                    const st = String(p.status || '').toUpperCase();
                    if ((st === 'APPROVED' || st === 'COMPLETED') && Number(p.amount) > 0) {
                        collected += Number(p.amount) || 0;
                        approvedCount += 1;
                    } else if (st === 'PENDING' || st === 'VERIFYING') {
                        pendingCount += 1;
                    }
                }

                return {
                    capabilityId: resolvedId,
                    matched: true,
                    reply: `En el mes actual se han recaudado ${formatCOP(collected)} en ${approvedCount} pagos aprobados (${pendingCount} pendientes).`,
                    data: {
                        kind: 'stats',
                        stats: [
                            { label: 'Recaudado mes', value: formatCOP(collected) },
                            { label: 'Aprobados', value: String(approvedCount) },
                            { label: 'Pendientes', value: String(pendingCount) },
                            { label: 'Registros', value: String(payments.length) },
                        ],
                    },
                    demo: false,
                };
            }

            case 'query.rejected_payments': {
                const now = new Date();
                const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
                const rejected = await Payment.find({
                    ...companyFilter,
                    status: { $in: ['DECLINED', 'ERROR', 'FAILED', 'REJECTED'] },
                    createdAt: { $gte: startOfMonth },
                })
                    .sort({ createdAt: -1 })
                    .limit(10)
                    .select('deviceId deviceIdName invoiceId amount status createdAt')
                    .lean();

                const totalRejected = rejected.reduce((s, p) => s + (Number(p.amount) || 0), 0);
                return {
                    capabilityId: resolvedId,
                    matched: true,
                    reply: `Encontré ${rejected.length} pagos rechazados recientes en el mes por un total de ${formatCOP(totalRejected)}.`,
                    data: {
                        kind: 'list',
                        items: rejected.slice(0, 5).map((p) => ({
                            title: p.deviceIdName || p.deviceId || 'Moto',
                            subtitle: p.invoiceId || p.status || 'Rechazado',
                            value: formatCOP(p.amount || 0),
                        })),
                    },
                    demo: false,
                };
            }

            case 'query.fleet_status': {
                const devices = await Device.find({
                    ...companyStrFilter,
                    isDeleted: { $ne: true },
                })
                    .select('name customerName lastUpdate cutOff ignition hasActiveContract')
                    .lean();

                const total = devices.length;
                let offline = 0;
                let cutOff = 0;
                let ignitionOn = 0;
                for (const d of devices) {
                    const lastMs = d.lastUpdate ? new Date(d.lastUpdate).getTime() : 0;
                    if (!lastMs || Date.now() - lastMs >= 3 * 60 * 1000) offline += 1;
                    if (d.cutOff) cutOff += 1;
                    if (d.ignition) ignitionOn += 1;
                }
                const online = Math.max(0, total - offline);
                return {
                    capabilityId: resolvedId,
                    matched: true,
                    reply: `La flota tiene ${total} motos: ${online} en línea y ${offline} desconectadas. ${ignitionOn} están encendidas y ${cutOff} tienen corte activo.`,
                    data: {
                        kind: 'stats',
                        stats: [
                            { label: 'Total flota', value: String(total) },
                            { label: 'En línea', value: String(online) },
                            { label: 'Desconectadas', value: String(offline) },
                            { label: 'Con corte', value: String(cutOff) },
                        ],
                    },
                    demo: false,
                };
            }

            case 'query.cutoff_devices': {
                const cutDevices = await Device.find({
                    ...companyStrFilter,
                    isDeleted: { $ne: true },
                    cutOff: true,
                })
                    .select('name customerName unpaidCount unpaidTotal')
                    .limit(15)
                    .lean();

                return {
                    capabilityId: resolvedId,
                    matched: true,
                    reply:
                        cutDevices.length > 0
                            ? `Hay ${cutDevices.length} motos apagadas con corte activo: ${cutDevices
                                  .slice(0, 6)
                                  .map((d) => d.name)
                                  .join(', ')}.`
                            : 'En este momento no hay ninguna moto apagada por corte en la flota.',
                    data: {
                        kind: 'list',
                        items: cutDevices.slice(0, 6).map((d) => ({
                            title: d.name || 'Moto',
                            subtitle: d.customerName || 'Con corte activo',
                            value: d.unpaidTotal ? formatCOP(d.unpaidTotal) : 'Apagada',
                        })),
                    },
                    demo: false,
                };
            }

            case 'query.top_debtors': {
                const debtors = await Device.find({
                    ...companyStrFilter,
                    isDeleted: { $ne: true },
                    unpaidTotal: { $gt: 0 },
                })
                    .sort({ unpaidTotal: -1 })
                    .limit(6)
                    .select('name customerName unpaidTotal unpaidCount')
                    .lean();

                if (debtors.length === 0) {
                    return {
                        capabilityId: resolvedId,
                        matched: true,
                        reply: 'Todas las motos de la compañía están al día (0 con deuda pendiente).',
                        data: null,
                        demo: false,
                    };
                }

                const top = debtors[0];
                return {
                    capabilityId: resolvedId,
                    matched: true,
                    reply: `El mayor saldo pendiente es ${top.name} con ${formatCOP(top.unpaidTotal)}. Te muestro las ${debtors.length} motos con mayor mora.`,
                    data: {
                        kind: 'list',
                        items: debtors.map((d) => ({
                            title: d.name || 'Moto',
                            subtitle: `${d.customerName || 'Conductor'} · ${d.unpaidCount || 1} días`,
                            value: formatCOP(d.unpaidTotal || 0),
                        })),
                    },
                    demo: false,
                };
            }

            case 'query.open_alerts': {
                if (!AlertLog) return resolveQuery({ text, capabilityId: resolvedId });
                const activeAlerts = await AlertLog.find({
                    ...(companyId ? { companyId: { $in: [companyId, String(companyId)] } } : {}),
                    status: 'ACTIVE',
                })
                    .sort({ createdAt: -1 })
                    .limit(6)
                    .select('deviceIdName alertType title severity createdAt')
                    .lean();

                return {
                    capabilityId: resolvedId,
                    matched: true,
                    reply:
                        activeAlerts.length > 0
                            ? `Hay ${activeAlerts.length} alertas activas recientes. La última es ${activeAlerts[0].title || activeAlerts[0].alertType} en ${activeAlerts[0].deviceIdName}.`
                            : 'No hay alertas activas pendientes en este momento.',
                    data: {
                        kind: 'list',
                        items: activeAlerts.map((a) => ({
                            title: a.title || a.alertType,
                            subtitle: a.deviceIdName,
                            value: a.severity || 'ACTIVA',
                        })),
                    },
                    demo: false,
                };
            }

            case 'query.contracts_overview': {
                const contracts = await Contract.find(companyFilter)
                    .select('status totalAmount dailyRate')
                    .lean();

                const active = contracts.filter((c) => c.status === 'ACTIVE');
                const completed = contracts.filter((c) => c.status === 'COMPLETED');
                const totalVal = active.reduce((s, c) => s + (Number(c.totalAmount) || 0), 0);

                return {
                    capabilityId: resolvedId,
                    matched: true,
                    reply: `Hay ${active.length} contratos activos y ${completed.length} finalizados (de ${contracts.length} totales), por un valor activo de ${formatCOP(totalVal)}.`,
                    data: {
                        kind: 'stats',
                        stats: [
                            { label: 'Activos', value: String(active.length) },
                            { label: 'Finalizados', value: String(completed.length) },
                            { label: 'Total', value: String(contracts.length) },
                            { label: 'Valor activo', value: formatCOP(totalVal) },
                        ],
                    },
                    demo: false,
                };
            }

            default:
                return resolveQuery({ text, capabilityId: resolvedId });
        }
    } catch {
        return resolveQuery({ text, capabilityId: resolvedId });
    }
};

export default {
    resolveQuery,
    resolveLiveQuery,
    matchIntent,
    normalizeText,
    SUPPORTED_CAPABILITIES,
};
