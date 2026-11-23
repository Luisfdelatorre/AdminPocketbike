import assistantDemoService from '../services/assistantDemoService.js';
import aiAssistantService from '../services/aiAssistantService.js';
import { validateChatRequest } from '../../client/src/services/voiceAssistant/schemaValidator.js';

const MAX_TEXT_LENGTH = 500;
const RATE_LIMIT_WINDOW_MS = 60 * 1000;
const RATE_LIMIT_MAX_REQUESTS = Number(process.env.AI_RATE_LIMIT_PER_MIN) || 30;
const rateBuckets = new Map();

const checkRateLimit = (key) => {
    const now = Date.now();
    const bucket = rateBuckets.get(key);
    if (!bucket || now - bucket.windowStart > RATE_LIMIT_WINDOW_MS) {
        rateBuckets.set(key, { windowStart: now, count: 1 });
        return true;
    }
    if (bucket.count >= RATE_LIMIT_MAX_REQUESTS) {
        return false;
    }
    bucket.count += 1;
    return true;
};

const isAiDemoAllowed = () => {
    // Blocked in production unless AI_DEMO_ALLOW_PROD is explicitly set;
    // enabled when AI_DEMO_ENABLED=true (or in local non-production dev when not explicitly disabled).
    if (process.env.NODE_ENV === 'production' && process.env.AI_DEMO_ALLOW_PROD !== 'true') {
        return false;
    }
    if (process.env.AI_DEMO_ENABLED === 'false') {
        return false;
    }
    return true;
};

/**
 * POST /api/v1/ai/chat
 * Interprets user natural-language request and returns a validated read-only action plan
 * + response template with `{{placeholders}}` (never exposes business data or API keys).
 */
export const chatWithAssistant = async (req, res) => {
    if (!isAiDemoAllowed()) {
        return res.status(403).json({
            success: false,
            error: 'AI assistant demo is disabled in this environment',
        });
    }

    const userKey = req.auth?.userId || req.ip || 'anonymous';
    if (!checkRateLimit(userKey)) {
        return res.status(429).json({
            success: false,
            error: 'Too many assistant requests. Please wait a moment.',
        });
    }

    const validation = validateChatRequest(req.body);
    if (!validation.success) {
        return res.status(400).json({
            success: false,
            error: validation.error,
        });
    }

    try {
        const result = await aiAssistantService.interpretUserRequest({
            ...validation.data,
            traceId: typeof req.body?.traceId === 'string' ? req.body.traceId : null,
            viaVoice: Boolean(req.body?.viaVoice),
            user: req.auth || null,
        });

        return res.json({
            success: true,
            data: {
                traceId: result.traceId,
                plan: result.plan,
                source: result.source,
                ...(process.env.NODE_ENV !== 'production' ? { metrics: result.metrics } : {}),
            },
        });
    } catch {
        return res.status(500).json({
            success: false,
            error: 'Assistant service is temporarily unavailable',
        });
    }
};

/**
 * POST /api/v1/ai/telemetry
 * Captures end-to-end turn results (including local matcher turns, resolved responses,
 * and 👍/👎 RLHF reward signals) into `server/scratch/assistant_rl_dataset.jsonl`.
 */
export const recordAssistantTelemetry = (req, res) => {
    if (!isAiDemoAllowed()) {
        return res.status(403).json({ success: false, error: 'Telemetry disabled' });
    }
    const body = req.body || {};
    const record = aiAssistantService.recordTrainingTrace({
        ...body,
        userRole: aiAssistantService.getRoleVariant(req.auth || null),
        companyId: req.auth?.companyId || null,
    });
    return res.json({
        success: true,
        data: { traceId: record?.traceId || body.traceId || null },
    });
};

/**
 * GET /api/v1/ai/telemetry
 * Returns captured training/evaluation traces and reward counts.
 */
export const getAssistantTelemetry = (req, res) => {
    if (process.env.NODE_ENV === 'production' && process.env.AI_DEMO_ALLOW_PROD !== 'true') {
        return res.status(403).json({ success: false, error: 'Telemetry export disabled in production' });
    }
    const limit = Math.min(500, Math.max(1, Number(req.query?.limit) || 100));
    return res.json({
        success: true,
        data: aiAssistantService.getTrainingTraces({ limit }),
    });
};

/**
 * GET /api/v1/ai/diagnostics
 * Development-only Prompt Caching & catalog diagnostics (never logs user prompts).
 */
export const getAssistantDiagnostics = (req, res) => {
    if (process.env.NODE_ENV === 'production') {
        return res.status(403).json({
            success: false,
            error: 'Diagnostics are only available in development',
        });
    }
    return res.json({
        success: true,
        data: aiAssistantService.getDiagnostics(req.auth || null),
    });
};

/**
 * GET or POST /api/v1/assistant/query
 * Input (body or query): { text?: string, capabilityId?: string }
 * Read-only demo endpoint: answers from a fictional dataset.
 */
export const queryAssistant = async (req, res) => {
    const source = req.method === 'GET' ? req.query : req.body;
    const { text, capabilityId } = source || {};

    const hasText = typeof text === 'string' && text.trim().length > 0;
    const hasCapability = typeof capabilityId === 'string' && capabilityId.trim().length > 0;

    if (!hasText && !hasCapability) {
        return res.status(400).json({ success: false, error: 'text or capabilityId is required' });
    }

    if (hasText && text.length > MAX_TEXT_LENGTH) {
        return res.status(400).json({ success: false, error: `text must be at most ${MAX_TEXT_LENGTH} characters` });
    }

    if (hasCapability && !assistantDemoService.SUPPORTED_CAPABILITIES.has(capabilityId)) {
        return res.status(400).json({ success: false, error: 'Unknown capabilityId' });
    }

    try {
        const result = req.auth
            ? await assistantDemoService.resolveLiveQuery({
                  text: hasText ? text.trim() : undefined,
                  capabilityId: hasCapability ? capabilityId : undefined,
                  auth: req.auth,
              })
            : assistantDemoService.resolveQuery({
                  text: hasText ? text.trim() : undefined,
                  capabilityId: hasCapability ? capabilityId : undefined,
              });
        return res.json({ success: true, data: result });
    } catch {
        return res.status(500).json({ success: false, error: 'Assistant query failed' });
    }
};
