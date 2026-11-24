/**
 * Automated Test Suite — UPay AI Voice Assistant (Section 18)
 * Run via: `node --test server/tests/aiAssistant.test.js`
 */

import { describe, it, beforeEach } from 'node:test';
import assert from 'node:assert/strict';

import {
    MODULES,
    TOOL_NAMES,
    serializeCatalogForPrompt,
} from '../../client/src/services/voiceAssistant/capabilities.js';
import {
    validateAction,
    validateActionPlan,
    validateChatRequest,
    MAX_CONVERSATION_TURNS,
} from '../../client/src/services/voiceAssistant/schemaValidator.js';
import {
    MATCH_STATUS,
    matchLocalIntent,
} from '../../client/src/services/voiceAssistant/matcher.js';
import {
    registerScreenBridge,
    clearAllScreenBridges,
} from '../../client/src/services/voiceAssistant/screenBridge.js';
import {
    resolveTemplatePlaceholders,
    resolveTemplateWithLiveData,
    applyNaturalCountGrammar,
} from '../../client/src/services/voiceAssistant/resolvers.js';
import {
    prepareSpokenResponse,
} from '../../client/src/services/voiceAssistant/tts.js';
import {
    dispatchActionPlan,
} from '../../client/src/services/voiceAssistant/dispatcher.js';
import {
    buildStablePrefix,
    buildDynamicSuffix,
    extractUsageMetrics,
    planContextualFallback,
    interpretUserRequest,
    FETCH_MODULE_RECORDS_TOOL,
    MAX_TOOL_CALLS_PER_TURN,
} from '../services/aiAssistantService.js';
import { fetchSanitizedModuleRecords } from '../services/assistantDemoService.js';

describe('18.1 Catalog & Schema Validation Tests', () => {
    it('validates canonical read-only actions', () => {
        const nav = validateAction({ name: 'navigate', params: { module: 'payments' } });
        assert.equal(nav.success, true);
        assert.deepEqual(nav.data, { name: 'navigate', params: { module: 'payments' } });

        const filter = validateAction({
            name: 'applyFilter',
            params: { module: 'payments', status: 'rejected', datePreset: 'yesterday' },
        });
        assert.equal(filter.success, true);
        assert.equal(filter.data.params.status, 'failed');
        assert.equal(filter.data.params.datePreset, 'yesterday');
    });

    it('rejects invalid parameters, unsupported tools and unsupported modules', () => {
        assert.equal(validateAction({ name: 'deletePayment', params: {} }).success, false);
        assert.equal(
            validateAction({ name: 'navigate', params: { module: 'nonexistent' } }).success,
            false
        );
        assert.equal(
            validateAction({
                name: 'applyFilter',
                params: { module: 'payments', status: 'invalid_enum' },
            }).success,
            false
        );
        assert.equal(
            validateAction({ name: 'search', params: { module: 'dashboard', query: 'ABC' } })
                .success,
            false
        );
    });

    it('rejects unauthorized capabilities for viewer and non-SuperAdmin roles', () => {
        const viewerUser = { userId: 'v1', role: 'viewer', isSuperAdmin: false };
        const adminUser = { userId: 'a1', role: 'admin', isSuperAdmin: false };
        const superUser = { userId: 's1', role: 'admin', isSuperAdmin: true };

        // Viewer can access payments, cannot access contracts or companies
        assert.equal(
            validateAction(
                { name: 'navigate', params: { module: 'payments' } },
                { user: viewerUser }
            ).success,
            true
        );
        const viewerContracts = validateAction(
            { name: 'navigate', params: { module: 'contracts' } },
            { user: viewerUser }
        );
        assert.equal(viewerContracts.success, false);
        assert.equal(viewerContracts.code, 'UNAUTHORIZED_MODULE');

        // Regular admin cannot access companies (requires SuperAdmin)
        assert.equal(
            validateAction(
                { name: 'navigate', params: { module: 'companies' } },
                { user: adminUser }
            ).success,
            false
        );
        assert.equal(
            validateAction(
                { name: 'navigate', params: { module: 'companies' } },
                { user: superUser }
            ).success,
            true
        );
    });

    it('enforces max 3 actions per plan and deterministic catalog serialization/hashing', () => {
        const fourActions = validateActionPlan({
            scope: 'other_screen',
            targetModule: 'payments',
            actions: [
                { name: 'navigate', params: { module: 'payments' } },
                { name: 'clearFilters', params: { module: 'payments' } },
                { name: 'applyFilter', params: { module: 'payments', status: 'failed' } },
                { name: 'search', params: { module: 'payments', query: 'ABC' } },
            ],
            responseTemplate: 'Done',
        });
        assert.equal(fourActions.success, false);

        const s1 = serializeCatalogForPrompt('admin');
        const s2 = serializeCatalogForPrompt('admin');
        assert.equal(s1, s2);

        const p1 = buildStablePrefix('admin');
        const p2 = buildStablePrefix('admin');
        assert.equal(p1.catalogHash, p2.catalogHash);
        assert.equal(p1.catalogHash.length, 64);
    });
});

