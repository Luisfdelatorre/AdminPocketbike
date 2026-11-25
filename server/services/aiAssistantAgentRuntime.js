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
import {
    MODULES,
    MODULE_IDS,
    canUserAccessModule,
    normalizeFilterStatus,
} from '../../client/src/services/voiceAssistant/capabilities.js';
import {
    validateActionPlan,
    FetchModuleRecordsArgsSchema,
} from '../../client/src/services/voiceAssistant/schemaValidator.js';

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
    module: z.enum(MODULE_IDS).nullable(),
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
    month: z.number().int().nullable(),
    year: z.number().int().nullable(),
    fromDay: z.number().int().nullable(),
    toDay: z.number().int().nullable(),
    sortBy: z.string().nullable(),
    view: z.string().nullable(),
    query: z.string().nullable(),
    targetType: z.enum(['contract', 'device_contract', 'alert']).nullable(),
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

export const FETCH_TOOL_DESCRIPTION_V1 =
    'Fetches up to 12 sanitized live records plus complete count/sum metadata from an authorized UPay module when the user asks an analytical or data question ("¿cuántos hay?", "¿cuánto suman?", "¿por qué están rechazados?", "¿a qué hora fueron?", telemetry causes, voltages, plates, or contract/invoice details). Do NOT call this tool for simple Path A navigation, filter, or clear-filter commands.';

export const FETCH_TOOL_DESCRIPTION_V2 =
    'Fetch up to 12 live records and verified count/sum metadata from an authorized UPay module ONLY when local {{placeholders}} cannot answer (specific plates, failure causes, timestamps, day ranges, >=24h offline, or cross-module checks). Never call for UI-only navigation/filtering.';

export const OUTPUT_SCHEMA_JSON = JSON.stringify({
    type: 'json_schema',
    name: 'final_output',
    strict: true,
    schema: z.toJSONSchema(ActionPlanZodSchema),
});

export const FETCH_TOOL_DEFINITION_JSON_V1 = JSON.stringify({
    type: 'function',
    name: 'fetch_module_records',
    description: FETCH_TOOL_DESCRIPTION_V1,
    parameters: z.toJSONSchema(FetchModuleRecordsZodSchema),
    strict: true,
});

