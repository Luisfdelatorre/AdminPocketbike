/**
 * OpenAI Agents SDK Runtime — UPay AI Voice Assistant
 *
 * Centralizes multi-turn conversation state, tool execution, structured output schemas,
 * and model transport (`OpenAIResponsesModel` & `OpenAIResponsesWSModel`) on top of
 * `@openai/agents` and `zod`:
 *
 *  1. Tenant-isolated `MemorySession` per `{ userId, companyId, roleVariant }` with TTL,
 *     LRU cap, and turn-boundary trimming (never splitting `function_call` / `function_call_output`
 *     pairs), so follow-up questions remember real `fetch_module_records` outputs across turns.
 *  2. Automatic synchronization of client-executed local matcher turns (`Abre contratos`,
 *     `Quita los filtros`) into `MemorySession` so 0-network UI turns stay in the agent's memory.
 *  3. Strict `zod` Structured Outputs (`ActionPlanZodSchema`) guaranteeing deterministic JSON
 *     key ordering (`scope` -> `targetModule` -> `actions` -> `responseTemplate` -> `needsClarification`)
 *     so `"actions"` always arrives before `"responseTemplate"` during live streaming.
 *  4. Typed `tool()` wrapper for `fetch_module_records` enforcing `FetchModuleRecordsArgsSchema`,
 *     role/tenant permissions, `MAX_TOOL_CALLS_PER_TURN`, and verified `tool_started` / `tool_completed` events.
 *  5. Safe shared `OpenAIResponsesWSModel` management without aborting concurrent users' sockets.
 */

import '../utils/polyfillFetch.js';
import {
    Agent,
    Runner,
    MemorySession,
    OpenAIResponsesModel,
    OpenAIResponsesWSModel,
    tool,
    user as buildAgentUserItem,
    assistant as buildAgentAssistantItem,
    setTracingDisabled,
} from '@openai/agents';
import { z } from 'zod';
import { MODULE_IDS } from '../../client/src/services/voiceAssistant/capabilities.js';
import { FetchModuleRecordsArgsSchema } from '../../client/src/services/voiceAssistant/schemaValidator.js';

if (process.env.OPENAI_AGENTS_TRACING !== 'true') {
    setTracingDisabled(true);
}

const SESSION_IDLE_TTL_MS = 30 * 60 * 1000; // 30 minutes
const MAX_ACTIVE_SESSIONS = 200;
const MAX_SESSION_USER_TURNS = 6;

const ACTION_PARAM_KEYS = Object.freeze([
    'module',
    'status',
    'alertType',
    'datePreset',
    'month',
    'year',
    'fromDay',
    'toDay',
    'sortBy',
    'view',
    'query',
    'targetType',
    'identifier',
    'topic',
]);

export const ActionParamsZodSchema = z.object({
    module: z.string().nullable(),
    status: z.string().nullable(),
    alertType: z.string().nullable(),
    datePreset: z.string().nullable(),
    month: z.number().int().nullable(),
    year: z.number().int().nullable(),
    fromDay: z.number().int().nullable(),
    toDay: z.number().int().nullable(),
    sortBy: z.string().nullable(),
    view: z.string().nullable(),
    query: z.string().nullable(),
    targetType: z.string().nullable(),
    identifier: z.string().nullable(),
    topic: z.string().nullable(),
});

export const ActionPlanZodSchema = z.object({
    scope: z.enum(['current_screen', 'other_screen', 'conversation_context']),
    targetModule: z.enum(MODULE_IDS),
    actions: z.array(
        z.object({
            name: z.enum([
                'navigate',
                'applyFilter',
                'search',
                'clearFilters',
                'openDetail',
                'showHelp',
            ]),
            params: ActionParamsZodSchema,
        })
    ),
    responseTemplate: z.string(),
    needsClarification: z.boolean(),
});

export const FetchModuleRecordsZodSchema = z.object({
    module: z.enum(MODULE_IDS),
    status: z.string().nullable(),
    alertType: z
        .enum([
            'ALL',
            'UNAUTHORIZED_DRIVING',
            'POWER_CUT',
            'UNAUTHORIZED_MOVEMENT',
            'UNAUTHORIZED_IGNITION',
            'GEOFENCE_EXIT',
            'EXTENDED_OFFLINE',
        ])
        .nullable(),
    datePreset: z.enum(['all', 'today', 'yesterday', 'last_7_days']).nullable(),
    query: z.string().nullable(),
    month: z.number().int().nullable(),
    year: z.number().int().nullable(),
    fromDay: z.number().int().nullable(),
    toDay: z.number().int().nullable(),
    limit: z.number().int().nullable(),
});