describe('18.2 Local Command Matcher Tests', () => {
    it('matches clear Spanish and English navigation, help and clear-filter commands', () => {
        const esNav = matchLocalIntent('Abre contratos');
        assert.equal(esNav.status, MATCH_STATUS.MATCH);
        assert.equal(esNav.plan.targetModule, 'contracts');
        assert.equal(esNav.plan.actions[0].name, 'navigate');

        const enNav = matchLocalIntent('Go to payments', { lang: 'en-US' });
        assert.equal(enNav.status, MATCH_STATUS.MATCH);
        assert.equal(enNav.plan.targetModule, 'payments');

        const clear = matchLocalIntent('Clear filters', { currentModule: 'payments' });
        assert.equal(clear.status, MATCH_STATUS.MATCH);
        assert.equal(clear.plan.actions[0].name, 'clearFilters');

        const help = matchLocalIntent('Show help');
        assert.equal(help.status, MATCH_STATUS.MATCH);
        assert.equal(help.plan.actions[0].name, 'showHelp');
    });

    it('does NOT trigger navigation on questions or negations containing command keywords', () => {
        const qEn = matchLocalIntent("Why can't I open contracts?");
        assert.equal(qEn.status, MATCH_STATUS.NO_MATCH);
        assert.equal(qEn.plan, null);

        const qEs = matchLocalIntent('¿Por qué no puedo abrir contratos?');
        assert.equal(qEs.status, MATCH_STATUS.NO_MATCH);
        assert.equal(qEs.plan, null);

        const neg = matchLocalIntent('No abras pagos');
        assert.equal(neg.status, MATCH_STATUS.NO_MATCH);
    });

    it('detects ambiguous pronoun commands and delegates complex filter queries to NO_MATCH', () => {
        const amb = matchLocalIntent('Open that');
        assert.equal(amb.status, MATCH_STATUS.AMBIGUOUS);

        const complex = matchLocalIntent('Show me rejected payments');
        assert.equal(complex.status, MATCH_STATUS.NO_MATCH);
    });
});

describe('18.3 Action Dispatcher Tests', () => {
    beforeEach(() => {
        clearAllScreenBridges();
    });

    it('executes sequential navigation + filter actions and verifies screen readiness', async () => {
        const visitedRoutes = [];
        let appliedFilter = null;

        registerScreenBridge('payments', {
            loading: false,
            activeFilters: { status: 'all' },
            metrics: {
                filteredCount: 4,
                filteredTotal: 140000,
                loadedCount: 20,
                globalTotalCount: 20,
                isPaginated: false,
            },
            applyFilter: (params) => {
                appliedFilter = params;
                return true;
            },
        });

        const result = await dispatchActionPlan(
            {
                scope: 'other_screen',
                targetModule: 'payments',
                actions: [
                    { name: 'navigate', params: { module: 'payments' } },
                    { name: 'applyFilter', params: { module: 'payments', status: 'failed' } },
                ],
                responseTemplate: 'Found {{payments.count}} rejected payments totaling {{payments.total}}.',
            },
            {
                navigate: (route) => visitedRoutes.push(route),
                currentModule: 'dashboard',
                lang: 'en-US',
            }
        );

        assert.equal(result.ok, true);
        assert.equal(result.executionStatus, 'success');
        assert.deepEqual(visitedRoutes, ['/payments']);
        assert.equal(appliedFilter.status, 'failed');
        assert.match(result.reply, /Found 4 rejected payments/);
    });

    it('halts execution immediately on unauthorized or failed actions', async () => {
        const viewerUser = { userId: 'v1', role: 'viewer', isSuperAdmin: false };
        const visitedRoutes = [];

        const result = await dispatchActionPlan(
            {
                scope: 'other_screen',
                targetModule: 'contracts',
                actions: [{ name: 'navigate', params: { module: 'contracts' } }],
                responseTemplate: 'Opening contracts',
            },
            {
                navigate: (route) => visitedRoutes.push(route),
                user: viewerUser,
                currentModule: 'payments',
            }
        );

        assert.equal(result.ok, false);
        assert.equal(result.executionStatus, 'failed');
        assert.equal(visitedRoutes.length, 0);
    });
});

