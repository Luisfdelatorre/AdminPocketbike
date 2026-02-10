import mongoose from 'mongoose';
import bcrypt from 'bcryptjs';

const contractSchema = new mongoose.Schema({
    contractId: {
        type: String,
        required: true,
        unique: true,
        index: true,
    },
    deviceIdName: {
        type: String,
        required: true,
        index: true,
    },
    deviceId: {
        type: String,
        required: true,
        index: true,
    },
    // Company association
    companyId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Company',
        required: true,
        index: true,
    },
    companyName: {
        type: String,
    },
    // Contract details
    dailyRate: {
        type: Number, // Amount in COP (e.g., 30000 = 30,000 COP)
        required: true,
    },
    contractDays: {
        type: Number,
        default: 500,
        required: true,
    },
    startDate: {
        type: String, // YYYY-MM-DD format
        required: true,
        index: true,
    },
    endDate: {
        type: String, // YYYY-MM-DD format (calculated: startDate + contractDays)
        required: true,
        index: true,
    },
    // Status
    status: {
        type: String, // 'ACTIVE', 'COMPLETED', 'CANCELLED', 'SUSPENDED'
        enum: ['ACTIVE', 'COMPLETED', 'CANCELLED', 'SUSPENDED'],
        default: 'ACTIVE',
        index: true,
    },
    // Tracking
    totalAmount: {
        type: Number, // Total contract value (dailyRate * contractDays) in COP
        required: true,
    },
    paidAmount: {
        type: Number, // Total paid so far in COP
        default: 0,
    },
    paidDays: {
        type: Number, // Number of days paid
        default: 0,
    },
    remainingDays: {
        type: Number, // Days left to pay
        default: 500,
    },
    // Customer info
    customerName: {
        type: String,
    },
    customerEmail: {
        type: String,
    },
    customerPhone: {
        type: String,
    },
    customerDocument: {
        type: String, // ID/Document number
    },
    // Notes
    notes: {
        type: String,
    },
    // Secure Access
    devicePin: {
        type: String, // Hashed PIN for payment app authentication
        required: true,
    },
    // Rules
    freeDaysLimit: {
        type: Number,
        default: 4, // Limit for monthly free days
    },
    reactivationRule: {
        type: String,
        enum: ['ALWAYS', 'SAME_OR_AFTER', 'DAY_BEFORE'],
        default: 'SAME_OR_AFTER',
    },
}, {
    timestamps: true,
});

// Hash PIN before saving
contractSchema.pre('save', async function (next) {
    if (!this.isModified('devicePin') || !this.devicePin) {
        return next();
    }

    try {
        const salt = await bcrypt.genSalt(10);
        this.devicePin = await bcrypt.hash(this.devicePin, salt);
        next();
    } catch (error) {
        next(error);
    }
});

// Compare PIN method
contractSchema.methods.comparePin = async function (candidatePin) {
    return await bcrypt.compare(candidatePin, this.devicePin);
};

// Virtual for completion percentage
contractSchema.virtual('completionPercentage').get(function () {
    return (this.paidDays / this.contractDays) * 100;
});

// Compound index for device + date range
contractSchema.index({ deviceIdName: 1, startDate: 1 });
contractSchema.index({ status: 1, endDate: 1 });

export const Contract = mongoose.model('Contract', contractSchema);
