/**
 * Automated Test Suite — UPay AI Assistant Streaming & WebSocket Upgrade
 * Run via: `node --test server/tests/aiAssistantStreaming.test.js`
 *
 * Covers Requirements 2–13:
 *  - Typed WebSocket protocol (`turnId`, monotonic `sequence`, `type`, `timestamp`, `payload`).
 *  - Authentication & multi-tenant (`companyId`) isolation on `/api/v1/ai/ws`.
 *  - Never executing partial streamed tool arguments; Zod validation + role authorization first.
 *  - Verified progress events (`tool_started`, `tool_completed`) without invented percentages.
 *  - Early streaming gate preventing unverified facts or unconfirmed UI actions from leaking early.
 *  - Sentence-buffered Neural TTS streaming (`audio_chunk`), ordered `AudioStreamQueue` playback,
 *    privacy filtering, and turn-scoped cancellation (`cancel_turn` + stale chunk dropping).
 *  - Both `http` streaming and `ws` (`ResponsesWS`) modes in `aiAssistantStreamService`.
 *  - Client reconnection & non-streaming fallback preservation.
 */

import { describe, it, afterEach } from 'node:test';
import assert from 'node:assert/strict';
import http from 'node:http';
import WebSocket from 'ws';

import {
    validateFetchModuleRecordsArgs,
    validateWsEventEnvelope,
    WS_SERVER_EVENT_TYPES,
} from '../../client/src/services/voiceAssistant/schemaValidator.js';
import { AssistantWsClient } from '../../client/src/services/voiceAssistant/wsClient.js';
import { AudioStreamQueue } from '../../client/src/services/voiceAssistant/audioQueue.js';
import {
    streamAssistantTurn,
    SentenceChunker,
    ResponseTemplateJsonExtractor,
    applyServerSpeechPrivacyFilter,
} from '../services/aiAssistantStreamService.js';
import { attachAssistantWebSocketServer } from '../ws/assistantWsServer.js';

const startEphemeralWsServer = async (options = {}) => {
    const httpServer = http.createServer((_req, res) => {
        res.writeHead(200);
        res.end('ok');
    });
    const attached = attachAssistantWebSocketServer(httpServer, options);
    await new Promise((resolve) => httpServer.listen(0, '127.0.0.1', resolve));
    const { port } = httpServer.address();
    return {
        port,
        wsUrl: `ws://127.0.0.1:${port}/api/v1/ai/ws`,
        close: async () => {
            attached.close();
            httpServer.closeAllConnections?.();
            await new Promise((resolve) => httpServer.close(resolve));
        },
    };
};

describe('1. Typed Protocol & Complete Tool-Argument Validation (Reqs. 4 & 7)', () => {
    it('validates all 7 typed WebSocket event envelopes and rejects malformed sequences', () => {
        for (const [idx, type] of WS_SERVER_EVENT_TYPES.entries()) {
            const res = validateWsEventEnvelope({
                turnId: 'turn_123',
                sequence: idx + 1,
                type,
                timestamp: new Date().toISOString(),
                payload: { ok: true },
            });
            assert.equal(res.success, true);
        }

        assert.equal(
            validateWsEventEnvelope({
                turnId: 'turn_123',
                sequence: 0,
                type: 'turn_started',
                timestamp: new Date().toISOString(),
                payload: {},
            }).success,
            false
        );
        assert.equal(
            validateWsEventEnvelope({
                turnId: 'turn_123',
                sequence: 1,
                type: 'invented_progress_50_percent',
                timestamp: new Date().toISOString(),
                payload: {},
            }).success,
            false
        );
    });

    it('rejects partially streamed JSON tool arguments and unauthorized modules', () => {
        const partial = validateFetchModuleRecordsArgs('{"module":"payments","status":"fai');
        assert.equal(partial.success, false);

        const viewerDenied = validateFetchModuleRecordsArgs(
            '{"module":"contracts","status":"active"}',
            { user: { role: 'viewer', isSuperAdmin: false } }
        );
        assert.equal(viewerDenied.success, false);
        assert.equal(viewerDenied.code, 'UNAUTHORIZED_MODULE');

        const validComplete = validateFetchModuleRecordsArgs(
            '{"module":"reports","fromDay":15,"toDay":21,"year":0}',
            { user: { role: 'admin', isSuperAdmin: false } }
        );
        assert.equal(validComplete.success, true);
        assert.equal(validComplete.data.module, 'reports');
        assert.equal(validComplete.data.fromDay, 15);
        assert.equal(validComplete.data.toDay, 21);
        assert.equal(validComplete.data.year, undefined);
    });
});