describe('18.4 Local Response Resolver Tests', () => {
    beforeEach(() => {
        clearAllScreenBridges();
    });

    it('resolves known placeholders with clean inline numbers, blocks unknown ones, and never claims 1 page = global total', () => {
        registerScreenBridge('payments', {
            loading: false,
            metrics: {
                filteredCount: 7,
                filteredTotal: 245000,
                loadedCount: 50,
                globalTotalCount: 180,
                isPaginated: true,
            },
        });

        const res = resolveTemplatePlaceholders(
            'Count: {{payments.count}}, Total: {{payments.total}}, Unknown: {{payments.secretHack}}',
            { lang: 'en-US' }
        );

        // Numerical placeholders stay clean inline (no descriptive prose stuffed mid-sentence)
        assert.match(res.text, /^Count: 7, Total: \$/);
        assert.equal(res.resolvedPlaceholders['payments.count'], '7');
        assert.equal(res.hasPartialScope, true);
        assert.equal(res.resolvedData['payments.count'].isComplete, false);
        assert.match(res.text, /50 currently loaded records out of 180 monthly records/);
        assert.match(res.text, /\[unavailable\]/);
    });

    it('escapes HTML-like strings and enforces module permission checks', () => {
        const htmlAttempt = resolveTemplatePlaceholders(
            '<script>alert(1)</script> {{contracts.count}}',
            {
                user: { role: 'viewer', isSuperAdmin: false },
                lang: 'en-US',
            }
        );

        assert.equal(htmlAttempt.text.includes('<script>'), false);
        assert.match(htmlAttempt.text, /\[restricted\]/);
    });
});