// --- Tenant-Isolated Conversation Session Store ---
const tenantSessions = new Map(); // sessionKey -> { session: MemorySession, updatedAt, syncedSignatures: Set<string>, turnCount: number }

export const buildTenantSessionKey = (user = null, roleVariant = 'admin') => {
    if (!user || typeof user !== 'object') return null;
    const uid = user.userId || user.id || user.email || null;
    if (!uid) return null;
    const cid = user.companyId ? String(user.companyId) : 'system';
    return `${String(uid)}::${cid}::${roleVariant}`;
};

const pruneExpiredSessions = (now = Date.now()) => {
    for (const [key, entry] of tenantSessions.entries()) {
        if (now - entry.updatedAt > SESSION_IDLE_TTL_MS) {
            tenantSessions.delete(key);
        }
    }
    while (tenantSessions.size > MAX_ACTIVE_SESSIONS) {
        const oldestKey = tenantSessions.keys().next().value;
        if (!oldestKey) break;
        tenantSessions.delete(oldestKey);
    }
};

export const getOrCreateTenantSession = (
    user = null,
    roleVariant = 'admin',
    { ephemeral = false } = {}
) => {
    if (ephemeral) {
        return {
            sessionKey: null,
            session: new MemorySession(),
            syncedSignatures: new Set(),
            ephemeral: true,
        };
    }

    const key = buildTenantSessionKey(user, roleVariant);
    if (!key) {
        return {
            sessionKey: null,
            session: new MemorySession(),
            syncedSignatures: new Set(),
            ephemeral: true,
        };
    }

    const now = Date.now();
    pruneExpiredSessions(now);

    let entry = tenantSessions.get(key);
    if (!entry) {
        entry = {
            sessionKey: key,
            session: new MemorySession({ sessionId: `upay_${key}` }),
            updatedAt: now,
            syncedSignatures: new Set(),
            turnCount: 0,
            ephemeral: false,
        };
        tenantSessions.set(key, entry);
    } else {
        entry.updatedAt = now;
        // Refresh LRU order
        tenantSessions.delete(key);
        tenantSessions.set(key, entry);
    }

    return entry;
};

export const resetTenantSession = async (user = null) => {
    if (!user || typeof user !== 'object') return { cleared: 0 };
    const uid = user.userId || user.id || user.email || null;
    if (!uid) return { cleared: 0 };
    const cid = user.companyId ? String(user.companyId) : 'system';
    const prefix = `${String(uid)}::${cid}::`;

    let cleared = 0;
    for (const [key, entry] of tenantSessions.entries()) {
        if (key.startsWith(prefix)) {
            try {
                await entry.session.clearSession();
            } catch {
                // Ignore clear error
            }
            tenantSessions.delete(key);
            cleared += 1;
        }
    }
    return { cleared };
};

export const clearAllTenantSessions = async () => {
    for (const entry of tenantSessions.values()) {
        try {
            await entry.session.clearSession();
        } catch {
            // Ignore
        }
    }
    tenantSessions.clear();
};

export const getAgentSessionStats = () => {
    pruneExpiredSessions();
    return {
        active_sessions: tenantSessions.size,
        max_active_sessions: MAX_ACTIVE_SESSIONS,
        session_ttl_seconds: Math.round(SESSION_IDLE_TTL_MS / 1000),
    };
};

/**
 * Trims a `MemorySession` strictly at user-turn boundaries so `function_call` and
 * `function_call_output` items are never separated.
 */
export const trimMemorySessionSafely = async (
    session,
    maxUserTurns = MAX_SESSION_USER_TURNS
) => {
    if (!session) return;
    const items = await session.getItems();
    if (!Array.isArray(items) || items.length === 0) return;

    const userIndices = [];
    for (let i = 0; i < items.length; i++) {
        const it = items[i];
        if (it?.role === 'user' || (it?.type === 'message' && it?.role === 'user')) {
            userIndices.push(i);
        }
    }

    if (userIndices.length <= maxUserTurns) return;

    const cutIndex = userIndices[userIndices.length - maxUserTurns];
    if (cutIndex <= 0) return;

    const kept = items.slice(cutIndex);
    await session.clearSession();
    await session.addItems(kept);
};

