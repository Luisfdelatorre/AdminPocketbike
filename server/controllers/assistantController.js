import assistantDemoService from '../services/assistantDemoService.js';
import aiAssistantService from '../services/aiAssistantService.js';
import { streamAssistantTurn } from '../services/aiAssistantStreamService.js';
import { validateChatRequest } from '../../client/src/services/voiceAssistant/schemaValidator.js';

const MAX_TEXT_LENGTH = 500;
const RATE_LIMIT_WINDOW_MS = 60 * 1000;
const RATE_LIMIT_MAX_REQUESTS = Number(process.env.AI_RATE_LIMIT_PER_MIN) || 30;
const rateBuckets = new Map();

const checkRateLimit = (key) => {
    const now = Date.now();
    if (rateBuckets.size > 500) {
        for (const [k, v] of rateBuckets.entries()) {
            if (now - v.windowStart > RATE_LIMIT_WINDOW_MS) rateBuckets.delete(k);
        }
    }
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

const isAiAssistantAllowed = () => {
    // Enabled by default; can be disabled with AI_ASSISTANT_ENABLED=false or AI_DEMO_ENABLED=false
    if (process.env.AI_ASSISTANT_ENABLED === 'false' || process.env.AI_DEMO_ENABLED === 'false') {
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
    if (!isAiAssistantAllowed()) {
        return res.status(403).json({
            success: false,
            error: 'AI assistant is disabled in this environment',
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

    const wantsStream =
        req.body?.stream === true ||
        String(req.headers?.accept || '')
            .toLowerCase()
            .includes('text/event-stream');

    if (wantsStream) {
        const turnId =
            typeof req.body?.traceId === 'string' && req.body.traceId.trim()
                ? req.body.traceId.trim().slice(0, 80)
                : `tr_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`;

        res.status(200);
        res.setHeader('Content-Type', 'text/event-stream; charset=utf-8');
        res.setHeader('Cache-Control', 'no-cache, no-transform');
        res.setHeader('Connection', 'keep-alive');
        res.setHeader('X-Accel-Buffering', 'no');
        res.flushHeaders?.();

        const abortController = new AbortController();
        res.on('close', () => {
            if (!res.writableEnded) {
                abortController.abort(new Error('TURN_CANCELLED'));
            }
        });

        let sequence = 0;
        const sendSseEnvelope = (type, payload = {}) => {
            if (res.writableEnded || abortController.signal.aborted) return;
            const envelope = {
                turnId,
                sequence: ++sequence,
                type,
                timestamp: new Date().toISOString(),
                payload,
            };
            res.write(`data: ${JSON.stringify(envelope)}\n\n`);
        };

        try {
            const ttsCfg =
                req.body?.tts && typeof req.body.tts === 'object'
                    ? req.body.tts
                    : { enabled: false, neural: false };

            await streamAssistantTurn({
                turnId,
                traceId: turnId,
                viaVoice: Boolean(req.body?.viaVoice),
                text: validation.data.text,
                lang: validation.data.lang,
                applicationContext: validation.data.applicationContext,
                conversationHistory: validation.data.conversationHistory,
                user: req.auth || null,
                ttsOptions: ttsCfg,
                signal: abortController.signal,
                emitEvent: (type, payload) => sendSseEnvelope(type, payload),
            });

            if (!res.writableEnded) {
                res.write('data: [DONE]\n\n');
                res.end();
            }
            return undefined;
        } catch (err) {
            if (!res.writableEnded && !abortController.signal.aborted) {
                sendSseEnvelope('turn_failed', {
                    code: 'INTERNAL_ERROR',
                    message: err?.message || 'Assistant streaming failed',
                });
                res.write('data: [DONE]\n\n');
                res.end();
            }
            return undefined;
        }
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
    if (!isAiAssistantAllowed()) {
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
 * Returns captured training/evaluation traces and reward counts, strictly tenant-scoped.
 */
export const getAssistantTelemetry = (req, res) => {
    if (!isAiAssistantAllowed()) {
        return res.status(403).json({ success: false, error: 'Telemetry disabled' });
    }
    if (req.auth && req.auth.role === 'viewer' && !req.auth.isSuperAdmin) {
        return res.status(403).json({ success: false, error: 'Insufficient permissions for telemetry' });
    }
    const limit = Math.min(500, Math.max(1, Number(req.query?.limit) || 100));
    return res.json({
        success: true,
        data: aiAssistantService.getTrainingTraces({ limit, user: req.auth || null }),
    });
};

/**
 * POST /api/v1/ai/session/reset
 * Clears the authenticated user's in-memory Agents SDK conversation session.
 */
export const resetAssistantSession = async (req, res) => {
    if (!isAiAssistantAllowed()) {
        return res.status(403).json({ success: false, error: 'AI assistant is disabled' });
    }
    const result = await aiAssistantService.resetConversationSession(req.auth || null);
    return res.json({
        success: true,
        data: result,
    });
};

/**
 * GET /api/v1/ai/diagnostics
 * Development-only Prompt Caching & catalog diagnostics (never logs user prompts).
 */
export const getAssistantDiagnostics = (req, res) => {
    if (!isAiAssistantAllowed()) {
        return res.status(403).json({
            success: false,
            error: 'Diagnostics disabled',
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
