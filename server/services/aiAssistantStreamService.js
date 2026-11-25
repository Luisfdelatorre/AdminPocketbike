/**
 * Streaming Orchestrator — UPay AI Assistant (Reqs. 1, 2, 4, 5, 7, 8, 9, 10, 12, 13)
 *
 * Layers real-time streaming on top of the existing `aiAssistantService` architecture:
 *  - Supports BOTH OpenAI HTTP Streaming (`responses.create({ stream: true })`) AND
 *    OpenAI Responses API WebSocket Mode (`ResponsesWS` over `wss://api.openai.com/v1/responses`).
 *  - Handles full Responses API lifecycle events (`response.created`, `response.output_item.added`,
 *    `response.function_call_arguments.delta`, `response.function_call_arguments.done`,
 *    `response.output_text.delta`, `response.output_text.done`, `response.completed`,
 *    `response.incomplete`, `response.failed`, `error`).
 *  - Never executes partial tool arguments: waits for complete JSON, validates with
 *    `FetchModuleRecordsArgsSchema`, enforces tenant/role permissions, and emits verified
 *    `tool_started` / `tool_completed` events.
 *  - Prevents unverified facts from leaking via early text/audio streaming: streams live
 *    `text_delta` + sentence-buffered neural TTS `audio_chunk`s ONLY when grounded in
 *    completed tool results (with `actions: []` and no unresolved `{{placeholders}}`),
 *    and gates UI-action confirmations until validation/execution completes.
 *  - Enforces turn-scoped `AbortSignal` cancellation across model and TTS streams.
 */

import crypto from 'node:crypto';
import {
    validateActionPlan,
    FetchModuleRecordsArgsSchema,
} from '../../client/src/services/voiceAssistant/schemaValidator.js';
import { prepareSpokenResponse } from '../../client/src/services/voiceAssistant/tts.js';
import {
    getActivePromptVersion,
    buildStablePrefix,
    buildDynamicSuffix,
    extractUsageMetrics,
    getRoleVariant,
    planContextualFallback,
    recordTrainingTrace,
    getOpenAIClient,
    isDailyTokenCapExceeded,
    recordMetricsSample,
    humanizeAssistantText,
    isFullYearUtterance,
    FETCH_MODULE_RECORDS_TOOL,
    MAX_TOOL_CALLS_PER_TURN,
} from './aiAssistantService.js';
import {
    estimatePromptComponentTokens,
    buildExtendedTokenCostTelemetry,
} from './aiTokenTelemetry.js';
import { fetchSanitizedModuleRecords } from './assistantDemoService.js';
import {
    runAssistantTurnWithAgentsSdk,
    closeSharedAgentsWSModel,
    markTurnSignatureSynced,
    isAnalyticalQuestion,
    ensureRequestedViewActions,
    evaluateGoalCompletion,
    buildTurnTelemetry,
} from './aiAssistantAgentRuntime.js';

const DEFAULT_MODEL = process.env.OPENAI_ASSISTANT_MODEL || 'gpt-4o-mini';
const DEFAULT_TTS_MODEL = process.env.OPENAI_TTS_MODEL || 'gpt-4o-mini-tts';
const DEFAULT_TTS_VOICE = process.env.OPENAI_TTS_VOICE || 'coral';
const MAX_OUTPUT_TOKENS = Number(process.env.AI_MAX_OUTPUT_TOKENS) || 900;
const REQUEST_TIMEOUT_MS = Number(process.env.AI_REQUEST_TIMEOUT_MS) || 18000;
const MODEL_TEMPERATURE = Number.isFinite(Number(process.env.AI_TEMPERATURE))
    ? Number(process.env.AI_TEMPERATURE)
    : 0.3;
const DEFAULT_STREAM_MODE = process.env.AI_OPENAI_STREAM_MODE === 'ws' ? 'ws' : 'http';

const shouldLogDebug = (openaiClientOverride = null) =>
    process.env.AI_DEBUG_LOGS !== 'false' &&
    process.env.NODE_ENV !== 'test' &&
    !process.execArgv.includes('--test') &&
    !openaiClientOverride;

/**
 * Redacts spoken amounts or customer names BEFORE sending sentences to Neural TTS
 * when privacy toggles are OFF (mirrors client privacy rules).
 */
export const applyServerSpeechPrivacyFilter = (
    text = '',
    { speakAmounts = true, speakCustomerNames = true, lang = 'es-CO' } = {}
) => {
    let output = String(text || '');
    if (!output) return '';

    if (!speakAmounts) {
        const replacement =
            lang === 'en-US' ? 'the amount shown on screen' : 'el monto mostrado en pantalla';
        output = output
            .replace(/\$\s?\d[\d.,]*(?:\s?(?:COP|mil|millones|M|k))?(?:\s+de\s+pesos|\s+pesos)?/gi, replacement)
            .replace(/\b\d[\d.,]*\s*(?:mil|millones(?:\s+de)?)\s+(?:pesos|COP)\b/gi, replacement)
            .replace(/\b\d[\d.,]{2,}\s*(?:pesos|COP)\b/gi, replacement);
    }

    if (!speakCustomerNames) {
        const replacement = lang === 'en-US' ? 'the registered customer' : 'el titular registrado';
        output = output.replace(
            /\b(?:Conductor|Cliente|Titular|Customer)\s+[A-ZÁÉÍÓÚÑ][a-záéíóúñ]+(?:\s+[A-ZÁÉÍÓÚÑ][a-záéíóúñ]+)*/g,
            replacement
        );
    }

    return output;
};

/**
 * Buffers streamed text deltas and emits natural complete sentences for ordered neural TTS.
 */
export class SentenceChunker {
    constructor({ minSentenceChars = 22, softSplitChars = 130 } = {}) {
        this.minSentenceChars = minSentenceChars;
        this.softSplitChars = softSplitChars;
        this.buffer = '';
    }