describe('2. Streaming Lifecycle, Verified Tool Gating & Early-Stream Safety (Reqs. 2, 5, 7, 8, 9)', () => {
    it('extracts incremental responseTemplate JSON safely and chunks sentences for TTS', () => {
        const extractor = new ResponseTemplateJsonExtractor();
        const rawJson =
            '{"scope":"conversation_context","targetModule":"payments","actions":[],"responseTemplate":"Veo 2 pagos rechazados por Nequi. Suman 450 mil pesos en este mes.","needsClarification":false}';

        let out = '';
        for (let i = 0; i < rawJson.length; i += 7) {
            out += extractor.feed(rawJson.slice(i, i + 7));
        }
        assert.equal(extractor.actionsKnownEmpty, true);
        assert.equal(
            out,
            'Veo 2 pagos rechazados por Nequi. Suman 450 mil pesos en este mes.'
        );

        const chunker = new SentenceChunker({ minSentenceChars: 18 });
        const s1 = chunker.push('Veo 2 pagos rechazados por Nequi. Suman 450 ');
        assert.deepEqual(s1, ['Veo 2 pagos rechazados por Nequi.']);
        const s2 = chunker.push('mil pesos en este mes.');
        assert.deepEqual([...s2, ...chunker.flush()], ['Suman 450 mil pesos en este mes.']);
    });

    it('waits for complete tool arguments, emits verified tool_started/tool_completed, and streams grounded text + neural TTS', async () => {
        const emitted = [];
        let toolExecutedDuringDelta = false;
        let deltaPhaseActive = false;

        const mockOpenAi = {
            responses: {
                create: async (params) => {
                    assert.equal(params.stream, true);
                    // Round 1: stream partial function_call_arguments deltas -> done -> completed
                    if (!params.previous_response_id) {
                        return (async function* () {
                            yield { type: 'response.created', response: { id: 'resp_r1' } };
                            yield {
                                type: 'response.output_item.added',
                                item: { id: 'fc_1', call_id: 'call_1', type: 'function_call', name: 'fetch_module_records', arguments: '' },
                            };
                            deltaPhaseActive = true;
                            yield { type: 'response.function_call_arguments.delta', item_id: 'fc_1', delta: '{"module":"pay' };
                            yield { type: 'response.function_call_arguments.delta', item_id: 'fc_1', delta: 'ments","status":"failed"}' };
                            deltaPhaseActive = false;
                            yield {
                                type: 'response.function_call_arguments.done',
                                item_id: 'fc_1',
                                name: 'fetch_module_records',
                                arguments: '{"module":"payments","status":"failed"}',
                            };
                            yield {
                                type: 'response.completed',
                                response: {
                                    id: 'resp_r1',
                                    usage: { input_tokens: 3100, input_tokens_details: { cached_tokens: 2944 }, output_tokens: 28 },
                                    output: [],
                                },
                            };
                        })();
                    }

                    // Round 2: grounded synthesis with tool_choice="none"
                    assert.equal(params.tool_choice, 'none');
                    const finalJson = JSON.stringify({
                        scope: 'conversation_context',
                        targetModule: 'payments',
                        actions: [],
                        responseTemplate:
                            'Veo 2 pagos rechazados en el mes. Suman $450.000 en total.',
                        needsClarification: false,
                    });
                    return (async function* () {
                        yield { type: 'response.created', response: { id: 'resp_r2' } };
                        for (let i = 0; i < finalJson.length; i += 14) {
                            yield { type: 'response.output_text.delta', delta: finalJson.slice(i, i + 14) };
                        }
                        yield {
                            type: 'response.completed',
                            response: {
                                id: 'resp_r2',
                                output_text: finalJson,
                                usage: { input_tokens: 3450, input_tokens_details: { cached_tokens: 2944 }, output_tokens: 48 },
                            },
                        };
                    })();
                },
            },
        };

        const synthesizedSentences = [];
        await streamAssistantTurn({
            turnId: 'turn_stream_test_1',
            text: '¿Cuántos pagos rechazados hay y cuánto suman?',
            lang: 'es-CO',
            applicationContext: { currentRoute: '/payments', currentModule: 'payments', activeFilters: { status: 'failed' } },
            ttsOptions: { enabled: true, neural: true, speakAmounts: false },
            user: { role: 'admin', companyId: 'comp_1' },
            openaiClient: mockOpenAi,
            toolExecutor: async (args) => {
                if (deltaPhaseActive) toolExecutedDuringDelta = true;
                assert.equal(args.module, 'payments');
                assert.equal(args.status, 'failed');
                return {
                    module: 'payments',
                    authorized: true,
                    totalMatching: 2,
                    totalAmountFormatted: '$ 450.000',
                    scopeMetadata: { isCompleteCount: true, isCompleteTotal: true },
                    records: [{ plate: 'PMQ44I', status: 'DECLINED', amount: '$ 225.000' }],
                };
            },
            ttsSynthesizer: async ({ text, onChunk }) => {
                synthesizedSentences.push(text);
                onChunk({
                    chunkIndex: 0,
                    isFinalChunk: false,
                    mimeType: 'audio/mpeg',
                    audioBase64: Buffer.from(`mp3:${text}`).toString('base64'),
                });
                onChunk({
                    chunkIndex: 1,
                    isFinalChunk: true,
                    mimeType: 'audio/mpeg',
                    audioBase64: '',
                });
            },
            emitEvent: (type, payload) => emitted.push({ type, payload }),
        });

        assert.equal(toolExecutedDuringDelta, false, 'Must NEVER execute partial tool arguments');

        const types = emitted.map((e) => e.type);
        assert.equal(types[0], 'turn_started');
        assert.ok(types.indexOf('tool_started') < types.indexOf('tool_completed'));
        assert.ok(types.indexOf('tool_completed') < types.indexOf('text_delta'));
        assert.equal(types[types.length - 1], 'turn_completed');

        // Verify privacy filter redacted $450.000 before sending to Neural TTS since speakAmounts=false
        assert.equal(synthesizedSentences.length, 2);
        assert.equal(synthesizedSentences[1].includes('450.000'), false);
        assert.match(synthesizedSentences[1], /el monto mostrado en pantalla/);
    });

    it('holds early text_delta streaming on Path A UI actions until action plan validation completes', async () => {
        const emitted = [];
        const planJson = JSON.stringify({
            scope: 'other_screen',
            targetModule: 'payments',
            actions: [
                { name: 'navigate', params: { module: 'payments' } },
                { name: 'applyFilter', params: { module: 'payments', status: 'failed' } },
            ],
            responseTemplate: 'Listo, ya te filtré los pagos rechazados.',
            needsClarification: false,
        });

        const mockOpenAi = {
            responses: {
                create: async () =>
                    (async function* () {
                        yield { type: 'response.created', response: { id: 'resp_path_a' } };
                        yield { type: 'response.output_text.delta', delta: planJson };
                        yield {
                            type: 'response.completed',
                            response: { id: 'resp_path_a', output_text: planJson, usage: { input_tokens: 3000, output_tokens: 40 } },
                        };
                    })(),
            },
        };

        await streamAssistantTurn({
            turnId: 'turn_path_a_hold',
            text: 'Muéstrame los pagos rechazados',
            lang: 'es-CO',
            applicationContext: { currentRoute: '/', currentModule: 'dashboard', activeFilters: {} },
            user: { role: 'admin', companyId: 'comp_1' },
            openaiClient: mockOpenAi,
            emitEvent: (type, payload) => emitted.push({ type, payload }),
        });

        // Must NOT emit premature text_delta claiming filter succeeded before frontend dispatcher runs!
        assert.equal(emitted.some((e) => e.type === 'text_delta'), false);
        const doneEvt = emitted.find((e) => e.type === 'turn_completed');
        assert.ok(doneEvt);
        assert.equal(doneEvt.payload.streamedText, false);
        assert.equal(doneEvt.payload.plan.responseTemplate, 'Listo, ya te filtré los pagos rechazados.');
    });

    it('supports OpenAI ResponsesWS mode over persistent socket stream', async () => {
        const sentWsPayloads = [];
        const planJson = JSON.stringify({
            scope: 'current_screen',
            targetModule: 'devices',
            actions: [],
            responseTemplate: '¿Qué moto quieres buscar en esta pantalla?',
            needsClarification: true,
        });

        const fakeWsFactory = async () => ({
            reconnectCount: 0,
            ws: {
                send: (event) => sentWsPayloads.push(event),
                stream: async function* () {
                    const streamId = sentWsPayloads[sentWsPayloads.length - 1]?.stream_id;
                    yield { type: 'message', message: { type: 'response.created', stream_id: streamId, response: { id: 'ws_r1' } } };
                    yield { type: 'message', message: { type: 'response.output_text.delta', stream_id: streamId, delta: planJson } };
                    yield {
                        type: 'message',
                        message: {
                            type: 'response.completed',
                            stream_id: streamId,
                            response: { id: 'ws_r1', output_text: planJson, usage: { input_tokens: 2800, output_tokens: 32 } },
                        },
                    };
                },
            },
        });

        const emitted = [];
        const res = await streamAssistantTurn({
            turnId: 'turn_ws_mode_1',
            text: 'abre eso',
            lang: 'es-CO',
            upstreamMode: 'ws',
            applicationContext: { currentRoute: '/devices', currentModule: 'devices', activeFilters: {} },
            user: { role: 'admin', companyId: 'comp_1' },
            openaiClient: { responses: {} },
            wsFactory: fakeWsFactory,
            emitEvent: (type, payload) => emitted.push({ type, payload }),
        });

        assert.equal(sentWsPayloads.length, 1);
        assert.equal(sentWsPayloads[0].type, 'response.create');
        assert.equal('stream' in sentWsPayloads[0], false, 'stream must be omitted in ResponsesWS mode');
        assert.equal(res.metrics.transport_mode, 'ws');
        assert.ok(emitted.some((e) => e.type === 'turn_completed'));
    });
});

