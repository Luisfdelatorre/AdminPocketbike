import mongoose from 'mongoose';
import bcrypt from 'bcryptjs';

const deviceAccessSchema = new mongoose.Schema({
    deviceId: {
        type: String,
        required: true,
        index: true,
    },
    pinHash: {
        type: String,
        required: true,
    },
    accessType: {
        type: String,
        enum: ['temporary', 'permanent'],
        default: 'temporary',
    },
    expiresAt: {
        type: Date,
        index: true,
    },
    maxUses: {
        type: Number,
        default: null, // null = unlimited
    },
    usedCount: {
        type: Number,
        default: 0,
    },
    isActive: {
        type: Boolean,
        default: true,
        index: true,
    },
    createdBy: {
        type: String, // userId of admin who created it
    },
    lastUsed: {
        type: Date,
    },
}, {
    timestamps: true,
});

// Hash PIN before saving
deviceAccessSchema.pre('save', async function (next) {
    if (!this.isModified('pinHash')) {
        return next();
    }

    try {
        const salt = await bcrypt.genSalt(10);
        this.pinHash = await bcrypt.hash(this.pinHash, salt);
        next();
    } catch (error) {
        next(error);
    }
});

// Method to compare PIN
deviceAccessSchema.methods.comparePin = async function (candidatePin) {
    return await bcrypt.compare(candidatePin, this.pinHash);
};

// Method to check if access is valid
deviceAccessSchema.methods.isValid = function () {
    if (!this.isActive) return false;

    // Check expiration
    if (this.expiresAt && new Date() > this.expiresAt) return false;

    // Check max uses
    if (this.maxUses && this.usedCount >= this.maxUses) return false;

    return true;
};

// Compound index for active device access
deviceAccessSchema.index({ deviceId: 1, isActive: 1 });

export const DeviceAccess = mongoose.model('DeviceAccess', deviceAccessSchema);
