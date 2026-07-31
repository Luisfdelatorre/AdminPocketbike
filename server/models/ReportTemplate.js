import mongoose from 'mongoose';

const reportFieldSchema = new mongoose.Schema({
    label: {
        type: String,
        required: true,
        trim: true
    },
    dataKey: {
        type: String,
        required: true,
        trim: true
    },
    format: {
        type: String,
        enum: ['currency', 'number', 'text', 'date'],
        default: 'text'
    }
}, { _id: false });

const reportSectionSchema = new mongoose.Schema({
    sectionTitle: {
        type: String,
        trim: true,
        default: ''
    },
    type: {
        type: String,
        enum: ['stats', 'table'],
        default: 'stats'
    },
    fields: [reportFieldSchema]
}, { _id: false });

const reportTemplateSchema = new mongoose.Schema({
    key: {
        type: String,
        required: true,
        unique: true,
        lowercase: true,
        trim: true,
        index: true
    },
    name: {
        type: String,
        required: true,
        trim: true
    },
    module: {
        type: String,
        required: true,
        trim: true
    },
    description: {
        type: String,
        trim: true,
        default: ''
    },
    sections: [reportSectionSchema],
    isDefault: {
        type: Boolean,
        default: true
    },
    updatedBy: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User'
    }
}, { timestamps: true });

export const ReportTemplate = mongoose.model('ReportTemplate', reportTemplateSchema);
export default ReportTemplate;