describe('3. Authenticated WebSocket Server, Tenant Isolation & Turn Cancellation (Reqs. 3, 6, 9, 10, 11)', () => {
    let serverHandle = null;

    afterEach(async () => {
        if (serverHandle) {
            await serverHandle.close();
            serverHandle = null;
        }
    });

    it('rejects unauthenticated upgrades and enforces tenant isolation on start_turn', async () => {
        serverHandle = await startEphemeralWsServer({
            verifyTokenFn: (token) => {
                if (token === 'valid_company_a') {
                    return { userId: 'u1', role: 'admin', isSuperAdmin: false, companyId: 'comp_A' };
                }
                throw new Error('Invalid token');
            },
            streamTurnFn: async ({ emitEvent }) => {
                emitEvent('turn_started', {});
                emitEvent('turn_completed', { plan: { scope: 'current_screen', targetModule: 'dashboard', actions: [], responseTemplate: 'Listo.', needsClarification: false } });
            },
        });

        // 1. Unauthenticated connection must fail with 401
        await assert.rejects(
            () =>
                new Promise((resolve, reject) => {
                    const badWs = new WebSocket(serverHandle.wsUrl);
                    badWs.on('open', () => resolve());
                    badWs.on('error', (err) => reject(err));
                })
        );

        // 2. Authenticated connection trying to spoof another companyId (`comp_B`) must be rejected with TENANT_MISMATCH
        const client = new AssistantWsClient({
            WebSocketImpl: class BrowserCompatWs extends WebSocket {
                constructor(url, protocols) {
                    super(url, protocols);
                }
            },
            urlBuilder: () => serverHandle.wsUrl,
        });
        client.syncSession({ token: 'valid_company_a', sessionKey: 'u1:comp_A' });

        await assert.rejects(
            () =>
                client.startTurn({
                    turnId: 'turn_spoof_1',
                    payload: {
                        text: 'Muéstrame pagos',
                        companyId: 'comp_B',
                        applicationContext: { currentRoute: '/', currentModule: 'dashboard' },
                    },
                }),
            (err) => err.code === 'TENANT_MISMATCH'
        );

        client.disconnect();
    });

    it('aborts in-flight server streams on cancel_turn and prevents stale audio/text playback', async () => {
        let serverSignalAborted = false;

        serverHandle = await startEphemeralWsServer({
            verifyTokenFn: () => ({ userId: 'u1', role: 'admin', isSuperAdmin: false, companyId: 'comp_A' }),
            streamTurnFn: async ({ turnId, signal, emitEvent }) => {
                emitEvent('turn_started', { turnId });
                emitEvent('text_delta', { delta: 'Primera parte… ' });
                await new Promise((resolve) => {
                    const t = setTimeout(resolve, 400);
                    signal.addEventListener('abort', () => {
                        serverSignalAborted = true;
                        clearTimeout(t);
                        resolve();
                    });
                });
                if (!signal.aborted) {
                    emitEvent('text_delta', { delta: 'Texto obsoleto que nunca debe llegar' });
                    emitEvent('turn_completed', { plan: {} });
                }
            },
        });

        const client = new AssistantWsClient({
            WebSocketImpl: WebSocket,
            urlBuilder: () => serverHandle.wsUrl,
        });
        client.syncSession({ token: 'tok_ok', sessionKey: 'u1:comp_A' });

        const receivedDeltas = [];
        const turnPromise = client.startTurn({
            turnId: 'turn_cancel_me',
            payload: {
                text: 'Explícame el reporte completo',
                applicationContext: { currentRoute: '/', currentModule: 'dashboard' },
            },
            onEvent: (env) => {
                if (env.type === 'text_delta') {
                    receivedDeltas.push(env.payload.delta);
                    // Immediately cancel right after first delta!
                    client.cancelTurn('turn_cancel_me');
                }
            },
        });

        await assert.rejects(() => turnPromise, (err) => err.code === 'TURN_CANCELLED');
        await new Promise((r) => setTimeout(r, 80));

        assert.equal(serverSignalAborted, true, 'Server AbortController must fire on cancel_turn');
        assert.deepEqual(receivedDeltas, ['Primera parte… ']);
        client.disconnect();

        // Also verify AudioStreamQueue plays sentences strictly in order and drops stale turn chunks
        const playedUrls = [];
        class FakeAudio {
            constructor(src) {
                this.src = src;
            }
            play() {
                playedUrls.push(this.src);
                queueMicrotask(() => this.onended?.());
                return Promise.resolve();
            }
            pause() {}
        }

        const audioQueue = new AudioStreamQueue({ AudioImpl: FakeAudio });
        audioQueue.beginTurn('turn_new');

        // Stale chunk from old turn must be ignored
        assert.equal(
            audioQueue.enqueueChunk('turn_cancel_me', {
                sentenceIndex: 0,
                chunkIndex: 0,
                isFinalChunk: true,
                audioBase64: Buffer.from('stale').toString('base64'),
            }),
            false
        );

        // Sentence 1 arrives BEFORE Sentence 0: queue must hold Sentence 1 until Sentence 0 finishes!
        audioQueue.enqueueChunk('turn_new', {
            sentenceIndex: 1,
            chunkIndex: 0,
            isFinalChunk: true,
            audioBase64: Buffer.from('S1').toString('base64'),
        });
        assert.equal(playedUrls.length, 0);

        audioQueue.enqueueChunk('turn_new', {
            sentenceIndex: 0,
            chunkIndex: 0,
            isFinalChunk: true,
            audioBase64: Buffer.from('S0').toString('base64'),
        });

        await new Promise((r) => setTimeout(r, 20));
        assert.equal(playedUrls.length, 2, 'Both sentences must play strictly in order S0 -> S1');
    });
});

