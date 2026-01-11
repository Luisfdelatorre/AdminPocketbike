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
const verifyDevicePin = async (req, res) => {
    try {
        const { deviceId, pin } = req.body;

        if (!deviceId || !pin) {
            return res.status(400).json({
                success: false,
                error: 'Device ID and PIN are required',
            });
        }

        const result = await authService.verifyDevicePin(deviceId, pin);

        res.json({
            success: true,
            data: {
                deviceId: result.access.deviceId,
                token: result.token,
                expiresAt: result.access.expiresAt,
            },
        });
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

export default {
    register,
    login,
    verifyDevicePin,
    createDevicePin,
    getMe,
    verifyToken
};
