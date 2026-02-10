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

        // Also attach to req.paymentAuth if it's a device token, for compatibility with user snippet logic
        if (decoded.deviceIdName) {
            req.paymentAuth = {
                deviceIdName: decoded.deviceIdName,
                contractId: decoded.contractId,
                deviceId: decoded.deviceId,
                companyId: decoded.companyId,
            };
        }

        next();
    } catch (error) {
        return res.status(401).json({ error: 'Invalid token' });
    }
};
