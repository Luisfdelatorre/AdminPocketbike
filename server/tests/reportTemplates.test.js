import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { REPORT_TEMPLATE_CATALOG } from '../constants/reportTemplates.js';
import { validateTemplatePayload, buildTemplateView, resolveCompanyId } from '../services/reportTemplateService.js';
import { buildReportRows } from '../../client/src/utils/reportGenerator.js';

const entry = REPORT_TEMPLATE_CATALOG['dashboard-summary'];
const basePayload = () => ({
    name: 'Mi reporte',
    sections: entry.sections.map(({ id, sectionTitle, fields }) => ({ id, sectionTitle, fields: fields.map((f) => ({ ...f })) })),
});

describe('Report templates: validation', () => {
    it('accepts a valid customization and sanitizes text', () => {
        const payload = basePayload();
        payload.sections[0].sectionTitle = '  Resumen\u0007 ';
        payload.sections[0].fields = [{ label: 'Recaudo', dataKey: 'stats.totalRevenue', format: 'currency' }];
        const clean = validateTemplatePayload('dashboard-summary', payload);
        assert.equal(clean.name, 'Mi reporte');
        assert.equal(clean.sections[0].sectionTitle, 'Resumen');
        assert.deepEqual(clean.sections[0].fields, [{ label: 'Recaudo', dataKey: 'stats.totalRevenue', format: 'currency' }]);
        assert.equal(clean.sections[1].fields.length, 4, 'untouched section keeps its fields');
    });

    it('rejects unknown templates, non-whitelisted or duplicated fields and empty sections', () => {
        assert.throws(() => validateTemplatePayload('invoices-monthly', basePayload()), /Unknown report template/);

        const notAllowed = basePayload();
        notAllowed.sections[1].fields.push({ label: 'Token', dataKey: 'device.token', format: 'text' });
        assert.throws(() => validateTemplatePayload('dashboard-summary', notAllowed), /not allowed/);

        const proto = basePayload();
        proto.sections[0].fields.push({ label: 'x', dataKey: '__proto__', format: 'text' });
        assert.throws(() => validateTemplatePayload('dashboard-summary', proto), /not allowed/);

        const dup = basePayload();
        dup.sections[1].fields.push({ ...dup.sections[1].fields[0] });
        assert.throws(() => validateTemplatePayload('dashboard-summary', dup), /duplicated/);

        const empty = basePayload();
        empty.sections[0].fields = [];
        assert.throws(() => validateTemplatePayload('dashboard-summary', empty), /at least one field/);

        const badFormat = basePayload();
        badFormat.sections[0].fields[0].format = 'html';
        assert.throws(() => validateTemplatePayload('dashboard-summary', badFormat), /Invalid format/);

        const longLabel = basePayload();
        longLabel.sections[0].fields[0].label = 'x'.repeat(61);
        assert.throws(() => validateTemplatePayload('dashboard-summary', longLabel), /exceeds/);
    });
});

describe('Report templates: view and scoping', () => {
    it('serves the catalog default without a stored document and merges customizations', () => {
        const def = buildTemplateView(entry, null);
        assert.equal(def.isCustom, false);
        assert.equal(def.sections[0].type, 'stats');
        assert.ok(def.sections[0].allowedFields['stats.totalRevenue']);

        const stored = { name: 'Custom', updatedAt: new Date(), sections: [{ id: 'summary', sectionTitle: 'KPIs', fields: [{ label: 'Gap', dataKey: 'stats.collectionGap', format: 'currency' }] }] };
        const view = buildTemplateView(entry, stored);
        assert.equal(view.isCustom, true);
        assert.equal(view.name, 'Custom');
        assert.equal(view.sections[0].sectionTitle, 'KPIs');
        assert.equal(view.sections[1].fields.length, 4, 'missing stored section falls back to default');
    });

    it('scopes to the session company and rejects missing or invalid ids', () => {
        assert.equal(resolveCompanyId({ companyId: '507f1f77bcf86cd799439011' }), '507f1f77bcf86cd799439011');
        assert.equal(resolveCompanyId({ type: 'user' }), null);
        assert.equal(resolveCompanyId({ companyId: { $ne: null } }), null);
        assert.equal(resolveCompanyId(undefined), null);
    });
});

describe('Report templates: CSV rows', () => {
    it('exports numbers raw and fills table sections from the context', () => {
        const view = buildTemplateView(entry, null);
        const rows = buildReportRows(view, {
            period: '11-2026',
            stats: { totalRevenue: 1250000, activeDevices: 12, pendingPayments: 3, totalInvoiced: 5000000, collectionGap: 0 },
            recentPayments: [{ device: 'ABC12', amount: 30000, status: 'APPROVED', date: '2026-11-24' }],
        });
        assert.deepEqual(rows[0], ['Reporte Resumen del Panel Principal', '11-2026']);
        assert.ok(rows.some((r) => r[0] === 'Ingresos Totales' && r[1] === 1250000));
        assert.ok(rows.some((r) => r[0] === 'Cartera Pendiente' && r[1] === 0));
        assert.ok(rows.some((r) => r.join('|') === 'ABC12|30000|APPROVED|2026-11-24'));
    });

    it('marks empty tables instead of failing', () => {
        const rows = buildReportRows(buildTemplateView(entry, null), { period: '2026', stats: {} });
        assert.ok(rows.some((r) => r[0] === 'Sin registros en este período'));
    });
});
