/**
 * Deterministic Schema Validator for UPay AI Voice Assistant
 *
 * Provides Zod-compatible `.safeParse()` validation for:
 *  - Single tool actions (`validateAction`)
 *  - Complete model action plans (`validateActionPlan`, max 3 actions)
 *  - Incoming `/api/v1/ai/chat` request payloads (`validateChatRequest`)
 *
 * Shared between `client/` and `server/` with zero external dependencies.
 */

import {
    MODULES,
    MODULE_IDS,
    TOOLS,
    TOOL_NAMES,
    canUserAccessModule,
    normalizeFilterStatus,
    normalizeDatePreset,
    normalizeAlertType,
} from './capabilities.js';

export const MAX_ACTIONS_PER_PLAN = 3;
export const MAX_CONVERSATION_TURNS = 5;
export const MAX_UTTERANCE_LENGTH = 500;

export const VALID_SCOPES = Object.freeze([
    'current_screen',
    'other_screen',
    'conversation_context',
]);

/**
 * Validates and normalizes a single action `{ name, params }` against the canonical catalog
 * and optional authenticated `user` permissions.
 */
export const validateAction = (action, { currentModule = 'dashboard', user = null } = {}) => {
    if (!action || typeof action !== 'object') {
        return { success: false, error: 'Action must be an object' };
    }

    const { name, params = {} } = action;
    if (!TOOL_NAMES.includes(name)) {
        return { success: false, error: `Unsupported tool "${String(name)}"` };
    }

    const toolDef = TOOLS[name];
    if (toolDef.risk !== 'read') {
        return { success: false, error: `Tool "${name}" is not read-only` };
    }

    if (!params || typeof params !== 'object' || Array.isArray(params)) {
        return { success: false, error: `Invalid params object for tool "${name}"` };
    }

    const targetModule = params.module || currentModule || 'dashboard';
    if (!MODULE_IDS.includes(targetModule)) {
        return { success: false, error: `Unsupported module "${String(targetModule)}"` };
    }

    if (user && !canUserAccessModule(targetModule, user)) {
        return {
            success: false,
            error: `User role "${user.role || 'viewer'}" is not authorized to access module "${targetModule}"`,
            code: 'UNAUTHORIZED_MODULE',
        };
    }

    if (!toolDef.supportedModules.includes(targetModule)) {
        return {
            success: false,
            error: `Tool "${name}" is not supported on module "${targetModule}"`,
        };
    }

    switch (name) {
        case 'navigate': {
            if (!params.module || !MODULE_IDS.includes(params.module)) {
                return { success: false, error: 'navigate requires a valid module parameter' };
            }
            return {
                success: true,
                data: { name: 'navigate', params: { module: params.module } },
            };
        }

        case 'applyFilter': {
            const mod = MODULES[targetModule];
            const cleanParams = { module: targetModule };
            let hasAnyFilter = false;

            if (params.status !== undefined && params.status !== null && params.status !== '') {
                const normalizedStatus = normalizeFilterStatus(targetModule, params.status);
                if (normalizedStatus) {
                    cleanParams.status = normalizedStatus;
                    hasAnyFilter = true;
                } else if (targetModule === 'alerts') {
                    const asAlertType = normalizeAlertType(params.status);
                    if (asAlertType) {
                        cleanParams.alertType = asAlertType;
                        hasAnyFilter = true;
                    }
                } else if (mod?.filters?.status) {
                    // Explicit invalid enum when called directly without strict schema
                    return {
                        success: false,
                        error: `Invalid status filter "${String(params.status)}" for module "${targetModule}"`,
                    };
                }
            }

            if (params.alertType !== undefined && params.alertType !== null && params.alertType !== '') {
                if (targetModule === 'alerts') {
                    const normalizedType = normalizeAlertType(params.alertType);
                    if (!normalizedType) {
                        return {
                            success: false,
                            error: `Invalid alertType "${String(params.alertType)}"`,
                        };
                    }
                    cleanParams.alertType = normalizedType;
                    hasAnyFilter = true;
                }
            }

            if (params.datePreset !== undefined && params.datePreset !== null && params.datePreset !== '') {
                const normalizedPreset = normalizeDatePreset(params.datePreset);
                if (!normalizedPreset) {
                    return {
                        success: false,
                        error: `Invalid datePreset "${String(params.datePreset)}"`,
                    };
                }
                if (mod?.filters?.datePreset) {
                    cleanParams.datePreset = normalizedPreset;
                    hasAnyFilter = true;
                }
            }

            const isProvidedNum = (val) =>
                val !== undefined &&
                val !== null &&
                val !== '' &&
                val !== 'null' &&
                val !== 0 &&
                val !== '0';

            if (isProvidedNum(params.month)) {
                const m = Number(params.month);
                if (!Number.isInteger(m) || m < 1 || m > 12) {
                    return { success: false, error: 'month must be an integer between 1 and 12' };
                }
                if (mod?.filters?.month) {
                    cleanParams.month = m;
                    hasAnyFilter = true;
                }
            }

            if (isProvidedNum(params.year)) {
                const y = Number(params.year);
                if (!Number.isInteger(y) || y < 2024 || y > 2030) {
                    return { success: false, error: 'year must be an integer between 2024 and 2030' };
                }
                if (mod?.filters?.year) {
                    cleanParams.year = y;
                    hasAnyFilter = true;
                }
            }

            if (isProvidedNum(params.fromDay)) {
                const fd = Number(params.fromDay);
                if (!Number.isInteger(fd) || fd < 1 || fd > 31) {
                    return { success: false, error: 'fromDay must be an integer between 1 and 31' };
                }
                if (mod?.filters?.fromDay) {
                    cleanParams.fromDay = fd;
                    hasAnyFilter = true;
                }
            }

            if (isProvidedNum(params.toDay)) {
                const td = Number(params.toDay);
                if (!Number.isInteger(td) || td < 1 || td > 31) {
                    return { success: false, error: 'toDay must be an integer between 1 and 31' };
                }
                if (mod?.filters?.toDay) {
                    cleanParams.toDay = td;
                    hasAnyFilter = true;
                }
            }

            if (params.sortBy !== undefined && params.sortBy !== null && params.sortBy !== '') {
                const sortDef = mod?.filters?.sortBy;
                if (sortDef && sortDef.values.includes(params.sortBy)) {
                    cleanParams.sortBy = params.sortBy;
                    hasAnyFilter = true;
                } else if (sortDef) {
                    return {
                        success: false,
                        error: `Invalid sortBy "${String(params.sortBy)}" for module "${targetModule}"`,
                    };
                }
            }

            if (params.view !== undefined && params.view !== null && params.view !== '') {
                const viewDef = mod?.filters?.view;
                if (viewDef && viewDef.values.includes(params.view)) {
                    cleanParams.view = params.view;
                    hasAnyFilter = true;
                } else if (viewDef) {
                    return {
                        success: false,
                        error: `Invalid view "${String(params.view)}" for module "${targetModule}"`,
                    };
                }
            }

            if (!hasAnyFilter) {
                return { success: false, error: 'applyFilter requires at least one valid filter parameter' };
            }

            return {
                success: true,
                data: { name: 'applyFilter', params: cleanParams },
            };
        }

        case 'search': {
            const mod = MODULES[targetModule];
            if (!mod?.supportsSearch) {
                return { success: false, error: `Module "${targetModule}" does not support search` };
            }
            const query = typeof params.query === 'string' ? params.query.trim() : '';
            if (!query || query.length > 80) {
                return { success: false, error: 'search requires a query string between 1 and 80 characters' };
            }
            return {
                success: true,
                data: { name: 'search', params: { module: targetModule, query } },
            };
        }

        case 'clearFilters': {
            return {
                success: true,
                data: { name: 'clearFilters', params: { module: targetModule } },
            };
        }

        case 'openDetail': {
            const allowedTargets = ['contract', 'device_contract', 'alert'];
            if (!allowedTargets.includes(params.targetType)) {
                return {
                    success: false,
                    error: `openDetail targetType must be one of: ${allowedTargets.join(', ')}`,
                };
            }
            const identifier =
                typeof params.identifier === 'string' ? params.identifier.trim().slice(0, 60) : '';
            return {
                success: true,
                data: {
                    name: 'openDetail',
                    params: {
                        module: targetModule,
                        targetType: params.targetType,
                        ...(identifier ? { identifier } : {}),
                    },
                },
            };
        }

        case 'showHelp': {
            const topic = typeof params.topic === 'string' ? params.topic.trim().slice(0, 40) : 'general';
            return {
                success: true,
                data: { name: 'showHelp', params: { topic } },
            };
        }

        default:
            return { success: false, error: `Unhandled tool "${name}"` };
    }
};

