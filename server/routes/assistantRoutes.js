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
 * GET /api/v1/ai/diagnostics
 * Development-only Prompt Caching & catalog hash metrics.
 */
router.get('/diagnostics', verifyToken, assistantController.getAssistantDiagnostics);

/**
 * GET & POST /api/v1/assistant/query
 * Resolve an assistant query (demo data only, no database access).
 */
router.get('/query', verifyToken, assistantController.queryAssistant);
router.post('/query', verifyToken, assistantController.queryAssistant);

export default router;
