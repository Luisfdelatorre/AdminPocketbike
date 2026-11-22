import express from 'express';
import { verifyToken } from '../middleware/authMiddleware.js';
import * as assistantController from '../controllers/assistantController.js';

const router = express.Router();

/**
 * POST /api/v1/assistant/query
 * Resolve an assistant query (demo data only, no database access).
 */
router.post('/query', verifyToken, assistantController.queryAssistant);

export default router;
