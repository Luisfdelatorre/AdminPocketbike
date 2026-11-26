/**
 * Report templates catalog.
 *
 * Defaults live in code and are never written to the database on read.
 * A company only gets a ReportTemplate document when an admin customizes one,
 * and deleting that document restores the default.
 *
 * `allowedFields` is the whitelist of data the client can export for each
 * section; customized templates may relabel, reorder, reformat or drop these
 * fields, but never reference anything outside the list.
 */
export const REPORT_FIELD_FORMATS = Object.freeze(['currency', 'number', 'text', 'date']);
export const REPORT_SECTION_TYPES = Object.freeze(['stats', 'table']);

export const REPORT_LIMITS = Object.freeze({
    nameMax: 80,
    sectionTitleMax: 60,
    labelMax: 60,
    fieldsPerSectionMax: 20,
});

export const REPORT_TEMPLATE_CATALOG = Object.freeze({
    'dashboard-summary': {
        key: 'dashboard-summary',
        module: 'dashboard',
        name: 'Reporte Resumen del Panel Principal',
        description: 'Indicadores del período y pagos recientes del panel administrativo.',
        sections: [
            {
                id: 'summary',
                sectionTitle: 'RESUMEN DEL PERIODO',
                type: 'stats',
                allowedFields: {
                    'stats.totalRevenue': 'currency',
                    'stats.activeDevices': 'number',
                    'stats.totalDevices': 'number',
                    'stats.pendingPayments': 'number',
                    'stats.totalInvoiced': 'currency',
                    'stats.collectionGap': 'currency',
                    'stats.collectionRate': 'number',
                },
                fields: [
                    { label: 'Ingresos Totales', dataKey: 'stats.totalRevenue', format: 'currency' },
                    { label: 'Dispositivos Activos', dataKey: 'stats.activeDevices', format: 'number' },
                    { label: 'Pagos Pendientes', dataKey: 'stats.pendingPayments', format: 'number' },
                    { label: 'Facturado (año)', dataKey: 'stats.totalInvoiced', format: 'currency' },
                    { label: 'Cartera Pendiente', dataKey: 'stats.collectionGap', format: 'currency' },
                ],
            },
            {
                id: 'recentPayments',
                sectionTitle: 'PAGOS RECIENTES',
                type: 'table',
                allowedFields: {
                    device: 'text',
                    amount: 'currency',
                    status: 'text',
                    date: 'date',
                },
                fields: [
                    { label: 'Dispositivo', dataKey: 'device', format: 'text' },
                    { label: 'Monto (COP)', dataKey: 'amount', format: 'currency' },
                    { label: 'Estado', dataKey: 'status', format: 'text' },
                    { label: 'Fecha', dataKey: 'date', format: 'date' },
                ],
            },
        ],
    },
});

export default REPORT_TEMPLATE_CATALOG;
