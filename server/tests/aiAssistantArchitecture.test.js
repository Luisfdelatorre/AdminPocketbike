/**
 * Regression Test Suite — UPay AI Assistant Agents SDK Architecture Improvements (Phases 2–10)
 *
 * Covers:
 *  1. Fast-path navigation vs contextual pronoun delegation to Agents SDK.
 *  2. Goal-completion verification (UI-only answer to analytical query vs verified tool data).
 *  3. Cross-module multi-tool execution within Agents SDK (`maxTurns` & `maxToolCallsPerTurn`).
 *  4. Battery health alerts (`devices` / `battery_issue`) vs power-cut telemetry (`alerts` / `POWER_CUT`).
 *  5. Weekly contracts in arrears (`summary` / `debt`).
 *  6. Failed tool execution (no fabricated counts, no fake clarification).
 *  7. Internal daily AI token quota exhaustion (standalone quota notice, no concatenated data, safe local nav allowed).
 *  8. Technical OpenAI / network timeout failure (error status, not clarification).
 *  9. Colombian Peso (COP) speech normalization (singular, thousands, millions, centavos, plates/dates/percentages intact).
 * 10. Privacy filter + COP normalization ordering before Neural TTS.
 * 11. Independent structured telemetry fields (`routingMode`, `agentRunStatus`, `toolExecutionStatus`,
 *     `goalCompletionStatus`, `responseStatus`, `fallbackReason`).
 */

import { describe, it, afterEach } from 'node:test';
import assert from 'node:assert/strict';

import {
    MATCH_STATUS,
    matchLocalIntent,
} from '../../client/src/services/voiceAssistant/matcher.js';
import {
    numberToSpanishWords,
    normalizeCOPForSpeech,
} from '../../client/src/services/voiceAssistant/speechNormalization.js';
import { prepareSpokenResponse } from '../../client/src/services/voiceAssistant/tts.js';
import {
    registerScreenBridge,
    clearAllScreenBridges,
} from '../../client/src/services/voiceAssistant/screenBridge.js';
import { dispatchActionPlan } from '../../client/src/services/voiceAssistant/dispatcher.js';
import {
    doesBridgeMatchScope,
    resolveTemplatePlaceholders,
} from '../../client/src/services/voiceAssistant/resolvers.js';
import {
    evaluateGoalCompletion,
    isAnalyticalQuestion,
    isPureUiViewCommand,
    ensureRequestedViewActions,
    clearAllTenantSessions,
} from '../services/aiAssistantAgentRuntime.js';
import {
    planContextualFallback,
    interpretUserRequest,
    recordMetricsSample,
    resetDailyTokenUsageForTest,
} from '../services/aiAssistantService.js';
import {
    streamAssistantTurn,
    applyServerSpeechPrivacyFilter,
} from '../services/aiAssistantStreamService.js';

const adminUser = {
    userId: 'arch_admin_1',
    role: 'admin',
    isSuperAdmin: false,
    companyId: 'comp_arch_1',
};

const baseContext = {
    currentRoute: '/dashboard',
    currentModule: 'dashboard',
    activeFilters: {},
};

const makeFakeResponsesClient = (turnResponses = []) => {
    let idx = 0;
    return {
        responses: {
            create: async () => {
                const next = turnResponses[Math.min(idx++, turnResponses.length - 1)];
                if (typeof next === 'function') return next();
                if (next instanceof Error) throw next;
                return next;
            },
        },
    };
};

afterEach(async () => {
    resetDailyTokenUsageForTest();
    await clearAllTenantSessions();
});

describe('Phase 2 & 6 — Fast-Path Routing & Contextual Pronoun Delegation', () => {
    it('resolves pure navigation and clear-filters locally without OpenAI', () => {
        const nav = matchLocalIntent('Abre pagos', { currentModule: 'dashboard', lang: 'es-CO' });
        assert.equal(nav.status, MATCH_STATUS.MATCH);
        assert.equal(nav.resolvedLocally, true);
        assert.equal(nav.plan.targetModule, 'payments');

        const clear = matchLocalIntent('Quita los filtros', { currentModule: 'payments', lang: 'es-CO' });
        assert.equal(clear.status, MATCH_STATUS.MATCH);
        assert.equal(clear.plan.actions[0].name, 'clearFilters');
    });

    it('delegates pronoun follow-ups ("Filtra esas", "Muestra esos") to Agents SDK when conversation context exists', () => {
        const withoutCtx = matchLocalIntent('Filtra esas', {
            currentModule: 'alerts',
            lang: 'es-CO',
            hasConversationContext: false,
        });
        assert.equal(withoutCtx.status, MATCH_STATUS.AMBIGUOUS);

        const withCtx = matchLocalIntent('Filtra esas', {
            currentModule: 'alerts',
            lang: 'es-CO',
            hasConversationContext: true,
        });
        assert.equal(withCtx.status, MATCH_STATUS.NO_MATCH);
        assert.equal(withCtx.resolvedLocally, false);
    });

    it('delegates analytical/unmatched questions to Agents SDK (never local MATCH)', () => {
        const q = matchLocalIntent('¿Cuántas alertas son por batería?', {
            currentModule: 'alerts',
            lang: 'es-CO',
        });
        assert.equal(q.status, MATCH_STATUS.NO_MATCH);
        assert.equal(isAnalyticalQuestion('¿Cuántas alertas son por batería?'), true);
    });
});

