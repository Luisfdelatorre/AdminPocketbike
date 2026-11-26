import mongoose from 'mongoose';
import reportTemplateRepository from '../repositories/reportTemplateRepository.js';
import {
    REPORT_TEMPLATE_CATALOG,
    REPORT_FIELD_FORMATS,
    REPORT_LIMITS,
} from '../constants/reportTemplates.js';

export class ReportTemplateValidationError extends Error {
    constructor(message) {
        super(message);
        this.name = 'ReportTemplateValidationError';
        this.statusCode = 400;
    }
}

/**
 * Templates are always scoped to the company of the active session token.
 * Switching company issues a new token, so SuperAdmins edit the company they
 * are currently viewing; a request without a valid company is rejected.
 */
export const resolveCompanyId = (auth) => {
    const companyId = auth?.companyId;
    return companyId && mongoose.isValidObjectId(companyId) ? String(companyId) : null;
};

const fail = (message) => { throw new ReportTemplateValidationError(message); };

const cleanText = (value, max, fieldName) => {
    if (typeof value !== 'string') fail(`${fieldName} must be a string`);
    const text = value.replace(/[\u0000-\u001F\u007F]/g, '').trim();
    if (text.length > max) fail(`${fieldName} exceeds ${max} characters`);
    return text;
};

export const getCatalogEntry = (key) => {
    const cleanKey = String(key || '').toLowerCase();
    return Object.prototype.hasOwnProperty.call(REPORT_TEMPLATE_CATALOG, cleanKey)
        ? REPORT_TEMPLATE_CATALOG[cleanKey]
        : null;
};

/**
 * Validate an admin-submitted template against the catalog whitelist.
 * Returns the sanitized { name, sections } to persist.
 */
export function validateTemplatePayload(key, payload) {
    const entry = getCatalogEntry(key);
    if (!entry) fail(`Unknown report template '${key}'`);
    if (!payload || typeof payload !== 'object') fail('Template payload is required');

    const name = payload.name === undefined
        ? entry.name
        : cleanText(payload.name, REPORT_LIMITS.nameMax, 'name') || entry.name;

    if (!Array.isArray(payload.sections)) fail('sections must be an array');

    const sections = entry.sections.map((catalogSection) => {
        const submitted = payload.sections.find((s) => s && s.id === catalogSection.id);
        if (!submitted) {
            return {
                id: catalogSection.id,
                sectionTitle: catalogSection.sectionTitle,
                fields: catalogSection.fields.map((f) => ({ ...f })),
            };
        }

        const sectionTitle = submitted.sectionTitle === undefined
            ? catalogSection.sectionTitle
            : cleanText(submitted.sectionTitle, REPORT_LIMITS.sectionTitleMax, 'sectionTitle');

        if (!Array.isArray(submitted.fields)) fail(`fields of section '${catalogSection.id}' must be an array`);
        if (submitted.fields.length === 0) fail(`section '${catalogSection.id}' needs at least one field`);
        if (submitted.fields.length > REPORT_LIMITS.fieldsPerSectionMax) {
            fail(`section '${catalogSection.id}' exceeds ${REPORT_LIMITS.fieldsPerSectionMax} fields`);
        }

        const seen = new Set();
        const fields = submitted.fields.map((field) => {
            if (!field || typeof field !== 'object') fail('Each field must be an object');
            const dataKey = String(field.dataKey || '');
            if (!Object.prototype.hasOwnProperty.call(catalogSection.allowedFields, dataKey)) {
                fail(`Field '${dataKey}' is not allowed in section '${catalogSection.id}'`);
            }
            if (seen.has(dataKey)) fail(`Field '${dataKey}' is duplicated in section '${catalogSection.id}'`);
            seen.add(dataKey);

            const format = field.format ?? catalogSection.allowedFields[dataKey];
            if (!REPORT_FIELD_FORMATS.includes(format)) fail(`Invalid format '${format}' for '${dataKey}'`);

            const label = cleanText(field.label ?? '', REPORT_LIMITS.labelMax, 'label');
            if (!label) fail(`Field '${dataKey}' needs a label`);

            return { label, dataKey, format };
        });

        return { id: catalogSection.id, sectionTitle, fields };
    });

    return { name, sections };
}

/**
 * Merge a stored customization (if any) over the catalog default and attach
 * the editing metadata the client needs (section type and allowed fields).
 */
export function buildTemplateView(entry, stored) {
    return {
        key: entry.key,
        module: entry.module,
        description: entry.description,
        name: stored?.name || entry.name,
        isCustom: Boolean(stored),
        updatedAt: stored?.updatedAt || null,
        sections: entry.sections.map((catalogSection) => {
            const storedSection = stored?.sections?.find((s) => s.id === catalogSection.id);
            const fields = (storedSection?.fields || catalogSection.fields)
                .filter((f) => Object.prototype.hasOwnProperty.call(catalogSection.allowedFields, f.dataKey));
            return {
                id: catalogSection.id,
                type: catalogSection.type,
                sectionTitle: storedSection ? storedSection.sectionTitle : catalogSection.sectionTitle,
                allowedFields: catalogSection.allowedFields,
                fields: fields.map(({ label, dataKey, format }) => ({ label, dataKey, format })),
            };
        }),
    };
}

class ReportTemplateService {
    async listTemplates(companyId) {
        const stored = await reportTemplateRepository.findByCompany(companyId);
        const byKey = new Map(stored.map((t) => [t.key, t]));
        return Object.values(REPORT_TEMPLATE_CATALOG).map((entry) => buildTemplateView(entry, byKey.get(entry.key)));
    }

    async getTemplate(companyId, key) {
        const entry = getCatalogEntry(key);
        if (!entry) return null;
        const stored = await reportTemplateRepository.findByCompanyAndKey(companyId, entry.key);
        return buildTemplateView(entry, stored);
    }

    async saveTemplate(companyId, key, payload, userId) {
        const entry = getCatalogEntry(key);
        const clean = validateTemplatePayload(key, payload);
        const stored = await reportTemplateRepository.upsert(companyId, entry.key, {
            ...clean,
            updatedBy: userId ? String(userId) : null,
        });
        return buildTemplateView(entry, stored);
    }

    async resetTemplate(companyId, key) {
        const entry = getCatalogEntry(key);
        if (!entry) fail(`Unknown report template '${key}'`);
        await reportTemplateRepository.deleteByCompanyAndKey(companyId, entry.key);
        return buildTemplateView(entry, null);
    }
}

export default new ReportTemplateService();
