import React, { useEffect, useRef, useState } from 'react';
import { Sparkles, X, Send, RotateCcw, Loader2, Volume2, VolumeX, Square, Mic, MicOff, AlertCircle } from 'lucide-react';
import { useVoiceAssistant, ASSISTANT_STATUS, STATUS_LABELS } from '../../context/VoiceAssistantContext';
import { getCapability, SUGGESTED_CAPABILITY_IDS } from '../../services/voiceAssistant/capabilities';
import './VoiceAssistantPanel.css';

const AssistantData = ({ data }) => {
    if (!data) return null;

    if (data.kind === 'stats' && Array.isArray(data.stats)) {
        return (
            <div className="va-stats">
                {data.stats.map((stat) => (
                    <div key={stat.label} className="va-stat">
                        <span className="va-stat-value">{stat.value}</span>
                        <span className="va-stat-label">{stat.label}</span>
                    </div>
                ))}
            </div>
        );
    }

    if (data.kind === 'list' && Array.isArray(data.items)) {
        return (
            <ul className="va-list">
                {data.items.map((item, index) => (
                    <li key={`${item.title}-${index}`} className="va-list-row">
                        <div className="va-list-main">
                            <span className="va-list-title">{item.title}</span>
                            {item.subtitle && <span className="va-list-subtitle">{item.subtitle}</span>}
                        </div>
                        {item.value && <span className="va-list-value">{item.value}</span>}
                    </li>
                ))}
            </ul>
        );
    }

    return null;
};

