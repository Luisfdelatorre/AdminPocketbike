import mongoose from 'mongoose';

const deviceSchema = new mongoose.Schema({
    _id: { type: Number, required: true }, // External system ID
    deviceName: {
        type: String,
        required: true,
    },
    deviceType: {
        type: String,
        default: 'pocketbike',
    },
    // Payment info
    nequiNumber: {
        type: String,
        default: null,
    },
    // SIM card info
    simCardNumber: {
        type: String,
        default: null,
    },
    // Status
    isActive: {
        type: Boolean,
        default: true,
        index: true,
    },
    status: {
        type: String,
        enum: ['active', 'inactive', 'maintenance'],
        default: 'active',
    },
    isDeleted: {
        type: Boolean,
        default: false,
        index: true
    },
    // Additional info
    notes: {
        type: String,
        default: '',
    },
    model: {
        type: String,
        default: null,
    },
    gpsId: {
        type: Number,
        unique: true,
        sparse: true, // Allow null/undefined for devices not from GPS
    },
    groupId: {
        type: Number,
        default: null,
    }

}, {
    timestamps: true,
});

export const Device = mongoose.model('Device', deviceSchema);
