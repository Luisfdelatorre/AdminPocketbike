import mongoose from 'mongoose';

const settingSchema = new mongoose.Schema({
    key: {
        type: String,
        required: true,
        unique: true,
        trim: true,
        index: true
    },
    value: {
        type: mongoose.Schema.Types.Mixed,
        required: true
    },
    description: {
        type: String,
        trim: true
    }
}, {
    timestamps: true
});

export const Setting = mongoose.model('Setting', settingSchema);
export default Setting;
