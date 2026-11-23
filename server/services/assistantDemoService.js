/**
 * Assistant Query Service (Live MongoDB + Static Fallback)
 *
 * When MongoDB is connected (`mongoose.connection.readyState === 1`), resolves
 * queries against real company-scoped records (`Device`, `Contract`, `Payment`,
 * `Invoice`, `AlertLog`). Falls back to the static dataset only when disconnected
 * (e.g., offline unit tests).
 */

import mongoose from 'mongoose';
import {
    MODULES,
    MODULE_IDS,
    canUserAccessModule,
    normalizeFilterStatus,
    normalizeDatePreset,
} from '../../client/src/services/voiceAssistant/capabilities.js';

const formatCOP = (value) =>
    new Intl.NumberFormat('es-CO', { style: 'currency', currency: 'COP', maximumFractionDigits: 0 }).format(
        Number(value) || 0
    );

const formatLocalTimeEsCO = (dateVal) => {
    if (!dateVal) return null;
    try {
        const d = new Date(dateVal);
        if (Number.isNaN(d.getTime())) return null;
        return d.toLocaleString('es-CO', {
            timeZone: 'America/Bogota',
            year: 'numeric',
            month: '2-digit',
            day: '2-digit',
            hour: '2-digit',
            minute: '2-digit',
            hour12: true,
        });
    } catch {
        return null;
    }
};

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

/**
 * 1:1 On-Demand Sanitized Module Record Fetcher (`fetch_module_records` tool for OpenAI).
 *
 * Maps 1:1 to every module in `MODULES` (`capabilities.js`) and its `filters` schema:
 *  - `alerts`    -> status, alertType, query, month, year
 *  - `devices`   -> status, query
 *  - `contracts` -> status, query
 *  - `summary`   -> status, query, month, year
 *  - `payments`  -> status, datePreset, query, month, year
 *  - `invoices`  -> status, query, month, year
 *  - `commands`  -> status, query, month, year
 *  - `dashboard` -> month, year
 *
 * Security & Privacy:
 *  - Strictly checks `canUserAccessModule(module, auth)`.
 *  - Scoped to `auth.companyId`.
 *  - Never returns tokens, PINs, passwords, raw credentials, customer ID documents, or addresses.
 *  - Caps results to at most 12 sanitized records.
 */