/**
 * Validates a full structured plan returned by OpenAI or the local matcher.
 * Never permits partially valid plans.
 */
export const validateActionPlan = (plan, { currentModule = 'dashboard', user = null } = {}) => {
    if (!plan || typeof plan !== 'object') {
        return { success: false, error: 'Plan must be an object' };
    }

    const scope = VALID_SCOPES.includes(plan.scope) ? plan.scope : 'current_screen';
    const targetModule = MODULE_IDS.includes(plan.targetModule) ? plan.targetModule : currentModule;

    if (user && !canUserAccessModule(targetModule, user)) {
        return {
            success: false,
            error: `Not authorized to access module "${targetModule}"`,
            code: 'UNAUTHORIZED_MODULE',
        };
    }

    const rawActions = Array.isArray(plan.actions) ? plan.actions : [];
    if (rawActions.length > MAX_ACTIONS_PER_PLAN) {
        return {
            success: false,
            error: `Action plan exceeds maximum of ${MAX_ACTIONS_PER_PLAN} actions`,
        };
    }

    const validatedActions = [];
    let effectiveModule = targetModule;

    for (const rawAction of rawActions) {
        const res = validateAction(rawAction, { currentModule: effectiveModule, user });
        if (!res.success) {
            // If OpenAI's strict schema emitted a no-op applyFilter (all-null params) or no-op search (empty/null query)
            // alongside other actions or a non-empty responseTemplate, skip the no-op action safely.
            if (
                rawAction?.name === 'applyFilter' &&
                res.error === 'applyFilter requires at least one valid filter parameter'
            ) {
                continue;
            }
            if (
                rawAction?.name === 'search' &&
                res.error === 'search requires a query string between 1 and 80 characters' &&
                (rawAction?.params?.query === null || rawAction?.params?.query === undefined || rawAction?.params?.query === '') &&
                (rawActions.length > 1 || (typeof plan.responseTemplate === 'string' && plan.responseTemplate.trim().length > 0))
            ) {
                continue;
            }
            return {
                success: false,
                error: res.error,
                code: res.code,
            };
        }
        validatedActions.push(res.data);
        if (res.data.name === 'navigate' && res.data.params.module) {
            effectiveModule = res.data.params.module;
        } else if (res.data.params?.module) {
            effectiveModule = res.data.params.module;
        }
    }

    const responseTemplate =
        typeof plan.responseTemplate === 'string' && plan.responseTemplate.trim().length > 0
            ? plan.responseTemplate.trim().slice(0, 600)
            : '';

    const needsClarification = Boolean(plan.needsClarification);
    const onDemandDataUsed = Boolean(plan.onDemandDataUsed);

    if (!responseTemplate && validatedActions.length === 0) {
        return { success: false, error: 'Plan must contain at least one action or a responseTemplate' };
    }

    return {
        success: true,
        data: {
            scope,
            targetModule: effectiveModule,
            actions: validatedActions,
            responseTemplate,
            needsClarification,
            ...(onDemandDataUsed ? { onDemandDataUsed: true } : {}),
        },
    };
};

