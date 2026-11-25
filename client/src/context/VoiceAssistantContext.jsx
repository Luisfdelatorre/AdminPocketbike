import React, { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { useAuth } from './AuthContext';
import {
    assistantChat,
    assistantChatStream,
    assistantQuery,
    recordAssistantTelemetry,
    resetAssistantSession,
} from '../services/api';
import { MODULES, ROUTE_TO_MODULE } from '../services/voiceAssistant/capabilities';
import { MAX_CONVERSATION_TURNS } from '../services/voiceAssistant/schemaValidator';
import { dispatchActionPlan } from '../services/voiceAssistant/dispatcher';
import { MATCH_STATUS, matchLocalIntent } from '../services/voiceAssistant/matcher';
import { getScreenBridge } from '../services/voiceAssistant/screenBridge';
import { resolveLocalDemoQuery } from '../services/voiceAssistant/demoData';
import AssistantWsClient from '../services/voiceAssistant/wsClient';
import AudioStreamQueue from '../services/voiceAssistant/audioQueue';
import {
    VOICE_STYLES,
    getAvailableVoices,
    onVoicesUpdated,
    isTTSSupported,
    prepareSpokenResponse,
    speakText,
    stopSpeaking,
    unlockTTS,
} from '../services/voiceAssistant/tts';
import useSpeechRecognition from '../hooks/useSpeechRecognition';

const VoiceAssistantContext = createContext(null);

export const ASSISTANT_STATUS = Object.freeze({
    IDLE: 'idle',
    LISTENING: 'listening',
    PROCESSING: 'processing',
    THINKING: 'thinking', // Alias kept for backward compatibility
    EXECUTING: 'executing',
    SPEAKING: 'speaking',
    ERROR: 'error',
});

export const STATUS_LABELS = Object.freeze({
    [ASSISTANT_STATUS.IDLE]: 'Listo',
    [ASSISTANT_STATUS.LISTENING]: 'Escuchando…',
    [ASSISTANT_STATUS.PROCESSING]: 'Procesando…',
    [ASSISTANT_STATUS.THINKING]: 'Procesando…',
    [ASSISTANT_STATUS.EXECUTING]: 'Ejecutando…',
    [ASSISTANT_STATUS.SPEAKING]: 'Hablando…',
    [ASSISTANT_STATUS.ERROR]: 'Atención',
});

const TTS_STORAGE_KEY = 'va_tts_enabled';
const VOICE_URI_STORAGE_KEY = 'va_voice_uri';
const VOICE_STYLE_STORAGE_KEY = 'va_voice_style';
const SPEAK_AMOUNTS_STORAGE_KEY = 'va_speak_amounts';
const SPEAK_NAMES_STORAGE_KEY = 'va_speak_names';
const ASSISTANT_LANG_STORAGE_KEY = 'va_lang';
const NEURAL_TTS_STORAGE_KEY = 'va_neural_tts';
const STREAMING_STORAGE_KEY = 'va_streaming_enabled';
const DEBUG_LOGS_STORAGE_KEY = 'va_debug_logs';
const INACTIVITY_TIMEOUT_MS = 2 * 60 * 1000; // 2 minutes (Section 13)

const logTurn = (...args) => {
    if (typeof window === 'undefined') return;
    try {
        if (localStorage.getItem(DEBUG_LOGS_STORAGE_KEY) === 'false') return;
    } catch {
        // Ignore storage errors
    }
    console.log('[UPay AI]', ...args);
};

const getStoredAuthToken = (contextToken = null) => {
    if (contextToken) return contextToken;
    if (typeof window === 'undefined') return null;
    try {
        return (
            localStorage.getItem('auth_token') ||
            sessionStorage.getItem('auth_token') ||
            localStorage.getItem('token') ||
            localStorage.getItem('adminToken') ||
            null
        );
    } catch {
        return null;
    }
};

let messageSeq = 0;
const createMessage = (role, text, extra = {}) => ({
    id: `${Date.now()}-${++messageSeq}`,
    role,
    text,
    ...extra,
});

const WELCOME = createMessage(
    'assistant',
    'Hola, soy el asistente de UPay. Pulsa el micrófono o escribe para navegar, filtrar pagos o motos, buscar una placa o consultar totales.'
);

/**
 * Privacy filter for spoken output (Section 15):
 * Replaces monetary amounts or customer names when spoken disclosure is OFF,
 * while preserving the full text on screen.
 */
export const applySpeechPrivacyFilter = (
    text = '',
    { speakAmounts = false, speakCustomerNames = false, lang = 'es-CO' } = {}
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

export const VoiceAssistantProvider = ({ children }) => {
    const navigate = useNavigate();
    const location = useLocation();
    const { user, token: authToken } = useAuth();

    const [isOpen, setIsOpen] = useState(false);
    const [isMinimized, setIsMinimized] = useState(false);
    const [status, setStatus] = useState(ASSISTANT_STATUS.IDLE);
    const [progressNote, setProgressNote] = useState(null);
    const [messages, setMessages] = useState([WELCOME]);
    // Ephemeral in-memory 5-turn conversation history (never persisted to localStorage)
    const [conversationHistory, setConversationHistory] = useState([]);
    const conversationHistoryRef = useRef([]);
    conversationHistoryRef.current = conversationHistory;

    const [assistantLang, setAssistantLangState] = useState(() => {
        if (typeof window === 'undefined') return 'es-CO';
        return localStorage.getItem(ASSISTANT_LANG_STORAGE_KEY) === 'en-US' ? 'en-US' : 'es-CO';
    });

    const [ttsSupported] = useState(() => isTTSSupported());
    const [ttsEnabled, setTtsEnabled] = useState(() => {
        if (typeof window === 'undefined') return true;
        const saved = localStorage.getItem(TTS_STORAGE_KEY);
        return saved === null ? true : saved === 'true';
    });
    const [neuralTtsEnabled, setNeuralTtsEnabled] = useState(() => {
        if (typeof window === 'undefined') return true;
        const saved = localStorage.getItem(NEURAL_TTS_STORAGE_KEY);
        return saved === null ? true : saved === 'true';
    });
    const [streamingEnabled, setStreamingEnabled] = useState(() => {
        const envDefault = import.meta.env?.VITE_AI_STREAMING !== 'false';
        if (typeof window === 'undefined') return envDefault;
        const saved = localStorage.getItem(STREAMING_STORAGE_KEY);
        return saved === null ? envDefault : saved === 'true';
    });
    const [wsStatus, setWsStatus] = useState('disconnected');
    const [availableVoices, setAvailableVoices] = useState(() => getAvailableVoices());
    const [selectedVoiceURI, setSelectedVoiceURI] = useState(() => {
        if (typeof window === 'undefined') return '';
        return localStorage.getItem(VOICE_URI_STORAGE_KEY) || '';
    });
    const [voiceStyle, setVoiceStyle] = useState(() => {
        if (typeof window === 'undefined') return 'normal';
        return localStorage.getItem(VOICE_STYLE_STORAGE_KEY) || 'normal';
    });

    // Voice privacy settings default to ON so the chat text and spoken voice match by default;
    // the user can toggle Montos/Clientes to OFF in the voice drawer anytime.
    const [speakAmounts, setSpeakAmountsState] = useState(() => {
        if (typeof window === 'undefined') return true;
        const saved = localStorage.getItem(SPEAK_AMOUNTS_STORAGE_KEY);
        return saved === null ? true : saved === 'true';
    });
    const [speakCustomerNames, setSpeakCustomerNamesState] = useState(() => {
        if (typeof window === 'undefined') return true;
        const saved = localStorage.getItem(SPEAK_NAMES_STORAGE_KEY);
        return saved === null ? true : saved === 'true';
    });

    const busyRef = useRef(false);
    const activeTurnIdRef = useRef(null);
    const activeHttpAbortRef = useRef(null);
    const wsClientRef = useRef(null);
    const audioQueueRef = useRef(null);
    const inactivityTimerRef = useRef(null);
    const typingIntervalRef = useRef(null);

    if (!wsClientRef.current) {
        wsClientRef.current = new AssistantWsClient();
    }
    if (!audioQueueRef.current) {
        audioQueueRef.current = new AudioStreamQueue({
            onSpeakingChange: (speaking) => {
                setStatus((prev) => {
                    if (speaking) return ASSISTANT_STATUS.SPEAKING;
                    return prev === ASSISTANT_STATUS.SPEAKING ? ASSISTANT_STATUS.IDLE : prev;
                });
            },
        });
    }

    const stopTypingStream = useCallback((finalizeMessageId = null) => {
        if (typingIntervalRef.current) {
            clearInterval(typingIntervalRef.current);
            typingIntervalRef.current = null;
        }
        if (finalizeMessageId) {
            setMessages((prev) =>
                prev.map((m) =>
                    m.id === finalizeMessageId ? { ...m, streamedText: m.text, isTyping: false } : m
                )
            );
        } else {
            setMessages((prev) =>
                prev.map((m) => (m.isTyping ? { ...m, streamedText: m.text, isTyping: false } : m))
            );
        }
    }, []);

    const currentRoute = location.pathname || '/';
    const currentModule = ROUTE_TO_MODULE[currentRoute] || 'dashboard';

    // Clear conversation memory whenever the authenticated user or company changes / logs out (Req. 6 & Section 17)
    // Note: transient WebSocket reconnects with the SAME sessionKey preserve conversationHistory intact!
    const sessionKey = user ? `${user.userId || user.email || 'u'}:${user.companyId || 'default'}` : 'logged_out';
    const effectiveToken = user ? getStoredAuthToken(authToken) : null;
    const prevSessionKeyRef = useRef(sessionKey);

    const cancelActiveTurn = useCallback(() => {
        const currentTurnId = activeTurnIdRef.current;
        activeTurnIdRef.current = null;
        if (currentTurnId) {
            wsClientRef.current?.cancelTurn(currentTurnId);
        }
        if (activeHttpAbortRef.current) {
            try {
                activeHttpAbortRef.current.abort(new Error('TURN_CANCELLED'));
            } catch {
                // Ignore abort errors
            }
            activeHttpAbortRef.current = null;
        }
        audioQueueRef.current?.stop();
        stopSpeaking();
        stopTypingStream();
        setProgressNote(null);
        busyRef.current = false;
    }, [stopTypingStream]);

    useEffect(() => {
        if (!wsClientRef.current) return undefined;
        setWsStatus(wsClientRef.current.connectionStatus || 'disconnected');
        return wsClientRef.current.onStatusChange((nextStatus) => {
            setWsStatus(nextStatus);
        });
    }, []);

    useEffect(() => {
        if (streamingEnabled) {
            wsClientRef.current?.syncSession({
                token: effectiveToken,
                sessionKey: user ? sessionKey : null,
            });
        } else {
            wsClientRef.current?.disconnect();
        }

        if (prevSessionKeyRef.current !== sessionKey) {
            prevSessionKeyRef.current = sessionKey;
            cancelActiveTurn();
            setConversationHistory([]);
            setMessages([WELCOME]);
            setStatus(ASSISTANT_STATUS.IDLE);
        }
    }, [sessionKey, effectiveToken, user, cancelActiveTurn, streamingEnabled]);

    useEffect(() => {
        const unsub = onVoicesUpdated(() => {
            setAvailableVoices(getAvailableVoices());
        });
        return () => {
            unsub();
            wsClientRef.current?.disconnect();
            audioQueueRef.current?.stop();
            stopSpeaking();
        };
    }, []);

    const appendMessage = useCallback((message) => setMessages((prev) => [...prev, message]), []);

    const recordVerifiedTurn = useCallback((turn) => {
        setConversationHistory((prev) => [...prev, turn].slice(-MAX_CONVERSATION_TURNS));
    }, []);

    const getApplicationContext = useCallback(() => {
        const bridge = getScreenBridge(currentModule);
        return {
            currentRoute,
            currentModule,
            activeFilters: bridge?.activeFilters || {},
            selectedItem: bridge?.selectedItem || bridge?.singleMatchItem || null,
        };
    }, [currentModule, currentRoute]);

    const query = useCallback(async (payload) => {
        try {
            const response = await assistantQuery(payload);
            return response?.data ?? resolveLocalDemoQuery(payload);
        } catch {
            return resolveLocalDemoQuery(payload);
        }
    }, []);

    const speakReply = useCallback(
        (replyText, overrides = {}) => {
            const msgId = overrides.messageId || null;
            const privacyFilteredText = applySpeechPrivacyFilter(replyText, {
                speakAmounts,
                speakCustomerNames,
                lang: assistantLang,
            });

            if (msgId && privacyFilteredText && privacyFilteredText !== replyText) {
                // Keep chat text identical to privacy-redacted text when privacy toggles are OFF
                setMessages((prev) =>
                    prev.map((m) => (m.id === msgId ? { ...m, text: privacyFilteredText } : m))
                );
            }

            const spokenText = prepareSpokenResponse(privacyFilteredText, {
                lang: assistantLang,
                keepFullList: Boolean(overrides.keepFullList),
            });

            if (!ttsSupported || !ttsEnabled || !spokenText) {
                if (msgId) stopTypingStream(msgId);
                setStatus(ASSISTANT_STATUS.IDLE);
                return;
            }

            stopTypingStream();

            // Progressive word-by-word typing synchronized with TTS speech
            if (msgId) {
                const words = spokenText.split(/(\s+)/);
                let wordIdx = Math.min(2, words.length);
                let boundarySeen = false;

                setMessages((prev) =>
                    prev.map((m) =>
                        m.id === msgId
                            ? {
                                  ...m,
                                  text: privacyFilteredText,
                                  streamedText: words.slice(0, wordIdx).join(''),
                                  isTyping: wordIdx < words.length,
                              }
                            : m
                    )
                );

                // Smooth fallback ticker (~55ms per word token) when the OS voice doesn't emit onboundary
                typingIntervalRef.current = setInterval(() => {
                    if (boundarySeen) return;
                    wordIdx = Math.min(words.length, wordIdx + 2);
                    const partial = words.slice(0, wordIdx).join('');
                    const done = wordIdx >= words.length;
                    setMessages((prev) =>
                        prev.map((m) =>
                            m.id === msgId
                                ? { ...m, streamedText: partial, isTyping: !done }
                                : m
                        )
                    );
                    if (done && typingIntervalRef.current) {
                        clearInterval(typingIntervalRef.current);
                        typingIntervalRef.current = null;
                    }
                }, 70);

                const started = speakText(spokenText, {
                    voiceURI:
                        overrides.voiceURI !== undefined ? overrides.voiceURI : selectedVoiceURI || null,
                    styleId: overrides.styleId || voiceStyle,
                    onStart: () => setStatus(ASSISTANT_STATUS.SPEAKING),
                    onBoundary: ({ charIndex, charLength }) => {
                        boundarySeen = true;
                        const endIdx = Math.min(
                            spokenText.length,
                            charIndex + Math.max(charLength || 8, 8)
                        );
                        // Snap to end of current word
                        const nextSpace = spokenText.indexOf(' ', endIdx);
                        const sliceEnd = nextSpace === -1 ? spokenText.length : nextSpace;
                        const partial = spokenText.slice(0, sliceEnd);
                        setMessages((prev) =>
                            prev.map((m) =>
                                m.id === msgId
                                    ? {
                                          ...m,
                                          streamedText: partial,
                                          isTyping: sliceEnd < spokenText.length,
                                      }
                                    : m
                            )
                        );
                    },
                    onEnd: () => {
                        stopTypingStream(msgId);
                        setStatus((prev) =>
                            prev === ASSISTANT_STATUS.SPEAKING ? ASSISTANT_STATUS.IDLE : prev
                        );
                    },
                });

                if (!started) {
                    stopTypingStream(msgId);
                    setStatus(ASSISTANT_STATUS.IDLE);
                }
                return;
            }

            const started = speakText(spokenText, {
                voiceURI: overrides.voiceURI !== undefined ? overrides.voiceURI : selectedVoiceURI || null,
                styleId: overrides.styleId || voiceStyle,
                onStart: () => setStatus(ASSISTANT_STATUS.SPEAKING),
                onEnd: () =>
                    setStatus((prev) =>
                        prev === ASSISTANT_STATUS.SPEAKING ? ASSISTANT_STATUS.IDLE : prev
                    ),
            });
            if (!started) {
                setStatus(ASSISTANT_STATUS.IDLE);
            }
        },
        [
            ttsSupported,
            ttsEnabled,
            selectedVoiceURI,
            voiceStyle,
            speakAmounts,
            speakCustomerNames,
            assistantLang,
            stopTypingStream,
        ]
    );

    const setAssistantLang = useCallback((nextLang) => {
        const clean = nextLang === 'en-US' ? 'en-US' : 'es-CO';
        setAssistantLangState(clean);
        try {
            localStorage.setItem(ASSISTANT_LANG_STORAGE_KEY, clean);
        } catch {
            // Ignore storage errors
        }
    }, []);

    const setSpeakAmounts = useCallback((enabled) => {
        const next = Boolean(enabled);
        setSpeakAmountsState(next);
        try {
            localStorage.setItem(SPEAK_AMOUNTS_STORAGE_KEY, String(next));
        } catch {
            // Ignore
        }
    }, []);

    const setSpeakCustomerNames = useCallback((enabled) => {
        const next = Boolean(enabled);
        setSpeakCustomerNamesState(next);
        try {
            localStorage.setItem(SPEAK_NAMES_STORAGE_KEY, String(next));
        } catch {
            // Ignore
        }
    }, []);

    const selectVoice = useCallback(
        (voiceURI) => {
            const next = voiceURI || '';
            setSelectedVoiceURI(next);
            try {
                if (next) localStorage.setItem(VOICE_URI_STORAGE_KEY, next);
                else localStorage.removeItem(VOICE_URI_STORAGE_KEY);
            } catch {
                // Ignore
            }
            if (ttsSupported && ttsEnabled) {
                unlockTTS();
                speakReply(assistantLang === 'en-US' ? 'Voice updated.' : 'Voz actualizada.', {
                    voiceURI: next || null,
                });
            }
        },
        [ttsSupported, ttsEnabled, speakReply, assistantLang]
    );

    const selectVoiceStyle = useCallback(
        (styleId) => {
            const next = styleId || 'normal';
            setVoiceStyle(next);
            try {
                localStorage.setItem(VOICE_STYLE_STORAGE_KEY, next);
            } catch {
                // Ignore
            }
            if (ttsSupported && ttsEnabled) {
                unlockTTS();
                const found = VOICE_STYLES.find((s) => s.id === next);
                speakReply(
                    `Modo ${found ? found.label.split('·')[0].trim().toLowerCase() : 'normal'} activado.`,
                    { styleId: next }
                );
            }
        },
        [ttsSupported, ttsEnabled, speakReply]
    );

    const submitText = useCallback(
        async (rawText, { viaVoice = false } = {}) => {
            const text = (rawText || '').trim();
            if (!text) return;

            // Turn-scoped interruption (Req. 10): submitting a new utterance cancels any previous turn/audio immediately
            if (busyRef.current || activeTurnIdRef.current || status === ASSISTANT_STATUS.SPEAKING) {
                cancelActiveTurn();
            }

            busyRef.current = true;
            if (ttsSupported && ttsEnabled) {
                unlockTTS();
            }
            if (ttsEnabled && neuralTtsEnabled) {
                audioQueueRef.current?.unlock();
            }

            const turnId = `tr_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`;
            activeTurnIdRef.current = turnId;
            if (ttsEnabled && neuralTtsEnabled) {
                audioQueueRef.current?.beginTurn(turnId);
            }

            appendMessage(createMessage('user', text, { viaVoice }));
            setProgressNote(assistantLang === 'en-US' ? 'Analyzing request…' : 'Analizando consulta…');
            setStatus(ASSISTANT_STATUS.PROCESSING);

            const appCtx = getApplicationContext();
            const turnT0 = typeof performance !== 'undefined' ? performance.now() : Date.now();
            const elapsedMs = () =>
                Math.round((typeof performance !== 'undefined' ? performance.now() : Date.now()) - turnT0);

            logTurn(`▶ Turno iniciado (${turnId})`, {
                texto: text,
                viaVoice,
                moduloActual: appCtx.currentModule,
                rutaActual: appCtx.currentRoute,
                filtrosActivos: appCtx.activeFilters,
                historialTurnos: conversationHistoryRef.current.length,
                streaming: streamingEnabled,
                vozHd: Boolean(streamingEnabled && ttsEnabled && neuralTtsEnabled),
            });

            let streamingMsgId = null;
            let accumulatedStreamText = '';
            let textDeltaCount = 0;
            let audioChunkCount = 0;
            let sawAnyServerEvent = false;
            let audioStreamed = false;

            const isStaleTurn = () => activeTurnIdRef.current !== turnId;

            try {
                // 1. Deterministic local command matcher first (0 network calls)
                const localMatch = matchLocalIntent(text, {
                    currentModule: appCtx.currentModule,
                    lang: assistantLang,
                    hasConversationContext:
                        Array.isArray(conversationHistoryRef.current) &&
                        conversationHistoryRef.current.length > 0,
                });
                logTurn(`[+${elapsedMs()}ms] 1. LocalMatcher -> ${localMatch.status}`, {
                    capabilityId: localMatch.capabilityId || null,
                    plan: localMatch.plan || null,
                });

                if (localMatch.status === MATCH_STATUS.AMBIGUOUS) {
                    if (isStaleTurn()) return;
                    const clarifyText =
                        localMatch.clarificationPrompt ||
                        '¿Podrías especificar a qué sección o registro te refieres?';
                    const clarifyMsg = createMessage('assistant', clarifyText, {
                        traceId: turnId,
                        source: 'local',
                        needsClarification: true,
                    });
                    setProgressNote(null);
                    appendMessage(clarifyMsg);
                    recordAssistantTelemetry({
                        traceId: turnId,
                        viaVoice,
                        lang: assistantLang,
                        userText: text,
                        applicationContext: appCtx,
                        matcherStatus: MATCH_STATUS.AMBIGUOUS,
                        plannerSource: 'local_matcher',
                        plan: null,
                        executionStatus: 'clarification',
                        executedActions: [],
                        assistantFinalText: clarifyText,
                    }).catch(() => {});
                    speakReply(clarifyText, { messageId: clarifyMsg.id });
                    return;
                }

                let actionPlan = null;
                let source = 'local_matcher';
                let chatMetrics = null;

                if (localMatch.status === MATCH_STATUS.MATCH && localMatch.plan) {
                    actionPlan = localMatch.plan;
                    chatMetrics = {
                        model: 'none (local_matcher)',
                        promptVersion: 'local',
                        inputTokens: 0,
                        cachedTokens: 0,
                        uncachedTokens: 0,
                        outputTokens: 0,
                        cacheHitPercent: null,
                        estimatedCostUSD: 0,
                        estimatedSavingsUSD: 0,
                        openaiCalls: 0,
                        toolCalls: 0,
                        localResolution: true,
                        responsePath: 'local_fast_path',
                        routingMode: 'local_fast_path',
                    };
                } else {
                    // 2. Streaming Path (`streamingEnabled === true`):
                    //    2a. Authenticated WebSocket (`/api/v1/ai/ws`)
                    //    2b. Streaming SSE over `POST /api/v1/ai/chat` (`Accept: text/event-stream`)
                    //    2c. Classic Non-Streaming JSON `POST /api/v1/ai/chat` (also used directly when `streamingEnabled === false`, Req. 13)
                    let usedClassicJsonFallback = !streamingEnabled;
                    let clientChannel = streamingEnabled ? 'ws' : 'http_json';

                    const turnPayload = {
                        traceId: turnId,
                        viaVoice,
                        text,
                        lang: assistantLang,
                        companyId: user?.companyId || null,
                        applicationContext: appCtx,
                        conversationHistory: conversationHistoryRef.current,
                        tts: {
                            enabled: Boolean(streamingEnabled && ttsEnabled && neuralTtsEnabled),
                            neural: Boolean(streamingEnabled && ttsEnabled && neuralTtsEnabled),
                            speakAmounts,
                            speakCustomerNames,
                        },
                    };

                    const handleStreamEnvelope = (env) => {
                        if (isStaleTurn()) return;
                        sawAnyServerEvent = true;

                        switch (env.type) {
                            case 'turn_started': {
                                logTurn(`[+${elapsedMs()}ms] ⚡ Evento #${env.sequence} turn_started`, env.payload);
                                setProgressNote(
                                    assistantLang === 'en-US'
                                        ? 'Analyzing request…'
                                        : 'Analizando tu consulta…'
                                );
                                break;
                            }
                            case 'tool_started': {
                                logTurn(`[+${elapsedMs()}ms] 🔍 Evento #${env.sequence} tool_started`, env.payload);
                                const modId = env.payload?.module;
                                const modLabel =
                                    assistantLang === 'en-US'
                                        ? MODULES[modId]?.labelEn || modId || 'records'
                                        : (MODULES[modId]?.label || modId || 'registros').toLowerCase();
                                setProgressNote(
                                    assistantLang === 'en-US'
                                        ? `Checking ${modLabel}…`
                                        : `Consultando ${modLabel}…`
                                );
                                break;
                            }
                            case 'tool_completed': {
                                logTurn(`[+${elapsedMs()}ms] ✅ Evento #${env.sequence} tool_completed`, env.payload);
                                setProgressNote(
                                    assistantLang === 'en-US'
                                        ? 'Preparing verified answer…'
                                        : 'Preparando respuesta con datos verificados…'
                                );
                                break;
                            }
                            case 'text_delta': {
                                const delta = String(env.payload?.delta || '');
                                if (!delta) break;
                                textDeltaCount += 1;
                                if (textDeltaCount === 1) {
                                    logTurn(`[+${elapsedMs()}ms] ✍️ Primer text_delta recibido`, { delta });
                                }
                                accumulatedStreamText += delta;
                                setProgressNote(null);
                                if (!streamingMsgId) {
                                    const liveMsg = createMessage('assistant', accumulatedStreamText, {
                                        traceId: turnId,
                                        streamedText: accumulatedStreamText,
                                        isTyping: true,
                                    });
                                    streamingMsgId = liveMsg.id;
                                    appendMessage(liveMsg);
                                } else {
                                    const currentSnap = accumulatedStreamText;
                                    setMessages((prev) =>
                                        prev.map((m) =>
                                            m.id === streamingMsgId
                                                ? {
                                                      ...m,
                                                      text: currentSnap,
                                                      streamedText: currentSnap,
                                                      isTyping: true,
                                                  }
                                                : m
                                        )
                                    );
                                }
                                break;
                            }
                            case 'audio_chunk': {
                                audioChunkCount += 1;
                                if (audioChunkCount === 1 || env.payload?.isFinalChunk) {
                                    logTurn(
                                        `[+${elapsedMs()}ms] 🔊 audio_chunk #${audioChunkCount} (oración ${env.payload?.sentenceIndex ?? 0})`
                                    );
                                }
                                if (ttsEnabled && neuralTtsEnabled) {
                                    const accepted = audioQueueRef.current?.enqueueChunk(
                                        turnId,
                                        env.payload
                                    );
                                    if (accepted && env.payload?.audioBase64) {
                                        audioStreamed = true;
                                    }
                                }
                                break;
                            }
                            case 'turn_completed': {
                                logTurn(`[+${elapsedMs()}ms] 🏁 Evento #${env.sequence} turn_completed`, {
                                    source: env.payload?.source,
                                    textDeltas: textDeltaCount,
                                    audioChunks: audioChunkCount,
                                    plan: env.payload?.plan,
                                    metrics: env.payload?.metrics,
                                });
                                break;
                            }
                            default:
                                break;
                        }
                    };

                    if (streamingEnabled) {
                        logTurn(`[+${elapsedMs()}ms] 📤 [OpenAI API Request (Streaming)]`, {
                            traceId: turnId,
                            text,
                            lang: assistantLang,
                            applicationContext: appCtx,
                            historyTurns: conversationHistoryRef.current.length,
                        });
                        let streamResult = null;
                        let needHttpSseFallback = false;

                        if (wsClientRef.current?.isSupported() && effectiveToken) {
                            try {
                                logTurn(`[+${elapsedMs()}ms] 2a. Enviando turno por WebSocket (/api/v1/ai/ws)…`);
                                wsClientRef.current.syncSession({
                                    token: effectiveToken,
                                    sessionKey,
                                });
                                streamResult = await wsClientRef.current.startTurn({
                                    turnId,
                                    payload: turnPayload,
                                    onEvent: handleStreamEnvelope,
                                });
                                clientChannel = 'ws';
                            } catch (wsErr) {
                                if (isStaleTurn() || wsErr?.code === 'TURN_CANCELLED') {
                                    logTurn(`[+${elapsedMs()}ms] ⏹ Turno WS cancelado (${turnId})`);
                                    return;
                                }
                                const isConnectFailure =
                                    !sawAnyServerEvent &&
                                    /^WS_(UNAVAILABLE|CONNECT_TIMEOUT|CONNECTION_ERROR|CLOSED_BEFORE_OPEN)/.test(
                                        String(wsErr?.message || '')
                                    );
                                if (isConnectFailure) {
                                    logTurn(
                                        `[+${elapsedMs()}ms] ⚠️ WS no disponible (${wsErr?.message}) -> cambiando a SSE POST /api/v1/ai/chat`
                                    );
                                    needHttpSseFallback = true;
                                } else {
                                    throw wsErr;
                                }
                            }
                        } else {
                            needHttpSseFallback = true;
                        }

                        // 2b. Streaming SSE over `POST /api/v1/ai/chat` (`Accept: text/event-stream`)
                        if (needHttpSseFallback) {
                            const httpAbort = new AbortController();
                            activeHttpAbortRef.current = httpAbort;
                            try {
                                logTurn(`[+${elapsedMs()}ms] 2b. Enviando turno por SSE (POST /api/v1/ai/chat stream=true)…`);
                                streamResult = await assistantChatStream({
                                    payload: turnPayload,
                                    signal: httpAbort.signal,
                                    onEvent: handleStreamEnvelope,
                                });
                                clientChannel = 'http_sse';
                            } catch (sseErr) {
                                if (
                                    isStaleTurn() ||
                                    httpAbort.signal.aborted ||
                                    sseErr?.name === 'AbortError' ||
                                    sseErr?.code === 'TURN_CANCELLED'
                                ) {
                                    logTurn(`[+${elapsedMs()}ms] ⏹ Turno SSE cancelado (${turnId})`);
                                    return;
                                }
                                if (!sawAnyServerEvent) {
                                    logTurn(
                                        `[+${elapsedMs()}ms] ⚠️ SSE falló antes de eventos (${sseErr?.message}) -> fallback HTTP JSON clásico`
                                    );
                                    usedClassicJsonFallback = true;
                                    clientChannel = 'http_json';
                                } else {
                                    throw sseErr;
                                }
                            } finally {
                                if (activeHttpAbortRef.current === httpAbort) {
                                    activeHttpAbortRef.current = null;
                                }
                            }
                        }

                        if (streamResult) {
                            actionPlan = streamResult?.plan || null;
                            source = streamResult?.source || 'ws_stream';
                            chatMetrics = streamResult?.metrics
                                ? {
                                      ...streamResult.metrics,
                                      client_channel: clientChannel,
                                      streaming_enabled: true,
                                  }
                                : { client_channel: clientChannel, streaming_enabled: true };
                            if (streamResult?.audioStreamed) {
                                audioStreamed = true;
                            }
                            logTurn(`🤖 [OpenAI API Response (${clientChannel})]`, {
                                model: chatMetrics?.model || chatMetrics?.model_name,
                                promptVersion: chatMetrics?.promptVersion,
                                openaiCalls: chatMetrics?.openaiCalls ?? 1,
                                toolCalls: chatMetrics?.on_demand_tool_calls || [],
                                tokens: {
                                    input: chatMetrics?.inputTokens ?? chatMetrics?.input_tokens,
                                    cached: chatMetrics?.cachedTokens ?? chatMetrics?.cached_tokens,
                                    uncached: chatMetrics?.uncachedTokens,
                                    output: chatMetrics?.outputTokens ?? chatMetrics?.output_tokens,
                                    cacheHitPercent: chatMetrics?.cacheHitPercent,
                                },
                                estimatedCostUSD: chatMetrics?.estimatedCostUSD,
                                plan: actionPlan,
                            });
                        }
                    }

                    // 2c. Non-streaming HTTP JSON (`POST /api/v1/ai/chat`, Req. 13 & `Streaming: OFF`)
                    if (usedClassicJsonFallback) {
                        try {
                            logTurn(
                                `[+${elapsedMs()}ms] 2c. Enviando turno por HTTP JSON clásico (POST /api/v1/ai/chat, Streaming=${streamingEnabled ? 'ON-fallback' : 'OFF'})…`
                            );
                            logTurn(
                                `[+${elapsedMs()}ms] 📤 [OpenAI API Request (HTTP JSON)]`,
                                {
                                    traceId: turnId,
                                    text,
                                    lang: assistantLang,
                                    applicationContext: appCtx,
                                    historyTurns: conversationHistoryRef.current.length,
                                }
                            );
                            const chatRes = await assistantChat({
                                traceId: turnId,
                                viaVoice,
                                text,
                                lang: assistantLang,
                                applicationContext: appCtx,
                                conversationHistory: conversationHistoryRef.current,
                            });
                            if (isStaleTurn()) return;
                            actionPlan = chatRes?.data?.plan || null;
                            source = chatRes?.data?.source || 'api';
                            chatMetrics = chatRes?.data?.metrics
                                ? {
                                      ...chatRes.data.metrics,
                                      client_channel: 'http_json',
                                      streaming_enabled: Boolean(streamingEnabled),
                                  }
                                : {
                                      client_channel: 'http_json',
                                      streaming_enabled: Boolean(streamingEnabled),
                                  };
                            logTurn(
                                `[+${elapsedMs()}ms] 📥 [OpenAI API Response (HTTP JSON)]`,
                                {
                                    model: chatMetrics?.model || chatMetrics?.model_name,
                                    promptVersion: chatMetrics?.promptVersion,
                                    openaiCalls: chatMetrics?.openaiCalls ?? chatMetrics?.llm_rounds,
                                    toolCalls: chatMetrics?.on_demand_tool_calls || [],
                                    tokens: {
                                        input: chatMetrics?.inputTokens ?? chatMetrics?.input_tokens,
                                        cached: chatMetrics?.cachedTokens ?? chatMetrics?.cached_tokens,
                                        uncached: chatMetrics?.uncachedTokens,
                                        output: chatMetrics?.outputTokens ?? chatMetrics?.output_tokens,
                                        cacheHitPercent: chatMetrics?.cacheHitPercent,
                                    },
                                    estimatedCostUSD: chatMetrics?.estimatedCostUSD,
                                    plan: actionPlan,
                                }
                            );
                        } catch {
                            if (isStaleTurn()) return;
                            if (localMatch.capabilityId) {
                                const demoAns = resolveLocalDemoQuery({
                                    capabilityId: localMatch.capabilityId,
                                    text,
                                });
                                setProgressNote(null);
                                const fallbackMsg = createMessage('assistant', demoAns.reply, {
                                    traceId: turnId,
                                    data: demoAns.data,
                                    capabilityId: demoAns.capabilityId,
                                    source: 'local',
                                });
                                appendMessage(fallbackMsg);
                                speakReply(demoAns.reply, { messageId: fallbackMsg.id });
                                return;
                            }
                            throw new Error(
                                assistantLang === 'en-US'
                                    ? 'Assistant service is temporarily unavailable.'
                                    : 'El servicio del asistente no está disponible en este momento.'
                            );
                        }
                    }
                }

                if (isStaleTurn()) return;

                // 3. Execute validated plan via Action Dispatcher & Local Resolvers
                if (Array.isArray(actionPlan?.actions) && actionPlan.actions.length > 0) {
                    setProgressNote(
                        assistantLang === 'en-US'
                            ? 'Applying action on screen…'
                            : 'Aplicando en pantalla…'
                    );
                }
                setStatus(ASSISTANT_STATUS.EXECUTING);

                const execResult = await dispatchActionPlan(actionPlan, {
                    navigate,
                    query,
                    user,
                    lang: assistantLang,
                    currentModule: appCtx.currentModule,
                    selectedItem: appCtx.selectedItem,
                });

                if (isStaleTurn()) return;
                setProgressNote(null);

                logTurn(`[+${elapsedMs()}ms] ✔ Turno finalizado (${turnId})`, {
                    source,
                    canal: chatMetrics?.client_channel || 'local',
                    ok: execResult.ok,
                    accionesEjecutadas: execResult.executedActions || [],
                    placeholdersResueltos: execResult.resolvedPlaceholders || {},
                    respuestaFinal: execResult.reply,
                    metricas: chatMetrics,
                });

                const finalSource = source === 'local_matcher' ? 'local' : source;
                let targetMsgId = streamingMsgId;

                if (streamingMsgId) {
                    setMessages((prev) =>
                        prev.map((m) =>
                            m.id === streamingMsgId
                                ? {
                                      ...m,
                                      text: execResult.reply,
                                      streamedText: execResult.reply,
                                      isTyping: false,
                                      data: execResult.data,
                                      source: finalSource,
                                      error: !execResult.ok,
                                  }
                                : m
                        )
                    );
                } else {
                    const replyMsg = createMessage('assistant', execResult.reply, {
                        traceId: turnId,
                        data: execResult.data,
                        source: finalSource,
                        error: !execResult.ok,
                    });
                    targetMsgId = replyMsg.id;
                    appendMessage(replyMsg);
                }

                // Record full post-execution trace for fine-tuning / RLHF dataset
                const resolvedCount = Object.keys(execResult.resolvedPlaceholders || {}).length;
                const finalMetrics = chatMetrics
                    ? {
                          ...chatMetrics,
                          durationMs: chatMetrics.durationMs ?? elapsedMs(),
                          localResolution:
                              Boolean(chatMetrics.localResolution) || resolvedCount > 0,
                      }
                    : null;
                recordAssistantTelemetry({
                    traceId: turnId,
                    viaVoice,
                    lang: assistantLang,
                    userText: text,
                    applicationContext: appCtx,
                    matcherStatus: localMatch.status,
                    plannerSource: source,
                    plan: actionPlan,
                    executionStatus: execResult.ok ? 'success' : 'failed',
                    executedActions: execResult.executedActions || [],
                    resolvedPlaceholders: execResult.resolvedPlaceholders || {},
                    assistantFinalText: execResult.reply,
                    metrics: finalMetrics,
                }).catch(() => {});

                // Only record turn as 'success' AFTER verified frontend execution (Section 7)
                recordVerifiedTurn({
                    userText: text,
                    assistantText: execResult.reply,
                    targetModule: execResult.targetModule || appCtx.currentModule,
                    intent: execResult.executedActions?.[0]?.name || 'query',
                    executedActions: execResult.executedActions || [],
                    executionStatus: execResult.ok ? 'success' : 'failed',
                });

                if (execResult.ok && execResult.action?.type === 'navigate') {
                    setIsMinimized(true);
                } else if (!execResult.ok) {
                    audioQueueRef.current?.stop();
                    setStatus(ASSISTANT_STATUS.ERROR);
                    return;
                } else {
                    setIsMinimized(false);
                }

                // If neural TTS audio chunks are already playing for this turn, keep ordered queue running;
                // otherwise use browser speechSynthesis fallback (`speakReply`)!
                if (audioStreamed && audioQueueRef.current?.isPlaying) {
                    setStatus(ASSISTANT_STATUS.SPEAKING);
                } else if (!audioStreamed) {
                    speakReply(execResult.reply, { messageId: targetMsgId });
                } else {
                    setStatus(ASSISTANT_STATUS.IDLE);
                }
            } catch (error) {
                if (isStaleTurn() || error?.code === 'TURN_CANCELLED') return;
                setProgressNote(null);
                audioQueueRef.current?.stop();
                appendMessage(
                    createMessage('assistant', `No pude completar la consulta: ${error.message}`, {
                        error: true,
                    })
                );
                setStatus(ASSISTANT_STATUS.ERROR);
            } finally {
                if (activeTurnIdRef.current === turnId) {
                    busyRef.current = false;
                }
            }
        },
        [
            appendMessage,
            assistantLang,
            cancelActiveTurn,
            effectiveToken,
            getApplicationContext,
            navigate,
            neuralTtsEnabled,
            query,
            recordVerifiedTurn,
            sessionKey,
            speakAmounts,
            speakCustomerNames,
            speakReply,
            status,
            streamingEnabled,
            ttsEnabled,
            ttsSupported,
            user,
        ]
    );

    const {
        isSupported: speechSupported,
        isListening,
        interimTranscript,
        permissionState: micPermission,
        error: speechError,
        startListening,
        stopListening,
        clearError: clearSpeechError,
    } = useSpeechRecognition({
        lang: assistantLang,
        onStart: () => {
            cancelActiveTurn();
            setStatus(ASSISTANT_STATUS.LISTENING);
        },
        onFinalTranscript: (transcript) => {
            submitText(transcript, { viaVoice: true });
        },
        onEnd: () => {
            setStatus((prev) =>
                prev === ASSISTANT_STATUS.LISTENING ? ASSISTANT_STATUS.IDLE : prev
            );
        },
        onError: () => {
            setStatus(ASSISTANT_STATUS.ERROR);
        },
    });

    // Prevent recognition echo while TTS is speaking (Section 15)
    useEffect(() => {
        if (status === ASSISTANT_STATUS.SPEAKING && isListening) {
            stopListening();
        }
    }, [status, isListening, stopListening]);

    // 2-minute inactivity timeout (Section 13)
    const resetInactivityTimer = useCallback(() => {
        if (inactivityTimerRef.current) {
            clearTimeout(inactivityTimerRef.current);
            inactivityTimerRef.current = null;
        }
        if (!isOpen) return;
        inactivityTimerRef.current = setTimeout(() => {
            stopListening();
            stopSpeaking();
            setStatus(ASSISTANT_STATUS.IDLE);
            setIsMinimized(true);
        }, INACTIVITY_TIMEOUT_MS);
    }, [isOpen, stopListening]);

    useEffect(() => {
        resetInactivityTimer();
        return () => {
            if (inactivityTimerRef.current) {
                clearTimeout(inactivityTimerRef.current);
            }
        };
    }, [isOpen, messages, status, isListening, resetInactivityTimer]);

    const toggleListening = useCallback(() => {
        resetInactivityTimer();
        if (isListening) {
            stopListening();
            setStatus(ASSISTANT_STATUS.IDLE);
        } else {
            cancelActiveTurn();
            if (ttsSupported && ttsEnabled) unlockTTS();
            if (ttsEnabled && neuralTtsEnabled) audioQueueRef.current?.unlock();
            startListening();
        }
    }, [cancelActiveTurn, isListening, resetInactivityTimer, startListening, stopListening, ttsSupported, ttsEnabled]);

    const toggleTts = useCallback(() => {
        setTtsEnabled((prev) => {
            const next = !prev;
            if (!next) {
                audioQueueRef.current?.stop();
                stopSpeaking();
                setStatus((s) => (s === ASSISTANT_STATUS.SPEAKING ? ASSISTANT_STATUS.IDLE : s));
            }
            try {
                localStorage.setItem(TTS_STORAGE_KEY, String(next));
            } catch {
                // Ignore
            }
            return next;
        });
    }, []);

    const toggleNeuralTts = useCallback(() => {
        setNeuralTtsEnabled((prev) => {
            const next = !prev;
            if (!next) {
                audioQueueRef.current?.stop();
            }
            try {
                localStorage.setItem(NEURAL_TTS_STORAGE_KEY, String(next));
            } catch {
                // Ignore
            }
            return next;
        });
    }, []);

    const toggleStreaming = useCallback(() => {
        setStreamingEnabled((prev) => {
            const next = !prev;
            if (!next) {
                audioQueueRef.current?.stop();
                wsClientRef.current?.disconnect();
            }
            try {
                localStorage.setItem(STREAMING_STORAGE_KEY, String(next));
            } catch {
                // Ignore
            }
            return next;
        });
    }, []);

    const stopAudio = useCallback(() => {
        cancelActiveTurn();
        setStatus((s) => (s === ASSISTANT_STATUS.SPEAKING || s === ASSISTANT_STATUS.PROCESSING ? ASSISTANT_STATUS.IDLE : s));
    }, [cancelActiveTurn]);

    const open = useCallback(() => {
        if (ttsSupported && ttsEnabled) unlockTTS();
        if (ttsEnabled && neuralTtsEnabled) audioQueueRef.current?.unlock();
        setAvailableVoices(getAvailableVoices());
        setIsMinimized(false);
        setIsOpen(true);
    }, [ttsSupported, ttsEnabled, neuralTtsEnabled]);

    const close = useCallback(() => {
        cancelActiveTurn();
        stopListening();
        setStatus(ASSISTANT_STATUS.IDLE);
        setIsMinimized(false);
        setIsOpen(false);
    }, [cancelActiveTurn, stopListening]);

    const toggle = useCallback(() => {
        setIsOpen((prev) => {
            if (prev) {
                cancelActiveTurn();
                stopListening();
                setStatus(ASSISTANT_STATUS.IDLE);
                setIsMinimized(false);
            } else {
                if (ttsSupported && ttsEnabled) unlockTTS();
                if (ttsEnabled && neuralTtsEnabled) audioQueueRef.current?.unlock();
                setAvailableVoices(getAvailableVoices());
                setIsMinimized(false);
            }
            return !prev;
        });
    }, [cancelActiveTurn, stopListening, ttsSupported, ttsEnabled]);

    const toggleMinimized = useCallback(() => {
        resetInactivityTimer();
        setIsMinimized((prev) => !prev);
    }, [resetInactivityTimer]);

    const rateMessage = useCallback((messageId, reward) => {
        let targetTraceId = null;
        setMessages((prev) =>
            prev.map((m) => {
                if (m.id === messageId) {
                    targetTraceId = m.traceId || null;
                    return { ...m, reward };
                }
                return m;
            })
        );
        if (targetTraceId) {
            recordAssistantTelemetry({
                eventType: 'feedback',
                traceId: targetTraceId,
                reward,
            }).catch(() => {});
        }
    }, []);

    const clearConversation = useCallback(() => {
        cancelActiveTurn();
        stopListening();
        clearSpeechError();
        const sentViaWs = wsClientRef.current?.resetConversation?.();
        if (!sentViaWs && effectiveToken) {
            resetAssistantSession().catch(() => {});
        }
        setConversationHistory([]);
        setMessages([WELCOME]);
        setIsMinimized(false);
        setStatus(ASSISTANT_STATUS.IDLE);
    }, [cancelActiveTurn, clearSpeechError, effectiveToken, stopListening]);

    const value = useMemo(
        () => ({
            isOpen,
            open,
            close,
            toggle,
            isMinimized,
            setIsMinimized,
            toggleMinimized,
            status,
            setStatus,
            progressNote,
            messages,
            conversationHistory,
            submitText,
            rateMessage,
            clearConversation,
            assistantLang,
            setAssistantLang,
            ttsSupported,
            ttsEnabled,
            toggleTts,
            neuralTtsEnabled,
            toggleNeuralTts,
            streamingEnabled,
            toggleStreaming,
            wsStatus,
            stopAudio,
            availableVoices,
            selectedVoiceURI,
            selectVoice,
            voiceStyle,
            selectVoiceStyle,
            voiceStyles: VOICE_STYLES,
            speakAmounts,
            setSpeakAmounts,
            speakCustomerNames,
            setSpeakCustomerNames,
            speechSupported,
            isListening,
            interimTranscript,
            micPermission,
            speechError,
            toggleListening,
            clearSpeechError,
        }),
        [
            isOpen,
            open,
            close,
            toggle,
            isMinimized,
            toggleMinimized,
            status,
            progressNote,
            messages,
            conversationHistory,
            submitText,
            rateMessage,
            clearConversation,
            assistantLang,
            setAssistantLang,
            ttsSupported,
            ttsEnabled,
            toggleTts,
            neuralTtsEnabled,
            toggleNeuralTts,
            streamingEnabled,
            toggleStreaming,
            wsStatus,
            stopAudio,
            availableVoices,
            selectedVoiceURI,
            selectVoice,
            voiceStyle,
            selectVoiceStyle,
            speakAmounts,
            setSpeakAmounts,
            speakCustomerNames,
            setSpeakCustomerNames,
            speechSupported,
            isListening,
            interimTranscript,
            micPermission,
            speechError,
            toggleListening,
            clearSpeechError,
        ]
    );

    return <VoiceAssistantContext.Provider value={value}>{children}</VoiceAssistantContext.Provider>;
};

export const useVoiceAssistant = () => {
    const context = useContext(VoiceAssistantContext);
    if (!context) throw new Error('useVoiceAssistant must be used within a VoiceAssistantProvider');
    return context;
};
