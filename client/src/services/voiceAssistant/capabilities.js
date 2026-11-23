/**
 * Canonical Capability Catalog — UPay AI Voice Assistant
 *
 * Single source of truth shared between `client/` and `server/`.
 * Defines:
 *  1. Modules, routes, permissions and supported filter enums.
 *  2. The 6 read-only tools (`navigate`, `applyFilter`, `search`, `clearFilters`, `openDetail`, `showHelp`).
 *  3. Approved response template placeholders (`{{...}}`).
 *  4. Deterministic catalog serialization for OpenAI Prompt Caching.
 */

export const CAPABILITY_TYPES = Object.freeze({
    NAVIGATE: 'navigate',
    QUERY: 'query',
    HELP: 'help',
});

export const MODULES = Object.freeze({
    dashboard: {
        id: 'dashboard',
        route: '/',
        label: 'Dashboard',
        labelEn: 'Dashboard',
        roles: ['admin', 'manager', 'viewer'],
        requiresSuperAdmin: false,
        supportsSearch: false,
        filters: {
            month: { type: 'number', min: 1, max: 12 },
            year: { type: 'number', min: 2024, max: 2030 },
        },
        aliases: ['dashboard', 'inicio', 'panel principal', 'home', 'main panel'],
    },
    devices: {
        id: 'devices',
        route: '/devices',
        label: 'Dispositivos (Motos)',
        labelEn: 'Motorcycles / Devices',
        roles: ['admin', 'manager', 'viewer'],
        requiresSuperAdmin: false,
        supportsSearch: true,
        searchableFields: ['name', 'deviceName', 'id', 'gpsId'],
        filters: {
            status: {
                type: 'enum',
                values: ['all', 'offline', 'battery_issue', 'active', 'available', 'on', 'off', 'alt_issue'],
                synonyms: {
                    suspended: 'off',
                    cutoff: 'off',
                    apagadas: 'off',
                    apagados: 'off',
                    cortadas: 'off',
                    encendidas: 'on',
                    encendidos: 'on',
                    desconectadas: 'offline',
                    desconectados: 'offline',
                    bateria: 'battery_issue',
                    alternador: 'alt_issue',
                    activas: 'active',
                    activos: 'active',
                    disponibles: 'available',
                    todas: 'all',
                    todos: 'all',
                },
            },
            sortBy: { type: 'enum', values: ['default', 'offline'] },
        },
        aliases: ['devices', 'dispositivos', 'motos', 'motocicletas', 'motorcycles', 'bikes', 'flota', 'fleet'],
    },
    summary: {
        id: 'summary',
        route: '/summary',
        label: 'Resumen de Pagos',
        labelEn: 'Payment Summary',
        roles: ['admin', 'manager', 'viewer'],
        requiresSuperAdmin: false,
        supportsSearch: true,
        searchableFields: ['device.name', 'device.customerName', 'device.driverName'],
        filters: {
            status: {
                type: 'enum',
                values: ['all', 'debt', 'ok', 'cutoff', 'weekly'],
                synonyms: {
                    morosos: 'debt',
                    deuda: 'debt',
                    deudores: 'debt',
                    overdue: 'debt',
                    aldia: 'ok',
                    apagadas: 'cutoff',
                    apagados: 'cutoff',
                    suspended: 'cutoff',
                    semanal: 'weekly',
                    todos: 'all',
                },
            },
            view: { type: 'enum', values: ['bike', 'matrix'] },
            month: { type: 'number', min: 1, max: 12 },
            year: { type: 'number', min: 2024, max: 2030 },
        },
        aliases: ['summary', 'resumen', 'resumen de pagos', 'payment summary', 'matriz'],
    },
    contracts: {
        id: 'contracts',
        route: '/contracts',
        label: 'Contratos',
        labelEn: 'Contracts',
        roles: ['admin', 'manager'],
        requiresSuperAdmin: false,
        supportsSearch: true,
        searchableFields: ['contractId', 'deviceId', 'customerName', 'customerEmail', 'vehicleInfo.placa'],
        filters: {
            status: {
                type: 'enum',
                values: ['all', 'active', 'weekly', 'completed', 'cancelled'],
                synonyms: {
                    activos: 'active',
                    activo: 'active',
                    semanales: 'weekly',
                    semanal: 'weekly',
                    finalizados: 'completed',
                    completados: 'completed',
                    cancelados: 'cancelled',
                    todos: 'all',
                },
            },
        },
        aliases: ['contracts', 'contratos', 'contrato'],
    },
    payments: {
        id: 'payments',
        route: '/payments',
        label: 'Pagos',
        labelEn: 'Payments',
        roles: ['admin', 'manager', 'viewer'],
        requiresSuperAdmin: false,
        supportsSearch: true,
        searchableFields: ['deviceId', 'invoiceId', 'unpaidInvoiceId', 'paymentReference'],
        filters: {
            status: {
                type: 'enum',
                values: ['all', 'completed', 'pending', 'failed', 'free'],
                synonyms: {
                    rejected: 'failed',
                    declined: 'failed',
                    rechazados: 'failed',
                    rechazado: 'failed',
                    fallidos: 'failed',
                    approved: 'completed',
                    aprobados: 'completed',
                    completados: 'completed',
                    exitosos: 'completed',
                    pendientes: 'pending',
                    pendiente: 'pending',
                    gratis: 'free',
                    ajustes: 'free',
                    todos: 'all',
                },
            },
            datePreset: {
                type: 'enum',
                values: ['all', 'today', 'yesterday', 'last_7_days'],
                synonyms: {
                    hoy: 'today',
                    ayer: 'yesterday',
                    semana: 'last_7_days',
                    last_week: 'last_7_days',
                    'last week': 'last_7_days',
                    'semana pasada': 'last_7_days',
                },
            },
            sortBy: { type: 'enum', values: ['date', 'amount', 'device'] },
            month: { type: 'number', min: 1, max: 12 },
            year: { type: 'number', min: 2024, max: 2030 },
        },
        aliases: ['payments', 'pagos', 'cobros'],
    },
    invoices: {
        id: 'invoices',
        route: '/invoices',
        label: 'Facturas',
        labelEn: 'Invoices',
        roles: ['admin', 'manager'],
        requiresSuperAdmin: false,
        supportsSearch: true,
        searchableFields: ['invoiceId', 'deviceIdName', 'contractId', 'paymentReference', 'transactionId'],
        filters: {
            status: {
                type: 'enum',
                values: ['all', 'PAID', 'PENDING', 'FREE', 'LOAN'],
                synonyms: {
                    pagadas: 'PAID',
                    pagados: 'PAID',
                    paid: 'PAID',
                    pendientes: 'PENDING',
                    pending: 'PENDING',
                    unpaid: 'PENDING',
                    gratis: 'FREE',
                    free: 'FREE',
                    prestamo: 'LOAN',
                    todas: 'all',
                },
            },
            month: { type: 'number', min: 1, max: 12 },
            year: { type: 'number', min: 2024, max: 2030 },
        },
        aliases: ['invoices', 'facturas', 'facturacion diaria'],
    },
    alerts: {
        id: 'alerts',
        route: '/alerts',
        label: 'Centro de Alertas',
        labelEn: 'Alerts Center',
        roles: ['admin', 'manager'],
        requiresSuperAdmin: false,
        supportsSearch: true,
        searchableFields: ['deviceIdName'],
        filters: {
            status: {
                type: 'enum',
                values: ['ALL', 'ACTIVE', 'ACKNOWLEDGED', 'RESOLVED'],
                synonyms: {
                    activas: 'ACTIVE',
                    abiertas: 'ACTIVE',
                    open: 'ACTIVE',
                    active: 'ACTIVE',
                    reconocidas: 'ACKNOWLEDGED',
                    acknowledged: 'ACKNOWLEDGED',
                    resueltas: 'RESOLVED',
                    resolved: 'RESOLVED',
                    todas: 'ALL',
                    all: 'ALL',
                },
            },
            alertType: {
                type: 'enum',
                values: [
                    'ALL',
                    'UNAUTHORIZED_DRIVING',
                    'POWER_CUT',
                    'UNAUTHORIZED_MOVEMENT',
                    'UNAUTHORIZED_IGNITION',
                    'GEOFENCE_EXIT',
                    'EXTENDED_OFFLINE',
                ],
            },
            month: { type: 'number', min: 1, max: 12 },
            year: { type: 'number', min: 2024, max: 2030 },
        },
        aliases: ['alerts', 'alertas', 'centro de alertas', 'incidentes'],
    },
    commands: {
        id: 'commands',
        route: '/commands',
        label: 'Historial de Comandos',
        labelEn: 'Command History',
        roles: ['admin', 'manager'],
        requiresSuperAdmin: false,
        supportsSearch: true,
        searchableFields: ['deviceIdName'],
        filters: {
            status: {
                type: 'enum',
                values: ['ALL', 'STOP', 'RESUME', 'PREVENTIVE', 'FAILED'],
                synonyms: {
                    apagado: 'STOP',
                    corte: 'STOP',
                    stop: 'STOP',
                    encendido: 'RESUME',
                    reanudacion: 'RESUME',
                    resume: 'RESUME',
                    preventivo: 'PREVENTIVE',
                    fallidos: 'FAILED',
                    failed: 'FAILED',
                    todos: 'ALL',
                },
            },
            month: { type: 'number', min: 1, max: 12 },
            year: { type: 'number', min: 2024, max: 2030 },
        },
        aliases: ['commands', 'comandos', 'historial de comandos'],
    },
    reports: {
        id: 'reports',
        route: '/reports',
        label: 'Reportes',
        labelEn: 'Reports',
        roles: ['admin', 'manager'],
        requiresSuperAdmin: false,
        supportsSearch: true,
        searchableFields: ['date'],
        filters: {
            status: {
                type: 'enum',
                values: ['all', 'payments', 'bancolombia', 'reconciled', 'pending', 'selected'],
                synonyms: {
                    conciliados: 'reconciled',
                    pendientes: 'pending',
                    pagos: 'payments',
                    todos: 'all',
                },
            },
            month: { type: 'number', min: 1, max: 12 },
            year: { type: 'number', min: 2024, max: 2030 },
        },
        aliases: ['reports', 'reportes', 'informes', 'conciliacion'],
    },
    'company-invoices': {
        id: 'company-invoices',
        route: '/company-invoices',
        label: 'Facturación Empresas',
        labelEn: 'Company Invoices',
        roles: ['admin'],
        requiresSuperAdmin: false,
        supportsSearch: true,
        searchableFields: ['invoiceNumber', 'companyId.name'],
        filters: {
            status: {
                type: 'enum',
                values: ['all', 'completed', 'pending'],
            },
        },
        aliases: ['company-invoices', 'facturacion empresas', 'facturas de empresas'],
    },
    settings: {
        id: 'settings',
        route: '/settings',
        label: 'Configuración',
        labelEn: 'Settings',
        roles: ['admin', 'manager'],
        requiresSuperAdmin: false,
        supportsSearch: false,
        filters: {},
        aliases: ['settings', 'configuracion', 'ajustes'],
    },
    users: {
        id: 'users',
        route: '/users',
        label: 'Usuarios',
        labelEn: 'Users',
        roles: ['admin', 'manager'],
        requiresSuperAdmin: false,
        supportsSearch: true,
        searchableFields: ['name', 'email', 'companyName'],
        filters: {},
        aliases: ['users', 'usuarios'],
    },
    companies: {
        id: 'companies',
        route: '/companies',
        label: 'Empresas',
        labelEn: 'Companies',
        roles: ['admin'],
        requiresSuperAdmin: true,
        supportsSearch: false,
        filters: {},
        aliases: ['companies', 'empresas', 'compañias'],
    },
});