describe('Phase 4 — Goal Completion Verification & Multi-Tool Execution', () => {
    it('flags UI-only filter reply to a quantitative question as incomplete', () => {
        const check = evaluateGoalCompletion({
            userText: '¿Cuántas alertas son por batería?',
            plan: {
                scope: 'current_screen',
                targetModule: 'alerts',
                actions: [{ name: 'applyFilter', params: { module: 'alerts', alertType: 'POWER_CUT' } }],
                responseTemplate: 'Listo, ya te filtré las alertas por batería.',
                needsClarification: false,
            },
            onDemandToolCalls: null,
            toolErrors: [],
            lang: 'es-CO',
        });
        assert.equal(check.status, 'incomplete');
        assert.equal(check.reason, 'ui_action_only_for_analytical_query');
    });

    it('marks quantitative question complete when backed by verified tool execution (battery vs power-cut)', async () => {
        const mockClient = makeFakeResponsesClient([
            {
                id: 'resp_alert_1',
                output: [
                    {
                        type: 'function_call',
                        call_id: 'call_alert_1',
                        name: 'fetch_module_records',
                        arguments: JSON.stringify({
                            module: 'alerts',
                            status: null,
                            alertType: 'POWER_CUT',
                            datePreset: null,
                            query: null,
                            month: null,
                            year: null,
                            fromDay: null,
                            toDay: null,
                            limit: 8,
                        }),
                    },
                ],
                usage: { input_tokens: 1200, input_tokens_details: { cached_tokens: 1024 }, output_tokens: 40 },
            },
            {
                id: 'resp_alert_2',
                output_text: JSON.stringify({
                    scope: 'current_screen',
                    targetModule: 'alerts',
                    actions: [],
                    responseTemplate: 'Hay 4 alertas por corte de energía (batería) activas.',
                    needsClarification: false,
                }),
                usage: { input_tokens: 1350, input_tokens_details: { cached_tokens: 1024 }, output_tokens: 38 },
            },
        ]);

        const toolCallsReceived = [];
        const res = await interpretUserRequest({
            text: '¿Cuántas alertas son por corte de batería?',
            lang: 'es-CO',
            applicationContext: { currentRoute: '/alerts', currentModule: 'alerts', activeFilters: {} },
            user: adminUser,
            openaiClient: mockClient,
            toolExecutor: async (args) => {
                toolCallsReceived.push(args);
                return {
                    module: 'alerts',
                    totalMatching: 4,
                    scopeMetadata: { isCompleteCount: true, isCompleteTotal: true },
                    records: [{ plate: 'DRS30I', alertType: 'POWER_CUT' }],
                };
            },
        });

        assert.equal(toolCallsReceived.length, 1);
        assert.equal(toolCallsReceived[0].module, 'alerts');
        assert.equal(toolCallsReceived[0].alertType, 'POWER_CUT');
        assert.equal(res.metrics.routingMode, 'agents_sdk');
        assert.equal(res.metrics.agentRunStatus, 'completed');
        assert.equal(res.metrics.toolExecutionStatus, 'success');
        assert.equal(res.metrics.goalCompletionStatus, 'complete');
        assert.equal(res.metrics.responseStatus, 'generated');
        assert.equal(res.metrics.fallbackReason, null);
    });

    it('supports sequential cross-module tool calls within Agents SDK (e.g., devices battery_issue + summary weekly debt)', async () => {
        const mockClient = makeFakeResponsesClient([
            {
                id: 'resp_cross_1',
                output: [
                    {
                        type: 'function_call',
                        call_id: 'call_c1',
                        name: 'fetch_module_records',
                        arguments: JSON.stringify({
                            module: 'devices',
                            status: 'battery_issue',
                            alertType: null,
                            datePreset: null,
                            query: null,
                            month: null,
                            year: null,
                            fromDay: null,
                            toDay: null,
                            limit: 8,
                        }),
                    },
                ],
                usage: { input_tokens: 1200, output_tokens: 35 },
            },
            {
                id: 'resp_cross_2',
                output: [
                    {
                        type: 'function_call',
                        call_id: 'call_c2',
                        name: 'fetch_module_records',
                        arguments: JSON.stringify({
                            module: 'summary',
                            status: 'debt',
                            alertType: null,
                            datePreset: null,
                            query: null,
                            month: null,
                            year: null,
                            fromDay: null,
                            toDay: null,
                            limit: 8,
                        }),
                    },
                ],
                usage: { input_tokens: 1300, output_tokens: 35 },
            },
            {
                id: 'resp_cross_3',
                output_text: JSON.stringify({
                    scope: 'other_screen',
                    targetModule: 'summary',
                    actions: [],
                    responseTemplate:
                        'Hay 2 motos con alerta de batería y 3 contratos semanales en mora por $703.000.',
                    needsClarification: false,
                }),
                usage: { input_tokens: 1400, output_tokens: 45 },
            },
        ]);

        const queriedModules = [];
        const res = await interpretUserRequest({
            text: '¿Cuántas motos tienen problema de batería y cuántos contratos semanales están en mora?',
            lang: 'es-CO',
            applicationContext: baseContext,
            user: adminUser,
            openaiClient: mockClient,
            toolExecutor: async (args) => {
                queriedModules.push(args.module);
                if (args.module === 'devices') {
                    return {
                        module: 'devices',
                        totalMatching: 2,
                        scopeMetadata: { isCompleteCount: true, isCompleteTotal: true },
                        records: [{ plate: 'DRS30I', batteryHealth: 'warning' }],
                    };
                }
                return {
                    module: 'summary',
                    totalMatching: 3,
                    weeklyDebtorsCount: 3,
                    weeklyDebtTotal: 703000,
                    scopeMetadata: { isCompleteCount: true, isCompleteTotal: true },
                    records: [{ plate: 'DRJ22I', debt: 245000, frequency: 'weekly' }],
                };
            },
        });

        assert.deepEqual(queriedModules, ['devices', 'summary']);
        assert.equal(res.metrics.goalCompletionStatus, 'complete');
        assert.equal(res.metrics.toolExecutionStatus, 'success');
        assert.equal(res.plan.onDemandDataUsed, true);
    });

    it('preserves grounded follow-up answers from MemorySession without re-calling tools (Traces tr_1795568013832_scx26 & tr_1795568048224_zo3ov)', async () => {
        const mockClient = makeFakeResponsesClient([
            // Turn 1 Round 1: call fetch_module_records for DRJ34I
            {
                id: 'resp_cmd_1',
                output: [
                    {
                        type: 'function_call',
                        call_id: 'call_cmd_1',
                        name: 'fetch_module_records',
                        arguments: JSON.stringify({
                            module: 'commands',
                            status: 'ALL',
                            alertType: null,
                            datePreset: null,
                            query: 'DRJ34I',
                            month: 11,
                            year: 2026,
                            fromDay: null,
                            toDay: null,
                            limit: 8,
                        }),
                    },
                ],
                usage: { input_tokens: 1200, output_tokens: 35 },
            },
            // Turn 1 Round 2: summarize DRJ34I commands
            {
                id: 'resp_cmd_2',
                output_text: JSON.stringify({
                    scope: 'current_screen',
                    targetModule: 'commands',
                    actions: [],
                    responseTemplate:
                        'Hay comandos de corte para DRJ34I los días 19, 20, 21, 23 y 24 de noviembre de 2026.',
                    needsClarification: false,
                }),
                usage: { input_tokens: 1350, output_tokens: 40 },
            },
            // Turn 2 Round 1: follow-up answered directly from MemorySession (no new tool call!)
            {
                id: 'resp_cmd_3',
                output_text: JSON.stringify({
                    scope: 'conversation_context',
                    targetModule: 'commands',
                    actions: [],
                    responseTemplate:
                        'Sí, el comando del 24 de noviembre para DRJ34I se ejecutó bien y no hay errores registrados.',
                    needsClarification: false,
                }),
                usage: { input_tokens: 1420, output_tokens: 36 },
            },
        ]);

        const cmdContext = {
            currentRoute: '/commands',
            currentModule: 'commands',
            activeFilters: { status: 'ALL', month: 11, year: 2026 },
        };

        const turn1 = await interpretUserRequest({
            text: '¿Hay alguno para DRJ34I?',
            lang: 'es-CO',
            applicationContext: cmdContext,
            user: adminUser,
            openaiClient: mockClient,
            persistSession: true,
            toolExecutor: async () => ({
                module: 'commands',
                totalMatching: 5,
                scopeMetadata: { isCompleteCount: true, isCompleteTotal: true },
                records: [
                    { plate: 'DRJ34I', date: '2026-11-24', command: 'STOP', status: 'EXECUTED' },
                ],
            }),
        });
        assert.equal(turn1.metrics.goalCompletionStatus, 'complete');

        const turn2 = await interpretUserRequest({
            text: 'el del 24 se ejecuto bien ?',
            lang: 'es-CO',
            applicationContext: cmdContext,
            user: adminUser,
            openaiClient: mockClient,
            persistSession: true,
            toolExecutor: async () => {
                throw new Error('Should not be called when MemorySession already has DRJ34I records');
            },
        });

        assert.equal(turn2.plan.needsClarification, false);
        assert.match(turn2.plan.responseTemplate, /24 de noviembre para DRJ34I se ejecutó bien/i);
        assert.equal(turn2.metrics.goalCompletionStatus, 'complete');
        assert.equal(turn2.metrics.goal_completion_reason, 'verified_session_tool_data');
        assert.equal(turn2.metrics.responseStatus, 'generated');
    });

    it('blocks hallucinated device diagnosis ("por que esta en naranja DRJ22I?") when no tool was called (Trace tr_1795571451308_0dsbb)', () => {
        const check = evaluateGoalCompletion({
            userText: 'por que esta en naranja DRJ22I?',
            plan: {
                scope: 'current_screen',
                targetModule: 'devices',
                actions: [],
                responseTemplate:
                    'La moto con placa DRJ22I está en naranja porque tiene un problema de batería.',
                needsClarification: false,
            },
            onDemandToolCalls: null,
            sessionHasVerifiedToolData: false,
            toolErrors: [],
            lang: 'es-CO',
        });
        assert.equal(check.status, 'incomplete');
        assert.equal(check.reason, 'analytical_answer_without_tool_data');
    });
});