describe('4. Telemetry Regressions: Year Tolerance, >2 Parallel Tools, Negations & SSE /ai/chat', () => {
    it('ignores out-of-range placeholder year/month values on /contracts instead of failing tool validation', () => {
        const res = validateFetchModuleRecordsArgs(
            JSON.stringify({
                module: 'contracts',
                status: 'all',
                year: -1,
                month: 99,
                fromDay: -1,
                toDay: 0,
                limit: 12,
            }),
            { currentModule: 'contracts', user: { role: 'admin' } }
        );
        assert.equal(res.success, true);
        assert.equal(res.data.module, 'contracts');
        assert.equal(res.data.year, undefined);
        assert.equal(res.data.month, undefined);
    });

    it('emits function_call_output for ALL parallel tool calls even when > MAX_TOOL_CALLS_PER_TURN', async () => {
        let round2InputItems = null;
        let roundNum = 0;

        const finalPlan = JSON.stringify({
            scope: 'current_screen',
            targetModule: 'alerts',
            actions: [],
            responseTemplate: 'Hay 4 alertas por corte de batería activas. Si necesitas más información, házmelo saber.',
            needsClarification: false,
        });

        const mockOpenAi = {
            responses: {
                create: async (params) => {
                    roundNum += 1;
                    if (roundNum === 1) {
                        return (async function* () {
                            yield { type: 'response.created', response: { id: 'resp_3tools' } };
                            for (const cid of ['call_1', 'call_2', 'call_3']) {
                                yield {
                                    type: 'response.output_item.done',
                                    item: {
                                        type: 'function_call',
                                        id: cid,
                                        call_id: cid,
                                        name: 'fetch_module_records',
                                        arguments: JSON.stringify({ module: 'alerts', status: 'ACTIVE' }),
                                    },
                                };
                            }
                            yield {
                                type: 'response.completed',
                                response: { id: 'resp_3tools', output: [], usage: { input_tokens: 6400, cached_tokens: 6016, output_tokens: 60 } },
                            };
                        })();
                    }
                    round2InputItems = params.input;
                    return (async function* () {
                        yield { type: 'response.created', response: { id: 'resp_3tools_r2' } };
                        yield { type: 'response.output_text.delta', delta: finalPlan };
                        yield {
                            type: 'response.completed',
                            response: { id: 'resp_3tools_r2', output_text: finalPlan, usage: { input_tokens: 6800, cached_tokens: 6400, output_tokens: 45 } },
                        };
                    })();
                },
            },
        };

        const res = await streamAssistantTurn({
            turnId: 'turn_3tools',
            text: '¿Cuántas alertas son por batería?',
            lang: 'es-CO',
            applicationContext: { currentRoute: '/alerts', currentModule: 'alerts', activeFilters: {} },
            user: { role: 'admin', companyId: 'comp_1' },
            openaiClient: mockOpenAi,
            toolExecutor: async () => ({ authorized: true, module: 'alerts', totalMatching: 4, records: [] }),
        });

        assert.equal(Array.isArray(round2InputItems), true);
        assert.equal(round2InputItems.length, 3, 'All 3 call_ids must receive function_call_output');
        assert.equal(JSON.parse(round2InputItems[2].output).skipped, true);
        // Also verifies humanizeAssistantText strips robotic call-center sign-off
        assert.equal(res.plan.responseTemplate, 'Hay 4 alertas por corte de batería activas.');
    });

    it('handles "deuna" debt typo, "facturas no pagadas hoy", and UI filter observations naturally in fallback', async () => {
        const { planContextualFallback } = await import('../services/aiAssistantService.js');

        // 1. Typo "deuna" -> routes to summary status="debt", NOT contracts!
        const debtPlan = planContextualFallback({
            text: 'cuantos contratos con deuna tenemos',
            lang: 'es-CO',
            applicationContext: { currentRoute: '/contracts', currentModule: 'contracts', activeFilters: {} },
        });
        assert.equal(debtPlan.targetModule, 'summary');
        assert.equal(debtPlan.actions.some((a) => a.name === 'applyFilter' && a.params.status === 'debt'), true);

        // 2. "ve a la página de facturas e investígame cuáles facturas no se han pagado hoy" -> invoices PENDING, NOT payments!
        const invPlan = planContextualFallback({
            text: 'OK ve a la página de facturas y investígame cuáles facturas no se han pagado hoy',
            lang: 'es-CO',
            applicationContext: { currentRoute: '/payments', currentModule: 'payments', activeFilters: {} },
        });
        assert.equal(invPlan.targetModule, 'invoices');
        assert.equal(invPlan.actions.some((a) => a.name === 'applyFilter' && a.params.status === 'PENDING'), true);

        // 3. "Creo que en facturas falta un filtro por no pagadas" -> conversational explanation, NEVER status="PAID"!
        const obsPlan = planContextualFallback({
            text: 'Creo que en facturas falta un filtro por no pagadas',
            lang: 'es-CO',
            applicationContext: { currentRoute: '/invoices', currentModule: 'invoices', activeFilters: { status: 'PENDING' } },
        });
        assert.equal(obsPlan.targetModule, 'invoices');
        assert.equal(obsPlan.actions.length, 0);
        assert.match(obsPlan.responseTemplate, /Pendientes/i);
    });

    it('streams typed SSE envelopes from POST /api/v1/ai/chat when stream=true', async () => {
        const { chatWithAssistant } = await import('../controllers/assistantController.js');
        const writtenChunks = [];
        const headers = {};

        const fakeReq = {
            headers: { accept: 'text/event-stream' },
            body: {
                stream: true,
                traceId: 'sse_test_1',
                text: 'Quita los filtros',
                lang: 'es-CO',
                applicationContext: { currentRoute: '/payments', currentModule: 'payments', activeFilters: { status: 'failed' } },
            },
            auth: { userId: 'u_sse', role: 'admin', companyId: 'comp_1' },
            ip: '127.0.0.1',
        };

        const fakeRes = {
            writableEnded: false,
            status(code) {
                this.statusCode = code;
                return this;
            },
            setHeader(k, v) {
                headers[k.toLowerCase()] = v;
            },
            flushHeaders() {},
            on() {},
            write(chunk) {
                writtenChunks.push(String(chunk));
                return true;
            },
            end() {
                this.writableEnded = true;
            },
        };

        const prevKey = process.env.OPENAI_API_KEY;
        delete process.env.OPENAI_API_KEY;
        try {
            await chatWithAssistant(fakeReq, fakeRes);
        } finally {
            if (prevKey !== undefined) process.env.OPENAI_API_KEY = prevKey;
        }

        assert.match(headers['content-type'] || '', /text\/event-stream/);
        const sseEvents = writtenChunks
            .join('')
            .split('\n\n')
            .map((b) => b.trim())
            .filter((b) => b.startsWith('data:') && !b.includes('[DONE]'))
            .map((b) => JSON.parse(b.slice(5).trim()));

        assert.equal(sseEvents[0].type, 'turn_started');
        assert.equal(sseEvents[sseEvents.length - 1].type, 'turn_completed');
        assert.equal(fakeRes.writableEnded, true);
    });

    it('queries full-year dashboard scope (never January only) and returns real collectionRate for "este año" (Trace tr_1795552787039_llmt1)', async () => {
        const { fetchSanitizedModuleRecords } = await import('../services/assistantDemoService.js');
        const capturedToolArgs = [];
        let round = 0;

        const mockOpenAi = {
            responses: {
                create: async () => {
                    round += 1;
                    if (round === 1) {
                        // Even if model mistakenly emits month: 1 for "este año", server must override to full-year scope (month: 0)
                        return (async function* () {
                            yield { type: 'response.created', response: { id: 'resp_yr_1' } };
                            yield {
                                type: 'response.output_item.done',
                                item: {
                                    type: 'function_call',
                                    id: 'call_yr',
                                    call_id: 'call_yr',
                                    name: 'fetch_module_records',
                                    arguments: JSON.stringify({ module: 'dashboard', month: 1, year: 2026 }),
                                },
                            };
                            yield {
                                type: 'response.completed',
                                response: { id: 'resp_yr_1', output: [], usage: { input_tokens: 6400, cached_tokens: 6016, output_tokens: 40 } },
                            };
                        })();
                    }
                    const planJson = JSON.stringify({
                        scope: 'current_screen',
                        targetModule: 'dashboard',
                        actions: [],
                        responseTemplate: 'El porcentaje de recaudo de este año va en 86.4%, con $148.500.000 recaudados de $171.875.000 facturados.',
                        needsClarification: false,
                    });
                    return (async function* () {
                        yield { type: 'response.created', response: { id: 'resp_yr_2' } };
                        yield { type: 'response.output_text.delta', delta: planJson };
                        yield {
                            type: 'response.completed',
                            response: { id: 'resp_yr_2', output_text: planJson, usage: { input_tokens: 6800, cached_tokens: 6400, output_tokens: 52 } },
                        };
                    })();
                },
            },
        };

        const res = await streamAssistantTurn({
            turnId: 'turn_yr_1',
            text: 'cual es el porcentaje de recaudo de este ano?',
            lang: 'es-CO',
            applicationContext: {
                currentRoute: '/',
                currentModule: 'dashboard',
                activeFilters: { month: '', year: 2026 },
            },
            user: { role: 'admin', companyId: 'comp_azvi' },
            openaiClient: mockOpenAi,
            toolExecutor: async (args) => {
                capturedToolArgs.push(args);
                return fetchSanitizedModuleRecords(args);
            },
        });

        assert.equal(capturedToolArgs.length, 1);
        assert.equal(capturedToolArgs[0].month, 0, 'Full-year query must override month=1 to 0 (all_year)');
        const directDash = await fetchSanitizedModuleRecords(capturedToolArgs[0]);
        assert.equal(directDash.appliedFilters.periodScope, 'full_year');
        assert.match(directDash.records[0].period, /año completo/i);
        assert.equal(typeof directDash.records[0].collectionRate, 'string');
        assert.match(res.plan.responseTemplate, /86\.4%/);
    });
});

