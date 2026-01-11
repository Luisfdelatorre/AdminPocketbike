import mongoose from 'mongoose';

const contractSchema = new mongoose.Schema({
    contractId: {
        type: String,
        required: true,
        unique: true,
        index: true,
    },
    deviceId: {
        type: Number,
        required: true,
        index: true,
    },
    // Contract details
    dailyRate: {
        type: Number, // Amount in cents (e.g., 3000000 = 30,000 COP)
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
        type: String,
        enum: ['ACTIVE', 'COMPLETED', 'CANCELLED', 'SUSPENDED'],
        default: 'ACTIVE',
        index: true,
    },
    // Tracking
    totalAmount: {
        type: Number, // Total contract value (dailyRate * contractDays) in cents
        required: true,
    },
    paidAmount: {
        type: Number, // Total paid so far in cents
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
}, {
    timestamps: true,
});

// Virtual for completion percentage
contractSchema.virtual('completionPercentage').get(function () {
    return (this.paidDays / this.contractDays) * 100;
});

// Compound index for device + date range
contractSchema.index({ deviceId: 1, startDate: 1 });
contractSchema.index({ status: 1, endDate: 1 });

export const Contract = mongoose.model('Contract', contractSchema);