describe('18.5 Multi-Turn Conversation & Expected Final Behavior (Section 21)', () => {
    it('supports the full Section 21 multi-turn walkthrough', () => {
        const history = [];

        // Turn 1: "Show rejected payments."
        const p1 = planContextualFallback({
            text: 'Show rejected payments.',
            lang: 'en-US',
            applicationContext: { currentRoute: '/', currentModule: 'dashboard', activeFilters: {} },
            conversationHistory: history,
        });
        assert.equal(p1.targetModule, 'payments');
        assert.equal(p1.actions[0].name, 'navigate');
        assert.equal(p1.actions[1].name, 'applyFilter');
        assert.equal(p1.actions[1].params.status, 'failed');
        history.push({
            userText: 'Show rejected payments.',
            assistantText: p1.responseTemplate,
            targetModule: 'payments',
            intent: 'applyFilter',
            executedActions: p1.actions,
            executionStatus: 'success',
        });

        // Turn 2: "Filter them by yesterday."
        const p2 = planContextualFallback({
            text: 'Filter them by yesterday.',
            lang: 'en-US',
            applicationContext: {
                currentRoute: '/payments',
                currentModule: 'payments',
                activeFilters: { status: 'failed' },
            },
            conversationHistory: history,
        });
        assert.equal(p2.scope, 'conversation_context');
        assert.equal(p2.actions[0].name, 'applyFilter');
        assert.equal(p2.actions[0].params.status, 'failed');
        assert.equal(p2.actions[0].params.datePreset, 'yesterday');

        // Turn 3: "How many are there?"
        const p3 = planContextualFallback({
            text: 'How many are there?',
            lang: 'en-US',
            applicationContext: {
                currentRoute: '/payments',
                currentModule: 'payments',
                activeFilters: { status: 'failed', datePreset: 'yesterday' },
            },
            conversationHistory: history,
        });
        assert.match(p3.responseTemplate, /\{\{payments\.count\}\}/);

        // Turn 4: "And what is the total?"
        const p4 = planContextualFallback({
            text: 'And what is the total?',
            lang: 'en-US',
            applicationContext: {
                currentRoute: '/payments',
                currentModule: 'payments',
                activeFilters: { status: 'failed' },
            },
            conversationHistory: history,
        });
        assert.match(p4.responseTemplate, /\{\{payments\.total\}\}/);

        // Turn 5: "Now show suspended motorcycles."
        const p5 = planContextualFallback({
            text: 'Now show suspended motorcycles.',
            lang: 'en-US',
            applicationContext: {
                currentRoute: '/payments',
                currentModule: 'payments',
                activeFilters: {},
            },
            conversationHistory: history,
        });
        assert.equal(p5.targetModule, 'devices');
        assert.equal(p5.actions[0].name, 'navigate');
        assert.equal(p5.actions[1].params.status, 'off');
        history.push({
            userText: 'Now show suspended motorcycles.',
            assistantText: p5.responseTemplate,
            targetModule: 'devices',
            intent: 'applyFilter',
            executedActions: p5.actions,
            executionStatus: 'success',
        });

        // Turn 6: "Find ABC123."
        const p6 = planContextualFallback({
            text: 'Find ABC123.',
            lang: 'en-US',
            applicationContext: {
                currentRoute: '/devices',
                currentModule: 'devices',
                activeFilters: { status: 'off' },
            },
            conversationHistory: history,
        });
        assert.equal(p6.actions[0].name, 'search');
        assert.equal(p6.actions[0].params.query, 'ABC123');
        history.push({
            userText: 'Find ABC123.',
            assistantText: p6.responseTemplate,
            targetModule: 'devices',
            intent: 'search',
            executedActions: p6.actions,
            executionStatus: 'success',
        });

        // Turn 7: "Open its contract."
        const p7 = planContextualFallback({
            text: 'Open its contract.',
            lang: 'en-US',
            applicationContext: {
                currentRoute: '/devices',
                currentModule: 'devices',
                activeFilters: {},
                selectedItem: 'ABC123',
            },
            conversationHistory: history,
        });
        assert.equal(p7.actions[0].name, 'openDetail');
        assert.equal(p7.actions[0].params.identifier, 'ABC123');

        // Turn 8: "Go back to payments."
        const p8 = planContextualFallback({
            text: 'Go back to payments.',
            lang: 'en-US',
            applicationContext: {
                currentRoute: '/contracts',
                currentModule: 'contracts',
                activeFilters: {},
            },
            conversationHistory: history,
        });
        assert.equal(p8.actions[0].name, 'navigate');
        assert.equal(p8.actions[0].params.module, 'payments');

        // Turn 9: "Dame la lista de las motos con sabotaje" -> must target /alerts with alertType=UNAUTHORIZED_DRIVING
        const p9 = planContextualFallback({
            text: 'Dame la lista de las motos con sabotaje',
            lang: 'es-CO',
            applicationContext: {
                currentRoute: '/payments',
                currentModule: 'payments',
                activeFilters: {},
            },
            conversationHistory: history,
        });
        assert.equal(p9.targetModule, 'alerts');
        assert.equal(p9.actions[0].name, 'navigate');
        assert.equal(p9.actions[0].params.module, 'alerts');
        assert.equal(p9.actions[1].name, 'applyFilter');
        assert.equal(p9.actions[1].params.alertType, 'UNAUTHORIZED_DRIVING');
    });

    it('trims conversation history to at most 5 turns in validateChatRequest', () => {
        const sevenTurns = Array.from({ length: 7 }, (_, i) => ({
            userText: `Turn ${i + 1}`,
            assistantText: `Reply ${i + 1}`,
            targetModule: 'payments',
            intent: 'navigate',
            executedActions: [],
            executionStatus: 'success',
        }));

        const validated = validateChatRequest({
            text: 'How many are there?',
            applicationContext: { currentRoute: '/payments', currentModule: 'payments' },
            conversationHistory: sevenTurns,
        });

        assert.equal(validated.success, true);
        assert.equal(validated.data.conversationHistory.length, MAX_CONVERSATION_TURNS);
        assert.equal(validated.data.conversationHistory[0].userText, 'Turn 3');
        assert.equal(validated.data.conversationHistory[4].userText, 'Turn 7');
    });
});