describe('5. OpenAI Agents SDK (`@openai/agents` + `zod`) Multi-Turn Sessions & Security Fixes', () => {
    it('retains verified fetch_module_records outputs across turns in tenant-isolated MemorySession and clears on reset', async () => {
        const {
            interpretUserRequest,
            resetConversationSession,
            clearAllTenantSessions,
        } = await import('../services/aiAssistantService.js');

        await clearAllTenantSessions();

        const capturedInputs = [];
        let callIndex = 0;

        const mockOpenAi = {
            responses: {
                create: async (params) => {
                    callIndex += 1;
                    capturedInputs.push(params.input);

                    // Enforce that @openai/agents compiles strict Zod json_schema output format
                    assert.equal(params.text?.format?.type, 'json_schema');
                    assert.equal(params.text?.format?.strict, true);

                    if (callIndex === 1) {
                        return {
                            id: 'ag_t1_r1',
                            output: [
                                {
                                    type: 'function_call',
                                    id: 'fc_t1',
                                    call_id: 'call_t1',
                                    name: 'fetch_module_records',
                                    arguments: JSON.stringify({
                                        module: 'payments',
                                        status: 'failed',
                                    }),
                                },
                            ],
                            usage: { input_tokens: 1500, input_tokens_details: { cached_tokens: 1200 }, output_tokens: 30 },
                        };
                    }

                    if (callIndex === 2) {
                        return {
                            id: 'ag_t1_r2',
                            output_text: JSON.stringify({
                                scope: 'current_screen',
                                targetModule: 'payments',
                                actions: [],
                                responseTemplate: 'Veo 2 pagos rechazados (PMQ44I y NIJ19I) que suman 450 mil pesos.',
                                needsClarification: false,
                            }),
                            usage: { input_tokens: 1800, input_tokens_details: { cached_tokens: 1200 }, output_tokens: 42 },
                        };
                    }

                    return {
                        id: `ag_followup_${callIndex}`,
                        output_text: JSON.stringify({
                            scope: 'conversation_context',
                            targetModule: 'payments',
                            actions: [],
                            responseTemplate: 'La segunda placa rechazada fue NIJ19I por $225.000.',
                            needsClarification: false,
                        }),
                        usage: { input_tokens: 1950, input_tokens_details: { cached_tokens: 1408 }, output_tokens: 28 },
                    };
                },
            },
        };

        const userCompanyA = { userId: 'u_op1', role: 'admin', companyId: 'comp_A' };
        const userCompanyB = { userId: 'u_op1', role: 'admin', companyId: 'comp_B' };

        const t1 = await interpretUserRequest({
            text: '¿Cuántos pagos rechazados hay?',
            lang: 'es-CO',
            applicationContext: { currentRoute: '/payments', currentModule: 'payments', activeFilters: { status: 'failed' } },
            conversationHistory: [
                {
                    userText: 'Abre pagos',
                    assistantText: 'Listo, ya te muestro los pagos.',
                    targetModule: 'payments',
                    intent: 'navigate',
                    executedActions: [{ name: 'navigate', params: { module: 'payments' } }],
                    executionStatus: 'success',
                },
            ],
            user: userCompanyA,
            openaiClient: mockOpenAi,
            persistSession: true,
        });

        // Verify aggregated multi-round token accounting (1500 + 1800 = 3300 input, 30 + 42 = 72 output)
        assert.equal(t1.metrics.input_tokens, 3300);
        assert.equal(t1.metrics.cached_tokens, 2400);
        assert.equal(t1.metrics.output_tokens, 72);
        assert.equal(t1.metrics.llm_rounds, 2);

        // Turn 2 on Company A: MemorySession must include synced local turn + Turn 1 function_call_output ("NIJ19I")
        await interpretUserRequest({
            text: '¿Y cuál era la segunda placa?',
            lang: 'es-CO',
            applicationContext: { currentRoute: '/payments', currentModule: 'payments', activeFilters: { status: 'failed' } },
            conversationHistory: [],
            user: userCompanyA,
            openaiClient: mockOpenAi,
            persistSession: true,
        });

        const turn2SerializedInput = JSON.stringify(capturedInputs[2]);
        assert.match(turn2SerializedInput, /Abre pagos/, 'Local matcher turn must be synced into MemorySession');
        assert.match(turn2SerializedInput, /NIJ19I/, 'Turn 1 tool output must be preserved in Turn 2 MemorySession');

        // Turn on Company B (same userId, different companyId): MUST NOT see Company A's MemorySession!
        await interpretUserRequest({
            text: '¿Qué vimos antes?',
            lang: 'es-CO',
            applicationContext: { currentRoute: '/payments', currentModule: 'payments', activeFilters: {} },
            conversationHistory: [],
            user: userCompanyB,
            openaiClient: mockOpenAi,
            persistSession: true,
        });
        const companyBInput = JSON.stringify(capturedInputs[3]);
        assert.equal(companyBInput.includes('NIJ19I'), false, 'Cross-tenant MemorySession leak forbidden');

        // Explicit session reset clears Company A's MemorySession
        const resetRes = await resetConversationSession(userCompanyA);
        assert.equal(resetRes.cleared, 1);

        await interpretUserRequest({
            text: 'Empecemos de cero',
            lang: 'es-CO',
            applicationContext: { currentRoute: '/', currentModule: 'dashboard', activeFilters: {} },
            conversationHistory: [],
            user: userCompanyA,
            openaiClient: mockOpenAi,
            persistSession: true,
        });
        const afterResetInput = JSON.stringify(capturedInputs[4]);
        assert.equal(afterResetInput.includes('NIJ19I'), false, 'Reset session must clear prior tool outputs');

        await clearAllTenantSessions();
    });

    it('redacts natural-language peso amounts without $ symbol, scopes telemetry by tenant, and escapes regex queries', async () => {
        const { recordTrainingTrace, getTrainingTraces } = await import('../services/aiAssistantService.js');
        const { fetchSanitizedModuleRecords } = await import('../services/assistantDemoService.js');

        // 1. Speech privacy filter catches "450 mil pesos" & "225.000 pesos" even without "$"
        const redacted = applyServerSpeechPrivacyFilter(
            'Veo 2 pagos rechazados que suman 450 mil pesos y otro de 225.000 pesos.',
            { speakAmounts: false, lang: 'es-CO' }
        );
        assert.equal(redacted.includes('450 mil'), false);
        assert.equal(redacted.includes('225.000'), false);
        assert.match(redacted, /el monto mostrado en pantalla/);

        // 2. Tenant isolation in getTrainingTraces (memoryOnly avoids polluting disk dataset)
        recordTrainingTrace({
            memoryOnly: true,
            traceId: 'tr_tenant_isolation_a',
            companyId: 'tenant_alpha_test',
            userRole: 'admin',
            userText: 'Secreto empresa Alpha',
            assistantFinalText: 'Placa ALPHA1',
        });
        recordTrainingTrace({
            memoryOnly: true,
            traceId: 'tr_tenant_isolation_b',
            companyId: 'tenant_beta_test',
            userRole: 'admin',
            userText: 'Secreto empresa Beta',
            assistantFinalText: 'Placa BETA2',
        });

        const alphaAdminView = getTrainingTraces({
            limit: 50,
            user: { userId: 'a1', role: 'admin', isSuperAdmin: false, companyId: 'tenant_alpha_test' },
        });
        assert.equal(
            alphaAdminView.traces.some((t) => t.companyId === 'tenant_beta_test'),
            false,
            'Admin of tenant Alpha must never see tenant Beta traces'
        );

        const viewerDenied = getTrainingTraces({
            limit: 50,
            user: { userId: 'v1', role: 'viewer', isSuperAdmin: false, companyId: 'tenant_alpha_test' },
        });
        assert.equal(viewerDenied.traces.length, 0, 'Viewer role must not read company trace logs');

        // 3. Unescaped regex characters in query never crash fetchSanitizedModuleRecords
        const safeRegexRes = await fetchSanitizedModuleRecords({
            module: 'payments',
            query: 'PMQ44I (NEQUI)[test*',
            auth: { role: 'admin', companyId: 'demo-company' },
        });
        assert.equal(safeRegexRes.authorized, true);
        assert.ok(Array.isArray(safeRegexRes.records));
    });

    it('polyfills structuredClone/AbortSignal.any and resolves "cuatas tienen dias sin conexion?" with multi-day offlineSummary (Trace tr_1795555631769_0p214)', async () => {
        await import('../utils/polyfillFetch.js');
        const { planContextualFallback } = await import('../services/aiAssistantService.js');
        const { fetchSanitizedModuleRecords } = await import('../services/assistantDemoService.js');

        // 1. Runtime globals required by @openai/agents are guaranteed present
        assert.equal(typeof globalThis.structuredClone, 'function');
        assert.equal(typeof globalThis.CustomEvent, 'function');
        assert.equal(typeof globalThis.AbortSignal.any, 'function');
        assert.equal(typeof globalThis.crypto?.randomUUID, 'function');

        const cloned = globalThis.structuredClone({ a: 1, nested: [true, 'ok'] });
        assert.deepEqual(cloned, { a: 1, nested: [true, 'ok'] });

        // 2. Contextual fallback handles "cuatas tienen dias sin conexion?" even when currently on /contracts!
        const fbFromContracts = planContextualFallback({
            text: 'cuatas tienen dias sin conexion?',
            lang: 'es-CO',
            applicationContext: { currentRoute: '/contracts', currentModule: 'contracts', activeFilters: {} },
            conversationHistory: [],
        });
        assert.equal(fbFromContracts.targetModule, 'devices');
        assert.equal(fbFromContracts.needsClarification, false);
        assert.equal(fbFromContracts.actions[0].name, 'navigate');
        assert.equal(fbFromContracts.actions[1].name, 'applyFilter');
        assert.equal(fbFromContracts.actions[1].params.status, 'offline');
        assert.match(fbFromContracts.responseTemplate, /\{\{devices\.offlineCount\}\}/);

        // 3. fetchSanitizedModuleRecords('devices') exposes complete offlineSummary with >=1 day breakdown
        const devOffline = await fetchSanitizedModuleRecords({
            module: 'devices',
            status: 'offline',
            auth: { role: 'admin', companyId: 'demo-company' },
        });
        assert.equal(devOffline.authorized, true);
        assert.equal(devOffline.offlineSummary.confirmedOneOrMoreDaysOfflineCount, 2);
        assert.equal(devOffline.offlineSummary.under24HoursOfflineCount, 1);
        assert.equal(devOffline.records[0].daysOffline, 3);
    });
});
