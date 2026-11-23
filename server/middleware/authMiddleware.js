import authService from '../services/authService.js';

export const verifyToken = (req, res, next) => {
    const authHeader = req.headers.authorization;
    let token;
    if (authHeader && authHeader.startsWith('Bearer ')) {
        token = authHeader.split(' ')[1];

    } else if (req.query.token) {
        // SSE (EventSource) often passes token in query param
        token = req.query.token;
    } else {
        return res.status(401).json({ error: 'No token provided' });
    }


    try {
        const decoded = authService.verifyToken(token);

        // Attach to req.auth for generic use
        req.auth = decoded;

        // Viewer protection logic: block mutative requests
        if (req.auth.role === 'viewer' && ['POST', 'PUT', 'DELETE', 'PATCH'].includes(req.method)) {
            // Exclude specific read-only or session endpoints like switch-company, login, and AI chat/query
            const isReadOnlyAssistant =
                req.originalUrl?.includes('/ai/chat') ||
                req.originalUrl?.includes('/assistant/query') ||
                req.path.includes('/chat') ||
                req.path.includes('/query');
            if (!req.path.includes('/switch-company') && !req.path.includes('/login') && !isReadOnlyAssistant) {
                return res.status(403).json({ success: false, error: 'Viewers are not authorized to modify data' });
            }
        }

        // Also attach to req.paymentAuth if it's a device token, for compatibility with user snippet logic
        if (decoded.deviceIdName) {
            req.paymentAuth = {
                deviceIdName: decoded.deviceIdName,
                contractId: decoded.contractId,
                schemaVersion: decoded.schemaVersion ?? 1,
                deviceId: decoded.deviceId,
                companyId: decoded.companyId,
            };
        }

        next();
    } catch (error) {
        return res.status(401).json({ error: 'Invalid token' });
    }
};

/**
 * Requires SuperAdmin privileges (global multi-company/system configuration)
 */
export const requireSuperAdmin = (req, res, next) => {
    if (!req.auth || req.auth.isSuperAdmin !== true) {
        return res.status(403).json({
            success: false,
            error: 'SuperAdmin privileges required',
        });
    }
    next();
};

/**
 * Requires Admin, Manager, or SuperAdmin role (blocks viewers and device PIN tokens)
 */
export const requireWriteRole = (req, res, next) => {
    if (!req.auth) {
        return res.status(401).json({
            success: false,
            error: 'Authentication required',
        });
    }
    if (req.auth.isSuperAdmin === true || req.auth.role === 'admin' || req.auth.role === 'manager') {
        return next();
    }
    return res.status(403).json({
        success: false,
        error: 'Admin or Manager privileges required',
    });
};