const VoiceAssistantPanel = () => {
    const {
        isOpen, toggle, close,
        status, messages, submitText, clearConversation,
        ttsSupported, ttsEnabled, toggleTts, stopAudio,
        speechSupported, isListening, interimTranscript, micPermission,
        speechError, toggleListening, clearSpeechError,
    } = useVoiceAssistant();
    const [draft, setDraft] = useState('');
    const listRef = useRef(null);
    const inputRef = useRef(null);
    const isThinking = status === ASSISTANT_STATUS.THINKING;
    const isSpeaking = status === ASSISTANT_STATUS.SPEAKING;
    const statusLabel = STATUS_LABELS[status] || STATUS_LABELS[ASSISTANT_STATUS.IDLE];
    const micDenied = micPermission === 'denied';

    useEffect(() => {
        listRef.current?.scrollTo({ top: listRef.current.scrollHeight, behavior: 'smooth' });
    }, [messages, isThinking, isListening, interimTranscript]);

    useEffect(() => {
        if (!isOpen) return undefined;
        inputRef.current?.focus();
        const onKeyDown = (event) => {
            if (event.key === 'Escape') close();
        };
        window.addEventListener('keydown', onKeyDown);
        return () => window.removeEventListener('keydown', onKeyDown);
    }, [isOpen, close]);

    const handleSubmit = (event) => {
        event.preventDefault();
        if (!draft.trim() || isThinking) return;
        clearSpeechError();
        submitText(draft);
        setDraft('');
    };

    return (
        <>
            <button
                type="button"
                className={`va-fab va-fab--${status} ${isOpen ? 'is-open' : ''}`}
                onClick={toggle}
                aria-label={isOpen ? 'Cerrar asistente' : 'Abrir asistente'}
                aria-expanded={isOpen}
            >
                {isOpen ? <X size={22} /> : <Sparkles size={22} />}
            </button>

            {isOpen && (
                <section className={`va-panel va-panel--${status}`} role="dialog" aria-label="Asistente de voz">
                    <header className="va-header">
                        <div className="va-header-title">
                            <span className={`va-orb va-orb--${status}`} aria-hidden="true" />
                            <div>
                                <div className="va-title-row">
                                    <h2>Asistente</h2>
                                    <span className={`va-status-pill va-status-pill--${status}`}>{statusLabel}</span>
                                </div>
                                <span className="va-demo-badge">Demo · datos de ejemplo</span>
                            </div>
                        </div>
                        <div className="va-header-actions">
                            {isSpeaking && (
                                <button
                                    type="button"
                                    className="va-icon-btn is-speaking"
                                    onClick={stopAudio}
                                    aria-label="Detener voz"
                                    title="Detener voz"
                                >
                                    <Square size={14} />
                                </button>
                            )}
                            {ttsSupported && (
                                <button
                                    type="button"
                                    className={`va-icon-btn ${ttsEnabled ? 'is-active' : ''}`}
                                    onClick={toggleTts}
                                    aria-label={ttsEnabled ? 'Silenciar respuestas por voz' : 'Activar respuestas por voz'}
                                    aria-pressed={ttsEnabled}
                                    title={ttsEnabled ? 'Voz activada' : 'Voz silenciada'}
                                >
                                    {ttsEnabled ? <Volume2 size={16} /> : <VolumeX size={16} />}
                                </button>
                            )}
                            <button type="button" className="va-icon-btn" onClick={clearConversation} aria-label="Reiniciar conversación" title="Reiniciar conversación">
                                <RotateCcw size={16} />
                            </button>
                            <button type="button" className="va-icon-btn" onClick={close} aria-label="Cerrar">
                                <X size={18} />
                            </button>
                        </div>
                    </header>

                    {(!speechSupported || speechError) && (
                        <div className="va-banner va-banner--warning" role="status">
                            <AlertCircle size={15} className="va-banner-icon" />
                            <span>
                                {speechError?.message ||
                                    'Tu navegador no soporta dictado por voz (Web Speech API). Puedes usar el campo de texto.'}
                            </span>
                            {speechError && (
                                <button
                                    type="button"
                                    className="va-banner-close"
                                    onClick={clearSpeechError}
                                    aria-label="Descartar aviso"
                                >
                                    <X size={14} />
                                </button>
                            )}
                        </div>
                    )}

                    <div className="va-messages" ref={listRef} aria-live="polite">
                        {messages.map((message) => (
                            <div key={message.id} className={`va-msg va-msg--${message.role} ${message.error ? 'is-error' : ''}`}>
                                <p>{message.text}</p>
                                {message.role === 'assistant' && <AssistantData data={message.data} />}
                                {message.role === 'assistant' && message.source === 'local' && (
                                    <span className="va-msg-meta">Resuelto localmente</span>
                                )}
                            </div>
                        ))}
                        {isListening && (
                            <div className="va-msg va-msg--user va-msg--interim">
                                <span>{interimTranscript || 'Escuchando… habla ahora'}</span>
                            </div>
                        )}
                        {isThinking && (
                            <div className="va-msg va-msg--assistant va-msg--thinking">
                                <Loader2 size={14} className="va-spin" />
                                <span>Pensando…</span>
                            </div>
                        )}
                    </div>

                    <div className="va-suggestions">
                        {SUGGESTED_CAPABILITY_IDS.map((id) => {
                            const capability = getCapability(id);
                            if (!capability) return null;
                            return (
                                <button
                                    key={id}
                                    type="button"
                                    className="va-chip"
                                    disabled={isThinking || isListening}
                                    onClick={() => submitText(capability.examples[0])}
                                >
                                    {capability.label}
                                </button>
                            );
                        })}
                    </div>

                    <form className="va-input-bar" onSubmit={handleSubmit}>
                        {speechSupported && (
                            <button
                                type="button"
                                className={`va-mic-btn ${isListening ? 'is-listening' : ''} ${micDenied ? 'is-denied' : ''}`}
                                onClick={toggleListening}
                                disabled={isThinking}
                                aria-label={isListening ? 'Detener micrófono' : 'Hablar con el asistente'}
                                aria-pressed={isListening}
                                title={
                                    micDenied
                                        ? 'Permiso de micrófono bloqueado en el navegador'
                                        : isListening
                                        ? 'Detener escucha'
                                        : 'Hablar por micrófono'
                                }
                            >
                                {micDenied ? <MicOff size={18} /> : <Mic size={18} />}
                            </button>
                        )}
                        <input
                            ref={inputRef}
                            type="text"
                            value={draft}
                            onChange={(event) => setDraft(event.target.value)}
                            placeholder={isListening ? 'Escuchando tu voz…' : 'Escribe o pulsa el micrófono…'}
                            maxLength={500}
                            aria-label="Mensaje para el asistente"
                        />
                        <button type="submit" className="va-send-btn" disabled={!draft.trim() || isThinking} aria-label="Enviar">
                            <Send size={18} />
                        </button>
                    </form>
                </section>
            )}
        </>
    );
};

export default VoiceAssistantPanel;
