import reportTemplateRepository from '../repositories/reportTemplateRepository.js';
import logger from '../config/logger.js';

// Seed default templates for system modules
export const DEFAULT_TEMPLATES = {
    'dashboard-summary': {
        key: 'dashboard-summary',
        name: 'Reporte Resumen del Panel Principal',
        module: 'dashboard',
        description: 'Resumen mensual del panel administrativo con indicadores clave y lista de pagos recientes',
        isDefault: true,
        sections: [
            {
                sectionTitle: 'RESUMEN DEL PERIODO',
                type: 'stats',
                fields: [
                    { label: 'Ingresos Totales', dataKey: 'stats.totalRevenue', format: 'currency' },
                    { label: 'Dispositivos Activos', dataKey: 'stats.activeDevices', format: 'number' },
                    { label: 'Pagos Pendientes', dataKey: 'stats.pendingPayments', format: 'number' },
                    { label: 'Facturado (año)', dataKey: 'stats.totalInvoiced', format: 'currency' },
                    { label: 'Cartera Pendiente', dataKey: 'stats.collectionGap', format: 'currency' }
                ]
            },
            {
                sectionTitle: 'PAGOS RECIENTES',
                type: 'table',
                fields: [
                    { label: 'Dispositivo', dataKey: 'device', format: 'text' },
                    { label: 'Monto (COP)', dataKey: 'amount', format: 'currency' },
                    { label: 'Estado', dataKey: 'status', format: 'text' },
                    { label: 'Fecha', dataKey: 'date', format: 'date' }
                ]
            }
        ]
    },
    'invoices-monthly': {
        key: 'invoices-monthly',
        name: 'Exportación de Facturas Mensuales',
        module: 'invoices',
        description: 'Detalle de facturación emitida y estatus de pago',
        isDefault: true,
        sections: [
            {
                sectionTitle: 'FACTURAS EMITIDAS',
                type: 'table',
                fields: [
                    { label: 'ID Factura', dataKey: '_id', format: 'text' },
                    { label: 'Placa/Vehículo', dataKey: 'devicePlate', format: 'text' },
                    { label: 'Monto Total', dataKey: 'totalAmount', format: 'currency' },
                    { label: 'Estado', dataKey: 'status', format: 'text' },
                    { label: 'Fecha Vencimiento', dataKey: 'dueDate', format: 'date' }
                ]
            }
        ]
    },
    'payments-status': {
        key: 'payments-status',
        name: 'Exportación de Estado de Pagos',
        module: 'payments',
        description: 'Reporte detallado de pagos procesados y pendientes',
        isDefault: true,
        sections: [
            {
                sectionTitle: 'ESTADO DE PAGOS',
                type: 'table',
                fields: [
                    { label: 'ID Pago', dataKey: '_id', format: 'text' },
                    { label: 'Vehículo', dataKey: 'deviceName', format: 'text' },
                    { label: 'Monto', dataKey: 'amount', format: 'currency' },
                    { label: 'Referencia Wompi', dataKey: 'reference', format: 'text' },
                    { label: 'Estado', dataKey: 'status', format: 'text' },
                    { label: 'Fecha Transacción', dataKey: 'createdAt', format: 'date' }
                ]
            }
        ]
    }
};

class ReportTemplateService {
    async getTemplateByKey(key) {
        const cleanKey = key.toLowerCase();
        let template = await reportTemplateRepository.findByKey(cleanKey);

        if (!template && DEFAULT_TEMPLATES[cleanKey]) {
            logger.info(`[ReportTemplateService] Seeding default template for key '${cleanKey}'`);
            template = await reportTemplateRepository.upsertByKey(cleanKey, DEFAULT_TEMPLATES[cleanKey]);
        }

        return template || DEFAULT_TEMPLATES[cleanKey] || null;
    }

    async getAllTemplates(filter = {}) {
        let templates = await reportTemplateRepository.findAll(filter);

        if (templates.length === 0) {
            logger.info('[ReportTemplateService] Seeding default templates in bulk');
            for (const key of Object.keys(DEFAULT_TEMPLATES)) {
                await reportTemplateRepository.upsertByKey(key, DEFAULT_TEMPLATES[key]);
            }
            templates = await reportTemplateRepository.findAll(filter);
        }

        return templates;
    }

    async upsertTemplate(key, data, userId) {
        const cleanKey = key.toLowerCase();
        const payload = {
            ...data,
            key: cleanKey,
            isDefault: false,
            updatedBy: userId
        };

        return await reportTemplateRepository.upsertByKey(cleanKey, payload);
    }
}

export default new ReportTemplateService();