    push(delta = '') {
        if (!delta) return [];
        this.buffer += delta;
        const sentences = [];

        while (this.buffer.length >= this.minSentenceChars) {
            // Hard sentence boundary (. ! ? ; : followed by whitespace)
            const boundaryMatch = this.buffer.match(/^([\s\S]*?[.!?;:])\s+([\s\S]*)$/);
            if (boundaryMatch && boundaryMatch[1].trim().length >= this.minSentenceChars) {
                sentences.push(boundaryMatch[1].trim());
                this.buffer = boundaryMatch[2];
                continue;
            }
            // Soft clause boundary (, ) only when sentence grows very long
            if (this.buffer.length >= this.softSplitChars) {
                const commaIdx = this.buffer.indexOf(', ', this.minSentenceChars);
                if (commaIdx !== -1) {
                    sentences.push(this.buffer.slice(0, commaIdx + 1).trim());
                    this.buffer = this.buffer.slice(commaIdx + 2);
                    continue;
                }
            }
            break;
        }

        return sentences;
    }

    flush() {
        const rest = this.buffer.trim();
        this.buffer = '';
        return rest ? [rest] : [];
    }
}

/**
 * Stateful incremental extractor for the `"responseTemplate"` string value inside
 * the streamed ActionPlan JSON object.
 *
 * Also inspects `"actions"` when `"actions"` precedes `"responseTemplate"` so we know
 * whether `"actions"` is empty (`[]`) before streaming characters to the client!
 */
export class ResponseTemplateJsonExtractor {
    constructor() {
        this.raw = '';
        this.inTemplateValue = false;
        this.templateDone = false;
        this.scanIndex = 0;
        this.escapeNext = false;
        this.unicodeBuffer = null;
        this.extractedTemplate = '';
        this.actionsKnownEmpty = null; // true if `"actions": []` seen before template
        this.placeholderDetected = false;
    }

