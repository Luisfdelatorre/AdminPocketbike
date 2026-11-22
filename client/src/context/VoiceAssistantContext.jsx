import React, { createContext, useCallback, useContext, useMemo, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { assistantQuery } from '../services/api';
import { dispatchIntent } from '../services/voiceAssistant/dispatcher';

const VoiceAssistantContext = createContext(null);

export const ASSISTANT_STATUS = Object.freeze({
    IDLE: 'idle',
    THINKING: 'thinking',
    ERROR: 'error',
});

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
    const busyRef = useRef(false);

    const appendMessage = useCallback((message) => setMessages((prev) => [...prev, message]), []);

    const query = useCallback(async (payload) => {
        const response = await assistantQuery(payload);
        return response?.data ?? {};
    }, []);

    const submitText = useCallback(async (rawText) => {
        const text = (rawText || '').trim();
        if (!text || busyRef.current) return;

        busyRef.current = true;
        appendMessage(createMessage('user', text));
        setStatus(ASSISTANT_STATUS.THINKING);

        try {
            const intent = await query({ text });
            const result = await dispatchIntent(intent, { navigate, query });
            appendMessage(createMessage('assistant', result.reply, { data: result.data, capabilityId: result.capabilityId }));
            setStatus(ASSISTANT_STATUS.IDLE);
        } catch (error) {
            appendMessage(createMessage('assistant', `No pude completar la consulta: ${error.message}`, { error: true }));
            setStatus(ASSISTANT_STATUS.ERROR);
        } finally {
            busyRef.current = false;
        }
    }, [appendMessage, navigate, query]);

    const open = useCallback(() => setIsOpen(true), []);
    const close = useCallback(() => setIsOpen(false), []);
    const toggle = useCallback(() => setIsOpen((prev) => !prev), []);
    const clearConversation = useCallback(() => {
        setMessages([WELCOME]);
        setStatus(ASSISTANT_STATUS.IDLE);
    }, []);

    const value = useMemo(() => ({
        isOpen, open, close, toggle,
        status, messages, submitText, clearConversation,
    }), [isOpen, open, close, toggle, status, messages, submitText, clearConversation]);

    return <VoiceAssistantContext.Provider value={value}>{children}</VoiceAssistantContext.Provider>;
};

export const useVoiceAssistant = () => {
    const context = useContext(VoiceAssistantContext);
    if (!context) throw new Error('useVoiceAssistant must be used within a VoiceAssistantProvider');
    return context;
};