export const MODULE_IDS = Object.freeze(Object.keys(MODULES));

export const ROUTE_TO_MODULE = Object.freeze(
    Object.values(MODULES).reduce((acc, mod) => {
        acc[mod.route] = mod.id;
        return acc;
    }, { '/historial-comandos': 'commands', '/alertas': 'alerts' })
);

export const canUserAccessModule = (moduleId, user) => {
    const mod = MODULES[moduleId];
    if (!mod) return false;
    if (!user) return true; // Unhydrated fallback in demo
    if (user.isSuperAdmin === true) return true;
    if (mod.requiresSuperAdmin) return false;
    const role = user.role || 'admin';
    return mod.roles.includes(role);
};

/**
 * Canonical Read-Only Tool Definitions (`risk: "read"`).
 */
export const TOOLS = Object.freeze({
    navigate: {
        name: 'navigate',
        risk: 'read',
        description: 'Navigate to an authorized application module/route.',
        supportedModules: MODULE_IDS,
        params: {
            module: { type: 'enum', required: true, values: MODULE_IDS },
        },
    },
    applyFilter: {
        name: 'applyFilter',
        risk: 'read',
        description: 'Apply status, date preset, month/year, view or sort filters on a module.',
        supportedModules: [
            'payments', 'devices', 'contracts', 'summary', 'invoices',
            'alerts', 'commands', 'dashboard', 'reports', 'company-invoices',
        ],
        params: {
            module: { type: 'enum', required: false, values: MODULE_IDS },
            status: { type: 'string', required: false, maxLength: 40 },
            datePreset: { type: 'enum', required: false, values: ['all', 'today', 'yesterday', 'last_7_days'] },
            month: { type: 'number', required: false, min: 1, max: 12 },
            year: { type: 'number', required: false, min: 2024, max: 2030 },
            sortBy: { type: 'string', required: false, maxLength: 24 },
            view: { type: 'enum', required: false, values: ['bike', 'matrix'] },
        },
    },
    search: {
        name: 'search',
        risk: 'read',
        description: 'Search records by plate, device ID, contract ID, customer name or reference.',
        supportedModules: [
            'devices', 'contracts', 'payments', 'summary', 'invoices',
            'alerts', 'commands', 'users', 'reports', 'company-invoices',
        ],
        params: {
            module: { type: 'enum', required: false, values: MODULE_IDS },
            query: { type: 'string', required: true, minLength: 1, maxLength: 80 },
        },
    },
    clearFilters: {
        name: 'clearFilters',
        risk: 'read',
        description: 'Clear active search query and status/date filters on the target module.',
        supportedModules: MODULE_IDS,
        params: {
            module: { type: 'enum', required: false, values: MODULE_IDS },
        },
    },
    openDetail: {
        name: 'openDetail',
        risk: 'read',
        description: 'Open read-only detail view or contract preview for a single unambiguous record.',
        supportedModules: ['contracts', 'devices', 'alerts', 'summary'],
        params: {
            targetType: { type: 'enum', required: true, values: ['contract', 'device_contract', 'alert'] },
            identifier: { type: 'string', required: false, maxLength: 60 },
        },
    },
    showHelp: {
        name: 'showHelp',
        risk: 'read',
        description: 'Show available voice and text assistant capabilities.',
        supportedModules: MODULE_IDS,
        params: {
            topic: { type: 'string', required: false, maxLength: 40 },
        },
    },
});