/**
 * Synchronizes verified frontend turns (such as 0-network `local_matcher` navigations)
 * into `MemorySession` when they aren't already recorded in the backend session.
 */
export const syncClientHistoryIntoSession = async (
    sessionEntry,
    conversationHistory = []
) => {
    if (!sessionEntry?.session || !Array.isArray(conversationHistory) || conversationHistory.length === 0) {
        return;
    }

    const existingItems = await sessionEntry.session.getItems();
    const existingTextBlob = JSON.stringify(existingItems);
    const toAppend = [];

    for (const turn of conversationHistory) {
        if (!turn?.userText || !turn?.assistantText) continue;
        const sig = `${turn.userText.trim()}||${turn.assistantText.trim()}||${turn.targetModule || ''}`;
        if (sessionEntry.syncedSignatures.has(sig)) continue;
        sessionEntry.syncedSignatures.add(sig);

        // Skip if this user utterance was already persisted by a prior Runner.run on this session
        if (existingTextBlob.includes(JSON.stringify(turn.userText.trim()).slice(1, -1))) {
            continue;
        }

        const syntheticPlan = JSON.stringify({
            scope: 'current_screen',
            targetModule: MODULE_IDS.includes(turn.targetModule) ? turn.targetModule : 'dashboard',
            actions: Array.isArray(turn.executedActions) ? turn.executedActions : [],
            responseTemplate: turn.assistantText,
            needsClarification: false,
        });

        toAppend.push(
            buildAgentUserItem(
                JSON.stringify({
                    currentModule: turn.targetModule || 'dashboard',
                    latestUserMessage: turn.userText,
                })
            ),
            buildAgentAssistantItem(syntheticPlan)
        );
    }

    if (toAppend.length > 0) {
        await sessionEntry.session.addItems(toAppend);
    }

    if (sessionEntry.syncedSignatures.size > 40) {
        const iter = sessionEntry.syncedSignatures.values();
        sessionEntry.syncedSignatures.delete(iter.next().value);
    }
};

export const markTurnSignatureSynced = (sessionEntry, { userText, assistantText, targetModule }) => {
    if (!sessionEntry?.syncedSignatures || !userText || !assistantText) return;
    sessionEntry.syncedSignatures.add(
        `${String(userText).trim()}||${String(assistantText).trim()}||${targetModule || ''}`
    );
};