    feed(chunk = '') {
        if (!chunk || this.templateDone) return '';
        this.raw += chunk;

        if (this.actionsKnownEmpty === null) {
            const emptyActMatch = /"actions"\s*:\s*\[\s*\]/.test(this.raw);
            const nonEmptyActMatch = /"actions"\s*:\s*\[\s*\{/.test(this.raw);
            if (emptyActMatch) this.actionsKnownEmpty = true;
            else if (nonEmptyActMatch) this.actionsKnownEmpty = false;
        }

        if (!this.inTemplateValue) {
            const keyMatch = this.raw.match(/"responseTemplate"\s*:\s*"/);
            if (!keyMatch) return '';
            this.inTemplateValue = true;
            this.scanIndex = keyMatch.index + keyMatch[0].length;
        }

        let deltaOut = '';
        while (this.scanIndex < this.raw.length) {
            const ch = this.raw[this.scanIndex++];

            if (this.unicodeBuffer !== null) {
                this.unicodeBuffer += ch;
                if (this.unicodeBuffer.length === 4) {
                    const code = parseInt(this.unicodeBuffer, 16);
                    if (!Number.isNaN(code)) {
                        deltaOut += String.fromCharCode(code);
                    }
                    this.unicodeBuffer = null;
                }
                continue;
            }

            if (this.escapeNext) {
                this.escapeNext = false;
                if (ch === 'n') deltaOut += '\n';
                else if (ch === 'r') deltaOut += '\r';
                else if (ch === 't') deltaOut += '\t';
                else if (ch === '"' || ch === '\\' || ch === '/') deltaOut += ch;
                else if (ch === 'u') this.unicodeBuffer = '';
                else deltaOut += ch;
                continue;
            }

            if (ch === '\\') {
                this.escapeNext = true;
                continue;
            }

            if (ch === '"') {
                this.templateDone = true;
                this.inTemplateValue = false;
                break;
            }

            deltaOut += ch;
        }

        if (deltaOut) {
            this.extractedTemplate += deltaOut;
            if (this.extractedTemplate.includes('{{')) {
                this.placeholderDetected = true;
            }
        }

        return deltaOut;
    }
}

// --- Shared OpenAI ResponsesWS Connection Manager (Req. 12) ---
let sharedWsSession = null; // { clientRef, ws, openReadyPromise, reconnectCount }

const getOrCreateResponsesWS = async (openai, { forceNew = false } = {}) => {
    if (
        !forceNew &&
        sharedWsSession &&
        sharedWsSession.clientRef === openai &&
        sharedWsSession.ws &&
        !sharedWsSession.ws._intentionallyClosed &&
        sharedWsSession.ws.socket?.readyState === 1
    ) {
        return sharedWsSession;
    }

    const { ResponsesWS } = await import('openai/resources/responses/ws.mjs');
    const session = {
        clientRef: openai,
        ws: null,
        reconnectCount: 0,
    };

    const ws = new ResponsesWS(openai, {
        reconnect: {
            maxRetries: 3,
            initialDelay: 400,
            maxDelay: 3500,
            onReconnecting: () => {
                session.reconnectCount += 1;
            },
        },
    });

    // Prevent unhandled rejection when idle errors occur on background socket
    ws.on('error', () => {});
    session.ws = ws;
    sharedWsSession = session;
    return session;
};

export const closeSharedResponsesWS = () => {
    if (sharedWsSession?.ws) {
        try {
            sharedWsSession.ws.close({ code: 1000, reason: 'Shutdown' });
        } catch {
            // Ignore
        }
    }
    sharedWsSession = null;
    closeSharedAgentsWSModel().catch(() => {});
};

/**
 * Executes a single OpenAI Responses streaming round over either `'http'` (`responses.create({ stream: true })`)
 * or `'ws'` (`ResponsesWS` over `wss://api.openai.com/v1/responses`), yielding canonical `ResponseStreamEvent`s.
 */
export async function* runOpenAIResponsesStreamRound({
    openai,
    mode = 'http',
    params,
    signal,
    wsFactory = getOrCreateResponsesWS,
}) {
    if (signal?.aborted) {
        throw new Error('TURN_CANCELLED');
    }

    if (mode === 'ws') {
        const wsSession = await wsFactory(openai);
        const ws = wsSession.ws;
        const streamId = `s_${Date.now()}_${crypto.randomBytes(3).toString('hex')}`;
        const iter = ws.stream({ maxBufferedEvents: 2000 });

        const onAbort = () => {
            // Only reset legacy custom wsFactory socket when explicitly injected; shared production WS uses OpenAIResponsesWSModel lock
            if (wsFactory !== getOrCreateResponsesWS) {
                closeSharedResponsesWS();
            }
        };
        signal?.addEventListener('abort', onAbort, { once: true });

        try {
            // Per OpenAI ResponsesWS spec: `stream` is implicit over WebSocket and must NOT be sent
            const { stream: _omitStream, ...wsParams } = params;
            ws.send({
                type: 'response.create',
                stream_id: streamId,
                ...wsParams,
            });

            let targetResponseId = null;

            for await (const item of iter) {
                if (signal?.aborted) {
                    throw new Error('TURN_CANCELLED');
                }
                if (item.type === 'error') {
                    throw item.error || new Error('RESPONSES_WS_STREAM_ERROR');
                }
                if (item.type === 'close') {
                    throw new Error(`RESPONSES_WS_CLOSED:${item.code || 1006}`);
                }
                if (item.type !== 'message' || !item.message) {
                    continue;
                }

                const ev = item.message;
                if (ev.stream_id && ev.stream_id !== streamId) {
                    continue;
                }
                if (ev.type === 'response.created' && ev.response?.id) {
                    targetResponseId = ev.response.id;
                }
                if (
                    targetResponseId &&
                    ev.response?.id &&
                    ev.response.id !== targetResponseId
                ) {
                    continue;
                }

                yield ev;

                if (
                    ev.type === 'response.completed' ||
                    ev.type === 'response.incomplete' ||
                    ev.type === 'response.failed' ||
                    ev.type === 'error'
                ) {
                    break;
                }
            }
        } finally {
            signal?.removeEventListener('abort', onAbort);
        }
        return;
    }

    // Default HTTP SSE streaming via OpenAI Responses API
    const httpStream = await openai.responses.create(
        {
            ...params,
            stream: true,
        },
        {
            timeout: REQUEST_TIMEOUT_MS,
            maxRetries: 1,
            signal,
        }
    );

    for await (const ev of httpStream) {
        if (signal?.aborted) {
            throw new Error('TURN_CANCELLED');
        }
        yield ev;
    }
}

/**
 * Default Neural TTS synthesizer using `openai.audio.speech.create`.
 * Streams MP3 chunks through `onChunk` with full `AbortSignal` support.
 */
export const defaultNeuralTtsSynthesizer = async ({
    openai,
    text,
    voice = DEFAULT_TTS_VOICE,
    signal,
    onChunk,
}) => {
    if (!openai?.audio?.speech?.create || !text || signal?.aborted) {
        return 0;
    }

    const speechRes = await openai.audio.speech.create(
        {
            model: DEFAULT_TTS_MODEL,
            voice: voice || DEFAULT_TTS_VOICE,
            input: text,
            response_format: 'mp3',
        },
        { signal, timeout: 12000 }
    );

    let chunkIndex = 0;
    const body = speechRes?.body;

    if (body && typeof body[Symbol.asyncIterator] === 'function') {
        for await (const rawChunk of body) {
            if (signal?.aborted) throw new Error('TURN_CANCELLED');
            const buf = Buffer.isBuffer(rawChunk) ? rawChunk : Buffer.from(rawChunk);
            if (buf.length > 0) {
                onChunk({
                    chunkIndex: chunkIndex++,
                    isFinalChunk: false,
                    mimeType: 'audio/mpeg',
                    audioBase64: buf.toString('base64'),
                });
            }
        }
    } else if (typeof speechRes?.arrayBuffer === 'function') {
        const ab = await speechRes.arrayBuffer();
        if (signal?.aborted) throw new Error('TURN_CANCELLED');
        const buf = Buffer.from(ab);
        if (buf.length > 0) {
            onChunk({
                chunkIndex: chunkIndex++,
                isFinalChunk: false,
                mimeType: 'audio/mpeg',
                audioBase64: buf.toString('base64'),
            });
        }
    }

    if (!signal?.aborted && chunkIndex > 0) {
        onChunk({
            chunkIndex,
            isFinalChunk: true,
            mimeType: 'audio/mpeg',
            audioBase64: '',
        });
    }

    return chunkIndex;
};

/**
 * Consumes a single Responses API stream round, accumulating complete tool calls and JSON output
 * while optionally streaming verified `text_delta` and sentence-level TTS when `allowLiveTextStream` is true.
 */
const consumeStreamRound = async ({
    eventIterator,
    allowLiveTextStream = false,
    onFirstEvent = null,
    onLiveTemplateDelta = null,
    signal,
}) => {
    let responseId = null;
    let outputText = '';
    let completedResponse = null;
    const toolCallMap = new Map(); // itemId -> { id, call_id, name, argumentsStr, completed }
    const extractor = new ResponseTemplateJsonExtractor();
    let liveStreamBlocked = !allowLiveTextStream;
    let firstEventSeen = false;

    for await (const ev of eventIterator) {
        if (signal?.aborted) throw new Error('TURN_CANCELLED');
        if (!firstEventSeen) {
            firstEventSeen = true;
            onFirstEvent?.(ev);
        }

        switch (ev.type) {
            case 'response.created': {
                if (ev.response?.id) responseId = ev.response.id;
                break;
            }

            case 'response.output_item.added': {
                const item = ev.item;
                if (item?.type === 'function_call') {
                    const key = item.id || item.call_id;
                    toolCallMap.set(key, {
                        id: item.id || key,
                        call_id: item.call_id || key,
                        name: item.name || '',
                        argumentsStr: typeof item.arguments === 'string' ? item.arguments : '',
                        completed: false,
                    });
                }
                break;
            }

            case 'response.function_call_arguments.delta': {
                // Accumulate ONLY; NEVER execute partial arguments (Req. 7)
                const key = ev.item_id || ev.call_id;
                const existing = toolCallMap.get(key) || {
                    id: key,
                    call_id: ev.call_id || key,
                    name: 'fetch_module_records',
                    argumentsStr: '',
                    completed: false,
                };
                existing.argumentsStr += ev.delta || '';
                toolCallMap.set(key, existing);
                break;
            }

            case 'response.function_call_arguments.done': {
                const key = ev.item_id || ev.call_id;
                const existing = toolCallMap.get(key) || {
                    id: key,
                    call_id: ev.call_id || key,
                    name: ev.name || 'fetch_module_records',
                    argumentsStr: '',
                    completed: false,
                };
                if (typeof ev.arguments === 'string') {
                    existing.argumentsStr = ev.arguments;
                }
                if (ev.name) existing.name = ev.name;
                existing.completed = true;
                toolCallMap.set(key, existing);
                break;
            }

            case 'response.output_item.done': {
                const item = ev.item;
                if (item?.type === 'function_call') {
                    const key = item.id || item.call_id;
                    toolCallMap.set(key, {
                        id: item.id || key,
                        call_id: item.call_id || key,
                        name: item.name || 'fetch_module_records',
                        argumentsStr: typeof item.arguments === 'string' ? item.arguments : '',
                        completed: true,
                    });
                }
                break;
            }

            case 'response.output_text.delta': {
                const delta = ev.delta || '';
                outputText += delta;
                if (!liveStreamBlocked) {
                    const tplDelta = extractor.feed(delta);
                    // Only emit live text_delta if actions are confirmed empty (`[]`) and no `{{placeholder}}` appeared
                    if (extractor.actionsKnownEmpty === false || extractor.placeholderDetected) {
                        liveStreamBlocked = true;
                    } else if (extractor.actionsKnownEmpty === true && tplDelta) {
                        onLiveTemplateDelta?.(tplDelta);
                    }
                }
                break;
            }

            case 'response.output_text.done': {
                if (typeof ev.text === 'string' && !outputText) {
                    outputText = ev.text;
                }
                break;
            }

            case 'response.completed':
            case 'response.incomplete': {
                completedResponse = ev.response || null;
                if (completedResponse?.id) responseId = completedResponse.id;
                if (!outputText && typeof completedResponse?.output_text === 'string') {
                    outputText = completedResponse.output_text;
                }
                // Backfill completed function_call items if SDK delivered them inside response.output
                if (Array.isArray(completedResponse?.output)) {
                    for (const outItem of completedResponse.output) {
                        if (outItem?.type === 'function_call') {
                            const key = outItem.id || outItem.call_id;
                            toolCallMap.set(key, {
                                id: outItem.id || key,
                                call_id: outItem.call_id || key,
                                name: outItem.name || 'fetch_module_records',
                                argumentsStr:
                                    typeof outItem.arguments === 'string' ? outItem.arguments : '',
                                completed: true,
                            });
                        } else if (!outputText && outItem?.type === 'message' && Array.isArray(outItem.content)) {
                            for (const c of outItem.content) {
                                if (typeof c?.text === 'string') outputText += c.text;
                            }
                        }
                    }
                }
                break;
            }

            case 'response.failed':
            case 'error': {
                const msg =
                    ev.error?.message ||
                    ev.response?.error?.message ||
                    ev.message ||
                    'OpenAI stream failed';
                throw new Error(msg);
            }

            default:
                break;
        }
    }

    const completedToolCalls = Array.from(toolCallMap.values()).filter(
        (tc) => tc.completed && tc.name === 'fetch_module_records'
    );

    return {
        responseId,
        outputText,
        completedResponse,
        completedToolCalls,
        streamedTemplateText: !liveStreamBlocked ? extractor.extractedTemplate : '',
    };
};

/**
 * Main streaming turn entrypoint invoked by `assistantWsServer` and benchmarks.
 */
export const streamAssistantTurn = async ({
    turnId,
    traceId = null,
    viaVoice = false,
    text,
    lang = 'es-CO',
    applicationContext = {},
    conversationHistory = [],
    ttsOptions = {},
    upstreamMode = undefined,
    promptVersion = null,
    user = null,
    signal = null,
    emitEvent = () => {},
    openaiClient = null,
    toolExecutor = fetchSanitizedModuleRecords,
    ttsSynthesizer = defaultNeuralTtsSynthesizer,
    wsFactory = undefined,
}) => {
    const startTime = performance.now();
    const activePromptVersion = getActivePromptVersion(promptVersion);
    const transportMode = upstreamMode === 'ws' || upstreamMode === 'http' ? upstreamMode : DEFAULT_STREAM_MODE;
    const roleVariant = getRoleVariant(user);
    const prefixInfo = buildStablePrefix(roleVariant, activePromptVersion);
    const dynamicSuffix = buildDynamicSuffix({
        applicationContext,
        conversationHistory,
        text,
        lang,
        promptVersion: activePromptVersion,
        omitConversationHistory: activePromptVersion === 'v2',
    });
    const activeTraceId =
        typeof traceId === 'string' && traceId.trim()
            ? traceId.trim().slice(0, 64)
            : turnId || `tr_${Date.now()}_${crypto.randomBytes(3).toString('hex')}`;
    const skipDiskWrite = Boolean(openaiClient);

    let firstEventLatencyMs = null;
    let firstTextDeltaMs = null;
    let firstAudioLatencyMs = null;
    let toolRounds = 0;

    const debugEnabled = shouldLogDebug(openaiClient);
    const logStream = (...args) => {
        if (!debugEnabled) return;
        const ms = Math.round(performance.now() - startTime);
        console.log(`[AI Stream ${activeTraceId} +${ms}ms]`, ...args);
    };

    logStream('▶ Turno iniciado (stream):', {
        userText: text,
        viaVoice,
        module: applicationContext?.currentModule || 'dashboard',
        route: applicationContext?.currentRoute || '/',
        activeFilters: applicationContext?.activeFilters || {},
        historyTurns: Array.isArray(conversationHistory) ? conversationHistory.length : 0,
        openaiTransport: transportMode,
        neuralTts: Boolean(ttsOptions?.enabled !== false && ttsOptions?.neural !== false),
    });

    emitEvent('turn_started', {
        turnId,
        traceId: activeTraceId,
        transport: transportMode,
    });

    const openai = openaiClient || (await getOpenAIClient());
    const capExceeded = openai ? isDailyTokenCapExceeded() : false;

    const ttsEnabled = ttsOptions?.enabled !== false;
    const neuralTtsEnabled =
        ttsEnabled &&
        ttsOptions?.neural !== false &&
        Boolean(openai?.audio?.speech?.create || ttsSynthesizer !== defaultNeuralTtsSynthesizer);
    const speakAmounts = ttsOptions?.speakAmounts !== false;
    const speakCustomerNames = ttsOptions?.speakCustomerNames !== false;
    const neuralVoice =
        typeof ttsOptions?.voice === 'string' && ttsOptions.voice.trim()
            ? ttsOptions.voice.trim()
            : DEFAULT_TTS_VOICE;

    // Ordered sentence synthesis queue (runs sequentially per sentenceIndex while text streams)
    const MAX_NEURAL_TTS_SENTENCES = 3;
    let nextSentenceIdx = 0;
    let ttsChain = Promise.resolve();
    let emittedAudioChunks = 0;

    const enqueueSentenceForNeuralTts = (rawSentence) => {
        if (!neuralTtsEnabled || !rawSentence || signal?.aborted) return;
        if (nextSentenceIdx >= MAX_NEURAL_TTS_SENTENCES) return;
        const humanized = humanizeAssistantText(rawSentence);
        const privacyClean = applyServerSpeechPrivacyFilter(humanized, {
            speakAmounts,
            speakCustomerNames,
            lang,
        });
        const spokenClean = prepareSpokenResponse(privacyClean, {
            lang,
            keepFullList: false,
        });
        if (!spokenClean) return;

        const sentenceIndex = nextSentenceIdx++;
        ttsChain = ttsChain
            .then(async () => {
                if (signal?.aborted) return;
                await ttsSynthesizer({
                    openai,
                    text: spokenClean,
                    voice: neuralVoice,
                    signal,
                    onChunk: (chunkPayload) => {
                        if (signal?.aborted) return;
                        if (firstAudioLatencyMs === null && chunkPayload.audioBase64) {
                            firstAudioLatencyMs = Math.round(performance.now() - startTime);
                        }
                        emittedAudioChunks += 1;
                        emitEvent('audio_chunk', {
                            sentenceIndex,
                            ...chunkPayload,
                        });
                    },
                });
            })
            .catch(() => {
                // Non-fatal TTS error: client falls back cleanly to text / browser speechSynthesis
            });
    };

    let streamErrorReason = null;
    if (openai && !capExceeded) {
        try {
            const cacheKey = `upay_${roleVariant}_${prefixInfo.catalogHash.slice(0, 32)}`;
            let parsed = null;
            let finalUsage = null;
            let openaiCallsCount = 1;
            let priorSessionItems = [];
            let onDemandToolCalls = null;
            let sessionHasVerifiedToolData = false;
            let toolErrors = [];
            let streamedTextCount = 0;
            let syncedSessionEntry = null;
            const sentenceChunker = new SentenceChunker();

            // Custom `wsFactory` test hook path (preserves direct ResponsesWS mock tests)
            if (wsFactory && transportMode === 'ws') {
                const round1Iter = runOpenAIResponsesStreamRound({
                    openai,
                    mode: 'ws',
                    params: {
                        model: DEFAULT_MODEL,
                        instructions: prefixInfo.stablePrefix,
                        input: [{ role: 'user', content: dynamicSuffix }],
                        tools: [FETCH_MODULE_RECORDS_TOOL],
                        tool_choice: 'auto',
                        text: { format: { type: 'json_object' } },
                        prompt_cache_key: cacheKey,
                        max_output_tokens: MAX_OUTPUT_TOKENS,
                        temperature: MODEL_TEMPERATURE,
                    },
                    signal,
                    wsFactory,
                });

                const round1 = await consumeStreamRound({
                    eventIterator: round1Iter,
                    allowLiveTextStream: false,
                    onFirstEvent: () => {
                        if (firstEventLatencyMs === null) {
                            firstEventLatencyMs = Math.round(performance.now() - startTime);
                        }
                    },
                    signal,
                });

                const firstSample = extractUsageMetrics(round1.completedResponse?.usage, {
                    catalogHash: prefixInfo.catalogHash,
                    modelName: DEFAULT_MODEL,
                    latencyMs: performance.now() - startTime,
                });
                recordMetricsSample(firstSample);

                const cleanJson = String(round1.outputText || '')
                    .trim()
                    .replace(/^```json\s*/i, '')
                    .replace(/^```\s*/i, '')
                    .replace(/```$/i, '')
                    .trim();
                parsed = JSON.parse(cleanJson);
                finalUsage = round1.completedResponse?.usage || null;
            } else {
                // Primary Path: `@openai/agents` (`Runner` + `Agent` + `MemorySession` + `zod` Structured Outputs)
                const liveExtractor = new ResponseTemplateJsonExtractor();
                let liveStreamBlocked = false;
                let pendingTail = '';
                const SIGN_OFF_GUARD_CHARS = 72;

                const flushSafeStreamChunk = (chunkStr) => {
                    if (!chunkStr || signal?.aborted) return;
                    if (firstTextDeltaMs === null) {
                        firstTextDeltaMs = Math.round(performance.now() - startTime);
                    }
                    streamedTextCount += chunkStr.length;
                    emitEvent('text_delta', { delta: chunkStr });
                    for (const s of sentenceChunker.push(chunkStr)) {
                        enqueueSentenceForNeuralTts(s);
                    }
                };

                const ephemeralSession = Boolean(openaiClient);
                const agentRun = await runAssistantTurnWithAgentsSdk({
                    openai,
                    modelName: DEFAULT_MODEL,
                    promptVersion: activePromptVersion,
                    transportMode,
                    stablePrefix: prefixInfo.stablePrefix,
                    cacheKey,
                    dynamicInputText: dynamicSuffix,
                    rawUserText: text,
                    isFullYearFn: isFullYearUtterance,
                    applicationContext,
                    conversationHistory,
                    user,
                    roleVariant,
                    maxOutputTokens: MAX_OUTPUT_TOKENS,
                    temperature: MODEL_TEMPERATURE,
                    maxToolCallsPerTurn: MAX_TOOL_CALLS_PER_TURN,
                    ephemeralSession,
                    stream: true,
                    signal,
                    toolExecutor,
                    onLog: logStream,
                    onFirstEvent: () => {
                        if (firstEventLatencyMs === null) {
                            firstEventLatencyMs = Math.round(performance.now() - startTime);
                        }
                    },
                    onToolStarted: (evtPayload) => {
                        emitEvent('tool_started', evtPayload);
                    },
                    onToolCompleted: (evtPayload) => {
                        emitEvent('tool_completed', evtPayload);
                    },
                    onRawTextDelta: (rawDelta, { toolsExecuted }) => {
                        // Stream live `text_delta` & Neural TTS ONLY in Round 2 (`toolsExecuted === true`)
                        // when `"actions": []` is already verified ahead of `"responseTemplate"` and no `{{placeholder}}` exists!
                        if (!toolsExecuted || liveStreamBlocked) return;
                        const tplDelta = liveExtractor.feed(rawDelta);
                        if (
                            liveExtractor.actionsKnownEmpty === false ||
                            liveExtractor.placeholderDetected
                        ) {
                            liveStreamBlocked = true;
                            pendingTail = '';
                            return;
                        }
                        if (liveExtractor.actionsKnownEmpty === true && tplDelta) {
                            pendingTail += tplDelta;
                            // Hold the last SIGN_OFF_GUARD_CHARS characters until end-of-turn so `humanizeAssistantText`
                            // strips trailing call-center sign-offs BEFORE emitting text_delta or Neural TTS!
                            if (pendingTail.length > SIGN_OFF_GUARD_CHARS) {
                                const safeCount = pendingTail.length - SIGN_OFF_GUARD_CHARS;
                                const safePart = pendingTail.slice(0, safeCount);
                                pendingTail = pendingTail.slice(safeCount);
                                flushSafeStreamChunk(safePart);
                            }
                        }
                    },
                });

                const totalSoFarMs = Math.round(performance.now() - startTime);
                openaiCallsCount = Math.max(1, agentRun.perRoundUsages.length);
                priorSessionItems = agentRun.priorSessionItems || [];
                const roundBreakdown = estimatePromptComponentTokens({
                    headerText: prefixInfo.headerText,
                    moduleRegistryText: prefixInfo.moduleRegistryText,
                    toolDefinitionJson: prefixInfo.toolDefinitionJson,
                    outputSchemaJson: prefixInfo.outputSchemaJson,
                    dynamicContextText: dynamicSuffix,
                    conversationHistoryItems: priorSessionItems,
                    embeddedHistoryInDynamic: activePromptVersion === 'v1',
                });
                for (const roundUsage of agentRun.perRoundUsages) {
                    const roundCost = buildExtendedTokenCostTelemetry({
                        model: DEFAULT_MODEL,
                        promptVersion: activePromptVersion,
                        promptHash: prefixInfo.catalogHash,
                        componentBreakdown: roundBreakdown,
                        usage: roundUsage,
                        durationMs: Math.round(totalSoFarMs / openaiCallsCount),
                        openaiCalls: 1,
                        toolCalls: 0,
                    });
                    const sample = {
                        ...extractUsageMetrics(roundUsage, {
                            catalogHash: prefixInfo.catalogHash,
                            modelName: DEFAULT_MODEL,
                            latencyMs: Math.round(totalSoFarMs / openaiCallsCount),
                        }),
                        estimatedCostUSD: roundCost.estimatedCostUSD,
                        estimatedSavingsUSD: roundCost.estimatedSavingsUSD,
                    };
                    recordMetricsSample(sample);
                }

                parsed = agentRun.finalOutput;
                finalUsage = agentRun.usage;
                onDemandToolCalls = agentRun.onDemandToolCalls;
                sessionHasVerifiedToolData = Boolean(agentRun.sessionHasVerifiedToolData);
                toolErrors = Array.isArray(agentRun.toolErrors) ? agentRun.toolErrors : [];
                toolRounds = agentRun.toolRounds;
                syncedSessionEntry = agentRun.sessionEntry;
            }

            const validated = validateActionPlan(parsed, {
                currentModule: applicationContext?.currentModule || 'dashboard',
                user,
            });

            if (validated.success) {
                let verifiedData = ensureRequestedViewActions({
                    userText: text,
                    plan: {
                        ...validated.data,
                        responseTemplate: humanizeAssistantText(
                            validated.data.responseTemplate || ''
                        ),
                    },
                    currentModule: applicationContext?.currentModule || 'dashboard',
                    activeFilters: applicationContext?.activeFilters || {},
                    onDemandToolCalls,
                    toolErrors,
                    user,
                });
                const goalCheck = evaluateGoalCompletion({
                    userText: text,
                    plan: verifiedData,
                    onDemandToolCalls,
                    sessionHasVerifiedToolData,
                    toolErrors,
                    lang,
                });
                if (goalCheck.suggestedPlanOverride) {
                    verifiedData = goalCheck.suggestedPlanOverride;
                }
                const tpl = verifiedData.responseTemplate || '';
                const hasPlaceholders = /\{\{\s*[a-zA-Z0-9_.-]+\s*\}\}/.test(tpl);

                const toolExecutionStatus =
                    toolErrors.length > 0 && !onDemandToolCalls
                        ? 'failed'
                        : toolErrors.length > 0 && onDemandToolCalls
                        ? 'partial_error'
                        : onDemandToolCalls
                        ? 'success'
                        : 'not_needed';
                const responseStatus =
                    goalCheck.status === 'failed'
                        ? 'error'
                        : verifiedData.needsClarification
                        ? 'clarification'
                        : 'generated';

                markTurnSignatureSynced(syncedSessionEntry, {
                    userText: text,
                    assistantText: verifiedData.responseTemplate,
                    targetModule: verifiedData.targetModule,
                });

                // If `actions` is empty and no `{{placeholders}}` remain, emit any unstreamed text + flush neural TTS now.
                // Conversely, if `actions.length > 0` or `{{placeholders}}` exist, hold text/audio until client dispatcher confirms!
                const canStreamNow = verifiedData.actions.length === 0 && !hasPlaceholders;

                if (canStreamNow) {
                    const remainingText =
                        streamedTextCount > 0
                            ? verifiedData.responseTemplate.slice(streamedTextCount)
                            : verifiedData.responseTemplate;
                    if (remainingText) {
                        if (firstTextDeltaMs === null) {
                            firstTextDeltaMs = Math.round(performance.now() - startTime);
                        }
                        emitEvent('text_delta', { delta: remainingText });
                        for (const s of sentenceChunker.push(remainingText)) {
                            enqueueSentenceForNeuralTts(s);
                        }
                        streamedTextCount += remainingText.length;
                    }
                    for (const tail of sentenceChunker.flush()) {
                        enqueueSentenceForNeuralTts(tail);
                    }
                    await ttsChain;
                } else if (
                    verifiedData.actions.length > 0 &&
                    !hasPlaceholders &&
                    neuralTtsEnabled &&
                    verifiedData.responseTemplate
                ) {
                    if (ttsOptions?.preSynthesizeActionAudio === true) {
                        for (const s of sentenceChunker.push(verifiedData.responseTemplate)) {
                            enqueueSentenceForNeuralTts(s);
                        }
                        for (const tail of sentenceChunker.flush()) {
                            enqueueSentenceForNeuralTts(tail);
                        }
                        await ttsChain;
                    }
                }

                if (signal?.aborted) throw new Error('TURN_CANCELLED');

                const finalPlan = onDemandToolCalls
                    ? { ...verifiedData, onDemandDataUsed: true }
                    : verifiedData;
                const plannerSource = onDemandToolCalls
                    ? 'openai_responses_with_data'
                    : 'openai_responses';
                const totalLatencyMs = Math.round(performance.now() - startTime);

                const componentBreakdown = estimatePromptComponentTokens({
                    headerText: prefixInfo.headerText,
                    moduleRegistryText: prefixInfo.moduleRegistryText,
                    toolDefinitionJson: prefixInfo.toolDefinitionJson,
                    outputSchemaJson: prefixInfo.outputSchemaJson,
                    dynamicContextText: dynamicSuffix,
                    conversationHistoryItems: priorSessionItems,
                    embeddedHistoryInDynamic: activePromptVersion === 'v1',
                });
                const extendedTelemetry = buildExtendedTokenCostTelemetry({
                    model: DEFAULT_MODEL,
                    promptVersion: activePromptVersion,
                    promptHash: prefixInfo.catalogHash,
                    componentBreakdown,
                    usage: finalUsage,
                    durationMs: totalLatencyMs,
                    openaiCalls: openaiCallsCount,
                    toolCalls: onDemandToolCalls ? onDemandToolCalls.length : 0,
                    plan: finalPlan,
                    routingMode: 'agents_sdk',
                    plannerSource,
                    onDemandToolCalls,
                    fallbackReason: null,
                });

                const metrics = {
                    ...extractUsageMetrics(finalUsage, {
                        catalogHash: prefixInfo.catalogHash,
                        modelName: DEFAULT_MODEL,
                        latencyMs: totalLatencyMs,
                    }),
                    ...buildTurnTelemetry({
                        routingMode: 'agents_sdk',
                        agentRunStatus: 'completed',
                        toolExecutionStatus,
                        goalCompletionStatus: goalCheck.status,
                        responseStatus,
                        fallbackReason: null,
                    }),
                    ...extendedTelemetry,
                    goal_completion_reason: goalCheck.reason,
                    transport_mode: transportMode,
                    sdk_runtime: '@openai/agents',
                    first_event_latency_ms: firstEventLatencyMs ?? totalLatencyMs,
                    first_text_delta_ms: firstTextDeltaMs,
                    first_audio_latency_ms: firstAudioLatencyMs,
                    tool_rounds: toolRounds,
                    ws_reconnects: sharedWsSession?.reconnectCount || 0,
                    ...(toolErrors.length > 0 ? { tool_errors: toolErrors } : {}),
                    ...(syncedSessionEntry?.sessionKey ? { session_active: true } : {}),
                    ...(onDemandToolCalls ? { on_demand_tool_calls: onDemandToolCalls } : {}),
                };

                recordTrainingTrace({
                    skipDiskWrite,
                    traceId: activeTraceId,
                    viaVoice,
                    lang,
                    userRole: roleVariant,
                    companyId: user?.companyId || null,
                    userText: text,
                    applicationContext,
                    matcherStatus: 'NO_MATCH',
                    plannerSource,
                    plan: finalPlan,
                    executionStatus: goalCheck.status === 'failed' ? 'failed' : 'planned',
                    metrics,
                });

                const resultPayload = {
                    traceId: activeTraceId,
                    plan: finalPlan,
                    source: plannerSource,
                    streamedText: streamedTextCount > 0,
                    audioStreamed: emittedAudioChunks > 0,
                    metrics,
                };

                logStream(`  └─ 🏁 Turno completado (stream) · ${openaiCallsCount} ${openaiCallsCount === 1 ? 'llamada' : 'llamadas'} a OpenAI · ${onDemandToolCalls ? onDemandToolCalls.length : 0} a herramientas:`, { openaiCalls: openaiCallsCount,
                    source: plannerSource,
                    targetModule: finalPlan.targetModule,
                    actions: finalPlan.actions,
                    responseTemplate: finalPlan.responseTemplate,
                    goalCompletionStatus: goalCheck.status,
                    streamedText: streamedTextCount > 0,
                    audioChunks: emittedAudioChunks,
                    firstAudioLatencyMs,
                    totalLatencyMs,
                });

                emitEvent('turn_completed', resultPayload);
                return resultPayload;
            }
            streamErrorReason = `validation_error: ${validated.error || 'invalid_plan'}`;
            logStream('  ├─ ⚠️ Error validando plan OpenAI:', streamErrorReason);
            // Prevent a malformed assistant output from poisoning MemorySession for future turns
            try {
                await syncedSessionEntry?.session?.popItem?.();
            } catch {
                // Ignore session rollback error
            }
        } catch (err) {
            if (signal?.aborted || err?.message === 'TURN_CANCELLED') {
                logStream('  └─ ⏹ Turno abortado por el cliente');
                return null;
            }
            const errName = err?.name || 'Error';
            const errStatus = err?.status ? ` (${err.status})` : '';
            const errMsg = typeof err?.message === 'string' ? err.message.slice(0, 140) : 'unknown';
            const isTimeout = /timeout|abort|ETIMEDOUT/i.test(`${errName} ${errMsg}`);
            streamErrorReason = isTimeout
                ? `network_timeout: ${errMsg}`
                : `openai_api_error: ${errName}${errStatus}: ${errMsg}`;
            logStream('  ├─ ⚠️ Excepción en flujo OpenAI -> pasando a fallback:', streamErrorReason);
            // Fall through to deterministic contextual fallback below (Req. 13)
        }
    } else {
        logStream('  └─ ℹ️ Usando fallback contextual directo:', {
            reason: !openai ? 'no_openai_client' : 'daily_token_cap_exceeded',
        });
    }

    if (signal?.aborted) return null;

    // Deterministic contextual fallback / quota / technical failure (Phases 5 & 7)
    const fallbackPlan = planContextualFallback({
        text,
        lang,
        applicationContext,
        conversationHistory,
        user,
    });
    const validatedFallback = validateActionPlan(fallbackPlan, {
        currentModule: applicationContext?.currentModule || 'dashboard',
        user,
    });

    if (!validatedFallback.success) {
        const failPayload = {
            code: validatedFallback.code || 'UNAUTHORIZED_MODULE',
            message:
                lang === 'en-US'
                    ? 'You do not have permission to access that module.'
                    : 'No tienes permiso para acceder a ese módulo.',
        };
        emitEvent('turn_failed', failPayload);
        return null;
    }

    const effectiveFallbackReason = capExceeded
        ? 'daily_token_cap_exceeded'
        : !openai
        ? 'no_openai_client'
        : streamErrorReason || 'contextual_fallback';
    const isTechnicalFailure =
        typeof effectiveFallbackReason === 'string' &&
        (effectiveFallbackReason.startsWith('openai_api_error') ||
            effectiveFallbackReason.startsWith('network_timeout') ||
            effectiveFallbackReason.startsWith('validation_error'));
    const analyticalQuery = isAnalyticalQuestion(text);
    const canFulfillSafelyLocally =
        validatedFallback.data.actions.length > 0 && !analyticalQuery;

    let fallbackData = validatedFallback.data;
    let fallbackSource = 'contextual_planner';
    let agentRunStatus = capExceeded ? 'quota_exceeded' : !openai ? 'unavailable' : 'failed';
    let goalCompletionStatus = validatedFallback.data.needsClarification
        ? 'clarification_needed'
        : 'complete';
    let responseStatus = validatedFallback.data.needsClarification ? 'clarification' : 'fallback';

    if (capExceeded && !canFulfillSafelyLocally) {
        fallbackData = {
            scope: 'current_screen',
            targetModule: applicationContext?.currentModule || 'dashboard',
            actions: [],
            needsClarification: false,
            responseTemplate:
                lang === 'en-US'
                    ? 'The daily AI assistant quota has been reached for today. Basic navigation and simple filters remain available.'
                    : 'Se alcanzó la cuota diaria de consultas con IA para hoy. La navegación básica y los filtros simples siguen disponibles.',
        };
        fallbackSource = 'quota_guard';
        goalCompletionStatus = 'incomplete';
        responseStatus = 'fallback';
    } else if (isTechnicalFailure && !canFulfillSafelyLocally) {
        fallbackData = {
            scope: 'current_screen',
            targetModule: applicationContext?.currentModule || 'dashboard',
            actions: [],
            needsClarification: false,
            responseTemplate:
                lang === 'en-US'
                    ? 'There was a temporary issue reaching the AI assistant. Please try again in a moment.'
                    : 'Hubo un problema temporal al consultar el asistente de IA. Intenta de nuevo en un momento.',
        };
        fallbackSource = 'technical_error_fallback';
        goalCompletionStatus = 'failed';
        responseStatus = 'error';
    }

    const hasPlaceholders = /\{\{\s*[a-zA-Z0-9_.-]+\s*\}\}/.test(fallbackData.responseTemplate || '');
    let fallbackStreamed = false;

    if (fallbackData.actions.length === 0 && !hasPlaceholders && fallbackData.responseTemplate) {
        emitEvent('text_delta', { delta: fallbackData.responseTemplate });
        fallbackStreamed = true;
    }

    const totalLatencyMs = Math.round(performance.now() - startTime);
    const fallbackBreakdown = estimatePromptComponentTokens({
        headerText: prefixInfo.headerText,
        moduleRegistryText: prefixInfo.moduleRegistryText,
        toolDefinitionJson: prefixInfo.toolDefinitionJson,
        outputSchemaJson: prefixInfo.outputSchemaJson,
        dynamicContextText: dynamicSuffix,
        conversationHistoryItems: conversationHistory,
        embeddedHistoryInDynamic: activePromptVersion === 'v1',
    });
    const fallbackExtended = buildExtendedTokenCostTelemetry({
        model: DEFAULT_MODEL,
        promptVersion: activePromptVersion,
        promptHash: prefixInfo.catalogHash,
        componentBreakdown: fallbackBreakdown,
        usage: null,
        durationMs: totalLatencyMs,
        openaiCalls: 0,
        toolCalls: 0,
        plan: fallbackData,
        routingMode: 'local_fallback',
        plannerSource: fallbackSource,
        fallbackReason: effectiveFallbackReason,
    });
    const fallbackMetrics = {
        ...extractUsageMetrics(null, {
            catalogHash: prefixInfo.catalogHash,
            modelName: openai ? `${DEFAULT_MODEL} (fallback)` : 'local-contextual-planner',
            latencyMs: totalLatencyMs,
            fallbackReason: effectiveFallbackReason,
        }),
        ...buildTurnTelemetry({
            routingMode: 'local_fallback',
            agentRunStatus,
            toolExecutionStatus: 'not_needed',
            goalCompletionStatus,
            responseStatus,
            fallbackReason: effectiveFallbackReason,
        }),
        ...fallbackExtended,
        transport_mode: transportMode,
        first_event_latency_ms: firstEventLatencyMs ?? totalLatencyMs,
        first_text_delta_ms: fallbackStreamed ? totalLatencyMs : null,
        first_audio_latency_ms: null,
        tool_rounds: toolRounds,
    };

    const completedPayload = {
        traceId: activeTraceId,
        plan: fallbackData,
        source: fallbackSource,
        streamedText: fallbackStreamed,
        audioStreamed: false,
        metrics: fallbackMetrics,
    };

    emitEvent('turn_completed', completedPayload);
    return completedPayload;
};

export default {
    streamAssistantTurn,
    runOpenAIResponsesStreamRound,
    closeSharedResponsesWS,
    SentenceChunker,
    ResponseTemplateJsonExtractor,
    applyServerSpeechPrivacyFilter,
};
