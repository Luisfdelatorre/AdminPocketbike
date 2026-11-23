import express from 'express';
import { verifyToken } from '../middleware/authMiddleware.js';
import * as assistantController from '../controllers/assistantController.js';

const router = express.Router();

/**
 * POST /api/v1/ai/chat
 * Structured read-only action planner & template generator.
 */
router.post('/chat', verifyToken, assistantController.chatWithAssistant);

/**
 * Optional token decoder for dev-only GET endpoints so they can be opened
 * directly in the browser address bar (`https://...:5173/api/v1/ai/telemetry`)
 * while still enforcing `verifyToken` in production.
 */
const optionalVerifyTokenInDev = (req, res, next) => {
    if (process.env.NODE_ENV === 'production') {
        return verifyToken(req, res, next);
    }
    const authHeader = req.headers.authorization;
    if (authHeader || req.query.token) {
        return verifyToken(req, res, next);
    }
    return next();
};

/**
 * GET /api/v1/ai/diagnostics
 * Development-only Prompt Caching & catalog hash metrics.
 */
router.get('/diagnostics', optionalVerifyTokenInDev, assistantController.getAssistantDiagnostics);

/**
 * GET & POST /api/v1/ai/telemetry
 * Capture and inspect interaction traces & RLHF feedback for fine-tuning.
 */
router.post('/telemetry', verifyToken, assistantController.recordAssistantTelemetry);
router.get('/telemetry', optionalVerifyTokenInDev, assistantController.getAssistantTelemetry);

/**
 * GET & POST /api/v1/assistant/query
 * Resolve an assistant query (demo data only, no database access).
 */
router.get('/query', verifyToken, assistantController.queryAssistant);
router.post('/query', verifyToken, assistantController.queryAssistant);

export default router;
