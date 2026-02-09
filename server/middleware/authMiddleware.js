import authService from '../services/authService.js';

export const verifyToken = (req, res, next) => {
    const authHeader = req.headers.authorization;

    if (!authHeader || !authHeader.startsWith('Bearer ')) {
        return res.status(401).json({ error: 'No token provided' });
    }

    const token = authHeader.split(' ')[1];

    try {
        const decoded = authService.verifyToken(token);

        // Attach to req.auth for generic use
        req.auth = decoded;

        // Also attach to req.paymentAuth if it's a device token, for compatibility with user snippet logic
        if (decoded.deviceIdName) {
            console.log('Device ID Name:', decoded);
            req.paymentAuth = {
                deviceIdName: decoded.deviceIdName,
                contractId: decoded.contractId,
                deviceId: decoded.deviceId // Numeric
            };
        }

        next();
    } catch (error) {
        return res.status(401).json({ error: 'Invalid token' });
    }
};
