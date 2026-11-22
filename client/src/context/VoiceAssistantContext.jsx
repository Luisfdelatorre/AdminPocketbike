import React, { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { assistantQuery } from '../services/api';
import { dispatchIntent } from '../services/voiceAssistant/dispatcher';
import { matchLocalIntent } from '../services/voiceAssistant/matcher';
import { isTTSSupported, speakText, stopSpeaking } from '../services/voiceAssistant/tts';

const VoiceAssistantContext = createContext(null);

export const ASSISTANT_STATUS = Object.freeze({
    IDLE: 'idle',
    LISTENING: 'listening',
    THINKING: 'thinking',
    SPEAKING: 'speaking',
    ERROR: 'error',
});

export const STATUS_LABELS = Object.freeze({
    [ASSISTANT_STATUS.IDLE]: 'Listo',
    [ASSISTANT_STATUS.LISTENING]: 'Escuchando…',
    [ASSISTANT_STATUS.THINKING]: 'Procesando…',
    [ASSISTANT_STATUS.SPEAKING]: 'Hablando…',
    [ASSISTANT_STATUS.ERROR]: 'Atención',
});

const TTS_STORAGE_KEY = 'va_tts_enabled';

let messageSeq = 0;
const createMessage = (role, text, extra = {}) => ({ id: `${Date.now()}-${++messageSeq}`, role, text, ...extra });

const WELCOME = createMessage(
    'assistant',
    'Hola, soy el asistente de demostración. Pregúntame por el recaudo, la flota o las alertas, o pídeme abrir una sección.'
);

export const VoiceAssistantProvider = ({ children }) => {
    const navigate = useNavigate();
    const [isOpen, setIsOpen] = useState(false);
    const [status, setStatus] = useState(ASSISTANT_STATUS.IDLE);
    const [messages, setMessages] = useState([WELCOME]);
    const [ttsSupported] = useState(() => isTTSSupported());
    const [ttsEnabled, setTtsEnabled] = useState(() => {
        if (typeof window === 'undefined') return true;
        const saved = localStorage.getItem(TTS_STORAGE_KEY);
        return saved === null ? true : saved === 'true';
    });
    const busyRef = useRef(false);

    useEffect(() => {
        return () => stopSpeaking();
    }, []);

    const appendMessage = useCallback((message) => setMessages((prev) => [...prev, message]), []);

    const query = useCallback(async (payload) => {
        const response = await assistantQuery(payload);
        return response?.data ?? {};
    }, []);

    const speakReply = useCallback((replyText) => {
        if (!ttsSupported || !ttsEnabled || !replyText) {
            setStatus(ASSISTANT_STATUS.IDLE);
            return;
        }
        const started = speakText(replyText, {
            onStart: () => setStatus(ASSISTANT_STATUS.SPEAKING),
            onEnd: () => setStatus((prev) => (prev === ASSISTANT_STATUS.SPEAKING ? ASSISTANT_STATUS.IDLE : prev)),
        });
        if (!started) {
            setStatus(ASSISTANT_STATUS.IDLE);
        }
    }, [ttsSupported, ttsEnabled]);

    const submitText = useCallback(async (rawText) => {
        const text = (rawText || '').trim();
        if (!text || busyRef.current) return;

        busyRef.current = true;
        stopSpeaking();
        appendMessage(createMessage('user', text));
        setStatus(ASSISTANT_STATUS.THINKING);

        try {
            // 1. Local matcher first: instant navigation/help and pre-resolved capabilityId
            const localMatch = matchLocalIntent(text);
            let intent;
            let source = 'local';

            if (localMatch.resolvedLocally) {
                intent = { capabilityId: localMatch.capabilityId };
            } else if (localMatch.capabilityId) {
                const serverData = await query({ capabilityId: localMatch.capabilityId });
                intent = { ...serverData, capabilityId: localMatch.capabilityId };
                source = 'local+api';
            } else {
                intent = await query({ text });
                source = 'api';
            }

            const result = await dispatchIntent(intent, { navigate, query });
            appendMessage(
                createMessage('assistant', result.reply, {
                    data: result.data,
                    capabilityId: result.capabilityId,
                    source,
                })
            );
            speakReply(result.reply);
        } catch (error) {
            appendMessage(createMessage('assistant', `No pude completar la consulta: ${error.message}`, { error: true }));
            setStatus(ASSISTANT_STATUS.ERROR);
        } finally {
            busyRef.current = false;
        }
    }, [appendMessage, navigate, query, speakReply]);

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
                // Ignore storage errors
            }
            return next;
        });
    }, []);

    const stopAudio = useCallback(() => {
        stopSpeaking();
        setStatus((s) => (s === ASSISTANT_STATUS.SPEAKING ? ASSISTANT_STATUS.IDLE : s));
    }, []);

    const open = useCallback(() => setIsOpen(true), []);
    const close = useCallback(() => {
        stopSpeaking();
        setStatus((s) => (s === ASSISTANT_STATUS.SPEAKING ? ASSISTANT_STATUS.IDLE : s));
        setIsOpen(false);
    }, []);
    const toggle = useCallback(() => {
        setIsOpen((prev) => {
            if (prev) {
                stopSpeaking();
                setStatus((s) => (s === ASSISTANT_STATUS.SPEAKING ? ASSISTANT_STATUS.IDLE : s));
            }
            return !prev;
        });
    }, []);
    const clearConversation = useCallback(() => {
        stopSpeaking();
        setMessages([WELCOME]);
        setStatus(ASSISTANT_STATUS.IDLE);
    }, []);

    const value = useMemo(() => ({
        isOpen, open, close, toggle,
        status, setStatus,
        messages, submitText, clearConversation,
        ttsSupported, ttsEnabled, toggleTts, stopAudio,
    }), [isOpen, open, close, toggle, status, messages, submitText, clearConversation, ttsSupported, ttsEnabled, toggleTts, stopAudio]);

    return <VoiceAssistantContext.Provider value={value}>{children}</VoiceAssistantContext.Provider>;
};

export const useVoiceAssistant = () => {
    const context = useContext(VoiceAssistantContext);
    if (!context) throw new Error('useVoiceAssistant must be used within a VoiceAssistantProvider');
    return context;
};
