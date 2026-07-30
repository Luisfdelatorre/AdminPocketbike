import express from 'express';
import sseController from '../controllers/sseController.js';
import { verifyToken } from '../middleware/authMiddleware.js';

const router = express.Router();

// Optional token verification middleware (if token is provided in query param or auth header)
const optionalVerifyToken = (req, res, next) => {
    if (req.headers.authorization || req.query.token) {
        return verifyToken(req, res, next);
    }
    next();
};

/**
 * GET /api/sse/subscribe
 * Subscribe to Server-Sent Events for real-time updates
 */
router.get('/subscribe', optionalVerifyToken, sseController.subscribe);

/**
 * GET /api/sse/status
 * Get SSE service status
 */
router.get('/status', sseController.getStatus);

export default router;
