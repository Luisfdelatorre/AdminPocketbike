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
} from '../../client/src/services/voiceAssistant/resolvers.js';
import {
    dispatchActionPlan,
} from '../../client/src/services/voiceAssistant/dispatcher.js';
import {
    buildStablePrefix,
    buildDynamicSuffix,
    extractUsageMetrics,
    planContextualFallback,
} from '../services/aiAssistantService.js';

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

    it('resolves known placeholders, blocks unknown ones, and never claims 1 page = global total', () => {
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

        assert.match(res.text, /7 in the currently loaded page \(50 of 180 monthly records loaded\)/);
        assert.match(res.text, /\(across the 50 loaded payments\)/);
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
});