describe('Phase 5 & 7 — Tool Failures, Technical Errors & Clean Quota Handling', () => {
    it('reports tool execution failure transparently without inventing counts or fake clarification', async () => {
        const mockClient = makeFakeResponsesClient([
            {
                id: 'resp_fail_1',
                output: [
                    {
                        type: 'function_call',
                        call_id: 'call_fail_1',
                        name: 'fetch_module_records',
                        arguments: JSON.stringify({
                            module: 'summary',
                            status: 'debt',
                            alertType: null,
                            datePreset: null,
                            query: null,
                            month: null,
                            year: null,
                            fromDay: null,
                            toDay: null,
                            limit: 8,
                        }),
                    },
                ],
                usage: { input_tokens: 1100, output_tokens: 30 },
            },
            {
                id: 'resp_fail_2',
                output_text: JSON.stringify({
                    scope: 'other_screen',
                    targetModule: 'summary',
                    actions: [],
                    responseTemplate: 'No hay motos con deuda hoy.',
                    needsClarification: false,
                }),
                usage: { input_tokens: 1200, output_tokens: 25 },
            },
        ]);

        const res = await interpretUserRequest({
            text: '¿Cuántas motos deben hoy?',
            lang: 'es-CO',
            applicationContext: baseContext,
            user: adminUser,
            openaiClient: mockClient,
            toolExecutor: async () => {
                throw new Error('MongoNetworkTimeoutError');
            },
        });

        assert.equal(res.metrics.toolExecutionStatus, 'failed');
        assert.equal(res.metrics.goalCompletionStatus, 'failed');
        assert.equal(res.metrics.responseStatus, 'error');
        assert.equal(res.plan.needsClarification, false);
        assert.doesNotMatch(res.plan.responseTemplate, /no hay motos/i);
    });

    it('returns a standalone quota notice on analytical queries when daily quota is exceeded (never concatenates stale data)', async () => {
        // Exhaust daily token cap
        recordMetricsSample({
            input_tokens: 2_000_000,
            cached_tokens: 0,
            output_tokens: 1000,
            latency_ms: 10,
        });

        const unusedClient = makeFakeResponsesClient([]);
        const res = await interpretUserRequest({
            text: '¿Cuántas motos deben hoy?',
            lang: 'es-CO',
            applicationContext: baseContext,
            user: adminUser,
            openaiClient: unusedClient,
        });

        assert.equal(res.source, 'quota_guard');
        assert.equal(res.metrics.routingMode, 'local_fallback');
        assert.equal(res.metrics.agentRunStatus, 'quota_exceeded');
        assert.equal(res.metrics.goalCompletionStatus, 'incomplete');
        assert.equal(res.metrics.fallbackReason, 'daily_token_cap_exceeded');
        assert.equal(res.plan.actions.length, 0);
        assert.equal(res.plan.needsClarification, false);
        assert.match(res.plan.responseTemplate, /cuota diaria/i);
        // Must NOT concatenate debt counts or COP amounts
        assert.doesNotMatch(res.plan.responseTemplate, /\$\d|motos con deuda/i);
    });

    it('still allows safe local navigation/filter when daily AI quota is exceeded', async () => {
        recordMetricsSample({
            input_tokens: 2_000_000,
            cached_tokens: 0,
            output_tokens: 1000,
            latency_ms: 10,
        });

        const unusedClient = makeFakeResponsesClient([]);
        const res = await interpretUserRequest({
            text: 'Muéstrame los pagos rechazados',
            lang: 'es-CO',
            applicationContext: baseContext,
            user: adminUser,
            openaiClient: unusedClient,
        });

        assert.equal(res.source, 'contextual_planner');
        assert.equal(res.metrics.agentRunStatus, 'quota_exceeded');
        assert.equal(res.metrics.fallbackReason, 'daily_token_cap_exceeded');
        assert.ok(res.plan.actions.length > 0);
        assert.equal(res.plan.targetModule, 'payments');
    });

    it('does NOT convert a technical OpenAI timeout into a clarification request', async () => {
        const timeoutClient = makeFakeResponsesClient([new Error('Request timeout exceeded')]);
        const res = await interpretUserRequest({
            text: '¿Por qué fallaron los pagos de hoy?',
            lang: 'es-CO',
            applicationContext: baseContext,
            user: adminUser,
            openaiClient: timeoutClient,
        });

        assert.equal(res.source, 'technical_error_fallback');
        assert.equal(res.metrics.agentRunStatus, 'failed');
        assert.equal(res.metrics.responseStatus, 'error');
        assert.equal(res.plan.needsClarification, false);
        assert.match(res.metrics.fallbackReason, /network_timeout/);
    });
});

