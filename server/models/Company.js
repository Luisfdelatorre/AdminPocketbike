import mongoose from 'mongoose';
import { encrypt, decrypt } from '../utils/encryption.js';

const companySchema = new mongoose.Schema({
    name: {
        type: String,
        required: true,
        trim: true
    },
    nit: {
        type: String,
        unique: true,
        trim: true,
        sparse: true // Allow null/undefined, but unique if present
    },
    address: {
        type: String,
        trim: true
    },
    phone: {
        type: String,
        trim: true
    },
    email: {
        type: String,
        trim: true,
        lowercase: true
    },
    isActive: {
        type: Boolean,
        default: true
    },
    automaticInvoicing: {
        type: Boolean,
        default: false
    },
    // Branding settings
    displayName: {
        type: String,
        trim: true,
        default: 'PocketBike'
    },
    logo: {
        type: String, // Base64 or URL
        default: '/pocketbike_60x60.jpg'
    },
    automaticCutOff: {
        type: Boolean,
        default: false
    },
    curfew: {
        enabled: { type: Boolean, default: false },
        startTime: { type: String, default: '00:05' }, // formats: "HH:mm"
        endTime: { type: String, default: '04:00' }
    },
    cutOffStrategy: {
        type: Number,
        enum: [1, 2, 3], // 1: Today, 2: Yesterday, 3: Disabled
        default: 1
    },
    // GPS Service Integration
    gpsService: {
        type: String,
        enum: ['megarastreo', 'traccar'],
        default: 'megarastreo'
    },
    gpsConfig: {
        host: { type: String, trim: true },
        port: { type: Number },
        user: { type: String, trim: true },
        password: { type: String, trim: true },
        token: { type: String, trim: true }
    },
    // Wompi Service Integration
    wompiConfig: {
        publicKey: { type: String, trim: true },
        privateKey: { type: String, trim: true },
        integritySecret: { type: String, trim: true },
        eventsSecret: { type: String, trim: true }
    },
    // Default Contract Values
    contractDefaults: {
        dailyRate: { type: Number, default: 35000 },
        contractDays: { type: Number, default: 500 },
        freeDaysLimit: { type: Number, default: 4 },
        freeDayPolicy: { type: String, enum: ['FLEXIBLE', 'FIXED_WEEKDAY'], default: 'FLEXIBLE' },
        fixedFreeDayOfWeek: { type: Number, min: 0, max: 6, default: 0 }, // 0 = Sunday
        initialFee: { type: Number, default: 0 },
        emailDomain: { type: String, default: 'tumotoya.online', trim: true }
    }
}, {
    timestamps: true
});

// Encryption logic for sensitive fields
const sensitiveFields = [
    'gpsConfig.password',
    'gpsConfig.token',
    'wompiConfig.privateKey',
    'wompiConfig.integritySecret',
    'wompiConfig.eventsSecret'
];

function getDeepValue(obj, path) {
    return path.split('.').reduce((acc, part) => acc && acc[part], obj);
}

function setDeepValue(obj, path, value) {
    const parts = path.split('.');
    const last = parts.pop();
    const target = parts.reduce((acc, part) => {
        if (!acc[part]) acc[part] = {};
        return acc[part];
    }, obj);
    target[last] = value;
}

companySchema.pre('save', function (next) {
    const company = this;
    sensitiveFields.forEach(path => {
        if (company.isModified(path)) {
            const val = getDeepValue(company, path);
            if (val && !val.includes(':')) { // Only encrypt if not already encrypted
                setDeepValue(company, path, encrypt(val));
            }
        }
    });
    next();
});

// Decrypt sensitive fields after loading from DB
companySchema.post('init', function (doc) {
    sensitiveFields.forEach(path => {
        const val = getDeepValue(doc, path);
        if (val && val.includes(':')) {
            setDeepValue(doc, path, decrypt(val));
        }
    });
});

export const Company = mongoose.model('Company', companySchema);
