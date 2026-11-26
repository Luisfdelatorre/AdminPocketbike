/**
 * Build CSV rows from a report template (see server/constants/reportTemplates.js)
 * and a data context. Numbers are exported raw so spreadsheets can sum them.
 */
export function getNestedValue(obj, path) {
    if (!obj || !path) return undefined;
    return path.split('.').reduce((acc, part) => (acc != null ? acc[part] : undefined), obj);
}

export function formatCellValue(value, format) {
    if (value === null || value === undefined || value === '') return '';
    if (format === 'currency' || format === 'number') {
        const num = Number(value);
        return Number.isFinite(num) ? num : String(value);
    }
    if (format === 'date' && value instanceof Date) return value.toLocaleDateString('es-CO');
    return String(value);
}

/**
 * @param {object} template  Template view returned by GET /report-templates/:key
 * @param {object} context   { period, stats, ...tables } — table sections read context[section.id]
 * @returns {Array<Array<string|number>>}
 */
export function buildReportRows(template, context = {}) {
    if (!template || !Array.isArray(template.sections)) {
        throw new Error('Invalid report template');
    }

    const rows = [[template.name || 'REPORTE', context.period || ''], ['']];

    template.sections.forEach((section, index) => {
        if (index > 0) rows.push(['']);
        if (section.sectionTitle) {
            rows.push([section.sectionTitle.toUpperCase()]);
            rows.push(['']);
        }

        if (section.type === 'stats') {
            rows.push(['Métrica', 'Valor']);
            section.fields.forEach((field) => {
                rows.push([field.label, formatCellValue(getNestedValue(context, field.dataKey), field.format)]);
            });
            return;
        }

        rows.push(section.fields.map((field) => field.label));
        const items = Array.isArray(context[section.id]) ? context[section.id] : [];
        if (items.length === 0) {
            rows.push(['Sin registros en este período']);
            return;
        }
        items.forEach((item) => {
            rows.push(section.fields.map((field) => formatCellValue(getNestedValue(item, field.dataKey), field.format)));
        });
    });

    return rows;
}
