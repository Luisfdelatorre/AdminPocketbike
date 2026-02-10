import jwt from 'jsonwebtoken';
import { nanoid } from 'nanoid';
import { User } from '../models/User.js';
import { DeviceAccess } from '../models/DeviceAccess.js';
import { Contract } from '../models/index.js';
import { resolveDeviceId } from '../utils/deviceResolver.js';
import contractRepository from '../repositories/contractRepository.js';
import paymentService from './paymentService.js';
import { Transaction } from '../config/config.js';

const { JWT_SECRET, JWT_EXPIRY } = Transaction;

export class AuthService {
    async registerUser(userData) {
        const { email, password, name, role, permissions } = userData;

        // Check if user exists
        const existingUser = await User.findOne({ email });
        if (existingUser) {
            throw new Error('User already exists');
        }

        // Create new user
        const user = new User({
            userId: nanoid(),
            email,
            passwordHash: await this.hashPassword(password), // Helper method needed or direct hash here if not exists
            name,
            role: role || 'viewer',
            permissions: permissions || [],
        });

        await user.save();
        return user;
    }

    /**
     * Helper to hash password if not using schema middleware explicitly for manual updates
     * But schema has pre-save hook for passwordHash field if modified.
     */
    async hashPassword(password) {
        // Since the schema handles hashing on save if 'passwordHash' is modified,
        // we can just return the plain password here and let the schema do it? 
        // NO, the schema expects 'passwordHash' field to be set. 
        // The schema pre-save checks: if (this.isModified('passwordHash')) ... hash it.
        // So we can pass the plain password to the model's passwordHash field, and the hook will hash it.
        return password;
    }

    /**
     * Login user with Traccar fallback/sync
     */
    async loginUser(email, password) {
        let traccarUser = null;
        let traccarCookies = null;

        /* try {
             // 1. Try Traccar Login
             const gpsService = (await import('./traccarService.js')).default;
             const traccarResponse = await gpsService.login(email, password);
             traccarUser = traccarResponse.data;
             traccarCookies = traccarResponse.headers['set-cookie'];
             console.log('✅ Traccar login successful for:', email);
         } catch (error) {
             console.log('⚠️ Traccar login failed/skipped:', error.message);
             // Continue to local auth attempt
         }*/

        // 2. Find or Create/Update Local User
        let user = await User.findOne({ email });

        /* if (traccarUser) {
             if (!user) {
                 // Create local user from Traccar data
                 console.log('👤 Creating new local user from Traccar profile');
                 user = new User({
                     userId: nanoid(),
                     email: traccarUser.email,
                     name: traccarUser.name || traccarUser.email.split('@')[0],
                     passwordHash: password, // Schema will hash this
                     role: traccarUser.administrator ? 'admin' : 'viewer',
                     isActive: true
                 });
             } else {
                 // Update existing user with latest info/password
                 user.passwordHash = password; // Update local password to match Traccar
                 if (traccarUser.name) user.name = traccarUser.name;
                 if (traccarUser.administrator && user.role !== 'admin') user.role = 'admin'; // Sync admin status? Optional.
             }
             await user.save();
         }*/

        if (!user) {
            throw new Error('Invalid credentials');
        }

        // 3. Validate Password (if not just authenticated via Traccar)
        // If we didn't get traccarUser, we MUST check password locally
        if (!traccarUser) {
            const isMatch = await user.comparePassword(password);
            if (!isMatch) {
                throw new Error('Invalid credentials');
            }
        }

        // 4. Update stats
        user.lastLogin = new Date();
        await user.save();

        // 5. Generate Token
        const token = this.generateToken({
            userId: user.userId,
            email: user.email,
            role: user.role,
            companyId: user.companyId,
            companyName: user.companyName,
            isSuperAdmin: user.isSuperAdmin,
            type: 'user'
        });

        return {
            user: {
                userId: user.userId,
                email: user.email,
                role: user.role,
                permissions: user.permissions,
                isSuperAdmin: user.isSuperAdmin
            },
            token,
            traccarCookies: traccarCookies // Return the array of cookies
        };
    }
    async verifyDevicePin(deviceIdName, pin) {
        // Find ACTIVE contract for this device
        // We use findOne because a device should only have ONE active contract at a time
        const contract = await Contract.findOne({
            deviceIdName,
            status: 'ACTIVE',
        });


        if (!contract) {
            throw new Error('No active contract found for this device');
        }

        // Validate PIN
        const isValid = await contract.comparePin(pin);

        if (isValid) {
            // Generate token for device access
            // We include contractId in the token for context
            const token = this.generateToken({
                deviceId: contract.deviceId, // Numeric ID
                deviceIdName: contract.deviceIdName,
                contractId: contract.contractId,
                companyId: contract.companyId,
                type: 'device',
            }, '24h');

            let paymentData = null;

            paymentData = await paymentService.calculatePaymentStatus(contract);

            return {
                success: true,
                token,
                paymentData
            };
        }

        throw new Error('Invalid PIN');
    }

    /**
     * Generate JWT token
     */
    generateToken(payload, expiresIn = null) {
        return jwt.sign(
            payload,
            JWT_SECRET,
            { expiresIn: expiresIn || JWT_EXPIRY }
        );
    }

    /**
     * Verify JWT token
     */
    verifyToken(token) {
        try {
            return jwt.verify(token, JWT_SECRET);
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