/**
 * Validates incoming `POST /api/v1/ai/chat` request body.
 */
export const validateChatRequest = (body) => {
    if (!body || typeof body !== 'object') {
        return { success: false, error: 'Request body must be a JSON object' };
    }

    const text = typeof body.text === 'string' ? body.text.trim() : '';
    if (!text) {
        return { success: false, error: 'text is required' };
    }
    if (text.length > MAX_UTTERANCE_LENGTH) {
        return {
            success: false,
            error: `text must not exceed ${MAX_UTTERANCE_LENGTH} characters`,
        };
    }

    const lang = body.lang === 'en-US' ? 'en-US' : 'es-CO';

    const rawCtx = body.applicationContext && typeof body.applicationContext === 'object'
        ? body.applicationContext
        : {};
    const currentModule = MODULE_IDS.includes(rawCtx.currentModule) ? rawCtx.currentModule : 'dashboard';
    const currentRoute = typeof rawCtx.currentRoute === 'string' ? rawCtx.currentRoute.slice(0, 60) : '/';
    const activeFilters =
        rawCtx.activeFilters && typeof rawCtx.activeFilters === 'object' && !Array.isArray(rawCtx.activeFilters)
            ? Object.entries(rawCtx.activeFilters)
                  .slice(0, 8)
                  .reduce((acc, [k, v]) => {
                      if (
                          typeof v === 'string' ||
                          typeof v === 'number' ||
                          typeof v === 'boolean'
                      ) {
                          acc[String(k).slice(0, 24)] = typeof v === 'string' ? v.slice(0, 60) : v;
                      }
                      return acc;
                  }, {})
            : {};

    const selectedItem =
        typeof rawCtx.selectedItem === 'string' ? rawCtx.selectedItem.slice(0, 60) : null;

    const rawHistory = Array.isArray(body.conversationHistory) ? body.conversationHistory : [];
    const conversationHistory = rawHistory.slice(-MAX_CONVERSATION_TURNS).map((turn) => ({
        userText: typeof turn?.userText === 'string' ? turn.userText.slice(0, 240) : '',
        assistantText: typeof turn?.assistantText === 'string' ? turn.assistantText.slice(0, 240) : '',
        targetModule: MODULE_IDS.includes(turn?.targetModule) ? turn.targetModule : null,
        intent: typeof turn?.intent === 'string' ? turn.intent.slice(0, 40) : null,
        executedActions: Array.isArray(turn?.executedActions)
            ? turn.executedActions.slice(0, MAX_ACTIONS_PER_PLAN).map((a) => ({
                  name: TOOL_NAMES.includes(a?.name) ? a.name : 'unknown',
                  params: a?.params && typeof a.params === 'object' ? a.params : {},
              }))
            : [],
        executionStatus: turn?.executionStatus === 'success' ? 'success' : 'failed',
    }));

    return {
        success: true,
        data: {
            text,
            lang,
            applicationContext: {
                currentRoute,
                currentModule,
                activeFilters,
                selectedItem,
            },
            conversationHistory,
        },
    };
};