describe('18.6 Prompt Caching Architecture Tests', () => {
    it('places stable prefix before dynamic suffix, exceeds 1,024 tokens, and extracts safe usage metrics', () => {
        const prefix = buildStablePrefix('admin');
        assert.ok(
            prefix.estimatedTokens >= 1024,
            `Expected stable prefix >= 1024 tokens for OpenAI Prompt Caching, got ${prefix.estimatedTokens}`
        );
        // Verify tool ordering is deterministic
        assert.deepEqual(TOOL_NAMES, [
            'navigate',
            'applyFilter',
            'search',
            'clearFilters',
            'openDetail',
            'showHelp',
        ]);

        const suffix = buildDynamicSuffix({
            applicationContext: {
                currentRoute: '/payments',
                currentModule: 'payments',
                activeFilters: { status: 'failed' },
                selectedItem: null,
            },
            conversationHistory: [],
            text: 'How many are there?',
            lang: 'en-US',
        });
        assert.ok(suffix.includes('"latestUserMessage":"How many are there?"'));

        const metrics = extractUsageMetrics(
            {
                input_tokens: 1400,
                input_tokens_details: { cached_tokens: 1152 },
                output_tokens: 48,
            },
            {
                catalogHash: prefix.catalogHash,
                modelName: 'gpt-4o-mini',
                latencyMs: 312.4,
            }
        );

        assert.equal(metrics.catalog_hash, prefix.catalogHash);
        assert.equal(metrics.input_tokens, 1400);
        assert.equal(metrics.cached_tokens, 1152);
        assert.equal(metrics.output_tokens, 48);
        assert.equal(metrics.latency_ms, 312);
        assert.equal(metrics.cache_hit_ratio, Number((1152 / 1400).toFixed(4)));
    });

    it('exposes 1:1 on-demand fetch_module_records tool and enforces role permissions', async () => {
        assert.equal(FETCH_MODULE_RECORDS_TOOL.name, 'fetch_module_records');
        assert.deepEqual(
            FETCH_MODULE_RECORDS_TOOL.parameters.properties.module.enum,
            Object.keys(MODULES)
        );

        const alertsSample = await fetchSanitizedModuleRecords({
            module: 'alerts',
            alertType: 'UNAUTHORIZED_DRIVING',
            auth: { role: 'admin', companyId: 'demo-company' },
        });
        assert.equal(alertsSample.authorized, true);
        assert.equal(alertsSample.module, 'alerts');
        assert.ok(Array.isArray(alertsSample.records));
        assert.ok(alertsSample.records.length > 0);
        assert.ok(alertsSample.records[0].timestampLocal);
        assert.ok(alertsSample.records[0].reason);

        const deniedSample = await fetchSanitizedModuleRecords({
            module: 'companies',
            auth: { role: 'admin', isSuperAdmin: false },
        });
        assert.equal(deniedSample.authorized, false);
        assert.deepEqual(deniedSample.records, []);
    });
});

