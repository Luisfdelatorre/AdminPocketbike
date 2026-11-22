/**
 * Voice Assistant capability registry.
 *
 * Each capability describes WHAT the assistant can do; the dispatcher decides HOW.
 * IDs must stay aligned with server/services/assistantDemoService.js.
 *
 * Types:
 *  - navigate: client-only, moves the router to `route`.
 *  - query: answered by POST /assistant/query (demo dataset).
 *  - help: lists capabilities locally.
 */

export const CAPABILITY_TYPES = Object.freeze({
    NAVIGATE: 'navigate',
    QUERY: 'query',
    HELP: 'help',
});

export const CAPABILITIES = Object.freeze([
    // --- Queries (demo data) ---
    {
        id: 'query.collections_today',
        type: CAPABILITY_TYPES.QUERY,
        label: 'Recaudo de hoy',
        examples: ['¿Cuánto se ha recaudado hoy?'],
        keywords: ['recaudo', 'recaudado', 'cobrado', 'cobros de hoy', 'ingresos', 'pagos de hoy'],
    },
    {
        id: 'query.fleet_status',
        type: CAPABILITY_TYPES.QUERY,
        label: 'Estado de la flota',
        examples: ['¿Cómo está la flota?'],
        keywords: ['estado de la flota', 'flota', 'en linea', 'conectadas', 'desconectadas'],
    },
    {
        id: 'query.cutoff_devices',
        type: CAPABILITY_TYPES.QUERY,
        label: 'Motos apagadas',
        examples: ['¿Qué motos están apagadas?'],
        keywords: ['apagadas', 'apagados', 'cortadas', 'corte', 'bloqueadas'],
    },
    {
        id: 'query.top_debtors',
        type: CAPABILITY_TYPES.QUERY,
        label: 'Mayores deudores',
        examples: ['¿Quiénes deben más?'],
        keywords: ['deudores', 'deben', 'morosos', 'deuda', 'mora'],
    },
    {
        id: 'query.open_alerts',
        type: CAPABILITY_TYPES.QUERY,
        label: 'Alertas abiertas',
        examples: ['¿Qué alertas hay abiertas?'],
        keywords: ['alertas abiertas', 'alertas activas', 'incidentes', 'que alertas'],
    },
    {
        id: 'query.contracts_overview',
        type: CAPABILITY_TYPES.QUERY,
        label: 'Resumen de contratos',
        examples: ['Dame el resumen de contratos'],
        keywords: ['resumen de contratos', 'contratos activos', 'cuantos contratos'],
    },

    // --- Navigation ---
    { id: 'nav.dashboard', type: CAPABILITY_TYPES.NAVIGATE, route: '/', label: 'Dashboard', examples: ['Abre el dashboard'], keywords: ['dashboard', 'inicio', 'panel principal'] },
    { id: 'nav.devices', type: CAPABILITY_TYPES.NAVIGATE, route: '/devices', label: 'Dispositivos', examples: ['Ir a dispositivos'], keywords: ['dispositivos', 'lista de motos', 'pagina de motos'] },
    { id: 'nav.contracts', type: CAPABILITY_TYPES.NAVIGATE, route: '/contracts', label: 'Contratos', examples: ['Abre contratos'], keywords: ['contratos'] },
    { id: 'nav.payments', type: CAPABILITY_TYPES.NAVIGATE, route: '/payments', label: 'Pagos', examples: ['Ir a pagos'], keywords: ['pagos'] },
    { id: 'nav.summary', type: CAPABILITY_TYPES.NAVIGATE, route: '/summary', label: 'Resumen de pagos', examples: ['Abre el resumen de pagos'], keywords: ['resumen de pagos', 'resumen semanal', 'resumen'] },
    { id: 'nav.invoices', type: CAPABILITY_TYPES.NAVIGATE, route: '/invoices', label: 'Facturas', examples: ['Ir a facturas'], keywords: ['facturas'] },
    { id: 'nav.alerts', type: CAPABILITY_TYPES.NAVIGATE, route: '/alerts', label: 'Centro de alertas', examples: ['Abre el centro de alertas'], keywords: ['centro de alertas', 'alertas'] },
    { id: 'nav.commands', type: CAPABILITY_TYPES.NAVIGATE, route: '/commands', label: 'Historial de comandos', examples: ['Ir al historial de comandos'], keywords: ['historial de comandos', 'comandos enviados'] },
    { id: 'nav.reports', type: CAPABILITY_TYPES.NAVIGATE, route: '/reports', label: 'Reportes', examples: ['Abre reportes'], keywords: ['reportes', 'informes'] },

    // --- Help ---
    {
        id: 'help',
        type: CAPABILITY_TYPES.HELP,
        label: 'Qué puedo hacer',
        examples: ['¿Qué puedes hacer?'],
        keywords: ['ayuda', 'que puedes hacer', 'que sabes hacer', 'comandos', 'opciones'],
    },
]);

const CAPABILITY_MAP = new Map(CAPABILITIES.map((capability) => [capability.id, capability]));

export const getCapability = (id) => (id ? CAPABILITY_MAP.get(id) ?? null : null);

/** Example prompts shown as quick suggestions in the panel. */
export const SUGGESTED_CAPABILITY_IDS = Object.freeze([
    'query.collections_today',
    'query.cutoff_devices',
    'query.open_alerts',
    'nav.contracts',
]);
