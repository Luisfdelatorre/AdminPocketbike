/**
 * Client-side fictional demo dataset & query resolver.
 * Mirrors server/services/assistantDemoService.js so the assistant can answer
 * reliably even when offline, on mobile networks, or when the user has a read-only token.
 */

import { matchLocalIntent } from './matcher.js';

const formatCOP = (value) =>
    new Intl.NumberFormat('es-CO', { style: 'currency', currency: 'COP', maximumFractionDigits: 0 }).format(value);

export const DEMO_DATA = Object.freeze({
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

export const buildLocalQueryResult = (capabilityId) => {
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

export const resolveLocalDemoQuery = ({ text, capabilityId } = {}) => {
    const resolvedId = capabilityId || matchLocalIntent(text).capabilityId;
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
        ...buildLocalQueryResult(resolvedId),
        demo: true,
    };
};

export default { DEMO_DATA, buildLocalQueryResult, resolveLocalDemoQuery };
