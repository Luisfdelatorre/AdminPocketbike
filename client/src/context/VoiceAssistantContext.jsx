import React, { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { useAuth } from './AuthContext';
import { assistantChat, assistantQuery } from '../services/api';
import { ROUTE_TO_MODULE } from '../services/voiceAssistant/capabilities';
import { MAX_CONVERSATION_TURNS } from '../services/voiceAssistant/schemaValidator';
import { dispatchActionPlan } from '../services/voiceAssistant/dispatcher';
import { MATCH_STATUS, matchLocalIntent } from '../services/voiceAssistant/matcher';
import { getScreenBridge } from '../services/voiceAssistant/screenBridge';
import { resolveLocalDemoQuery } from '../services/voiceAssistant/demoData';
import {
    VOICE_STYLES,
    getAvailableVoices,
    onVoicesUpdated,
    isTTSSupported,
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
const INACTIVITY_TIMEOUT_MS = 2 * 60 * 1000; // 2 minutes (Section 13)

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
        output = output.replace(/\$\s?\d[\d.,]*(?:\s?(?:COP|mil|millones|M|k))?/gi, replacement);
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
    const { user } = useAuth();

    const [isOpen, setIsOpen] = useState(false);
    const [isMinimized, setIsMinimized] = useState(false);
    const [status, setStatus] = useState(ASSISTANT_STATUS.IDLE);
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
    const [availableVoices, setAvailableVoices] = useState(() => getAvailableVoices());
    const [selectedVoiceURI, setSelectedVoiceURI] = useState(() => {
        if (typeof window === 'undefined') return '';
        return localStorage.getItem(VOICE_URI_STORAGE_KEY) || '';
    });
    const [voiceStyle, setVoiceStyle] = useState(() => {
        if (typeof window === 'undefined') return 'normal';
        return localStorage.getItem(VOICE_STYLE_STORAGE_KEY) || 'normal';
    });

    // Voice privacy settings default to OFF (Section 15)
    const [speakAmounts, setSpeakAmountsState] = useState(() => {
        if (typeof window === 'undefined') return false;
        return localStorage.getItem(SPEAK_AMOUNTS_STORAGE_KEY) === 'true';
    });
    const [speakCustomerNames, setSpeakCustomerNamesState] = useState(() => {
        if (typeof window === 'undefined') return false;
        return localStorage.getItem(SPEAK_NAMES_STORAGE_KEY) === 'true';
    });

    const busyRef = useRef(false);
    const inactivityTimerRef = useRef(null);

    const currentRoute = location.pathname || '/';
    const currentModule = ROUTE_TO_MODULE[currentRoute] || 'dashboard';

    // Clear conversation memory whenever the authenticated user or company changes / logs out (Section 7 & 17)
    const sessionKey = user ? `${user.userId || user.email || 'u'}:${user.companyId || 'default'}` : 'logged_out';
    const prevSessionKeyRef = useRef(sessionKey);
    useEffect(() => {
        if (prevSessionKeyRef.current !== sessionKey) {
            prevSessionKeyRef.current = sessionKey;
            stopSpeaking();
            setConversationHistory([]);
            setMessages([WELCOME]);
            setStatus(ASSISTANT_STATUS.IDLE);
        }
    }, [sessionKey]);

    useEffect(() => {
        const unsub = onVoicesUpdated(() => {
            setAvailableVoices(getAvailableVoices());
        });
        return () => {
            unsub();
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
            if (!ttsSupported || !ttsEnabled || !replyText) {
                setStatus(ASSISTANT_STATUS.IDLE);
                return;
            }
            const spokenText = applySpeechPrivacyFilter(replyText, {
                speakAmounts,
                speakCustomerNames,
                lang: assistantLang,
            });
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
        [ttsSupported, ttsEnabled, selectedVoiceURI, voiceStyle, speakAmounts, speakCustomerNames, assistantLang]
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
            if (!text || busyRef.current) return;

            busyRef.current = true;
            stopSpeaking();
            if (ttsSupported && ttsEnabled) {
                unlockTTS();
            }

            appendMessage(createMessage('user', text, { viaVoice }));
            setStatus(ASSISTANT_STATUS.PROCESSING);

            const appCtx = getApplicationContext();

            try {
                // 1. Deterministic local command matcher first (Section 10)
                const localMatch = matchLocalIntent(text, {
                    currentModule: appCtx.currentModule,
                    lang: assistantLang,
                });

                if (localMatch.status === MATCH_STATUS.AMBIGUOUS) {
                    const clarifyText =
                        localMatch.clarificationPrompt ||
                        '¿Podrías especificar a qué sección o registro te refieres?';
                    appendMessage(
                        createMessage('assistant', clarifyText, {
                            source: 'local',
                            needsClarification: true,
                        })
                    );
                    speakReply(clarifyText);
                    return;
                }

                let actionPlan = null;
                let source = 'local';

                if (localMatch.status === MATCH_STATUS.MATCH && localMatch.plan) {
                    actionPlan = localMatch.plan;
                } else {
                    // 2. Send to backend `/api/v1/ai/chat` with current context + 5-turn memory
                    try {
                        const chatRes = await assistantChat({
                            text,
                            lang: assistantLang,
                            applicationContext: appCtx,
                            conversationHistory: conversationHistoryRef.current,
                        });
                        actionPlan = chatRes?.data?.plan || null;
                        source = chatRes?.data?.source || 'api';
                    } catch {
                        // Offline fallback if backend is unreachable
                        if (localMatch.capabilityId) {
                            const demoAns = resolveLocalDemoQuery({
                                capabilityId: localMatch.capabilityId,
                                text,
                            });
                            appendMessage(
                                createMessage('assistant', demoAns.reply, {
                                    data: demoAns.data,
                                    capabilityId: demoAns.capabilityId,
                                    source: 'local',
                                })
                            );
                            speakReply(demoAns.reply);
                            return;
                        }
                        throw new Error(
                            assistantLang === 'en-US'
                                ? 'Assistant service is temporarily unavailable.'
                                : 'El servicio del asistente no está disponible en este momento.'
                        );
                    }
                }

                // 3. Execute validated plan via Action Dispatcher & Local Resolvers
                setStatus(ASSISTANT_STATUS.EXECUTING);
                const execResult = await dispatchActionPlan(actionPlan, {
                    navigate,
                    query,
                    user,
                    lang: assistantLang,
                    currentModule: appCtx.currentModule,
                    selectedItem: appCtx.selectedItem,
                });

                appendMessage(
                    createMessage('assistant', execResult.reply, {
                        data: execResult.data,
                        source,
                        error: !execResult.ok,
                    })
                );

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
                    setStatus(ASSISTANT_STATUS.ERROR);
                    return;
                } else {
                    setIsMinimized(false);
                }

                speakReply(execResult.reply);
            } catch (error) {
                appendMessage(
                    createMessage('assistant', `No pude completar la consulta: ${error.message}`, {
                        error: true,
                    })
                );
                setStatus(ASSISTANT_STATUS.ERROR);
            } finally {
                busyRef.current = false;
            }
        },
        [
            appendMessage,
            assistantLang,
            getApplicationContext,
            navigate,
            query,
            recordVerifiedTurn,
            speakReply,
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
            stopSpeaking();
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
        if (busyRef.current) return;
        resetInactivityTimer();
        if (isListening) {
            stopListening();
            setStatus(ASSISTANT_STATUS.IDLE);
        } else {
            stopSpeaking();
            if (ttsSupported && ttsEnabled) unlockTTS();
            startListening();
        }
    }, [isListening, resetInactivityTimer, startListening, stopListening, ttsSupported, ttsEnabled]);

    const toggleTts = useCallback(() => {
        setTtsEnabled((prev) => {
            const next = !prev;
            if (!next) {
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

    const stopAudio = useCallback(() => {
        stopSpeaking();
        setStatus((s) => (s === ASSISTANT_STATUS.SPEAKING ? ASSISTANT_STATUS.IDLE : s));
    }, []);

    const open = useCallback(() => {
        if (ttsSupported && ttsEnabled) unlockTTS();
        setAvailableVoices(getAvailableVoices());
        setIsMinimized(false);
        setIsOpen(true);
    }, [ttsSupported, ttsEnabled]);

    const close = useCallback(() => {
        stopSpeaking();
        stopListening();
        setStatus(ASSISTANT_STATUS.IDLE);
        setIsMinimized(false);
        setIsOpen(false);
    }, [stopListening]);

    const toggle = useCallback(() => {
        setIsOpen((prev) => {
            if (prev) {
                stopSpeaking();
                stopListening();
                setStatus(ASSISTANT_STATUS.IDLE);
                setIsMinimized(false);
            } else {
                if (ttsSupported && ttsEnabled) unlockTTS();
                setAvailableVoices(getAvailableVoices());
                setIsMinimized(false);
            }
            return !prev;
        });
    }, [stopListening, ttsSupported, ttsEnabled]);

    const toggleMinimized = useCallback(() => {
        resetInactivityTimer();
        setIsMinimized((prev) => !prev);
    }, [resetInactivityTimer]);

    const clearConversation = useCallback(() => {
        stopSpeaking();
        stopListening();
        clearSpeechError();
        setConversationHistory([]);
        setMessages([WELCOME]);
        setIsMinimized(false);
        setStatus(ASSISTANT_STATUS.IDLE);
    }, [clearSpeechError, stopListening]);

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
            messages,
            conversationHistory,
            submitText,
            clearConversation,
            assistantLang,
            setAssistantLang,
            ttsSupported,
            ttsEnabled,
            toggleTts,
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
            messages,
            conversationHistory,
            submitText,
            clearConversation,
            assistantLang,
            setAssistantLang,
            ttsSupported,
            ttsEnabled,
            toggleTts,
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