export const TOOL_NAMES = Object.freeze(Object.keys(TOOLS));

/**
 * Approved Placeholders for Local Response Resolvers.
 * OpenAI never sees underlying values; it emits these placeholders in `responseTemplate`.
 */
export const PLACEHOLDERS = Object.freeze([
    'payments.count',
    'payments.total',
    'payments.globalTotalCount',
    'devices.count',
    'devices.offlineCount',
    'devices.cutoffCount',
    'contracts.count',
    'contracts.totalValue',
    'summary.count',
    'summary.debtorsCount',
    'summary.debtTotal',
    'invoices.count',
    'invoices.unpaidCount',
    'invoices.totalAmount',
    'alerts.count',
    'alerts.activeCount',
    'alerts.criticalCount',
    'commands.count',
    'commands.failedCount',
    'dashboard.totalRevenue',
    'dashboard.collectionRate',
]);

/**
 * Resolves a filter synonym to its canonical value for `moduleId`.
 */
export const normalizeFilterStatus = (moduleId, rawStatus) => {
    if (!rawStatus) return null;
    const mod = MODULES[moduleId];
    const statusDef = mod?.filters?.status;
    if (!statusDef) return null;

    const clean = String(rawStatus).trim();
    const exact = statusDef.values.find((v) => v.toLowerCase() === clean.toLowerCase());
    if (exact) return exact;

    const lowerKey = clean
        .toLowerCase()
        .normalize('NFD')
        .replace(/[\u0300-\u036f]/g, '');
    if (statusDef.synonyms && lowerKey in statusDef.synonyms) {
        return statusDef.synonyms[lowerKey];
    }
    return null;
};

