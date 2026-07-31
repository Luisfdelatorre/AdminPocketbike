import { exportToCSV, formatCompact } from './helpers';

/**
 * Safely extract nested property value using dot-notation string (e.g. 'stats.totalRevenue')
 */
export function getNestedValue(obj, path) {
    if (!obj || !path) return undefined;
    return path.split('.').reduce((prev, curr) => (prev && prev[curr] !== undefined ? prev[curr] : undefined), obj);
}

/**
 * Format cell value based on format type
 */
export function formatCellValue(value, format) {
    if (value === null || value === undefined) return '';

    switch (format) {
        case 'currency':
            return typeof value === 'number' ? formatCompact(value) : value;
        case 'number':
            return typeof value === 'number' ? value.toLocaleString('es-CO') : value;
        case 'date':
            if (value instanceof Date) return value.toLocaleDateString('es-CO');
            return String(value);
        case 'text':
        default:
            return String(value);
    }
}

/**
 * Generate CSV export directly from a Database ReportTemplate and Data Context
 * @param {Object} template - ReportTemplate document from DB
 * @param {Object} dataContext - Object containing metrics/stats and data arrays
 * @param {string} defaultFilename - Fallback filename if template key isn't provided
 */
export function generateReportFromTemplate(template, dataContext, defaultFilename = 'reporte.csv') {
    if (!template || !template.sections) {
        throw new Error('Invalid template provided for report generation');
    }

    const rows = [];
    const filename = template.key ? `${template.key}_${dataContext.period || Date.now()}.csv` : defaultFilename;

    // Header Title
    rows.push([template.name || 'REPORTE DE SISTEMA', dataContext.period || '']);
    rows.push(['']);

    template.sections.forEach((section, index) => {
        if (index > 0) rows.push(['']); // Blank separator line

        if (section.sectionTitle) {
            rows.push([section.sectionTitle.toUpperCase()]);
            rows.push(['']);
        }

        if (section.type === 'stats') {
            rows.push(['Campo / Métrica', 'Valor']);
            section.fields.forEach(field => {
                const rawVal = getNestedValue(dataContext, field.dataKey);
                const formattedVal = formatCellValue(rawVal, field.format);
                rows.push([field.label, formattedVal]);
            });
        } else if (section.type === 'table') {
            // Header row of column labels
            const headers = section.fields.map(f => f.label);
            rows.push(headers);

            // Retrieve data array matching section or table key
            const tableData = dataContext.recentPayments || dataContext.items || dataContext.tableData || [];

            if (Array.isArray(tableData) && tableData.length > 0) {
                tableData.forEach(item => {
                    const rowCells = section.fields.map(field => {
                        const rawVal = getNestedValue(item, field.dataKey);
                        return formatCellValue(rawVal, field.format);
                    });
                    rows.push(rowCells);
                });
            } else {
                rows.push(['No hay registros disponibles en esta sección']);
            }
        }
    });

    exportToCSV(filename, rows);
}

export default generateReportFromTemplate;