export const ActionPlanSchema = Object.freeze({
    safeParse: (plan, ctx) => validateActionPlan(plan, ctx),
});

export const ChatRequestSchema = Object.freeze({
    safeParse: (body) => validateChatRequest(body),
});

export const WS_SERVER_EVENT_TYPES = Object.freeze([
    'turn_started',
    'tool_started',
    'tool_completed',
    'text_delta',
    'audio_chunk',
    'turn_completed',
    'turn_failed',
]);

export const WS_CLIENT_EVENT_TYPES = Object.freeze([
    'start_turn',
    'cancel_turn',
    'reset_conversation',
    'ping',
]);

/**
 * Validates complete `fetch_module_records` tool-call arguments BEFORE execution (Req. 7).
 * Rejects non-objects, partial/malformed JSON strings, unsupported modules, and unauthorized roles.
 */
export const validateFetchModuleRecordsArgs = (rawArgs, { currentModule = 'dashboard', user = null } = {}) => {
    let parsed = rawArgs;
    if (typeof rawArgs === 'string') {
        const trimmed = rawArgs.trim();
        if (!trimmed.startsWith('{') || !trimmed.endsWith('}')) {
            return { success: false, error: 'Incomplete or malformed tool argument JSON' };
        }
        try {
            parsed = JSON.parse(trimmed);
        } catch {
            return { success: false, error: 'Failed to parse complete tool argument JSON' };
        }
    }

    if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) {
        return { success: false, error: 'Tool arguments must be a JSON object' };
    }

    const targetModule = parsed.module || currentModule || 'dashboard';
    if (!MODULE_IDS.includes(targetModule)) {
        return { success: false, error: `Unsupported module "${String(targetModule)}"` };
    }

    if (user && !canUserAccessModule(targetModule, user)) {
        return {
            success: false,
            error: `Role not authorized to inspect module "${targetModule}"`,
            code: 'UNAUTHORIZED_MODULE',
        };
    }

    const clean = { module: targetModule };

    if (parsed.status !== undefined && parsed.status !== null && parsed.status !== '' && parsed.status !== 'null') {
        clean.status = normalizeFilterStatus(targetModule, parsed.status) || String(parsed.status).slice(0, 40);
    }
    if (parsed.alertType !== undefined && parsed.alertType !== null && parsed.alertType !== '' && parsed.alertType !== 'null') {
        const normAlert = normalizeAlertType(parsed.alertType);
        if (normAlert) clean.alertType = normAlert;
    }
    if (parsed.datePreset !== undefined && parsed.datePreset !== null && parsed.datePreset !== '' && parsed.datePreset !== 'null') {
        const normPreset = normalizeDatePreset(parsed.datePreset);
        if (normPreset) clean.datePreset = normPreset;
    }
    if (typeof parsed.query === 'string' && parsed.query.trim() && parsed.query !== 'null') {
        clean.query = parsed.query.trim().slice(0, 80);
    }

    const validOptionalInt = (val, min, max) => {
        if (val === undefined || val === null || val === '' || val === 'null' || val === 0 || val === '0') {
            return null;
        }
        const n = Number(val);
        // Treat out-of-range placeholder numbers emitted under strict JSON schemas (e.g. -1 or 9999 on
        // modules without year/month filters like /contracts or /devices) as omitted instead of failing the tool call.
        if (!Number.isInteger(n) || n < min || n > max) return null;
        return n;
    };

    const m = validOptionalInt(parsed.month, 1, 12);
    if (m !== null) clean.month = m;

    const y = validOptionalInt(parsed.year, 2024, 2030);
    if (y !== null) clean.year = y;

    const fd = validOptionalInt(parsed.fromDay, 1, 31);
    if (fd !== null) clean.fromDay = fd;

    const td = validOptionalInt(parsed.toDay, 1, 31);
    if (td !== null) clean.toDay = td;

    const lim = validOptionalInt(parsed.limit, 1, 12);
    clean.limit = !Number.isNaN(lim) && lim !== null ? lim : 8;

    return { success: true, data: clean };
};