export const normalizeDatePreset = (rawPreset) => {
    if (!rawPreset) return null;
    const clean = String(rawPreset)
        .trim()
        .toLowerCase()
        .normalize('NFD')
        .replace(/[\u0300-\u036f]/g, '');
    const presets = MODULES.payments.filters.datePreset;
    if (presets.values.includes(clean)) return clean;
    if (presets.synonyms && clean in presets.synonyms) return presets.synonyms[clean];
    return null;
};

/**
 * Legacy compatibility list used by quick suggestion chips and demo queries.
 */
export const CAPABILITIES = Object.freeze([
    {
        id: 'query.collections_today',
        type: CAPABILITY_TYPES.QUERY,
        label: 'Pagos aprobados',
        examples: ['Muéstrame los pagos aprobados'],
        keywords: ['recaudo', 'recaudado', 'cobrado', 'cobros de hoy', 'ingresos', 'pagos de hoy', 'pagos aprobados'],
    },
    {
        id: 'query.rejected_payments',
        type: CAPABILITY_TYPES.QUERY,
        label: 'Pagos rechazados',
        examples: ['Muéstrame los pagos rechazados'],
        keywords: ['pagos rechazados', 'rejected payments', 'pagos fallidos'],
    },
    {
        id: 'query.cutoff_devices',
        type: CAPABILITY_TYPES.QUERY,
        label: 'Motos apagadas',
        examples: ['Muéstrame las motos apagadas'],
        keywords: ['apagadas', 'apagados', 'cortadas', 'corte', 'bloqueadas', 'suspended motorcycles'],
    },
    {
        id: 'query.top_debtors',
        type: CAPABILITY_TYPES.QUERY,
        label: 'Motos en mora',
        examples: ['Muéstrame las motos con deuda en resumen'],
        keywords: ['deudores', 'deben', 'morosos', 'deuda', 'mora'],
    },
    {
        id: 'query.open_alerts',
        type: CAPABILITY_TYPES.QUERY,
        label: 'Alertas activas',
        examples: ['Muéstrame las alertas activas'],
        keywords: ['alertas abiertas', 'alertas activas', 'incidentes', 'que alertas'],
    },
    {
        id: 'query.contracts_overview',
        type: CAPABILITY_TYPES.QUERY,
        label: 'Contratos activos',
        examples: ['Muéstrame los contratos activos'],
        keywords: ['resumen de contratos', 'contratos activos', 'cuantos contratos'],
    },
    { id: 'nav.dashboard', type: CAPABILITY_TYPES.NAVIGATE, route: '/', module: 'dashboard', label: 'Dashboard', examples: ['Abre el dashboard'], keywords: ['dashboard', 'inicio', 'panel principal'] },
    { id: 'nav.devices', type: CAPABILITY_TYPES.NAVIGATE, route: '/devices', module: 'devices', label: 'Dispositivos', examples: ['Ir a dispositivos'], keywords: ['dispositivos', 'lista de motos', 'pagina de motos'] },
    { id: 'nav.contracts', type: CAPABILITY_TYPES.NAVIGATE, route: '/contracts', module: 'contracts', label: 'Contratos', examples: ['Abre contratos'], keywords: ['contratos'] },
    { id: 'nav.payments', type: CAPABILITY_TYPES.NAVIGATE, route: '/payments', module: 'payments', label: 'Pagos', examples: ['Ir a pagos'], keywords: ['pagos'] },
    { id: 'nav.summary', type: CAPABILITY_TYPES.NAVIGATE, route: '/summary', module: 'summary', label: 'Resumen de pagos', examples: ['Abre el resumen de pagos'], keywords: ['resumen de pagos', 'resumen semanal', 'resumen'] },
    { id: 'nav.invoices', type: CAPABILITY_TYPES.NAVIGATE, route: '/invoices', module: 'invoices', label: 'Facturas', examples: ['Ir a facturas'], keywords: ['facturas'] },
    { id: 'nav.alerts', type: CAPABILITY_TYPES.NAVIGATE, route: '/alerts', module: 'alerts', label: 'Centro de alertas', examples: ['Abre el centro de alertas'], keywords: ['centro de alertas', 'alertas'] },
    { id: 'nav.commands', type: CAPABILITY_TYPES.NAVIGATE, route: '/commands', module: 'commands', label: 'Historial de comandos', examples: ['Ir al historial de comandos'], keywords: ['historial de comandos', 'comandos enviados'] },
    { id: 'nav.reports', type: CAPABILITY_TYPES.NAVIGATE, route: '/reports', module: 'reports', label: 'Reportes', examples: ['Abre reportes'], keywords: ['reportes', 'informes'] },
    {
        id: 'help',
        type: CAPABILITY_TYPES.HELP,
        label: 'Qué puedo hacer',
        examples: ['¿Qué puedes hacer?'],
        keywords: ['ayuda', 'que puedes hacer', 'que sabes hacer', 'comandos', 'opciones', 'help'],
    },
]);

