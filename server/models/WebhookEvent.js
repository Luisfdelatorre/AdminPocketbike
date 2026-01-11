import mongoose from 'mongoose';

const webhookEventSchema = new mongoose.Schema({
    eventId: {
        type: String,
        required: true,
        unique: true, // Ensures idempotency
        index: true,
    },
    eventType: {
        type: String,
        required: true,
    },
    transactionId: {
        type: String,
        index: true,
    },
    paymentReference: {
        type: String,
        index: true,
    },
    status: {
        type: String,
    },
    signature: {
        type: String,
    },
    payload: {
        type: mongoose.Schema.Types.Mixed, // Full webhook payload
        required: true,
    },
    processed: {
        type: Boolean,
        default: false,
        index: true,
    },
    processedAt: {
        type: Date,
    },
}, {
    timestamps: true,
});

// Index for finding unprocessed events
webhookEventSchema.index({ processed: 1, createdAt: 1 });

const transactionVerificationSchema = new mongoose.Schema({
    paymentReference: {
        type: String,
        required: true,
        index: true,
    },
    verificationType: {
        type: String,
        enum: ['manual', 'scheduled', 'webhook'],
        default: 'manual',
    },
    wompiStatus: {
        type: String,
    },
    localStatus: {
        type: String,
    },
    match: {
        type: Boolean,
    },
    response: {
        type: mongoose.Schema.Types.Mixed, // Full verification response
    },
}, {
    timestamps: true,
});

// Index for verification history queries
transactionVerificationSchema.index({ paymentReference: 1, createdAt: -1 });

export const WebhookEvent = mongoose.model('WebhookEvent', webhookEventSchema);
export const TransactionVerification = mongoose.model('TransactionVerification', transactionVerificationSchema);