export const FetchModuleRecordsArgsSchema = Object.freeze({
    safeParse: (args, ctx) => validateFetchModuleRecordsArgs(args, ctx),
});

/**
 * Validates a typed server->client WebSocket event envelope (Req. 4):
 * `{ turnId, sequence, type, timestamp, payload }`.
 */
export const validateWsEventEnvelope = (envelope) => {
    if (!envelope || typeof envelope !== 'object') {
        return { success: false, error: 'WS event must be an object' };
    }
    const { turnId, sequence, type, timestamp, payload } = envelope;
    if (typeof turnId !== 'string' || !turnId.trim() || turnId.length > 80) {
        return { success: false, error: 'Invalid turnId' };
    }
    if (!Number.isInteger(sequence) || sequence < 1) {
        return { success: false, error: 'sequence must be a positive integer' };
    }
    if (!WS_SERVER_EVENT_TYPES.includes(type)) {
        return { success: false, error: `Unsupported WS event type "${String(type)}"` };
    }
    if (typeof timestamp !== 'string' || Number.isNaN(Date.parse(timestamp))) {
        return { success: false, error: 'Invalid ISO timestamp' };
    }
    if (!payload || typeof payload !== 'object' || Array.isArray(payload)) {
        return { success: false, error: 'payload must be an object' };
    }
    return {
        success: true,
        data: { turnId, sequence, type, timestamp, payload },
    };
};

export default {
    validateAction,
    validateActionPlan,
    validateChatRequest,
    validateFetchModuleRecordsArgs,
    validateWsEventEnvelope,
    ActionPlanSchema,
    ChatRequestSchema,
    FetchModuleRecordsArgsSchema,
    WS_SERVER_EVENT_TYPES,
    WS_CLIENT_EVENT_TYPES,
    MAX_ACTIONS_PER_PLAN,
    MAX_CONVERSATION_TURNS,
    MAX_UTTERANCE_LENGTH,
};
