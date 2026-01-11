import jwt from 'jsonwebtoken';
import { nanoid } from 'nanoid';
import { User } from '../models/User.js';
import { DeviceAccess } from '../models/DeviceAccess.js';
import { config } from '../config/config.js';

export class AuthService {
    /**
     * Register a new admin user
     */
    async registerUser({ email, password, name, role = 'viewer', permissions = [] }) {
        // Check if user already exists
        const existingUser = await User.findOne({ email });
        if (existingUser) {
            throw new Error('User with this email already exists');
        }

        const userId = `user-${nanoid(10)}`;

        const user = await User.create({
            userId,
            email,
            passwordHash: password, // Will be hashed by pre-save hook
            name,
            role,
            permissions: role === 'admin' ? ['all'] : permissions,
        });

        return user;
    }

    /**
     * Login user (admin)
     */
    async loginUser(email, password) {
        const user = await User.findOne({ email, isActive: true });

        if (!user) {
            throw new Error('Invalid credentials');
        }

        const isPasswordValid = await user.comparePassword(password);

        if (!isPasswordValid) {
            throw new Error('Invalid credentials');
        }

        // Update last login
        user.lastLogin = new Date();
        await user.save();

        // Generate JWT token
        const token = this.generateToken({
            userId: user.userId,
            email: user.email,
            role: user.role,
            type: 'admin',
        });

        return {
            user,
            token,
        };
    }

    /**
     * Create device PIN access
     */
    async createDeviceAccess({
        deviceId,
        pin,
        accessType = 'temporary',
        expiresIn = 30, // days
        maxUses = null,
        createdBy
    }) {
        // Set expiration date
        const expiresAt = new Date();
        expiresAt.setDate(expiresAt.getDate() + expiresIn);

        const deviceAccess = await DeviceAccess.create({
            deviceId,
            pinHash: pin, // Will be hashed by pre-save hook
            accessType,
            expiresAt: accessType === 'permanent' ? null : expiresAt,
            maxUses,
            createdBy,
        });

        return deviceAccess;
    }

    /**
     * Verify device PIN
     */
    async verifyDevicePin(deviceId, pin) {
        const accesses = await DeviceAccess.find({
            deviceId,
            isActive: true,
        });

        for (const access of accesses) {
            if (!access.isValid()) continue;

            const isValid = await access.comparePin(pin);

            if (isValid) {
                // Update usage
                access.usedCount += 1;
                access.lastUsed = new Date();
                await access.save();

                // Generate temporary token for device access
                const token = this.generateToken({
                    deviceId: access.deviceId,
                    accessId: access._id,
                    type: 'device',
                }, '24h'); // Shorter expiration for device access

                return {
                    access,
                    token,
                };
            }
        }

        throw new Error('Invalid PIN');
    }

    /**
     * Generate JWT token
     */
    generateToken(payload, expiresIn = null) {
        return jwt.sign(
            payload,
            config.jwt.secret,
            { expiresIn: expiresIn || config.jwt.expiresIn }
        );
    }

    /**
     * Verify JWT token
     */
    verifyToken(token) {
        try {
            return jwt.verify(token, config.jwt.secret);
        } catch (error) {
            throw new Error('Invalid or expired token');
        }
    }

    /**
     * Get user by ID
     */
    async getUserById(userId) {
        return await User.findOne({ userId, isActive: true });
    }

    /**
     * Check if user has permission
     */
    hasPermission(user, permission) {
        if (user.role === 'admin' || user.permissions.includes('all')) {
            return true;
        }
        return user.permissions.includes(permission);
    }
}

export default new AuthService();