describe('18.7 Natural Conversational Response Generation & Trace Regressions', () => {
    beforeEach(() => {
        clearAllScreenBridges();
    });

    it('produces short natural confirmations for navigation and clearFilters without extra OpenAI calls', async () => {
        const navMatch = matchLocalIntent('Abre contratos', { lang: 'es-CO' });
        assert.equal(navMatch.status, MATCH_STATUS.MATCH);
        assert.equal(navMatch.plan.responseTemplate, 'Listo, ya te muestro los contratos.');

        const motoMatch = matchLocalIntent('Ir a dispositivos', { lang: 'es-CO' });
        assert.equal(motoMatch.status, MATCH_STATUS.MATCH);
        assert.equal(motoMatch.plan.responseTemplate, 'Listo, ya te muestro las motos.');
        assert.equal(motoMatch.plan.responseTemplate.includes('('), false);

        const clearMatch = matchLocalIntent('Quita los filtros', {
            currentModule: 'payments',
            lang: 'es-CO',
        });
        assert.equal(clearMatch.status, MATCH_STATUS.MATCH);
        assert.equal(clearMatch.plan.responseTemplate, 'Quité los filtros.');
    });

    it('replaces robotic filter responses (Trace tr_1795460701922_49xci) and makes only 1 OpenAI call on Path A', async () => {
        let openAiCalls = 0;
        const mockOpenAi = {
            responses: {
                create: async (payload) => {
                    openAiCalls += 1;
                    assert.ok(payload.prompt_cache_key.startsWith('upay_admin_'));
                    return {
                        id: 'resp_path_a_1',
                        output: [],
                        output_text: JSON.stringify({
                            scope: 'other_screen',
                            targetModule: 'payments',
                            actions: [
                                { name: 'navigate', params: { module: 'payments' } },
                                { name: 'applyFilter', params: { module: 'payments', status: 'failed' } },
                            ],
                            responseTemplate: 'Listo, ya te filtré los pagos rechazados.',
                            needsClarification: false,
                        }),
                        usage: { input_tokens: 3100, input_tokens_details: { cached_tokens: 2944 }, output_tokens: 46 },
                    };
                },
            },
        };

        const interpreted = await interpretUserRequest({
            text: 'Muéstrame los pagos rechazados.',
            lang: 'es-CO',
            applicationContext: { currentRoute: '/', currentModule: 'dashboard', activeFilters: { month: 11, year: 2026 } },
            conversationHistory: [],
            user: { role: 'admin', companyId: '69bfc6a83024eb08afb9493f' },
            openaiClient: mockOpenAi,
        });

        // Path A must NOT make a second OpenAI call
        assert.equal(openAiCalls, 1);
        assert.equal(interpreted.source, 'openai_responses');

        registerScreenBridge('payments', {
            loading: false,
            activeFilters: { status: 'failed' },
            metrics: {
                filteredCount: 1,
                filteredTotal: 225000,
                loadedCount: 3,
                globalTotalCount: 205,
                isPaginated: true,
            },
            applyFilter: () => true,
        });

        const dispatched = await dispatchActionPlan(interpreted.plan, {
            navigate: () => {},
            currentModule: 'dashboard',
            lang: 'es-CO',
        });

        assert.equal(dispatched.ok, true);
        assert.equal(dispatched.reply, 'Listo, ya te filtré los pagos rechazados.');
        // Regression guard against "Mostrando 1 en las páginas cargadas (3 de 205 registros del mes) pagos rechazados."
        assert.equal(dispatched.reply.includes('en las páginas cargadas'), false);
        assert.equal(dispatched.reply.includes('Mostrando'), false);
    });

    it('handles Spanish singular, plural, and zero grammar naturally without "1 pagos" or "1 registros"', () => {
        assert.equal(
            applyNaturalCountGrammar('Hay 1 pagos rechazados.', 'es-CO'),
            'Hay un pago rechazado.'
        );
        assert.equal(
            applyNaturalCountGrammar('Hay 1 motos apagadas.', 'es-CO'),
            'Hay una moto apagada.'
        );
        assert.equal(
            applyNaturalCountGrammar('Hay 1 alertas activas.', 'es-CO'),
            'Hay una alerta activa.'
        );
        assert.equal(
            applyNaturalCountGrammar('Hay 3 pagos rechazados.', 'es-CO'),
            'Hay 3 pagos rechazados.'
        );
        assert.equal(
            applyNaturalCountGrammar('Hay 0 pagos rechazados.', 'es-CO'),
            'No hay pagos rechazados en este momento.'
        );
    });

    it('distinguishes partial vs complete result sets and never states a partial sum as the complete total', () => {
        // Partial paginated screen (Trace tr_1795460701922_49xci: 1 rejected in 3 loaded out of 205 monthly)
        registerScreenBridge('payments', {
            loading: false,
            metrics: {
                filteredCount: 1,
                filteredTotal: 210000,
                loadedCount: 3,
                globalTotalCount: 205,
                isPaginated: true,
            },
        });

        const partialCount = resolveTemplatePlaceholders('Hay {{payments.count}} pagos rechazados.', {
            lang: 'es-CO',
        });
        assert.match(partialCount.text, /Por ahora veo un pago rechazado entre los registros cargados/);
        assert.match(partialCount.text, /Todavía no tengo el total completo/);
        assert.equal(partialCount.text.includes('1 pagos'), false);

        const partialSum = resolveTemplatePlaceholders('Los pagos rechazados suman {{payments.total}}.', {
            lang: 'es-CO',
        });
        assert.match(partialSum.text, /todavía no tengo el total completo/i);
        assert.equal(partialSum.hasPartialScope, true);

        // Complete non-paginated dataset: states exact count and sum concisely
        clearAllScreenBridges();
        registerScreenBridge('payments', {
            loading: false,
            metrics: {
                filteredCount: 2,
                filteredTotal: 450000,
                loadedCount: 18,
                globalTotalCount: 18,
                isPaginated: false,
            },
        });

        const completeCount = resolveTemplatePlaceholders('Hay {{payments.count}} pagos rechazados.', {
            lang: 'es-CO',
        });
        assert.equal(completeCount.text, 'Hay 2 pagos rechazados.');
        assert.equal(completeCount.hasPartialScope, false);

        const completeSum = resolveTemplatePlaceholders('Los pagos rechazados suman {{payments.total}}.', {
            lang: 'es-CO',
        });
        assert.match(completeSum.text, /^Los pagos rechazados suman \$[\s\u00a0]?450\.000\.$/);
    });

    it('never fabricates 0 or $0 when screen metrics are missing or still loading', async () => {
        registerScreenBridge('payments', {
            loading: true,
            metrics: {},
        });

        const missingRes = resolveTemplatePlaceholders('Hay {{payments.count}} pagos rechazados.', {
            lang: 'es-CO',
        });
        assert.equal(missingRes.hasMissingMetrics, true);
        assert.equal(missingRes.text.includes('0 pagos'), false);
        assert.match(missingRes.text, /Todavía no tengo los datos cargados/i);

        // Also ensure resolveTemplateWithLiveData does not append unrequested summarySentence to clarifications
        const clarifyRes = await resolveTemplateWithLiveData(
            '¿A qué moto te refieres? Indícame la placa.',
            { targetModule: 'devices', lang: 'es-CO' }
        );
        assert.equal(clarifyRes.text, '¿A qué moto te refieres? Indícame la placa.');
    });

    it('executes Path B analytical tool flow with capped tool calls, grounded facts vs hypotheses, and follow-up context', async () => {
        const calls = [];
        let toolExecutions = 0;

        const mockOpenAi = {
            responses: {
                create: async (payload) => {
                    calls.push(payload);
                    if (calls.length === 1) {
                        // Emit 4 tool calls to verify MAX_TOOL_CALLS_PER_TURN cap enforces <= 2 executions
                        return {
                            id: 'resp_analytical_step1',
                            output: [
                                {
                                    type: 'function_call',
                                    call_id: 'call_1',
                                    name: 'fetch_module_records',
                                    arguments: JSON.stringify({ module: 'payments', status: 'failed' }),
                                },
                                {
                                    type: 'function_call',
                                    call_id: 'call_2',
                                    name: 'fetch_module_records',
                                    arguments: JSON.stringify({ module: 'payments', status: 'pending' }),
                                },
                                {
                                    type: 'function_call',
                                    call_id: 'call_3',
                                    name: 'fetch_module_records',
                                    arguments: JSON.stringify({ module: 'devices', status: 'off' }),
                                },
                            ],
                            output_text: '',
                            usage: { input_tokens: 3200, input_tokens_details: { cached_tokens: 3072 }, output_tokens: 40 },
                        };
                    }
                    // Step 2: verify previous_response_id and sanitized tool outputs with scopeMetadata
                    assert.equal(payload.previous_response_id, 'resp_analytical_step1');
                    assert.equal(payload.input.length, MAX_TOOL_CALLS_PER_TURN);
                    const parsedToolData = JSON.parse(payload.input[0].output);
                    assert.equal(parsedToolData.scopeMetadata.isCompleteTotal, true);
                    assert.equal(parsedToolData.scopeMetadata.exactRejectionCauseStoredInDb, false);

                    return {
                        id: 'resp_analytical_step2',
                        output: [],
                        output_text: JSON.stringify({
                            scope: 'conversation_context',
                            targetModule: 'payments',
                            actions: [],
                            responseTemplate:
                                'Veo 2 pagos rechazados que suman 450 mil pesos (placas PMQ44I y NIJ19I por Nequi). Aparecen en estado declinado, aunque el sistema no guarda el motivo exacto del banco; suele deberse a fondos insuficientes o a un error de autorización.',
                            needsClarification: false,
                        }),
                        usage: { input_tokens: 3650, input_tokens_details: { cached_tokens: 3072 }, output_tokens: 72 },
                    };
                },
            },
        };

        const res = await interpretUserRequest({
            text: '¿Por qué están rechazados y cuánto suman?',
            lang: 'es-CO',
            applicationContext: {
                currentRoute: '/payments',
                currentModule: 'payments',
                activeFilters: { status: 'failed', month: 11, year: 2026 },
            },
            conversationHistory: [
                {
                    userText: 'Muéstrame los pagos rechazados',
                    assistantText: 'Listo, ya te filtré los pagos rechazados.',
                    targetModule: 'payments',
                    intent: 'applyFilter',
                    executedActions: [{ name: 'applyFilter', params: { module: 'payments', status: 'failed' } }],
                    executionStatus: 'success',
                },
            ],
            user: { role: 'admin', companyId: 'demo-company' },
            openaiClient: mockOpenAi,
            toolExecutor: async (args) => {
                toolExecutions += 1;
                return fetchSanitizedModuleRecords(args);
            },
        });

        assert.equal(calls.length, 2);
        assert.equal(toolExecutions, MAX_TOOL_CALLS_PER_TURN);
        assert.equal(res.source, 'openai_responses_with_data');
        assert.equal(res.plan.onDemandDataUsed, true);
        assert.match(res.plan.responseTemplate, /450 mil pesos/);
        assert.match(res.plan.responseTemplate, /no guarda el motivo exacto/);
    });

    it('never confirms failed filter actions or zero-result searches as found (Traces tr_1795470363875_hdddw & tr_1795470468415_kxv87)', async () => {
        registerScreenBridge('payments', {
            loading: false,
            metrics: { filteredCount: 5, filteredTotal: 175000 },
            applyFilter: () => false, // Simulate screen rejecting filter
        });

        const failedFilter = await dispatchActionPlan(
            {
                scope: 'current_screen',
                targetModule: 'payments',
                actions: [{ name: 'applyFilter', params: { module: 'payments', status: 'failed' } }],
                responseTemplate: 'Listo, ya te filtré los pagos rechazados.',
                needsClarification: false,
            },
            { navigate: () => {}, currentModule: 'payments', lang: 'es-CO' }
        );

        assert.equal(failedFilter.ok, false);
        assert.equal(failedFilter.executionStatus, 'failed');
        assert.equal(failedFilter.reply.includes('Listo'), false);
        assert.match(failedFilter.reply, /No pude aplicar ese filtro/);

        // Simulate a search that completes with 0 matching records in the active screen
        clearAllScreenBridges();
        registerScreenBridge('contracts', {
            loading: false,
            metrics: { filteredCount: 0, filteredTotalValue: 0 },
            search: () => true,
        });

        const zeroSearch = await dispatchActionPlan(
            {
                scope: 'current_screen',
                targetModule: 'contracts',
                actions: [{ name: 'search', params: { module: 'contracts', query: 'QBD29I' } }],
                responseTemplate: 'Ya encontré el contrato de QBD29I.',
                needsClarification: false,
            },
            { navigate: () => {}, currentModule: 'contracts', lang: 'es-CO' }
        );

        assert.equal(zeroSearch.ok, true);
        assert.match(zeroSearch.reply, /no aparece ningún registro/i);
        assert.equal(zeroSearch.reply.includes('Se muestran 0 contratos'), false);
    });

    it('cleans technical artifacts and shortens overly long responses in prepareSpokenResponse for TTS', () => {
        const withArtifacts =
            'Listo, **PMQ44I** tiene `1` alerta activa. {"debug":"raw_json"} Revisé el reporte.';
        const cleanShort = prepareSpokenResponse(withArtifacts, { lang: 'es-CO' });
        assert.equal(cleanShort.includes('**'), false);
        assert.equal(cleanShort.includes('`'), false);
        assert.equal(cleanShort.includes('raw_json'), false);
        assert.match(cleanShort, /Listo, PMQ44I tiene 1 alerta activa\./);

        const longDetailed =
            'Encontré 8 alertas activas de conducción en corte durante la mañana. ' +
            'La primera ocurrió en MWY10I a las 08:12 a. m. con 14 km/h reportados. ' +
            'La segunda ocurrió en FPZ45I a las 08:40 a. m. con 19 km/h reportados. ' +
            'La tercera ocurrió en IFN20I a las 09:05 a. m. con 11 km/h reportados, además de NHO78I, NIJ17I, NHO79I y QBK45I con eventos adicionales registrados en la bitácora.';
        const shortened = prepareSpokenResponse(longDetailed, { lang: 'es-CO', maxLength: 200 });
        assert.ok(shortened.length < longDetailed.length);
        assert.match(shortened, /Puedes ver el detalle completo en pantalla\.$/);
    });
});