describe('Phase 9 — Speech Synthesis Normalization for Colombian Pesos (COP)', () => {
    it('converts singular, thousands, millions, and centavos into natural es-CO pesos', () => {
        assert.equal(numberToSpanishWords(703000), 'setecientos tres mil');
        assert.equal(normalizeCOPForSpeech('Deuda de $703.000.'), 'Deuda de setecientos tres mil pesos.');
        assert.equal(normalizeCOPForSpeech('Saldo de $1.'), 'Saldo de un peso.');
        assert.equal(normalizeCOPForSpeech('Total $1.000.000.'), 'Total un millón de pesos.');
        assert.equal(
            normalizeCOPForSpeech('Acumulan $2.216.000.'),
            'Acumulan dos millones doscientos dieciséis mil pesos.'
        );
        assert.equal(
            normalizeCOPForSpeech('Cargo de $1.500,50 COP.'),
            'Cargo de mil quinientos pesos con cincuenta centavos.'
        );
        assert.equal(
            normalizeCOPForSpeech('Valor de 35.000 COP.'),
            'Valor de treinta y cinco mil pesos.'
        );
    });

    it('preserves plates, dates, percentages, and non-currency identifiers untouched', () => {
        const display =
            'Placa DRS30I del 19/11/2026 con avance del 85% debe $245.000 (contrato #1042).';
        const spoken = prepareSpokenResponse(display, { lang: 'es-CO', keepFullList: true });

        assert.match(spoken, /DRS30I/);
        assert.match(spoken, /19\/11\/2026/);
        assert.match(spoken, /85%/);
        assert.match(spoken, /#1042/);
        assert.match(spoken, /doscientos cuarenta y cinco mil pesos/);
        assert.doesNotMatch(spoken, /\$245\.000/);
        // Original display string remains immutable for React UI
        assert.match(display, /\$245\.000/);
    });

    it('respects privacy redaction before COP normalization in Neural TTS pipeline', () => {
        const raw = 'Conductor Carlos Pérez tiene deuda por $703.000.';
        const redacted = applyServerSpeechPrivacyFilter(raw, {
            speakAmounts: false,
            speakCustomerNames: false,
            lang: 'es-CO',
        });
        const spoken = prepareSpokenResponse(redacted, { lang: 'es-CO', keepFullList: true });

        assert.doesNotMatch(spoken, /setecientos|703|Carlos/);
        assert.match(spoken, /el titular registrado/);
        assert.match(spoken, /el monto mostrado en pantalla/);
    });

    it('emits structured Phase 10 telemetry on streaming turns too', async () => {
        const events = [];
        const result = await streamAssistantTurn({
            turnId: 'arch_stream_1',
            text: 'Muéstrame los pagos rechazados',
            lang: 'es-CO',
            applicationContext: baseContext,
            user: adminUser,
            openaiClient: null,
            emit: (ev) => events.push(ev),
        });

        assert.ok(result);
        assert.equal(result.metrics.routingMode, 'local_fallback');
        assert.equal(result.metrics.agentRunStatus, 'unavailable');
        assert.equal(result.metrics.toolExecutionStatus, 'not_needed');
        assert.equal(result.metrics.goalCompletionStatus, 'complete');
        assert.equal(result.metrics.responseStatus, 'fallback');
        assert.equal(result.metrics.fallbackReason, 'no_openai_client');
    });
});

describe('PATH A — Verified Local Response Enrichment & Scope Safety', () => {
    afterEach(() => {
        clearAllScreenBridges();
    });

    it('keeps "Abre contratos." and "Quita los filtros." short with 0 OpenAI calls and 0 placeholders', () => {
        const nav = matchLocalIntent('Abre contratos.', { currentModule: 'dashboard', lang: 'es-CO' });
        assert.equal(nav.status, MATCH_STATUS.MATCH);
        assert.equal(nav.plan.targetModule, 'contracts');
        assert.doesNotMatch(nav.plan.responseTemplate, /\{\{/);

        const clear = matchLocalIntent('Quita los filtros.', { currentModule: 'payments', lang: 'es-CO' });
        assert.equal(clear.status, MATCH_STATUS.MATCH);
        assert.equal(clear.plan.actions[0].name, 'clearFilters');
        assert.doesNotMatch(clear.plan.responseTemplate, /\{\{/);
    });

    it('enriches "Muéstrame los pagos rechazados." with multiple local placeholders after ScreenBridge confirmation in 1 OpenAI call', async () => {
        let openaiCalls = 0;
        const mockClient = {
            responses: {
                create: async () => {
                    openaiCalls += 1;
                    return {
                        id: 'resp_path_a_pay',
                        output_text: JSON.stringify({
                            scope: 'other_screen',
                            targetModule: 'payments',
                            actions: [
                                { name: 'navigate', params: { module: 'payments', status: null, alertType: null, datePreset: null, month: null, year: null, fromDay: null, toDay: null, sortBy: null, view: null, query: null, targetType: null, identifier: null, topic: null } },
                                { name: 'applyFilter', params: { module: 'payments', status: 'failed', alertType: null, datePreset: null, month: null, year: null, fromDay: null, toDay: null, sortBy: null, view: null, query: null, targetType: null, identifier: null, topic: null } },
                            ],
                            responseTemplate:
                                'Aquí tienes los {{payments.count}} pagos rechazados, que suman {{payments.total}}.',
                            needsClarification: false,
                        }),
                        usage: { input_tokens: 1200, input_tokens_details: { cached_tokens: 1024 }, output_tokens: 45 },
                    };
                },
            },
        };

        const aiRes = await interpretUserRequest({
            text: 'Muéstrame los pagos rechazados.',
            lang: 'es-CO',
            applicationContext: baseContext,
            user: adminUser,
            openaiClient: mockClient,
        });

        assert.equal(openaiCalls, 1, 'Must use exactly 1 OpenAI call for PATH A enrichment');
        assert.equal(aiRes.metrics.goalCompletionStatus, 'complete');

        let appliedStatus = null;
        registerScreenBridge('payments', {
            loading: false,
            activeFilters: { status: 'all', companyId: adminUser.companyId },
            metrics: { filteredCount: 99, filteredTotal: 9999999 },
            applyFilter: async (params) => {
                appliedStatus = params.status;
                // Simulate React updating ScreenBridge with verified filtered data
                registerScreenBridge('payments', {
                    loading: false,
                    activeFilters: { status: params.status, companyId: adminUser.companyId },
                    metrics: { filteredCount: 4, filteredTotal: 540000, isPaginated: false },
                });
                return true;
            },
        });

        const dispatched = await dispatchActionPlan(aiRes.plan, {
            navigate: () => {},
            user: adminUser,
            lang: 'es-CO',
            currentModule: 'dashboard',
        });

        assert.equal(dispatched.ok, true);
        assert.equal(appliedStatus, 'failed');
        assert.doesNotMatch(dispatched.reply, /\{\{/);
        assert.match(dispatched.reply, /4 pagos rechazados/);
        assert.match(dispatched.reply, /540\.000/);

        const spoken = prepareSpokenResponse(dispatched.reply, { lang: 'es-CO', keepFullList: true });
        assert.match(spoken, /quinientos cuarenta mil pesos/);
    });

    it('enriches "Muéstrame las motos que están en deuda." with multiple summary placeholders in 1 OpenAI call + COP TTS', async () => {
        let openaiCalls = 0;
        const mockClient = {
            responses: {
                create: async () => {
                    openaiCalls += 1;
                    return {
                        id: 'resp_path_a_debt',
                        output_text: JSON.stringify({
                            scope: 'other_screen',
                            targetModule: 'summary',
                            actions: [
                                { name: 'navigate', params: { module: 'summary', status: null, alertType: null, datePreset: null, month: null, year: null, fromDay: null, toDay: null, sortBy: null, view: null, query: null, targetType: null, identifier: null, topic: null } },
                                { name: 'applyFilter', params: { module: 'summary', status: 'debt', alertType: null, datePreset: null, month: null, year: null, fromDay: null, toDay: null, sortBy: null, view: null, query: null, targetType: null, identifier: null, topic: null } },
                            ],
                            responseTemplate:
                                'Estas son las {{summary.debtorsCount}} motos en deuda, acumulando {{summary.debtTotal}}.',
                            needsClarification: false,
                        }),
                        usage: { input_tokens: 1200, output_tokens: 45 },
                    };
                },
            },
        };

        const aiRes = await interpretUserRequest({
            text: 'Muéstrame las motos que están en deuda.',
            lang: 'es-CO',
            applicationContext: baseContext,
            user: adminUser,
            openaiClient: mockClient,
        });
        assert.equal(openaiCalls, 1);

        registerScreenBridge('summary', {
            loading: false,
            activeFilters: { status: 'debt', companyId: adminUser.companyId },
            metrics: { debtorsCount: 7, filteredDebtTotal: 703000 },
            applyFilter: async () => true,
        });

        const dispatched = await dispatchActionPlan(aiRes.plan, {
            navigate: () => {},
            user: adminUser,
            lang: 'es-CO',
            currentModule: 'dashboard',
        });

        assert.equal(dispatched.ok, true);
        assert.doesNotMatch(dispatched.reply, /\{\{/);
        assert.match(dispatched.reply, /7 motos en deuda/);
        assert.match(dispatched.reply, /703\.000/);

        const spoken = prepareSpokenResponse(dispatched.reply, { lang: 'es-CO', keepFullList: true });
        assert.match(spoken, /setecientos tres mil pesos/);
    });

    it('rejects stale/mismatched ScreenBridge scope and falls back safely when any required metric is unavailable', () => {
        const staleBridge = {
            loading: false,
            activeFilters: { status: 'all', companyId: adminUser.companyId },
            metrics: { filteredCount: 50, filteredTotal: 5000000 },
        };
        assert.equal(
            doesBridgeMatchScope(staleBridge, {
                activeFilters: { status: 'failed' },
                user: adminUser,
            }),
            false
        );

        const wrongTenantBridge = {
            loading: false,
            activeFilters: { status: 'failed', companyId: 'other_company' },
            metrics: { filteredCount: 4, filteredTotal: 540000 },
        };
        assert.equal(
            doesBridgeMatchScope(wrongTenantBridge, {
                activeFilters: { status: 'failed' },
                user: adminUser,
            }),
            false
        );

        // Partial missing metric in multi-placeholder template -> clean fallback, never "no disponible" mid-sentence
        const missingOne = resolveTemplatePlaceholders(
            'Aquí tienes los {{payments.count}} pagos rechazados, que suman {{payments.total}}.',
            {
                user: adminUser,
                lang: 'es-CO',
                metricsOverride: { payments: { filteredCount: 4 } }, // filteredTotal missing!
                hasUiActions: true,
            }
        );
        assert.equal(missingOne.hasMissingMetrics, true);
        assert.doesNotMatch(missingOne.text, /\{\{|no disponible/i);
        assert.equal(missingOne.text, 'Ya apliqué el filtro en pantalla.');
    });

    it('uses Agents SDK data tool for explicit quantitative query "¿Cuántas motos están en deuda y cuánto deben?"', async () => {
        const mockClient = makeFakeResponsesClient([
            {
                id: 'resp_quant_1',
                output: [
                    {
                        type: 'function_call',
                        call_id: 'call_quant_1',
                        name: 'fetch_module_records',
                        arguments: JSON.stringify({
                            module: 'summary',
                            status: 'debt',
                            alertType: null,
                            datePreset: null,
                            query: null,
                            month: 11,
                            year: 2026,
                            fromDay: null,
                            toDay: null,
                            limit: 8,
                        }),
                    },
                ],
                usage: { input_tokens: 1200, output_tokens: 35 },
            },
            {
                id: 'resp_quant_2',
                output_text: JSON.stringify({
                    scope: 'other_screen',
                    targetModule: 'summary',
                    actions: [],
                    responseTemplate: 'Hay 7 motos en deuda por un total de $703.000.',
                    needsClarification: false,
                }),
                usage: { input_tokens: 1350, output_tokens: 30 },
            },
        ]);

        const res = await interpretUserRequest({
            text: '¿Cuántas motos están en deuda y cuánto deben?',
            lang: 'es-CO',
            applicationContext: baseContext,
            user: adminUser,
            openaiClient: mockClient,
            toolExecutor: async (args) => {
                assert.equal(args.module, 'summary');
                assert.equal(args.status, 'debt');
                return {
                    module: 'summary',
                    totalMatching: 7,
                    debtTotal: 703000,
                    scopeMetadata: { isCompleteCount: true, isCompleteTotal: true },
                    records: [{ plate: 'DRS30I', debt: 245000 }],
                };
            },
        });

        assert.equal(res.metrics.goalCompletionStatus, 'complete');
        assert.equal(res.metrics.toolExecutionStatus, 'success');
        assert.doesNotMatch(res.plan.responseTemplate, /\{\{/);
        const spoken = prepareSpokenResponse(res.plan.responseTemplate, { lang: 'es-CO', keepFullList: true });
        assert.match(spoken, /setecientos tres mil pesos/);
    });
});

describe('View-command guard, negated filters & cross-module period isolation', () => {
    const emptyPlan = (targetModule, responseTemplate = 'Aquí tienes.') => ({
        scope: 'current_screen',
        targetModule,
        actions: [],
        responseTemplate,
        needsClarification: false,
    });

    it('maps negated "paid" phrases to PENDING, never PAID, when synthesizing view actions', () => {
        for (const text of [
            'Muéstrame las facturas no pagadas',
            'Muéstrame las facturas sin pagar',
            'Muéstrame las facturas que no se han pagado',
        ]) {
            const plan = ensureRequestedViewActions({
                userText: text,
                plan: emptyPlan('invoices'),
                currentModule: 'dashboard',
                user: adminUser,
            });
            const filter = plan.actions.find((a) => a.name === 'applyFilter');
            assert.ok(filter, `expected applyFilter for "${text}"`);
            assert.equal(filter.params.status, 'PENDING', text);
        }

        const paid = ensureRequestedViewActions({
            userText: 'Muéstrame las facturas pagadas',
            plan: emptyPlan('invoices'),
            currentModule: 'dashboard',
            user: adminUser,
        });
        assert.equal(paid.actions.find((a) => a.name === 'applyFilter').params.status, 'PAID');
    });

    it('never forces toolChoice=none on day ranges ("entre el X y el Y") or metric requests', () => {
        for (const text of [
            'Muéstrame los recaudos entre el 15 y el 20',
            'Muéstrame los recaudos del 15 al 20',
            'Muéstrame el total de pagos aprobados',
            'Muéstrame la suma de los pagos de hoy',
        ]) {
            assert.equal(isPureUiViewCommand(text), false, text);
        }
        assert.equal(isPureUiViewCommand('Muéstrame los pagos rechazados'), true);
        assert.equal(isPureUiViewCommand('Muéstrame las motos con deuda'), true);
    });

    it('does not mark a pure view command as incomplete for lacking tool data', () => {
        const text = 'Muéstrame las motos con deuda';
        assert.equal(isAnalyticalQuestion(text), true);
        const check = evaluateGoalCompletion({
            userText: text,
            plan: {
                ...emptyPlan('summary', 'Aquí tienes las motos en mora.'),
                actions: [{ name: 'applyFilter', params: { module: 'summary', status: 'debt' } }],
            },
        });
        assert.equal(check.status, 'complete');
    });

    it('does not inherit month/year from another module when the tool queries a different module', async () => {
        const fetchCalls = [];
        const mockClient = makeFakeResponsesClient([
            {
                id: 'resp_iso_1',
                output: [
                    {
                        type: 'function_call',
                        call_id: 'call_iso_1',
                        name: 'fetch_module_records',
                        arguments: JSON.stringify({ module: 'dashboard' }),
                    },
                ],
                usage: { input_tokens: 1200, output_tokens: 30 },
            },
            {
                id: 'resp_iso_2',
                output_text: JSON.stringify({
                    scope: 'other_screen',
                    targetModule: 'dashboard',
                    actions: [],
                    responseTemplate: 'La efectividad de cobro es del 92%.',
                    needsClarification: false,
                }),
                usage: { input_tokens: 1300, output_tokens: 30 },
            },
        ]);

        await interpretUserRequest({
            text: '¿Cuál es el porcentaje de recaudo?',
            lang: 'es-CO',
            applicationContext: {
                currentRoute: '/invoices',
                currentModule: 'invoices',
                activeFilters: { status: 'PENDING', month: 3, year: 2025 },
            },
            user: adminUser,
            openaiClient: mockClient,
            toolExecutor: async (args) => {
                fetchCalls.push(args);
                return {
                    module: 'dashboard',
                    totalMatching: 1,
                    scopeMetadata: { isCompleteCount: true, isCompleteTotal: true },
                    records: [{ collectionRate: 92 }],
                };
            },
        });

        assert.equal(fetchCalls.length, 1);
        assert.equal(fetchCalls[0].module, 'dashboard');
        assert.equal(fetchCalls[0].status, null);
        assert.equal(fetchCalls[0].month, null);
        assert.equal(fetchCalls[0].year, null);
    });
});

describe('Invoices pending total ({{invoices.unpaidAmount}})', () => {
    afterEach(() => clearAllScreenBridges());

    it('resolves the outstanding unpaid amount, not the collected total', () => {
        registerScreenBridge('invoices', {
            loading: false,
            activeFilters: { status: 'PENDING', month: 11, year: 2026 },
            metrics: { filteredCount: 40, unpaidCount: 40, unpaidAmount: 1400000, totalAmount: 9800000 },
            applyFilter: async () => true,
            search: async () => true,
            clearFilters: async () => true,
        });
        const res = resolveTemplatePlaceholders('El total pendiente es {{invoices.unpaidAmount}}.', {
            user: adminUser,
            lang: 'es-CO',
        });
        assert.match(res.text, /1\.400\.000/);
        assert.doesNotMatch(res.text, /9\.800\.000/);
    });

    it('fallback planner answers "total de facturas pendientes" with unpaidAmount', () => {
        const plan = planContextualFallback({
            text: 'dame el total de todas las facturas pendientes?',
            applicationContext: {
                currentRoute: '/invoices',
                currentModule: 'invoices',
                activeFilters: { status: 'PENDING', month: 11, year: 2026 },
            },
            user: adminUser,
        });
        assert.match(plan.responseTemplate, /\{\{invoices\.unpaidAmount\}\}/);
    });
});