export const FETCH_TOOL_DEFINITION_JSON_V2 = JSON.stringify({
    type: 'function',
    name: 'fetch_module_records',
    description: FETCH_TOOL_DESCRIPTION_V2,
    parameters: z.toJSONSchema(FetchModuleRecordsZodSchema),
    strict: true,
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
const compactHistoricalToolItem = (item) => {
    if (!item || (item.type !== 'function_call_result' && item.type !== 'function_call_output')) {
        return { item, changed: false };
    }
    const isTextObject = typeof item.output?.text === 'string';
    const rawStr =
        typeof item.output === 'string'
            ? item.output
            : isTextObject
            ? item.output.text
            : null;
    if (!rawStr || rawStr.length < 700) {
        return { item, changed: false };
    }
    try {
        const parsed = JSON.parse(rawStr);
        if (
            !parsed ||
            typeof parsed !== 'object' ||
            parsed._compactedHistory === true ||
            !Array.isArray(parsed.records) ||
            parsed.records.length <= 2
        ) {
            return { item, changed: false };
        }
        const compactPayload = JSON.stringify({
            ...parsed,
            records: parsed.records.slice(0, 2),
            _compactedHistory: true,
        });
        return {
            changed: true,
            item: {
                ...item,
                output: isTextObject ? { ...item.output, text: compactPayload } : compactPayload,
            },
        };
    } catch {
        return { item, changed: false };
    }
};

export const trimMemorySessionSafely = async (
    session,
    maxUserTurns = MAX_SESSION_USER_TURNS,
    { compactOlderToolOutputs = true } = {}
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

    const cutIndex =
        userIndices.length > maxUserTurns
            ? Math.max(0, userIndices[userIndices.length - maxUserTurns])
            : 0;
    let kept = cutIndex > 0 ? items.slice(cutIndex) : items.slice();
    let mutated = cutIndex > 0;

    // Preserve full raw tool records for the latest 2 user turns; compact older tool outputs to prevent O(N) bloat
    if (compactOlderToolOutputs) {
        const keptUserIndices = [];
        for (let i = 0; i < kept.length; i++) {
            const it = kept[i];
            if (it?.role === 'user' || (it?.type === 'message' && it?.role === 'user')) {
                keptUserIndices.push(i);
            }
        }
        if (keptUserIndices.length > 2) {
            const recentBoundary = keptUserIndices[keptUserIndices.length - 2];
            kept = kept.map((it, idx) => {
                if (idx >= recentBoundary) return it;
                const res = compactHistoricalToolItem(it);
                if (res.changed) mutated = true;
                return res.item;
            });
        }
    }

    if (!mutated) return;
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

const summarizeOpenAiResponseForLog = (res = {}) => {
    const out = Array.isArray(res?.output) ? res.output : [];
    const toolCalls = out
        .filter((it) => it?.type === 'function_call')
        .map((tc) => ({
            call_id: tc.call_id || tc.id,
            name: tc.name,
            arguments: tc.arguments,
        }));
    const u = res?.usage || null;
    const inTok = u?.input_tokens ?? u?.prompt_tokens ?? null;
    const cachedTok =
        u?.input_tokens_details?.cached_tokens ??
        u?.prompt_tokens_details?.cached_tokens ??
        u?.cached_tokens ??
        0;
    const outTok = u?.output_tokens ?? u?.completion_tokens ?? null;
    return {
        responseId: res?.id || null,
        ...(toolCalls.length > 0 ? { toolCalls } : {}),
        ...(res?.output_text ? { outputText: res.output_text } : {}),
        usage: u
            ? {
                  input_tokens: inTok,
                  cached_tokens: cachedTok,
                  uncached_tokens:
                      typeof inTok === 'number' ? Math.max(0, inTok - cachedTok) : null,
                  output_tokens: outTok,
              }
            : null,
    };
};

const wrapOpenAIClientForAgents = (openai, turnTracker) => {
    if (!openai?.responses?.create) return openai;
    const proxy = Object.create(openai);
    proxy.responses = {
        ...openai.responses,
        create: async (params, options) => {
            const callNum = (turnTracker.openaiCallSeq = (turnTracker.openaiCallSeq || 0) + 1);
            const t0 = performance.now();
            turnTracker.onLog?.(`  ├─ 📤 OpenAI ronda ${callNum} · petición`, {
                model: params?.model,
                stream: Boolean(params?.stream),
                previous_response_id: params?.previous_response_id || null,
                tool_choice: params?.tool_choice || 'auto',
                prompt_cache_key: params?.prompt_cache_key || null,
                instructionsChars:
                    typeof params?.instructions === 'string' ? params.instructions.length : 0,
                inputItemsCount: Array.isArray(params?.input) ? params.input.length : 1,
                latestInput: Array.isArray(params?.input)
                    ? params.input[params.input.length - 1]
                    : params?.input,
            });

            const rawResult = await openai.responses.create(params, options);
            if (params?.stream && rawResult && typeof rawResult[Symbol.asyncIterator] === 'function') {
                return (async function* () {
                    for await (const ev of wrapStreamIteratorForAgents(rawResult)) {
                        if (ev.type === 'response.completed' && ev.response?.id) {
                            turnTracker.lastResponseId = ev.response.id;
                            turnTracker.rawUsages.push(ev.response.usage || null);
                            const elapsed = Math.round(performance.now() - t0);
                            turnTracker.onLog?.(
                                `  ├─ 📥 OpenAI ronda ${callNum} · respuesta (${elapsed} ms)`,
                                summarizeOpenAiResponseForLog(ev.response)
                            );
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
            const elapsed = Math.round(performance.now() - t0);
            turnTracker.onLog?.(
                `  ├─ 📥 OpenAI ronda ${callNum} · respuesta (${elapsed} ms)`,
                summarizeOpenAiResponseForLog(normalized)
            );
            return normalized;
        },
    };
    return proxy;
};

const applyTurnChainingOverrides = (turnTracker, requestData) => {
    const inputItems = Array.isArray(requestData?.input) ? requestData.input : [];
    // Detect post-tool synthesis/continuation step: trailing items in `input` are `function_call_output`
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
        const forceSynthesis =
            turnTracker.forceSynthesisAfterFirstToolRound === true ||
            turnTracker.executedToolCalls >= (turnTracker.maxToolCallsPerTurn || 2);
        return {
            previous_response_id: turnTracker.lastResponseId,
            input: latestOutputs,
            ...(forceSynthesis ? { tool_choice: 'none' } : {}),
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
        let reasoningTokens = 0;
        let hasReasoning = false;
        let cacheWriteTokens = 0;
        let hasCacheWrite = false;
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
            const rTok =
                u.output_tokens_details?.reasoning_tokens ??
                u.completion_tokens_details?.reasoning_tokens ??
                u.reasoning_tokens;
            if (typeof rTok === 'number' && Number.isFinite(rTok)) {
                hasReasoning = true;
                reasoningTokens += rTok;
            }
            const cwTok =
                u.input_tokens_details?.cache_creation_input_tokens ??
                u.input_tokens_details?.cache_write_tokens ??
                u.cache_write_tokens;
            if (typeof cwTok === 'number' && Number.isFinite(cwTok)) {
                hasCacheWrite = true;
                cacheWriteTokens += cwTok;
            }
        }
        return {
            requests: valid.length,
            input_tokens: inputTokens,
            input_tokens_details: {
                cached_tokens: cachedTokens,
                ...(hasCacheWrite ? { cache_write_tokens: cacheWriteTokens } : {}),
            },
            output_tokens: outputTokens,
            ...(hasReasoning ? { output_tokens_details: { reasoning_tokens: reasoningTokens } } : {}),
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
 * Detects whether a user utterance is an analytical, quantitative, or investigative
 * question that requires verified business data (not just a UI filter/navigation action).
 */
/**
 * Question/metric words that make an utterance analytical. Shared by `isAnalyticalQuestion`
 * and `isPureUiViewCommand` so a turn can never be both "tool forbidden" and "tool required".
 */
const ANALYTICAL_CLAUSE_REGEX =
    /\b(cuant[oa]s?|cuanto|cuatas|cuatos|how many|how much|why|which|total|suman|suma|porcentaje|efectividad|tasa|promedio|cuales|quienes|por que|porque|motivo|razon|causa|a que hora|cuando|reporte de|resumen de|dime|investiga|investigame|analiza|explicame|acumulado|mas de \d+|varios dias|dias sin|horas sin)\b/;
// Debt topic words: analytical when asked as a question, but valid inside a pure view command
// ("Mu\u00e9strame las motos con deuda").
const DEBT_TOPIC_REGEX = /\b(deben|mora|deuda|deuna)\b/;
const DAY_RANGE_REGEX = /\b(?:del|desde|entre)(?:\s+el)?\s+\d{1,2}\s+(?:al|hasta|y)\b/;

export const isAnalyticalQuestion = (text = '') => {
    const clean = String(text || '')
        .toLowerCase()
        .normalize('NFD')
        .replace(/[\u0300-\u036f]/g, '')
        .trim();
    if (!clean) return false;

    return (
        ANALYTICAL_CLAUSE_REGEX.test(clean) ||
        DEBT_TOPIC_REGEX.test(clean) ||
        (/^\s*¿/.test(String(text || '')) && /\b(hay|tienen|estan|son|deben|pagaron|fallaron)\b/.test(clean))
    );
};

/**
 * Detects pure UI view/filter/search commands (e.g. "Muéstrame los pagos rechazados",
 * "Quiero ver las motos apagadas", "Filtra contratos semanales", "Busca DRS30I") that
 * contain NO analytical/investigative questions, day-ranges, or today-invoice checks.
 * Passing `toolChoice: 'none'` on these guarantees 1-step navigation + filter in ~1.8s.
 */
export const isPureUiViewCommand = (text = '') => {
    const raw = String(text || '').trim();
    if (!raw || /[?¿]/.test(raw)) return false;
    const clean = raw
        .toLowerCase()
        .normalize('NFD')
        .replace(/[\u0300-\u036f]/g, '')
        .replace(/[^\w\s]/g, ' ')
        .replace(/\s+/g, ' ')
        .trim();
    if (!clean) return false;

    const startsWithViewVerb =
        /^(?:muestrame|mostrar|muestra|quiero ver|dejame ver|ver|filtra|filtrar|busca|buscar|ordena|ordenar|llevame a|show me|show|filter|search)\b/.test(
            clean
        );
    if (!startsWithViewVerb) return false;

    if (ANALYTICAL_CLAUSE_REGEX.test(clean)) return false;
    if (DAY_RANGE_REGEX.test(clean)) return false;

    const isInvoicesToday = /\b(facturas?|invoices?)\b/.test(clean) && /\b(hoy|today)\b/.test(clean);
    if (isInvoicesToday) return false;

    return true;
};

/**
 * Infers canonical status / alertType filter from user text for a given targetModule
 * when the model set `targetModule` on a "Muéstrame / Ver / Filtra..." command but left `actions: []`.
 */
const inferFilterParamsForModule = (userText = '', targetModule = '') => {
    const mod = MODULES[targetModule];
    if (!mod?.filters) return null;
    const clean = String(userText || '')
        .toLowerCase()
        .normalize('NFD')
        .replace(/[\u0300-\u036f]/g, '')
        .replace(/[^\w\s]/g, ' ')
        .replace(/\s+/g, ' ')
        .trim();
    if (!clean) return null;

    const params = { module: targetModule };
    let matched = false;

    if (mod.filters.alertType?.synonyms) {
        for (const [syn, canonical] of Object.entries(mod.filters.alertType.synonyms)) {
            if (syn === 'all' || syn === 'todas' || syn === 'todos') continue;
            if (new RegExp(`\\b${syn}\\b`, 'i').test(clean)) {
                params.alertType = canonical;
                matched = true;
                break;
            }
        }
    }

    if (mod.filters.status) {
        const isUsableStatus = (s) => s && s !== 'all' && s !== 'ALL';
        let status = null;

        // 1. Negated "paid" forms ("no pagadas", "sin pagar", "no se han pagado") mean unpaid, never PAID.
        if (/\b(?:no|sin)\s+(?:se\s+han?\s+)?(?:pagad[oa]s?|pagar|pago)\b/.test(clean)) {
            status =
                [normalizeFilterStatus(targetModule, 'unpaid'),
                    normalizeFilterStatus(targetModule, 'pending'),
                    normalizeFilterStatus(targetModule, 'debt')].find(isUsableStatus) || null;
        }

        // 2. Multi-word synonyms ("en mora", "sin conexion"), longest first.
        if (!status && mod.filters.status.synonyms) {
            const phrases = Object.keys(mod.filters.status.synonyms)
                .filter((k) => k.includes(' '))
                .sort((a, b) => b.length - a.length);
            for (const phrase of phrases) {
                if (clean.includes(phrase)) {
                    const candidate = mod.filters.status.synonyms[phrase];
                    if (isUsableStatus(candidate)) {
                        status = candidate;
                        break;
                    }
                }
            }
        }

        // 3. Single words, skipping any word directly negated by "no".
        if (!status) {
            const words = clean.split(' ');
            for (let i = 0; i < words.length; i++) {
                const w = words[i];
                if (['todos', 'todas', 'all'].includes(w)) continue;
                if (i > 0 && words[i - 1] === 'no') continue;
                const normStatus = normalizeFilterStatus(targetModule, w);
                if (isUsableStatus(normStatus)) {
                    status = normStatus;
                    break;
                }
            }
        }

        if (status) {
            params.status = status;
            matched = true;
        }
    }

    if (mod.filters.datePreset?.synonyms) {
        for (const [syn, canonical] of Object.entries(mod.filters.datePreset.synonyms)) {
            if (syn === 'all') continue;
            if (new RegExp(`\\b${syn}\\b`, 'i').test(clean)) {
                params.datePreset = canonical;
                matched = true;
                break;
            }
        }
    }

    return matched ? params : null;
};

/**
 * Deterministic post-plan safeguard (fixes Trace `tr_1795595026004_5z246`):
 * When the user explicitly asks to show/view/filter a module ("Muéstrame los pagos rechazados")
 * and the model sets `targetModule` + answer text but omits `actions` (`actions: []`),
 * injects the missing `navigate` + `applyFilter` actions and re-validates against RBAC & schema.
 */
export const ensureRequestedViewActions = ({
    userText = '',
    plan = null,
    currentModule = 'dashboard',
    activeFilters = {},
    onDemandToolCalls = null,
    toolErrors = [],
    user = null,
} = {}) => {
    if (!plan || typeof plan !== 'object' || plan.needsClarification) return plan;
    if (Array.isArray(toolErrors) && toolErrors.length > 0) return plan;
    if (Array.isArray(plan.actions) && plan.actions.length > 0) return plan;

    const raw = String(userText || '').trim();
    const clean = raw
        .toLowerCase()
        .normalize('NFD')
        .replace(/[\u0300-\u036f]/g, '')
        .trim();

    const hasExplicitViewCommand =
        /^(?:muestrame|mostrar|muestra|quiero ver|dejame ver|ver|filtra|filtrar|abre|abrir|ir a|ir al|ve a|ve al|llevame|show me|show|filter|open|go to)\b/.test(
            clean
        );
    if (!hasExplicitViewCommand) return plan;

    const targetMod = plan.targetModule;
    if (!targetMod || !MODULES[targetMod] || !canUserAccessModule(targetMod, user)) {
        return plan;
    }

    const matchingToolCall = Array.isArray(onDemandToolCalls)
        ? onDemandToolCalls.find((tc) => tc?.args?.module === targetMod)
        : null;

    let filterParams = null;
    if (matchingToolCall?.args) {
        const a = matchingToolCall.args;
        const candidate = { module: targetMod };
        let hasAny = false;
        if (a.status && a.status !== 'all' && a.status !== 'ALL') {
            candidate.status = a.status;
            hasAny = true;
        }
        if (a.alertType && a.alertType !== 'ALL') {
            candidate.alertType = a.alertType;
            hasAny = true;
        }
        if (a.datePreset && a.datePreset !== 'all') {
            candidate.datePreset = a.datePreset;
            hasAny = true;
        }
        if (typeof a.fromDay === 'number' && typeof a.toDay === 'number') {
            candidate.fromDay = a.fromDay;
            candidate.toDay = a.toDay;
            candidate.status = candidate.status || 'selected';
            hasAny = true;
        }
        if (hasAny) filterParams = candidate;
    }

    if (!filterParams) {
        filterParams = inferFilterParamsForModule(userText, targetMod);
    }

    const synthesizedActions = [];
    if (targetMod !== currentModule) {
        synthesizedActions.push({ name: 'navigate', params: { module: targetMod } });
    }

    if (matchingToolCall?.args?.query) {
        synthesizedActions.push({
            name: 'search',
            params: { module: targetMod, query: matchingToolCall.args.query },
        });
    } else if (filterParams) {
        const alreadySameFilterOnScreen =
            targetMod === currentModule &&
            (!filterParams.status || filterParams.status === activeFilters?.status) &&
            (!filterParams.alertType || filterParams.alertType === activeFilters?.alertType) &&
            (!filterParams.datePreset || filterParams.datePreset === activeFilters?.datePreset);
        if (!alreadySameFilterOnScreen) {
            synthesizedActions.push({ name: 'applyFilter', params: filterParams });
        }
    }

    if (synthesizedActions.length === 0) return plan;

    const candidatePlan = {
        ...plan,
        scope: targetMod !== currentModule ? 'other_screen' : plan.scope,
        actions: synthesizedActions,
    };
    const rechecked = validateActionPlan(candidatePlan, { currentModule, user });
    return rechecked.success ? { ...plan, ...rechecked.data } : plan;
};

const UNVERIFIED_DATA_CLAIM_REGEX =
    /\b(?:no veo|no hay|no encontr[eé]|ning[uú]n|there are no|i see \d+|hay \d+\s+(?:pagos?|motos?|alertas?|contratos?|facturas?|comandos?|registros?)|suman\s+\$?[\d.,]+)/i;
const SECURITY_OR_OFFTOPIC_REGEX =
    /\b(solo lectura|read-only|no puedo ayudar|no tengo permiso|permission)\b/i;

/**
 * Checks whether a tenant `MemorySession` already holds at least one verified
 * `function_call_output` from a prior turn so contextual follow-ups ("¿el del 24 se ejecutó bien?")
 * answered directly from session memory are recognized as grounded.
 */
export const hasVerifiedToolOutputInSession = async (session) => {
    if (!session || typeof session.getItems !== 'function') return false;
    try {
        const items = await session.getItems();
        if (!Array.isArray(items) || items.length === 0) return false;
        for (let i = items.length - 1; i >= 0; i--) {
            const it = items[i];
            if (it?.type !== 'function_call_result' && it?.type !== 'function_call_output') {
                continue;
            }
            const rawOut =
                typeof it.output === 'string'
                    ? it.output
                    : typeof it.output?.text === 'string'
                    ? it.output.text
                    : JSON.stringify(it.output || '');
            if (!rawOut) continue;
            try {
                const parsed = JSON.parse(rawOut);
                if (
                    parsed &&
                    typeof parsed === 'object' &&
                    !parsed.error &&
                    parsed.authorized !== false &&
                    parsed.ok !== false &&
                    parsed.skipped !== true
                ) {
                    return true;
                }
            } catch {
                // Ignore non-JSON outputs
            }
        }
    } catch {
        // Ignore session inspection errors
    }
    return false;
};

/**
 * Lightweight, SDK-compatible Goal Completion Verification (Phase 4).
 * Verifies whether the produced ActionPlan actually satisfies the user's original intent
 * instead of treating any UI action or ungrounded text as complete.
 *
 * @returns {{
 *   status: 'complete' | 'incomplete' | 'clarification_needed' | 'failed',
 *   reason: string,
 *   requiresToolData: boolean,
 *   suggestedPlanOverride: object | null,
 * }}
 */
export const evaluateGoalCompletion = ({
    userText = '',
    plan = null,
    onDemandToolCalls = null,
    sessionHasVerifiedToolData = false,
    toolErrors = [],
    lang = 'es-CO',
} = {}) => {
    const isEn = lang === 'en-US';
    if (!plan || typeof plan !== 'object') {
        return {
            status: 'failed',
            reason: 'missing_plan',
            requiresToolData: false,
            suggestedPlanOverride: null,
        };
    }

    const tpl = String(plan.responseTemplate || '').trim();
    const actions = Array.isArray(plan.actions) ? plan.actions : [];
    const hasPlaceholders = /\{\{\s*[a-zA-Z0-9_.-]+\s*\}\}/.test(tpl);
    const hasVerifiedToolData = Array.isArray(onDemandToolCalls) && onDemandToolCalls.length > 0;
    const hasAnyVerifiedData = hasVerifiedToolData || Boolean(sessionHasVerifiedToolData);
    const errors = Array.isArray(toolErrors) ? toolErrors : [];
    // A pure view command runs with toolChoice='none', so it must never be judged as requiring tool data.
    const analytical = isAnalyticalQuestion(userText) && !isPureUiViewCommand(userText);
    const isSecurityOrOffTopic = SECURITY_OR_OFFTOPIC_REGEX.test(tpl);
    const hasUnverifiedClaim = UNVERIFIED_DATA_CLAIM_REGEX.test(tpl) || /\$\s?\d[\d.,]+/.test(tpl);

    // 1. All attempted tool calls failed -> never invent counts/zero claims; report technical failure
    if (errors.length > 0 && !hasVerifiedToolData) {
        const failedMessage = isEn
            ? 'I could not retrieve the live records needed to answer that right now. Please try again in a moment.'
            : 'No pude consultar los registros en vivo para responderte con exactitud en este momento. Intenta de nuevo en un instante.';
        return {
            status: 'failed',
            reason: 'tool_execution_failed',
            requiresToolData: true,
            suggestedPlanOverride: {
                ...plan,
                actions: [],
                needsClarification: false,
                responseTemplate: failedMessage,
            },
        };
    }

    // 2. Genuine clarification requested by the agent
    if (plan.needsClarification) {
        return {
            status: 'clarification_needed',
            reason: 'genuine_clarification',
            requiresToolData: false,
            suggestedPlanOverride: null,
        };
    }

    // 3. Analytical/quantitative question answered ONLY with a UI filter/navigation action
    //    (e.g. "¿Cuántas alertas son por batería?" -> "Listo, ya te filtré las alertas por batería.")
    if (
        analytical &&
        !hasAnyVerifiedData &&
        !hasPlaceholders &&
        !isSecurityOrOffTopic &&
        actions.length > 0
    ) {
        return {
            status: 'incomplete',
            reason: 'ui_action_only_for_analytical_query',
            requiresToolData: true,
            suggestedPlanOverride: null,
        };
    }

    // 4. Unverified numeric/amount/zero-result claim OR diagnostic/analytical answer with zero tool data
    if (
        !hasAnyVerifiedData &&
        !hasPlaceholders &&
        !isSecurityOrOffTopic &&
        actions.length === 0 &&
        (hasUnverifiedClaim || (analytical && /\b(porque|tiene|está|esta|presenta|indica|debe|falla|batería|bateria|alternador|naranja|corte)\b/i.test(tpl)))
    ) {
        return {
            status: 'incomplete',
            reason: hasUnverifiedClaim
                ? 'unverified_data_claim_without_tool'
                : 'analytical_answer_without_tool_data',
            requiresToolData: true,
            suggestedPlanOverride: {
                ...plan,
                needsClarification: true,
                responseTemplate: isEn
                    ? 'Could you confirm what filter or period you want me to check on this screen?'
                    : '¿Me confirmas qué filtro o período quieres revisar en esta pantalla para darte el dato exacto?',
            },
        };
    }

    // 5. Verified complete
    if (hasVerifiedToolData) {
        return {
            status: 'complete',
            reason: 'verified_tool_data',
            requiresToolData: false,
            suggestedPlanOverride: null,
        };
    }

    if (sessionHasVerifiedToolData && actions.length === 0) {
        return {
            status: 'complete',
            reason: 'verified_session_tool_data',
            requiresToolData: false,
            suggestedPlanOverride: null,
        };
    }

    if (actions.length > 0) {
        return {
            status: 'complete',
            reason: 'ui_action_planned',
            requiresToolData: false,
            suggestedPlanOverride: null,
        };
    }

    return {
        status: 'complete',
        reason: 'conversational_response',
        requiresToolData: false,
        suggestedPlanOverride: null,
    };
};

/**
 * Builds the Phase 10 independent turn telemetry status object.
 */
export const buildTurnTelemetry = ({
    routingMode = 'agents_sdk',
    agentRunStatus = 'completed',
    toolExecutionStatus = 'not_needed',
    goalCompletionStatus = 'complete',
    responseStatus = 'generated',
    fallbackReason = null,
} = {}) => ({
    routingMode,
    agentRunStatus,
    toolExecutionStatus,
    goalCompletionStatus,
    responseStatus,
    fallbackReason: fallbackReason || null,
});

/**
 * Runs a complete UPay Assistant turn using `@openai/agents` (`Runner`, `Agent`, `MemorySession`, `tool`).
 * Supports both non-streaming (`stream: false`) and real-time streaming (`stream: true`).
 */
export const runAssistantTurnWithAgentsSdk = async ({
    openai,
    modelName = 'gpt-4o-mini',
    promptVersion = 'v2',
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
    maxAgentTurns = 3,
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

    const isV2 = promptVersion !== 'v1';
    const turnTracker = {
        lastResponseId: null,
        rawUsages: [],
        openaiCallSeq: 0,
        onLog,
        seenToolCalls: 0,
        executedToolCalls: 0,
        maxToolCallsPerTurn,
        forceSynthesisAfterFirstToolRound: Boolean(stream),
        onDemandToolCalls: [],
        toolErrors: [],
        roundIndex: 0,
    };

    const sessionEntry = getOrCreateTenantSession(user, roleVariant, {
        ephemeral: ephemeralSession,
    });
    await syncClientHistoryIntoSession(sessionEntry, conversationHistory);
    await trimMemorySessionSafely(sessionEntry.session, MAX_SESSION_USER_TURNS, {
        compactOlderToolOutputs: isV2,
    });
    const priorSessionItems = await sessionEntry.session.getItems();
    const sessionHasVerifiedToolData = await hasVerifiedToolOutputInSession(sessionEntry.session);

    let callSeq = 0;
    const turnToolCache = new Map();
    const fetchRecordsAgentTool = tool({
        name: 'fetch_module_records',
        description: isV2 ? FETCH_TOOL_DESCRIPTION_V2 : FETCH_TOOL_DESCRIPTION_V1,
        parameters: FetchModuleRecordsZodSchema,
        execute: async (rawArgs) => {
            if (signal?.aborted) {
                throw new Error('TURN_CANCELLED');
            }
            const callId = `call_${++callSeq}`;
            turnTracker.seenToolCalls += 1;

            if (
                turnTracker.executedToolCalls >= maxToolCallsPerTurn ||
                turnTracker.seenToolCalls > maxToolCallsPerTurn
            ) {
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
                turnTracker.toolErrors.push({
                    callId,
                    tool: 'fetch_module_records',
                    code: 'INVALID_OR_UNAUTHORIZED_ARGS',
                    error: argCheck.error,
                });
                return JSON.stringify({
                    authorized: false,
                    error: argCheck.error,
                    records: [],
                });
            }

            const activeFilters = applicationContext?.activeFilters || {};
            const cleanArgs = argCheck.data;
            const isSameModule =
                cleanArgs.module === (applicationContext?.currentModule || 'dashboard');
            // Period filters (month/year) are only inherited from the screen being queried;
            // another module's month filter must not leak into a cross-module lookup.
            const resolvedMonth = isFullYearFn?.(rawUserText)
                ? 0
                : cleanArgs.month !== undefined && cleanArgs.month !== null
                ? cleanArgs.month
                : !isSameModule
                ? null
                : activeFilters.month === ''
                ? 0
                : activeFilters.month ?? null;

            const fetchArgs = {
                module: cleanArgs.module,
                status: cleanArgs.status ?? (isSameModule ? activeFilters.status : null) ?? null,
                alertType:
                    cleanArgs.alertType ?? (isSameModule ? activeFilters.alertType : null) ?? null,
                datePreset:
                    cleanArgs.datePreset ?? (isSameModule ? activeFilters.datePreset : null) ?? null,
                query: cleanArgs.query ?? (isSameModule ? activeFilters.searchQuery : null) ?? null,
                month: resolvedMonth,
                year: cleanArgs.year ?? (isSameModule ? activeFilters.year : null) ?? null,
                fromDay: cleanArgs.fromDay ?? (isSameModule ? activeFilters.fromDay : null) ?? null,
                toDay: cleanArgs.toDay ?? (isSameModule ? activeFilters.toDay : null) ?? null,
                companyId: activeFilters.companyId ?? null,
                limit: cleanArgs.limit,
                auth: user,
            };

            const dedupeSignature = JSON.stringify({
                module: fetchArgs.module,
                status: fetchArgs.status,
                alertType: fetchArgs.alertType,
                datePreset: fetchArgs.datePreset,
                query: fetchArgs.query,
                month: fetchArgs.month,
                year: fetchArgs.year,
                fromDay: fetchArgs.fromDay,
                toDay: fetchArgs.toDay,
                limit: fetchArgs.limit,
            });

            if (isV2 && turnToolCache.has(dedupeSignature)) {
                const cachedEntry = await turnToolCache.get(dedupeSignature);
                onLog?.(`  ├─ ♻️ Herramienta fetch_module_records · reutiliza resultado duplicado (${callId})`, {
                    module: fetchArgs.module,
                });
                return JSON.stringify({
                    deduplicated: true,
                    module: fetchArgs.module,
                    totalMatching: cachedEntry?.totalMatching ?? 0,
                    note: 'Identical query already executed in this turn; use the verified records returned in the sibling tool output.',
                });
            }

            turnTracker.executedToolCalls += 1;

            onLog?.(`  ├─ 🔧 Herramienta fetch_module_records · ejecutando (${callId}):`, {
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

            let resolveInFlight;
            if (isV2) {
                turnToolCache.set(
                    dedupeSignature,
                    new Promise((r) => {
                        resolveInFlight = r;
                    })
                );
            }

            let toolResult;
            try {
                toolResult = await toolExecutor(fetchArgs);
            } catch (err) {
                if (isV2) {
                    turnToolCache.delete(dedupeSignature);
                    resolveInFlight?.(null);
                }
                if (signal?.aborted || err?.message === 'TURN_CANCELLED') {
                    throw err;
                }
                const errMsg =
                    typeof err?.message === 'string'
                        ? err.message.slice(0, 140)
                        : 'tool_execution_error';
                turnTracker.toolErrors.push({
                    callId,
                    tool: 'fetch_module_records',
                    module: fetchArgs.module,
                    code: 'TOOL_EXECUTION_ERROR',
                    error: errMsg,
                });
                onLog?.(`  ├─ ❌ Herramienta fetch_module_records · error (${fetchArgs.module}):`, errMsg);
                onToolCompleted?.({
                    callId,
                    tool: 'fetch_module_records',
                    module: fetchArgs.module,
                    recordsReturned: 0,
                    totalMatching: 0,
                    isComplete: false,
                    error: errMsg,
                });
                return JSON.stringify({
                    ok: false,
                    error: errMsg,
                    records: [],
                    note: 'Tool execution failed. Do NOT invent counts, amounts, or zero-result claims; explain transparently that the live query failed.',
                });
            }

            if (signal?.aborted) {
                throw new Error('TURN_CANCELLED');
            }

            if (toolResult?.error || toolResult?.authorized === false) {
                if (isV2) {
                    turnToolCache.delete(dedupeSignature);
                    resolveInFlight?.(null);
                }
                turnTracker.toolErrors.push({
                    callId,
                    tool: 'fetch_module_records',
                    module: fetchArgs.module,
                    code: toolResult?.authorized === false ? 'UNAUTHORIZED' : 'TOOL_ERROR',
                    error: String(toolResult?.error || 'unauthorized'),
                });
                onToolCompleted?.({
                    callId,
                    tool: 'fetch_module_records',
                    module: fetchArgs.module,
                    recordsReturned: 0,
                    totalMatching: 0,
                    isComplete: false,
                    error: String(toolResult?.error || 'unauthorized'),
                });
                return JSON.stringify(toolResult);
            }

            const recordsReturned = Array.isArray(toolResult?.records)
                ? toolResult.records.length
                : 0;
            const totalMatching = toolResult?.totalMatching ?? 0;

            onLog?.(`  ├─ ✅ Herramienta fetch_module_records · resultado (${fetchArgs.module}):`, {
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

            resolveInFlight?.({ totalMatching });
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

    const forceNoToolForPureView = isV2 && isPureUiViewCommand(rawUserText);

    const agent = new Agent({
        name: 'UPayVoiceAssistant',
        instructions: stablePrefix,
        model: modelInstance,
        tools: [fetchRecordsAgentTool],
        outputType: ActionPlanZodSchema,
        modelSettings: {
            temperature,
            maxTokens: maxOutputTokens,
            ...(forceNoToolForPureView ? { toolChoice: 'none' } : {}),
            providerData: {
                prompt_cache_key: cacheKey,
            },
        },
    });

    const runner = new Runner({
        tracingDisabled: process.env.OPENAI_AGENTS_TRACING !== 'true',
        workflowName: 'UPay Voice Assistant',
    });

    const isWsUpstream = transportMode === 'ws' && typeof openai?.baseURL === 'string';
    if (isWsUpstream) {
        onLog?.('  ├─ 📤 OpenAI (WebSocket) · petición', {
            model: modelName,
            prompt_cache_key: cacheKey,
            instructionsChars: typeof stablePrefix === 'string' ? stablePrefix.length : 0,
            dynamicInput: dynamicInputText,
        });
    }

    const safeMaxTurns = Math.min(Math.max(Number(maxAgentTurns) || 3, 2), 4);

    if (!stream) {
        const result = await runner.run(agent, dynamicInputText, {
            session: sessionEntry.session,
            maxTurns: safeMaxTurns,
            ...(signal ? { signal } : {}),
        });
        await trimMemorySessionSafely(sessionEntry.session, MAX_SESSION_USER_TURNS, {
            compactOlderToolOutputs: isV2,
        });
        const aggregatedUsage = aggregateTurnUsage(turnTracker.rawUsages, result);
        if (isWsUpstream) {
            onLog?.('  ├─ 📥 OpenAI (WebSocket) · respuesta', {
                finalOutput: result.finalOutput,
                usage: aggregatedUsage,
            });
        }
        return {
            finalOutput: result.finalOutput,
            usage: aggregatedUsage,
            perRoundUsages: turnTracker.rawUsages.filter(Boolean),
            priorSessionItems,
            onDemandToolCalls:
                turnTracker.onDemandToolCalls.length > 0 ? turnTracker.onDemandToolCalls : null,
            sessionHasVerifiedToolData,
            toolErrors: turnTracker.toolErrors,
            toolRounds: Math.max(
                0,
                turnTracker.rawUsages.filter(Boolean).length - 1,
                turnTracker.executedToolCalls > 0 ? 1 : 0
            ),
            sessionKey: sessionEntry.sessionKey,
            sessionEntry,
        };
    }

    const streamedResult = await runner.run(agent, dynamicInputText, {
        session: sessionEntry.session,
        stream: true,
        maxTurns: safeMaxTurns,
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
    await trimMemorySessionSafely(sessionEntry.session, MAX_SESSION_USER_TURNS, {
        compactOlderToolOutputs: isV2,
    });

    const aggregatedUsage = aggregateTurnUsage(turnTracker.rawUsages, streamedResult);
    if (isWsUpstream) {
        onLog?.('  ├─ 📥 OpenAI (WebSocket) · respuesta', {
            finalOutput: streamedResult.finalOutput,
            usage: aggregatedUsage,
        });
    }
    return {
        finalOutput: streamedResult.finalOutput,
        usage: aggregatedUsage,
        perRoundUsages: turnTracker.rawUsages.filter(Boolean),
        priorSessionItems,
        onDemandToolCalls:
            turnTracker.onDemandToolCalls.length > 0 ? turnTracker.onDemandToolCalls : null,
        sessionHasVerifiedToolData,
        toolErrors: turnTracker.toolErrors,
        toolRounds: Math.max(
            0,
            turnTracker.rawUsages.filter(Boolean).length - 1,
            turnTracker.executedToolCalls > 0 ? 1 : 0
        ),
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
    isAnalyticalQuestion,
    evaluateGoalCompletion,
    buildTurnTelemetry,
    runAssistantTurnWithAgentsSdk,
    closeSharedAgentsWSModel,
    aggregateTurnUsage,
};
