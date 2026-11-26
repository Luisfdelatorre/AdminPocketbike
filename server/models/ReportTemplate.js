import mongoose from 'mongoose';
import { REPORT_FIELD_FORMATS } from '../constants/reportTemplates.js';

/**
 * Per-company customization of a report template from REPORT_TEMPLATE_CATALOG.
 * Only created when an admin saves a customization; absence means "use the default".
 */
const reportFieldSchema = new mongoose.Schema({
    label: { type: String, required: true, trim: true },
    dataKey: { type: String, required: true, trim: true },
    format: { type: String, enum: REPORT_FIELD_FORMATS, default: 'text' },
}, { _id: false });

const reportSectionSchema = new mongoose.Schema({
    id: { type: String, required: true, trim: true },
    sectionTitle: { type: String, trim: true, default: '' },
    fields: [reportFieldSchema],
}, { _id: false });

const reportTemplateSchema = new mongoose.Schema({
    companyId: { type: mongoose.Schema.Types.ObjectId, ref: 'Company', required: true },
    key: { type: String, required: true, lowercase: true, trim: true },
    name: { type: String, required: true, trim: true },
    sections: [reportSectionSchema],
    updatedBy: { type: String, default: null },
}, { timestamps: true });

reportTemplateSchema.index({ companyId: 1, key: 1 }, { unique: true });

export const ReportTemplate = mongoose.models.ReportTemplate || mongoose.model('ReportTemplate', reportTemplateSchema);
export default ReportTemplate;