export const fetchSanitizedModuleRecords = async ({
    module: rawModule = 'dashboard',
    status: rawStatus = null,
    alertType: rawAlertType = null,
    datePreset: rawDatePreset = null,
    query: rawQuery = null,
    month: rawMonth = null,
    year: rawYear = null,
    limit: rawLimit = 10,
    auth = null,
} = {}) => {
    const targetModule = MODULE_IDS.includes(rawModule) ? rawModule : 'dashboard';
    if (auth && !canUserAccessModule(targetModule, auth)) {
        return {
            module: targetModule,
            authorized: false,
            error: `Role not authorized to inspect module "${targetModule}"`,
            records: [],
        };
    }

    const maxItems = Math.min(Math.max(Number(rawLimit) || 10, 1), 12);
    const normalizedStatus =
        rawStatus && rawStatus !== 'null'
            ? normalizeFilterStatus(targetModule, rawStatus) || String(rawStatus)
            : null;
    const normalizedDatePreset =
        rawDatePreset && rawDatePreset !== 'null' ? normalizeDatePreset(rawDatePreset) : null;
    const searchQuery =
        typeof rawQuery === 'string' && rawQuery !== 'null' && rawQuery.trim()
            ? rawQuery.trim().toUpperCase()
            : null;

    const now = new Date();
    const month =
        Number.isInteger(Number(rawMonth)) && Number(rawMonth) >= 1 && Number(rawMonth) <= 12
            ? Number(rawMonth)
            : now.getMonth() + 1;
    const year =
        Number.isInteger(Number(rawYear)) && Number(rawYear) >= 2024 && Number(rawYear) <= 2030
            ? Number(rawYear)
            : now.getFullYear();

    const startOfMonth = new Date(year, month - 1, 1, 0, 0, 0, 0);
    const endOfMonth = new Date(year, month, 0, 23, 59, 59, 999);

    // Offline / disconnected unit-test fallback
    if (mongoose.connection.readyState !== 1) {
        return {
            module: targetModule,
            authorized: true,
            demo: true,
            appliedFilters: {
                status: normalizedStatus,
                alertType: rawAlertType || null,
                datePreset: normalizedDatePreset,
                query: searchQuery,
                month,
                year,
            },
            totalMatching: 2,
            records:
                targetModule === 'alerts'
                    ? [
                          {
                              plate: 'DMO-118',
                              alertType: rawAlertType || 'UNAUTHORIZED_DRIVING',
                              title: 'Conducción en corte (Sabotaje)',
                              severity: 'CRITICAL',
                              status: 'ACTIVE',
                              timestampLocal: '23/11/2026, 10:02 a. m.',
                              reason: 'Velocidad reportada de 14 km/h con motor en corte activo',
                              speedKmh: 14,
                              cutOffActive: true,
                          },
                          {
                              plate: 'DMO-205',
                              alertType: rawAlertType || 'UNAUTHORIZED_DRIVING',
                              title: 'Conducción en corte (Sabotaje)',
                              severity: 'CRITICAL',
                              status: 'ACTIVE',
                              timestampLocal: '23/11/2026, 09:48 a. m.',
                              reason: 'Velocidad reportada de 9 km/h con motor en corte activo',
                              speedKmh: 9,
                              cutOffActive: true,
                          },
                      ]
                    : DEMO_DATA.cutOffDevices.slice(0, maxItems),
        };
    }

    try {
        const [
            { Device, Contract, Payment, Invoice },
            { default: AlertLog },
            { default: CommandLog },
        ] = await Promise.all([
            import('../models/index.js'),
            import('../models/AlertLog.js').catch(() => ({ default: null })),
            import('../models/CommandLog.js').catch(() => ({ default: null })),
        ]);

        const companyId = auth?.companyId || null;
        const companyObjFilter = companyId
            ? mongoose.Types.ObjectId.isValid(companyId)
                ? { companyId: new mongoose.Types.ObjectId(companyId) }
                : { companyId }
            : {};
        const companyMixedFilter = companyId
            ? {
                  companyId: {
                      $in: [
                          String(companyId),
                          ...(mongoose.Types.ObjectId.isValid(companyId)
                              ? [new mongoose.Types.ObjectId(companyId)]
                              : []),
                      ],
                  },
              }
            : {};
        const companyStrFilter = companyId ? { companyId: String(companyId) } : {};

        switch (targetModule) {
            case 'alerts': {
                if (!AlertLog) {
                    return { module: 'alerts', authorized: true, totalMatching: 0, records: [] };
                }
                const filter = {
                    ...companyMixedFilter,
                    timestamp: { $gte: startOfMonth, $lte: endOfMonth },
                };
                if (normalizedStatus && normalizedStatus !== 'ALL') {
                    filter.status = normalizedStatus.toUpperCase();
                }
                if (rawAlertType && rawAlertType !== 'ALL' && rawAlertType !== 'null') {
                    filter.alertType = String(rawAlertType).toUpperCase();
                }
                if (searchQuery) {
                    filter.deviceIdName = { $regex: searchQuery, $options: 'i' };
                }

                const [totalMatching, docs] = await Promise.all([
                    AlertLog.countDocuments(filter),
                    AlertLog.find(filter)
                        .sort({ timestamp: -1 })
                        .limit(maxItems)
                        .select(
                            'deviceIdName alertType severity status title message location metadata occurrenceCount timestamp lastSeenAt'
                        )
                        .lean(),
                ]);

                const records = docs.map((a) => ({
                    plate: a.deviceIdName,
                    alertType: a.alertType,
                    title: a.title || a.alertType,
                    severity: a.severity,
                    status: a.status,
                    timestampLocal: formatLocalTimeEsCO(a.timestamp),
                    lastSeenLocal: formatLocalTimeEsCO(a.lastSeenAt),
                    occurrenceCount: a.occurrenceCount || 1,
                    reason: a.message || a.title || '',
                    speedKmh: a.location?.speed ?? null,
                    cutOffActive: a.metadata?.cutOff ?? null,
                    ignitionOn: a.metadata?.ignition ?? null,
                    batteryLevel: a.metadata?.batteryLevel ?? null,
                    hoursOffline: a.metadata?.hoursOffline ?? null,
                }));

                return {
                    module: 'alerts',
                    authorized: true,
                    appliedFilters: {
                        status: normalizedStatus || 'ALL',
                        alertType: rawAlertType || 'ALL',
                        query: searchQuery,
                        month,
                        year,
                    },
                    totalMatching,
                    records,
                };
            }

            case 'devices': {
                const filter = {
                    ...companyStrFilter,
                    isDeleted: { $ne: true },
                };
                if (searchQuery) {
                    filter.name = { $regex: searchQuery, $options: 'i' };
                }

                const allDevices = await Device.find(filter)
                    .select(
                        'name status telemetry hasActiveContract dailyRate activeContractId exemptFromCutOff curfewStatus'
                    )
                    .lean();

                const nowMs = Date.now();
                const enriched = allDevices.map((d) => {
                    const lastUp = d.telemetry?.lastUpdate
                        ? new Date(d.telemetry.lastUpdate).getTime()
                        : 0;
                    const minutesSinceReport = lastUp
                        ? Math.round((nowMs - lastUp) / 60000)
                        : null;
                    const isOffline = !lastUp || nowMs - lastUp >= 3 * 60 * 1000;
                    const cutOff = Boolean(d.telemetry?.cutOff);
                    const ignition = Boolean(d.telemetry?.ignition);
                    const batteryLevel = d.telemetry?.batteryLevel ?? null;
                    const powerCut = Boolean(d.telemetry?.powerCut);
                    return {
                        plate: d.name,
                        online: !isOffline,
                        minutesSinceReport,
                        lastReportLocal: formatLocalTimeEsCO(d.telemetry?.lastUpdate),
                        engineCutOff: cutOff,
                        ignitionOn: ignition,
                        batteryLevel,
                        powerCut,
                        hasActiveContract: Boolean(d.hasActiveContract),
                        dailyRate: d.dailyRate ? formatCOP(d.dailyRate) : null,
                    };
                });

                const filtered = enriched.filter((item) => {
                    if (!normalizedStatus || normalizedStatus === 'all') return true;
                    if (normalizedStatus === 'off') return item.engineCutOff;
                    if (normalizedStatus === 'on') return item.ignitionOn && !item.engineCutOff;
                    if (normalizedStatus === 'offline') return !item.online;
                    if (normalizedStatus === 'active') return item.hasActiveContract;
                    if (normalizedStatus === 'available') return !item.hasActiveContract;
                    if (normalizedStatus === 'battery_issue') {
                        return (
                            item.powerCut ||
                            (typeof item.batteryLevel === 'number' && item.batteryLevel < 30)
                        );
                    }
                    if (normalizedStatus === 'alt_issue') {
                        return typeof item.batteryLevel === 'number' && item.batteryLevel < 50;
                    }
                    return true;
                });

                return {
                    module: 'devices',
                    authorized: true,
                    appliedFilters: { status: normalizedStatus || 'all', query: searchQuery },
                    totalMatching: filtered.length,
                    records: filtered.slice(0, maxItems),
                };
            }

            case 'contracts': {
                const filter = { ...companyObjFilter };
                if (normalizedStatus && normalizedStatus !== 'all') {
                    if (normalizedStatus === 'weekly') {
                        filter.paymentFrequency = 7;
                    } else {
                        filter.status = normalizedStatus.toUpperCase();
                    }
                }
                if (searchQuery) {
                    filter.$or = [
                        { deviceIdName: { $regex: searchQuery, $options: 'i' } },
                        { contractId: { $regex: searchQuery, $options: 'i' } },
                    ];
                }

                const [totalMatching, docs] = await Promise.all([
                    Contract.countDocuments(filter),
                    Contract.find(filter)
                        .sort({ createdAt: -1 })
                        .limit(maxItems)
                        .select(
                            'contractId deviceIdName status dailyRate contractDays startDate endDate totalAmount paidAmount paidDays remainingDays paymentFrequency'
                        )
                        .lean(),
                ]);

                const records = docs.map((c) => ({
                    contractId: c.contractId,
                    plate: c.deviceIdName,
                    status: c.status,
                    paymentFrequency: c.paymentFrequency === 7 ? 'weekly' : 'daily',
                    dailyRate: formatCOP(c.dailyRate || 0),
                    totalAmount: formatCOP(c.totalAmount || 0),
                    paidAmount: formatCOP(c.paidAmount || 0),
                    remainingBalance: formatCOP(
                        Math.max(0, (Number(c.totalAmount) || 0) - (Number(c.paidAmount) || 0))
                    ),
                    paidDays: c.paidDays || 0,
                    remainingDays: c.remainingDays || 0,
                    startDate: c.startDate,
                    endDate: c.endDate,
                }));

                return {
                    module: 'contracts',
                    authorized: true,
                    appliedFilters: { status: normalizedStatus || 'all', query: searchQuery },
                    totalMatching,
                    records,
                };
            }

            case 'summary': {
                const unpaidInvoices = await Invoice.aggregate([
                    {
                        $match: {
                            ...companyObjFilter,
                            paid: false,
                            dayType: { $ne: 'FREE' },
                            date: { $lte: now },
                        },
                    },
                    {
                        $group: {
                            _id: '$deviceIdName',
                            unpaidCount: { $sum: 1 },
                            unpaidTotal: {
                                $sum: {
                                    $subtract: [
                                        { $ifNull: ['$amount', 0] },
                                        { $ifNull: ['$paidAmount', 0] },
                                    ],
                                },
                            },
                            oldestUnpaidDate: { $min: '$date' },
                            latestUnpaidDate: { $max: '$date' },
                        },
                    },
                    { $sort: { unpaidTotal: -1 } },
                ]);

                let list = unpaidInvoices.map((u) => ({
                    plate: u._id,
                    unpaidDaysCount: u.unpaidCount,
                    debtAmount: formatCOP(u.unpaidTotal),
                    rawDebtAmount: u.unpaidTotal,
                    oldestUnpaidDate: u.oldestUnpaidDate
                        ? new Date(u.oldestUnpaidDate).toISOString().slice(0, 10)
                        : null,
                }));

                if (searchQuery) {
                    list = list.filter((i) => String(i.plate || '').includes(searchQuery));
                }

                return {
                    module: 'summary',
                    authorized: true,
                    appliedFilters: {
                        status: normalizedStatus || 'debt',
                        query: searchQuery,
                        month,
                        year,
                    },
                    totalMatching: list.length,
                    totalDebtFormatted: formatCOP(
                        list.reduce((acc, item) => acc + (Number(item.rawDebtAmount) || 0), 0)
                    ),
                    records: list.slice(0, maxItems),
                };
            }

            case 'payments': {
                const filter = {
                    ...companyObjFilter,
                };
                if (normalizedDatePreset === 'today') {
                    const startToday = new Date(
                        now.getFullYear(),
                        now.getMonth(),
                        now.getDate(),
                        0,
                        0,
                        0
                    );
                    filter.created_at = { $gte: startToday };
                } else if (normalizedDatePreset === 'yesterday') {
                    const startYest = new Date(
                        now.getFullYear(),
                        now.getMonth(),
                        now.getDate() - 1,
                        0,
                        0,
                        0
                    );
                    const endYest = new Date(
                        now.getFullYear(),
                        now.getMonth(),
                        now.getDate() - 1,
                        23,
                        59,
                        59,
                        999
                    );
                    filter.created_at = { $gte: startYest, $lte: endYest };
                } else if (normalizedDatePreset === 'last_7_days') {
                    const start7 = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
                    filter.created_at = { $gte: start7 };
                } else {
                    filter.created_at = { $gte: startOfMonth, $lte: endOfMonth };
                }

                if (normalizedStatus === 'completed') {
                    filter.status = { $in: ['APPROVED', 'COMPLETED'] };
                } else if (normalizedStatus === 'failed') {
                    filter.status = { $in: ['DECLINED', 'ERROR', 'FAILED', 'REJECTED', 'VOIDED'] };
                } else if (normalizedStatus === 'pending') {
                    filter.status = { $in: ['PENDING', 'VERIFYING'] };
                } else if (normalizedStatus === 'free') {
                    filter.type = 'FREE';
                }

                if (searchQuery) {
                    filter.$or = [
                        { deviceIdName: { $regex: searchQuery, $options: 'i' } },
                        { reference: { $regex: searchQuery, $options: 'i' } },
                    ];
                }

                const [totalMatching, docs] = await Promise.all([
                    Payment.countDocuments(filter),
                    Payment.find(filter)
                        .sort({ created_at: -1 })
                        .limit(maxItems)
                        .select(
                            'reference deviceIdName amount status type payment_method_type adjustmentType created_at finalized_at invoiceId'
                        )
                        .lean(),
                ]);

                const records = docs.map((p) => ({
                    reference: p.reference,
                    plate: p.deviceIdName,
                    amount: formatCOP(p.amount || 0),
                    status: p.status,
                    method: p.payment_method_type || p.type,
                    invoiceId: p.invoiceId,
                    createdAtLocal: formatLocalTimeEsCO(p.created_at),
                    finalizedAtLocal: formatLocalTimeEsCO(p.finalized_at),
                }));

                return {
                    module: 'payments',
                    authorized: true,
                    appliedFilters: {
                        status: normalizedStatus || 'all',
                        datePreset: normalizedDatePreset || 'all',
                        query: searchQuery,
                        month,
                        year,
                    },
                    totalMatching,
                    records,
                };
            }

            case 'invoices': {
                const filter = {
                    ...companyObjFilter,
                    date: { $gte: startOfMonth, $lte: endOfMonth },
                };
                if (normalizedStatus === 'PAID') filter.paid = true;
                else if (normalizedStatus === 'PENDING') {
                    filter.paid = false;
                    filter.dayType = { $ne: 'FREE' };
                } else if (normalizedStatus === 'FREE') {
                    filter.dayType = 'FREE';
                }
                if (searchQuery) {
                    filter.deviceIdName = { $regex: searchQuery, $options: 'i' };
                }

                const [totalMatching, docs] = await Promise.all([
                    Invoice.countDocuments(filter),
                    Invoice.find(filter)
                        .sort({ date: -1 })
                        .limit(maxItems)
                        .select('invoiceId deviceIdName date amount paidAmount paid dayType cutOff')
                        .lean(),
                ]);

                const records = docs.map((inv) => ({
                    invoiceId: inv.invoiceId,
                    plate: inv.deviceIdName,
                    date: inv.date ? new Date(inv.date).toISOString().slice(0, 10) : null,
                    amount: formatCOP(inv.amount || 0),
                    paid: Boolean(inv.paid),
                    dayType: inv.dayType,
                    cutOffTriggered: Boolean(inv.cutOff),
                }));

                return {
                    module: 'invoices',
                    authorized: true,
                    appliedFilters: {
                        status: normalizedStatus || 'all',
                        query: searchQuery,
                        month,
                        year,
                    },
                    totalMatching,
                    records,
                };
            }

            case 'commands': {
                if (!CommandLog) {
                    return { module: 'commands', authorized: true, totalMatching: 0, records: [] };
                }
                const filter = {
                    ...companyMixedFilter,
                    sentAt: { $gte: startOfMonth, $lte: endOfMonth },
                };
                if (normalizedStatus && normalizedStatus !== 'ALL') {
                    const upper = normalizedStatus.toUpperCase();
                    if (['STOP', 'RESUME', 'PREVENTIVE'].includes(upper)) {
                        filter.commandType = upper;
                    } else if (['EXECUTED', 'QUEUED', 'FAILED', 'SENT'].includes(upper)) {
                        filter.status = upper === 'SENT' ? 'QUEUED' : upper;
                    }
                }
                if (searchQuery) {
                    filter.deviceIdName = { $regex: searchQuery, $options: 'i' };
                }

                const [totalMatching, docs] = await Promise.all([
                    CommandLog.countDocuments(filter),
                    CommandLog.find(filter)
                        .sort({ sentAt: -1 })
                        .limit(maxItems)
                        .select(
                            'deviceIdName commandType source status latencyMs reason details error sentAt'
                        )
                        .lean(),
                ]);

                const records = docs.map((cmd) => ({
                    plate: cmd.deviceIdName,
                    commandType: cmd.commandType,
                    source: cmd.source,
                    status: cmd.status,
                    sentAtLocal: formatLocalTimeEsCO(cmd.sentAt),
                    reason: cmd.reason || cmd.details || '',
                    error: cmd.error || null,
                }));

                return {
                    module: 'commands',
                    authorized: true,
                    appliedFilters: {
                        status: normalizedStatus || 'ALL',
                        query: searchQuery,
                        month,
                        year,
                    },
                    totalMatching,
                    records,
                };
            }

            case 'dashboard':
            default: {
                const [payments, devicesCount, activeContractsCount] = await Promise.all([
                    Payment.find({
                        ...companyObjFilter,
                        status: { $in: ['APPROVED', 'COMPLETED'] },
                        created_at: { $gte: startOfMonth, $lte: endOfMonth },
                    })
                        .select('amount')
                        .lean(),
                    Device.countDocuments({ ...companyStrFilter, isDeleted: { $ne: true } }),
                    Contract.countDocuments({ ...companyObjFilter, status: 'ACTIVE' }),
                ]);
                const totalRevenue = payments.reduce((s, p) => s + (Number(p.amount) || 0), 0);
                return {
                    module: 'dashboard',
                    authorized: true,
                    appliedFilters: { month, year },
                    totalMatching: 1,
                    records: [
                        {
                            period: `${year}-${String(month).padStart(2, '0')}`,
                            totalRevenue: formatCOP(totalRevenue),
                            approvedPaymentsCount: payments.length,
                            totalFleet: devicesCount,
                            activeContracts: activeContractsCount,
                        },
                    ],
                };
            }
        }
    } catch (err) {
        return {
            module: targetModule,
            authorized: true,
            error: 'Could not query module records at this moment',
            records: [],
        };
    }
};

export default {
    resolveQuery,
    resolveLiveQuery,
    fetchSanitizedModuleRecords,
    matchIntent,
    normalizeText,
    SUPPORTED_CAPABILITIES,
};