// --- Normalization Helpers for Structured Outputs & Test Mocks ---
const normalizePlanJsonString = (rawText = '') => {
    if (typeof rawText !== 'string' || !rawText.trim()) return rawText;
    const stripped = rawText
        .trim()
        .replace(/^```json\s*/i, '')
        .replace(/^```\s*/i, '')
        .replace(/```$/i, '')
        .trim();
    try {
        const obj = JSON.parse(stripped);
        if (!obj || typeof obj !== 'object' || Array.isArray(obj)) return stripped;
        const normalizedActions = Array.isArray(obj.actions)
            ? obj.actions.map((act) => {
                  const rawParams = act?.params && typeof act.params === 'object' ? act.params : {};
                  const fullParams = {};
                  for (const key of ACTION_PARAM_KEYS) {
                      fullParams[key] =
                          rawParams[key] !== undefined ? rawParams[key] : null;
                  }
                  return {
                      name: act?.name || 'navigate',
                      params: fullParams,
                  };
              })
            : [];
        return JSON.stringify({
            scope: VALID_SCOPE_SET.has(obj.scope) ? obj.scope : 'current_screen',
            targetModule: MODULE_IDS.includes(obj.targetModule) ? obj.targetModule : 'dashboard',
            actions: normalizedActions,
            responseTemplate: typeof obj.responseTemplate === 'string' ? obj.responseTemplate : '',
            needsClarification: Boolean(obj.needsClarification),
        });
    } catch {
        return stripped;
    }
};

const VALID_SCOPE_SET = new Set(['current_screen', 'other_screen', 'conversation_context']);

const TOOL_ARG_KEYS = Object.freeze([
    'module',
    'status',
    'alertType',
    'datePreset',
    'query',
    'month',
    'year',
    'fromDay',
    'toDay',
    'limit',
]);

const normalizeToolArgsJsonString = (rawArgs) => {
    const str =
        typeof rawArgs === 'string' ? rawArgs : JSON.stringify(rawArgs || {});
    try {
        const parsed = JSON.parse(str);
        if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) return str;
        const full = {};
        for (const key of TOOL_ARG_KEYS) {
            full[key] = parsed[key] !== undefined ? parsed[key] : null;
        }
        if (!MODULE_IDS.includes(full.module)) {
            full.module = 'dashboard';
        }
        return JSON.stringify(full);
    } catch {
        return str;
    }
};

const normalizeResponseObjectForAgents = (rawRes) => {
    if (!rawRes || typeof rawRes !== 'object') return rawRes;
    const rawOutput = Array.isArray(rawRes.output) ? rawRes.output : [];
    const normalizedOutput = rawOutput.map((item, idx) => {
        if (item?.type === 'function_call') {
            return {
                ...item,
                id: item.id || item.call_id || `fc_${idx + 1}`,
                call_id: item.call_id || item.id || `call_${idx + 1}`,
                status: item.status || 'completed',
                arguments:
                    item.name === 'fetch_module_records' || !item.name
                        ? normalizeToolArgsJsonString(item.arguments)
                        : typeof item.arguments === 'string'
                        ? item.arguments
                        : JSON.stringify(item.arguments || {}),
            };
        }
        if (item?.type === 'message' && Array.isArray(item.content)) {
            return {
                ...item,
                id: item.id || `msg_${idx + 1}`,
                role: item.role || 'assistant',
                status: item.status || 'completed',
                content: item.content.map((c) =>
                    c?.type === 'output_text' && typeof c.text === 'string'
                        ? {
                              ...c,
                              text: normalizePlanJsonString(c.text),
                              annotations: Array.isArray(c.annotations) ? c.annotations : [],
                          }
                        : c
                ),
            };
        }
        return item;
    });

    if (
        normalizedOutput.length === 0 &&
        typeof rawRes.output_text === 'string' &&
        rawRes.output_text.trim()
    ) {
        const cleanText = normalizePlanJsonString(rawRes.output_text);
        normalizedOutput.push({
            id: `msg_${rawRes.id || 'auto'}`,
            type: 'message',
            role: 'assistant',
            status: 'completed',
            content: [
                {
                    type: 'output_text',
                    text: cleanText,
                    annotations: [],
                },
            ],
        });
    }

    const usage = rawRes.usage
        ? {
              ...rawRes.usage,
              input_tokens: rawRes.usage.input_tokens ?? rawRes.usage.prompt_tokens ?? 0,
              output_tokens: rawRes.usage.output_tokens ?? rawRes.usage.completion_tokens ?? 0,
              total_tokens:
                  rawRes.usage.total_tokens ??
                  (rawRes.usage.input_tokens ?? 0) + (rawRes.usage.output_tokens ?? 0),
              input_tokens_details:
                  rawRes.usage.input_tokens_details ||
                  (typeof rawRes.usage.cached_tokens === 'number'
                      ? { cached_tokens: rawRes.usage.cached_tokens }
                      : undefined),
          }
        : undefined;

    return {
        ...rawRes,
        id: rawRes.id || `resp_${Date.now()}`,
        status: rawRes.status || 'completed',
        output: normalizedOutput,
        ...(usage ? { usage } : {}),
    };
};

const wrapStreamIteratorForAgents = async function* (rawIter) {
    let responseId = null;
    let accText = '';
    const seenToolCalls = new Map();

    for await (const ev of rawIter) {
        if (!ev || typeof ev !== 'object') continue;

        if (ev.type === 'response.created' && ev.response?.id) {
            responseId = ev.response.id;
        } else if (ev.type === 'response.output_item.added' && ev.item?.type === 'function_call') {
            const key = ev.item.id || ev.item.call_id;
            seenToolCalls.set(key, {
                id: ev.item.id || key,
                call_id: ev.item.call_id || key,
                type: 'function_call',
                name: ev.item.name || 'fetch_module_records',
                arguments: typeof ev.item.arguments === 'string' ? ev.item.arguments : '',
                status: 'completed',
            });
        } else if (ev.type === 'response.function_call_arguments.delta') {
            const key = ev.item_id || ev.call_id;
            const prev = seenToolCalls.get(key) || {
                id: key,
                call_id: ev.call_id || key,
                type: 'function_call',
                name: 'fetch_module_records',
                arguments: '',
                status: 'completed',
            };
            prev.arguments += ev.delta || '';
            seenToolCalls.set(key, prev);
        } else if (ev.type === 'response.function_call_arguments.done') {
            const key = ev.item_id || ev.call_id;
            const prev = seenToolCalls.get(key) || {
                id: key,
                call_id: ev.call_id || key,
                type: 'function_call',
                name: ev.name || 'fetch_module_records',
                arguments: '',
                status: 'completed',
            };
            if (typeof ev.arguments === 'string') prev.arguments = ev.arguments;
            if (ev.name) prev.name = ev.name;
            seenToolCalls.set(key, prev);
        } else if (ev.type === 'response.output_item.done' && ev.item?.type === 'function_call') {
            const key = ev.item.id || ev.item.call_id;
            seenToolCalls.set(key, {
                id: ev.item.id || key,
                call_id: ev.item.call_id || key,
                type: 'function_call',
                name: ev.item.name || 'fetch_module_records',
                arguments: typeof ev.item.arguments === 'string' ? ev.item.arguments : '',
                status: 'completed',
            });
        } else if (ev.type === 'response.output_text.delta') {
            accText += ev.delta || '';
        }

        if (ev.type === 'response.completed') {
            const baseRes = ev.response || {};
            const existingOut = Array.isArray(baseRes.output) ? baseRes.output : [];
            let finalOut = existingOut;
            if (finalOut.length === 0 && seenToolCalls.size > 0) {
                finalOut = Array.from(seenToolCalls.values());
            }
            const mergedRes = normalizeResponseObjectForAgents({
                ...baseRes,
                id: baseRes.id || responseId || `resp_${Date.now()}`,
                output: finalOut,
                output_text:
                    typeof baseRes.output_text === 'string' && baseRes.output_text
                        ? baseRes.output_text
                        : accText,
            });
            yield {
                ...ev,
                response: mergedRes,
            };
            continue;
        }

        yield ev;
    }
};

const wrapOpenAIClientForAgents = (openai, turnTracker) => {
    if (!openai?.responses?.create) return openai;
    const proxy = Object.create(openai);
    proxy.responses = {
        ...openai.responses,
        create: async (params, options) => {
            const rawResult = await openai.responses.create(params, options);
            if (params?.stream && rawResult && typeof rawResult[Symbol.asyncIterator] === 'function') {
                return (async function* () {
                    for await (const ev of wrapStreamIteratorForAgents(rawResult)) {
                        if (ev.type === 'response.completed' && ev.response?.id) {
                            turnTracker.lastResponseId = ev.response.id;
                            turnTracker.rawUsages.push(ev.response.usage || null);
                        }
                        yield ev;
                    }
                })();
            }
            const normalized = normalizeResponseObjectForAgents(rawResult);
            if (normalized?.id) {
                turnTracker.lastResponseId = normalized.id;
            }
            turnTracker.rawUsages.push(normalized?.usage || null);
            return normalized;
        },
    };
    return proxy;
};

const applyTurnChainingOverrides = (turnTracker, requestData) => {
    const inputItems = Array.isArray(requestData?.input) ? requestData.input : [];
    // Detect Round 2 synthesis step: trailing items in `input` are `function_call_output`
    let trailingToolOutputStart = -1;
    for (let i = inputItems.length - 1; i >= 0; i--) {
        if (inputItems[i]?.type === 'function_call_output') {
            trailingToolOutputStart = i;
        } else {
            break;
        }
    }

    if (trailingToolOutputStart >= 0 && turnTracker.lastResponseId) {
        const latestOutputs = inputItems.slice(trailingToolOutputStart);
        return {
            previous_response_id: turnTracker.lastResponseId,
            input: latestOutputs,
            tool_choice: 'none',
        };
    }

    return {};
};

class UPayResponsesModel extends OpenAIResponsesModel {
    constructor(client, model, turnTracker) {
        super(client, model);
        this._turnTracker = turnTracker;
    }

    _getResponsesCreateRequestOverrides(_request, requestData) {
        return applyTurnChainingOverrides(this._turnTracker, requestData);
    }
}

class UPayResponsesWSModel extends OpenAIResponsesWSModel {
    constructor(client, model, options = {}) {
        super(client, model, options);
        this._activeTurnTracker = null;
    }

    bindTurnTracker(turnTracker) {
        this._activeTurnTracker = turnTracker;
    }

    _getResponsesCreateRequestOverrides(_request, requestData) {
        if (!this._activeTurnTracker) return {};
        return applyTurnChainingOverrides(this._activeTurnTracker, requestData);
    }
}

// Shared `OpenAIResponsesWSModel` per `(client, modelName)` — internally serialized via `#wsRequestLock`
// in `@openai/agents-openai` so cancelling one user's turn never kills another user's socket!
let sharedAgentsWsModelEntry = null;

export const getSharedAgentsWSModel = (openai, modelName) => {
    if (
        sharedAgentsWsModelEntry &&
        sharedAgentsWsModelEntry.client === openai &&
        sharedAgentsWsModelEntry.modelName === modelName
    ) {
        return sharedAgentsWsModelEntry.wsModel;
    }
    const wsModel = new UPayResponsesWSModel(openai, modelName, { reuseConnection: true });
    sharedAgentsWsModelEntry = { client: openai, modelName, wsModel };
    return wsModel;
};

export const closeSharedAgentsWSModel = async () => {
    const current = sharedAgentsWsModelEntry;
    sharedAgentsWsModelEntry = null;
    if (current?.wsModel) {
        try {
            await current.wsModel.close();
        } catch {
            // Ignore close errors
        }
    }
};

/**
 * Aggregates token usage across all LLM calls in a multi-step Agent turn (Round 1 + Round 2).
 */
export const aggregateTurnUsage = (rawUsages = [], runResult = null) => {
    const valid = rawUsages.filter((u) => u && typeof u === 'object');
    if (valid.length > 0) {
        let inputTokens = 0;
        let cachedTokens = 0;
        let outputTokens = 0;
        for (const u of valid) {
            inputTokens += Number(u.input_tokens ?? u.prompt_tokens ?? 0) || 0;
            cachedTokens +=
                Number(
                    u.input_tokens_details?.cached_tokens ??
                        u.prompt_tokens_details?.cached_tokens ??
                        u.cached_tokens ??
                        0
                ) || 0;
            outputTokens += Number(u.output_tokens ?? u.completion_tokens ?? 0) || 0;
        }
        return {
            requests: valid.length,
            input_tokens: inputTokens,
            input_tokens_details: { cached_tokens: cachedTokens },
            output_tokens: outputTokens,
            total_tokens: inputTokens + outputTokens,
        };
    }

    const rawResponses = runResult?.rawResponses || [];
    if (Array.isArray(rawResponses) && rawResponses.length > 0) {
        let inputTokens = 0;
        let cachedTokens = 0;
        let outputTokens = 0;
        for (const r of rawResponses) {
            const u = r?.usage;
            if (!u) continue;
            inputTokens += Number(u.inputTokens || 0);
            outputTokens += Number(u.outputTokens || 0);
            const details = Array.isArray(u.inputTokensDetails)
                ? u.inputTokensDetails
                : u.inputTokensDetails
                ? [u.inputTokensDetails]
                : [];
            for (const d of details) {
                cachedTokens += Number(d?.cached_tokens || 0);
            }
        }
        if (inputTokens > 0 || outputTokens > 0) {
            return {
                requests: rawResponses.length,
                input_tokens: inputTokens,
                input_tokens_details: { cached_tokens: cachedTokens },
                output_tokens: outputTokens,
                total_tokens: inputTokens + outputTokens,
            };
        }
    }

    return null;
};

/**
 * Runs a complete UPay Assistant turn using `@openai/agents` (`Runner`, `Agent`, `MemorySession`, `tool`).
 * Supports both non-streaming (`stream: false`) and real-time streaming (`stream: true`).
 */
export const runAssistantTurnWithAgentsSdk = async ({
    openai,
    modelName = 'gpt-4o-mini',
    transportMode = 'http',
    stablePrefix,
    cacheKey,
    dynamicInputText,
    rawUserText = '',
    isFullYearFn = null,
    applicationContext = {},
    conversationHistory = [],
    user = null,
    roleVariant = 'admin',
    maxOutputTokens = 900,
    temperature = 0.3,
    maxToolCallsPerTurn = 2,
    ephemeralSession = false,
    stream = false,
    signal = null,
    toolExecutor,
    onFirstEvent = null,
    onToolStarted = null,
    onToolCompleted = null,
    onRawTextDelta = null,
    onRoundStarted = null,
    onLog = null,
}) => {
    if (signal?.aborted) {
        throw new Error('TURN_CANCELLED');
    }

    const turnTracker = {
        lastResponseId: null,
        rawUsages: [],
        seenToolCalls: 0,
        executedToolCalls: 0,
        onDemandToolCalls: [],
        roundIndex: 0,
    };

    const sessionEntry = getOrCreateTenantSession(user, roleVariant, {
        ephemeral: ephemeralSession,
    });
    await syncClientHistoryIntoSession(sessionEntry, conversationHistory);
    await trimMemorySessionSafely(sessionEntry.session, MAX_SESSION_USER_TURNS);

    let callSeq = 0;
    const fetchRecordsAgentTool = tool({
        name: 'fetch_module_records',
        description:
            'Fetches up to 12 sanitized live records plus complete count/sum metadata from an authorized UPay module when the user asks an analytical or data question ("¿cuántos hay?", "¿cuánto suman?", "¿por qué están rechazados?", "¿a qué hora fueron?", telemetry causes, voltages, plates, or contract/invoice details). Do NOT call this tool for simple Path A navigation, filter, or clear-filter commands.',
        parameters: FetchModuleRecordsZodSchema,
        execute: async (rawArgs) => {
            if (signal?.aborted) {
                throw new Error('TURN_CANCELLED');
            }
            const callId = `call_${++callSeq}`;
            turnTracker.seenToolCalls += 1;

            if (turnTracker.executedToolCalls >= maxToolCallsPerTurn) {
                return JSON.stringify({
                    skipped: true,
                    reason: 'max_tool_calls_per_turn_reached',
                });
            }

            const argCheck = FetchModuleRecordsArgsSchema.safeParse(rawArgs, {
                currentModule: applicationContext?.currentModule || 'dashboard',
                user,
            });

            if (!argCheck.success) {
                return JSON.stringify({
                    authorized: false,
                    error: argCheck.error,
                    records: [],
                });
            }

            turnTracker.executedToolCalls += 1;
            const activeFilters = applicationContext?.activeFilters || {};
            const cleanArgs = argCheck.data;
            const resolvedMonth = isFullYearFn?.(rawUserText)
                ? 0
                : cleanArgs.month !== undefined && cleanArgs.month !== null
                ? cleanArgs.month
                : activeFilters.month === ''
                ? 0
                : activeFilters.month ?? null;

            const fetchArgs = {
                module: cleanArgs.module,
                status: cleanArgs.status ?? activeFilters.status ?? null,
                alertType: cleanArgs.alertType ?? activeFilters.alertType ?? null,
                datePreset: cleanArgs.datePreset ?? activeFilters.datePreset ?? null,
                query: cleanArgs.query ?? activeFilters.searchQuery ?? null,
                month: resolvedMonth,
                year: cleanArgs.year ?? activeFilters.year ?? null,
                fromDay: cleanArgs.fromDay ?? activeFilters.fromDay ?? null,
                toDay: cleanArgs.toDay ?? activeFilters.toDay ?? null,
                companyId: activeFilters.companyId ?? null,
                limit: cleanArgs.limit,
                auth: user,
            };

            onLog?.(`🔍 Ejecutando fetch_module_records (${callId}):`, {
                module: fetchArgs.module,
                status: fetchArgs.status,
                month: fetchArgs.month === 0 ? 'all_year' : fetchArgs.month,
                year: fetchArgs.year,
                alertType: fetchArgs.alertType,
                datePreset: fetchArgs.datePreset,
                query: fetchArgs.query,
                fromDay: fetchArgs.fromDay,
                toDay: fetchArgs.toDay,
                limit: fetchArgs.limit,
            });

            onToolStarted?.({
                callId,
                tool: 'fetch_module_records',
                module: fetchArgs.module,
            });

            const toolResult = await toolExecutor(fetchArgs);
            if (signal?.aborted) {
                throw new Error('TURN_CANCELLED');
            }

            const recordsReturned = Array.isArray(toolResult?.records)
                ? toolResult.records.length
                : 0;
            const totalMatching = toolResult?.totalMatching ?? 0;

            onLog?.(`✅ Resultado fetch_module_records (${fetchArgs.module}):`, {
                recordsReturned,
                totalMatching,
                isCompleteTotal: Boolean(toolResult?.scopeMetadata?.isCompleteTotal ?? true),
            });

            onToolCompleted?.({
                callId,
                tool: 'fetch_module_records',
                module: fetchArgs.module,
                recordsReturned,
                totalMatching,
                isComplete: Boolean(toolResult?.scopeMetadata?.isCompleteTotal ?? true),
            });

            turnTracker.onDemandToolCalls.push({
                tool: 'fetch_module_records',
                args: {
                    module: fetchArgs.module,
                    status: fetchArgs.status,
                    alertType: fetchArgs.alertType,
                    datePreset: fetchArgs.datePreset,
                    query: fetchArgs.query,
                    fromDay: fetchArgs.fromDay,
                    toDay: fetchArgs.toDay,
                    limit: fetchArgs.limit,
                },
                recordsReturned,
                totalMatching,
            });

            return JSON.stringify(toolResult);
        },
    });

    const wrappedClient = wrapOpenAIClientForAgents(openai, turnTracker);
    let modelInstance;
    if (transportMode === 'ws' && typeof openai?.baseURL === 'string') {
        const wsModel = getSharedAgentsWSModel(openai, modelName);
        wsModel.bindTurnTracker(turnTracker);
        modelInstance = wsModel;
    } else {
        modelInstance = new UPayResponsesModel(wrappedClient, modelName, turnTracker);
    }

    const agent = new Agent({
        name: 'UPayVoiceAssistant',
        instructions: stablePrefix,
        model: modelInstance,
        tools: [fetchRecordsAgentTool],
        outputType: ActionPlanZodSchema,
        modelSettings: {
            temperature,
            maxTokens: maxOutputTokens,
            providerData: {
                prompt_cache_key: cacheKey,
            },
        },
    });

    const runner = new Runner({
        tracingDisabled: process.env.OPENAI_AGENTS_TRACING !== 'true',
        workflowName: 'UPay Voice Assistant',
    });

    if (!stream) {
        const result = await runner.run(agent, dynamicInputText, {
            session: sessionEntry.session,
            maxTurns: 2,
            ...(signal ? { signal } : {}),
        });
        await trimMemorySessionSafely(sessionEntry.session, MAX_SESSION_USER_TURNS);
        const aggregatedUsage = aggregateTurnUsage(turnTracker.rawUsages, result);
        return {
            finalOutput: result.finalOutput,
            usage: aggregatedUsage,
            perRoundUsages: turnTracker.rawUsages.filter(Boolean),
            onDemandToolCalls:
                turnTracker.onDemandToolCalls.length > 0 ? turnTracker.onDemandToolCalls : null,
            toolRounds: turnTracker.executedToolCalls > 0 ? 1 : 0,
            sessionKey: sessionEntry.sessionKey,
            sessionEntry,
        };
    }

    const streamedResult = await runner.run(agent, dynamicInputText, {
        session: sessionEntry.session,
        stream: true,
        maxTurns: 2,
        ...(signal ? { signal } : {}),
    });

    let firstEventSeen = false;
    let currentRound = 0;

    for await (const ev of streamedResult) {
        if (signal?.aborted) {
            throw new Error('TURN_CANCELLED');
        }
        if (!firstEventSeen) {
            firstEventSeen = true;
            onFirstEvent?.(ev);
        }

        if (ev.type === 'raw_model_stream_event') {
            const data = ev.data;
            if (data?.type === 'response_started') {
                currentRound += 1;
                turnTracker.roundIndex = currentRound;
                onRoundStarted?.(currentRound);
            } else if (data?.type === 'output_text_delta' && typeof data.delta === 'string') {
                onRawTextDelta?.(data.delta, {
                    round: currentRound,
                    toolsExecuted: turnTracker.executedToolCalls > 0,
                });
            }
        }
    }

    await streamedResult.completed;
    await trimMemorySessionSafely(sessionEntry.session, MAX_SESSION_USER_TURNS);

    const aggregatedUsage = aggregateTurnUsage(turnTracker.rawUsages, streamedResult);
    return {
        finalOutput: streamedResult.finalOutput,
        usage: aggregatedUsage,
        perRoundUsages: turnTracker.rawUsages.filter(Boolean),
        onDemandToolCalls:
            turnTracker.onDemandToolCalls.length > 0 ? turnTracker.onDemandToolCalls : null,
        toolRounds: turnTracker.executedToolCalls > 0 ? 1 : 0,
        sessionKey: sessionEntry.sessionKey,
        sessionEntry,
    };
};

export default {
    ActionPlanZodSchema,
    FetchModuleRecordsZodSchema,
    buildTenantSessionKey,
    getOrCreateTenantSession,
    resetTenantSession,
    clearAllTenantSessions,
    getAgentSessionStats,
    trimMemorySessionSafely,
    syncClientHistoryIntoSession,
    markTurnSignatureSynced,
    runAssistantTurnWithAgentsSdk,
    closeSharedAgentsWSModel,
    aggregateTurnUsage,
};
