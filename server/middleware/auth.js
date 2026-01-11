import authService from '../services/authService.js';

/**
 * Middleware to verify JWT token (Admin or Device access)
 */
export const authenticate = async (req, res, next) => {
    try {
        const token = req.headers.authorization?.replace('Bearer ', '');

        if (!token) {
            return res.status(401).json({
                success: false,
                error: 'No authentication token provided',
            });
        }

        const decoded = authService.verifyToken(token);
        req.auth = decoded;

        next();
    } catch (error) {
        return res.status(401).json({
            success: false,
            error: 'Invalid or expired token',
        });
    }
};

/**
 * Middleware to check if user is admin
 */
export const requireAdmin = async (req, res, next) => {
    try {
        if (req.auth.type !== 'admin') {
            return res.status(403).json({
                success: false,
                error: 'Admin access required',
            });
        }

        const user = await authService.getUserById(req.auth.userId);

        if (!user || user.role !== 'admin') {
            return res.status(403).json({
                success: false,
                error: 'Admin privileges required',
            });
        }

        req.user = user;
        next();
    } catch (error) {
        return res.status(403).json({
            success: false,
            error: 'Authorization failed',
        });
    }
};

/**
 * Middleware to check device access
 */
export const requireDeviceAccess = (req, res, next) => {
    const { deviceId } = req.params;

    // Admin can access any device
    if (req.auth.type === 'admin') {
        return next();
    }

    // Device access must match the requested device
    if (req.auth.type === 'device' && req.auth.deviceId === deviceId) {
        return next();
    }

    return res.status(403).json({
        success: false,
        error: 'Access denied to this device',
    });
};

/**
 * Middleware to check permission
 */
export const requirePermission = (permission) => {
    return async (req, res, next) => {
        try {
            if (req.auth.type !== 'admin') {
                return res.status(403).json({
                    success: false,
                    error: 'Admin access required',
                });
            }

            const user = await authService.getUserById(req.auth.userId);

            if (!authService.hasPermission(user, permission)) {
                return res.status(403).json({
                    success: false,
                    error: `Permission '${permission}' required`,
                });
            }

            req.user = user;
            next();
        } catch (error) {
            return res.status(403).json({
                success: false,
                error: 'Authorization failed',
            });
        }
    };
};
