import mongoose from 'mongoose';
import bcrypt from 'bcryptjs';

const userSchema = new mongoose.Schema({
    userId: {
        type: String,
        required: true,
        unique: true,
        index: true,
    },
    email: {
        type: String,
        required: true,
        unique: true,
        lowercase: true,
        trim: true,
        index: true,
    },
    passwordHash: {
        type: String,
        required: true,
    },
    name: {
        type: String,
        required: true,
    },
    role: {
        type: String,
        enum: ['admin', 'manager', 'viewer'],
        default: 'viewer',
        index: true,
    },
    permissions: [{
        type: String,
        enum: ['all', 'view_payments', 'create_contracts', 'manage_devices', 'view_reports'],
    }],
    isActive: {
        type: Boolean,
        default: true,
        index: true,
    },
    lastLogin: {
        type: Date,
    },
}, {
    timestamps: true,
});

// Hash password before saving
userSchema.pre('save', async function (next) {
    if (!this.isModified('passwordHash')) {
        return next();
    }

    try {
        const salt = await bcrypt.genSalt(10);
        this.passwordHash = await bcrypt.hash(this.passwordHash, salt);
        next();
    } catch (error) {
        next(error);
    }
});

// Method to compare password
userSchema.methods.comparePassword = async function (candidatePassword) {
    return await bcrypt.compare(candidatePassword, this.passwordHash);
};

// Remove password from JSON output
userSchema.methods.toJSON = function () {
    const obj = this.toObject();
    delete obj.passwordHash;
    return obj;
};

export const User = mongoose.model('User', userSchema);