const CAPABILITY_MAP = new Map(CAPABILITIES.map((c) => [c.id, c]));
export const getCapability = (id) => (id ? CAPABILITY_MAP.get(id) ?? null : null);

export const SUGGESTED_CAPABILITY_IDS = Object.freeze([
    'query.rejected_payments',
    'query.cutoff_devices',
    'query.open_alerts',
    'nav.contracts',
]);

/**
 * Builds a deterministic, sorted JSON representation of the catalog for a role variant
 * so OpenAI Prompt Caching always sees an identical prefix across requests.
 */
export const serializeCatalogForPrompt = (roleVariant = 'admin') => {
    const isSuper = roleVariant === 'superadmin';
    const role = isSuper ? 'admin' : roleVariant;
    const mockUser = { role, isSuperAdmin: isSuper };

    const permittedModules = MODULE_IDS.filter((id) => canUserAccessModule(id, mockUser)).map((id) => {
        const m = MODULES[id];
        return {
            id: m.id,
            route: m.route,
            label: m.label,
            labelEn: m.labelEn,
            supportsSearch: m.supportsSearch,
            searchableFields: m.searchableFields || [],
            filters: Object.entries(m.filters || {}).reduce((acc, [k, v]) => {
                acc[k] = v.type === 'enum' ? v.values : `${v.type}(${v.min}..${v.max})`;
                return acc;
            }, {}),
        };
    });

    const toolsList = TOOL_NAMES.map((name) => {
        const t = TOOLS[name];
        return {
            name: t.name,
            risk: t.risk,
            description: t.description,
            params: t.params,
        };
    });

    return JSON.stringify({
        version: 'upay-voice-catalog-v1',
        roleVariant,
        modules: permittedModules,
        tools: toolsList,
        placeholders: PLACEHOLDERS,
    });
};
