import mongoose from 'mongoose';

const reconciliationSchema = new mongoose.Schema({
    companyId: { 
        type: mongoose.Schema.Types.ObjectId, 
        ref: 'Company', 
        default: null,
        index: true,
    },
    date: { 
        type: String, // format: YYYY-MM-DD
        required: true,
        index: true,
    },
    reconciled: { 
        type: Boolean, 
        default: false,
    },
    transactionId: {
        type: String,
        default: '',
    }
}, {
    timestamps: true
});

reconciliationSchema.index({ companyId: 1, date: 1 }, { unique: true });

export const Reconciliation = mongoose.model('Reconciliation', reconciliationSchema);
