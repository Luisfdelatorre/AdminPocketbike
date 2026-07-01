import authService from '../services/authService.js';

/**
 * Register a new admin user (requires existing admin)
 */
const register = async (req, res) => {
    try {
        const { email, password, name, role, permissions } = req.body;

        if (!email || !password || !name) {
            return res.status(400).json({
                success: false,
                error: 'Email, password, and name are required',
            });
        }

        const user = await authService.registerUser({
            email,
            password,
            name,
            role: role || 'viewer',
            permissions: permissions || [],
        });

        res.json({
            success: true,
            data: user,
        });
    } catch (error) {
        console.error('Register error:', error);
        res.status(400).json({
            success: false,
            error: error.message,
        });
    }
};

/**
 * Admin login with email/password
 */
const login = async (req, res) => {
    try {
        const { email, password } = req.body;

        if (!email || !password) {
            return res.status(400).json({
                success: false,
                error: 'Email and password are required',
            });
        }

        const result = await authService.loginUser(email, password);

        // Forward Traccar cookies if present
        if (result.traccarCookies && Array.isArray(result.traccarCookies)) {
            result.traccarCookies.forEach(cookie => {
                // Parse simple cookie string to get name, value and options? 
                // Or just blindly forward as Set-Cookie?
                // Express res.append('Set-Cookie', cookie) works for multiple cookies
                res.append('Set-Cookie', cookie);
            });
        }

        res.json({
            success: true,
            data: result,
        });
    } catch (error) {
        console.error('Login error:', error);
        res.status(401).json({
            success: false,
            error: error.message,
        });
    }
};

/**
 * Verify device PIN and get access token
 */
const authenticateDevice = async (req, res) => {
    try {
        const { deviceIdName, pin } = req.body;

        if (!deviceIdName || !pin) {
            return res.status(400).json({
                success: false,
                error: 'Device ID and PIN are required',
            });
        }

        const result = await authService.verifyDevicePin(deviceIdName, pin);

        res.json(result);
    } catch (error) {
        console.error('Device PIN error:', error);
        res.status(401).json({
            success: false,
            error: error.message,
        });
    }
};

/**
 * Create a new device PIN (admin only)
 */
const createDevicePin = async (req, res) => {
    try {
        const { deviceId, pin, accessType, expiresIn, maxUses } = req.body;

        if (!deviceId || !pin) {
            return res.status(400).json({
                success: false,
                error: 'Device ID and PIN are required',
            });
        }

        const access = await authService.createDeviceAccess({
            deviceId,
            pin,
            accessType: accessType || 'temporary',
            expiresIn: expiresIn || 30,
            maxUses: maxUses || null,
            createdBy: req.auth.userId,
        });

        res.json({
            success: true,
            data: {
                deviceId: access.deviceId,
                accessType: access.accessType,
                expiresAt: access.expiresAt,
                maxUses: access.maxUses,
            },
        });
    } catch (error) {
        console.error('Create device PIN error:', error);
        res.status(400).json({
            success: false,
            error: error.message,
        });
    }
};

/**
 * Get current user info
 */
const getMe = async (req, res) => {
    try {
        if (req.auth.type === 'admin') {
            const user = await authService.getUserById(req.auth.userId);
            res.json({
                success: true,
                data: {
                    type: 'admin',
                    user,
                },
            });
        } else {
            res.json({
                success: true,
                data: {
                    type: 'device',
                    deviceId: req.auth.deviceId,
                },
            });
        }
    } catch (error) {
        console.error('Get user info error:', error);
        res.status(500).json({
            success: false,
            error: error.message,
        });
    }
};

/**
 * Verify if token is still valid
 */
const verifyToken = async (req, res) => {
    try {
        const { token } = req.body;

        if (!token) {
            return res.status(400).json({
                success: false,
                error: 'Token is required',
            });
        }

        const decoded = authService.verifyToken(token);

        res.json({
            success: true,
            data: {
                valid: true,
                payload: decoded,
            },
        });
    } catch (error) {
        res.json({
            success: false,
            data: {
                valid: false,
            },
        });
    }
};

/**
 * Switch active company for the current user
 */
const switchCompany = async (req, res) => {
    try {
        const { targetCompanyId } = req.body;
        
        if (!targetCompanyId) {
            return res.status(400).json({ success: false, error: 'Target company ID is required' });
        }

        const user = await authService.getUserById(req.auth.userId);
        if (!user) {
            return res.status(404).json({ success: false, error: 'User not found' });
        }

        // Check if user has access to target company
        let hasAccess = user.isSuperAdmin;
        
        if (!hasAccess && user.accessibleCompanies) {
            const accessibleStr = user.accessibleCompanies.map(id => id.toString());
            hasAccess = accessibleStr.includes(targetCompanyId.toString());
        }

        // Also check if it's their primary company
        if (!hasAccess && user.companyId && user.companyId.toString() === targetCompanyId.toString()) {
            hasAccess = true;
        }

        if (!hasAccess) {
            return res.status(403).json({ success: false, error: 'Not authorized to access this company' });
        }

        // Fetch company name
        const { Company } = await import('../models/Company.js');
        const company = await Company.findById(targetCompanyId);
        if (!company || !company.isActive) {
            return res.status(404).json({ success: false, error: 'Company not found or inactive' });
        }

        // Generate new token
        const token = authService.generateToken({
            userId: user.userId,
            email: user.email,
            role: user.role,
            companyId: company._id,
            companyName: company.name,
            isSuperAdmin: user.isSuperAdmin,
            type: 'user'
        });

        res.json({
            success: true,
            data: {
                token,
                companyId: company._id,
                companyName: company.name
            }
        });

    } catch (error) {
        console.error('Switch company error:', error);
        res.status(500).json({ success: false, error: 'Failed to switch company' });
    }
};

export default {
    register,
    login,
    authenticateDevice,
    createDevicePin,
    getMe,
    verifyToken,
    switchCompany
};
