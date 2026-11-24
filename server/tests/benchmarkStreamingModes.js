/**
 * Live & Reproducible Benchmark: HTTP Streaming vs. OpenAI Responses API WebSocket Mode (Req. 12)
 *
 * Run via: `node server/tests/benchmarkStreamingModes.js`
 *
 * Compares `upstreamMode: "http"` (`responses.create({ stream: true })`) against
 * `upstreamMode: "ws"` (`ResponsesWS` persistent `wss://api.openai.com/v1/responses`)
 * across 3 real UPay conversation scenarios:
 *  1. Path A simple filter command ("Muéstrame los pagos rechazados")
 *  2. Path B analytical multi-round tool query ("¿Cuántos pagos rechazados hay y por qué fallaron?")
 *  3. Follow-up day-range report accumulation ("En reportes dame el acumulado desde el 15 hasta el 21")
 *
 * Measures:
 *  - First-event latency (ms)
 *  - First-text-delta latency (ms)
 *  - First-audio-chunk latency (ms)
 *  - End-to-end completion time (ms)
 *  - Tool rounds & token usage / Prompt Cache hit ratio
 *  - Reconnection behavior (`closeSharedResponsesWS()` forced drop + recovery)
 */

import 'dotenv/config';
import {
    streamAssistantTurn,
    closeSharedResponsesWS,
} from '../services/aiAssistantStreamService.js';
import { getOpenAIClient } from '../services/aiAssistantService.js';
import { fetchSanitizedModuleRecords } from '../services/assistantDemoService.js';

const SCENARIOS = [
    {
        id: 'path_a_filter',
        label: 'Path A · Filtro simple ("Muéstrame los pagos rechazados")',
        text: 'Muéstrame los pagos rechazados',
        applicationContext: {
            currentRoute: '/',
            currentModule: 'dashboard',
            activeFilters: { month: 11, year: 2026 },
        },
        conversationHistory: [],
        tts: { enabled: false, neural: false },
    },
    {
        id: 'path_b_analytical',
        label: 'Path B · Analítica con tool + TTS ("¿Cuántos están rechazados y por qué?")',
        text: '¿Cuántos están rechazados y por qué fallaron?',
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
        tts: { enabled: true, neural: true },
    },
    {
        id: 'path_b_reports_range',
        label: 'Path B · Acumulado rango reportes ("Acumulado desde el 15 hasta el 21")',
        text: 'En reportes dame el acumulado de los días desde el 15 hasta el 21',
        applicationContext: {
            currentRoute: '/reports',
            currentModule: 'reports',
            activeFilters: { status: 'all', month: 11, year: 2026 },
        },
        conversationHistory: [],
        tts: { enabled: true, neural: true },
    },
];

const runSingleScenario = async (mode, scenario, turnSeq) => {
    const start = performance.now();
    let firstClientEventMs = null;
    let firstTextMs = null;
    let firstAudioMs = null;
    let eventCount = 0;

    const result = await streamAssistantTurn({
        turnId: `bench_${mode}_${turnSeq}`,
        text: scenario.text,
        lang: 'es-CO',
        applicationContext: scenario.applicationContext,
        conversationHistory: scenario.conversationHistory,
        ttsOptions: scenario.tts,
        upstreamMode: mode,
        user: { userId: 'bench_admin', role: 'admin', isSuperAdmin: false, companyId: 'demo-company' },
        toolExecutor: fetchSanitizedModuleRecords,
        emitEvent: (type, payload) => {
            eventCount += 1;
            const elapsed = Math.round(performance.now() - start);
            if (firstClientEventMs === null && type !== 'turn_started') {
                firstClientEventMs = elapsed;
            }
            if (firstTextMs === null && type === 'text_delta') {
                firstTextMs = elapsed;
            }
            if (firstAudioMs === null && type === 'audio_chunk' && payload?.audioBase64) {
                firstAudioMs = elapsed;
            }
        },
    });

    const totalMs = Math.round(performance.now() - start);
    const m = result?.metrics || {};
    return {
        mode,
        scenario: scenario.id,
        first_event_ms: m.first_event_latency_ms ?? firstClientEventMs ?? totalMs,
        first_text_ms: m.first_text_delta_ms ?? firstTextMs,
        first_audio_ms: m.first_audio_latency_ms ?? firstAudioMs,
        end_to_end_ms: totalMs,
        tool_rounds: m.tool_rounds ?? 0,
        input_tokens: m.input_tokens ?? 'n/a',
        cached_tokens: m.cached_tokens ?? 'n/a',
        output_tokens: m.output_tokens ?? 'n/a',
        cache_hit_ratio: m.cache_hit_ratio ?? 'n/a',
        events_emitted: eventCount,
        source: result?.source || 'unknown',
        reply_preview: String(result?.plan?.responseTemplate || '').slice(0, 90),
    };
};

const main = async () => {
    const openai = await getOpenAIClient();
    if (!openai) {
        console.log(JSON.stringify({ liveOpenAI: false, note: 'OPENAI_API_KEY not configured' }, null, 2));
        process.exit(0);
    }

    const results = [];

    // Warm Prompt Cache once so both modes are compared fairly under warm cache conditions
    await runSingleScenario('http', SCENARIOS[0], 0);

    for (const mode of ['http', 'ws']) {
        let idx = 1;
        for (const scenario of SCENARIOS) {
            const sample = await runSingleScenario(mode, scenario, idx++);
            results.push(sample);
        }
    }

    // Test WS reconnection behavior: force-close shared ResponsesWS socket and immediately run another turn
    closeSharedResponsesWS();
    const reconnectStart = performance.now();
    const afterDropSample = await runSingleScenario('ws', SCENARIOS[0], 99);
    const reconnectRecoveryMs = Math.round(performance.now() - reconnectStart);

    closeSharedResponsesWS();

    console.log(
        JSON.stringify(
            {
                liveOpenAI: true,
                timestamp: new Date().toISOString(),
                samples: results,
                wsReconnectAfterDrop: {
                    recovered: afterDropSample.source.startsWith('openai'),
                    recovery_end_to_end_ms: reconnectRecoveryMs,
                    first_event_ms: afterDropSample.first_event_ms,
                },
            },
            null,
            2
        )
    );
    process.exit(0);
};

main().catch((err) => {
    closeSharedResponsesWS();
    console.error('Benchmark error:', err);
    process.exit(1);
});
