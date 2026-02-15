import mongoose from 'mongoose';

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
    cutOffStrategy: {
        type: Number,
        enum: [1, 2, 3], // 1: Today, 2: Yesterday, 3: Disabled
        default: 1
    }
}, {
    timestamps: true
});

export const Company = mongoose.model('Company', companySchema);
