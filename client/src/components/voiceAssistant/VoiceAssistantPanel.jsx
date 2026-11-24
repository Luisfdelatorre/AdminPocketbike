import React, { useCallback, useEffect, useRef, useState } from 'react';
import {
    Sparkles, X, Send, RotateCcw, Loader2, Volume2, VolumeX, Square,
    Mic, MicOff, AlertCircle, ChevronUp, ChevronDown, SlidersHorizontal,
    ThumbsUp, ThumbsDown,
} from 'lucide-react';
import { useVoiceAssistant, ASSISTANT_STATUS, STATUS_LABELS } from '../../context/VoiceAssistantContext';
import { useAuth } from '../../context/AuthContext';
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
    const { user } = useAuth();
    const {
        isOpen, toggle, close,
        isMinimized, setIsMinimized, toggleMinimized,
        status, progressNote, neuralTtsEnabled, toggleNeuralTts,
        streamingEnabled, toggleStreaming, wsStatus,
        messages, submitText, rateMessage, clearConversation,
        ttsSupported, ttsEnabled, toggleTts, stopAudio,
        availableVoices, selectedVoiceURI, selectVoice,
        voiceStyle, selectVoiceStyle, voiceStyles,
        assistantLang, setAssistantLang,
        speakAmounts, setSpeakAmounts,
        speakCustomerNames, setSpeakCustomerNames,
        speechSupported, isListening, interimTranscript, micPermission,
        speechError, toggleListening, clearSpeechError,
    } = useVoiceAssistant();
    const [draft, setDraft] = useState('');
    const [showVoiceSettings, setShowVoiceSettings] = useState(false);
    const [dragOffsetY, setDragOffsetY] = useState(0);
    const [isDragging, setIsDragging] = useState(false);
    const dragStateRef = useRef({
        active: false,
        startY: 0,
        lastY: 0,
        startTime: 0,
        moved: false,
    });
    const listRef = useRef(null);
    const inputRef = useRef(null);
    const isThinking =
        status === ASSISTANT_STATUS.THINKING ||
        status === ASSISTANT_STATUS.PROCESSING ||
        status === ASSISTANT_STATUS.EXECUTING;
    const isSpeaking = status === ASSISTANT_STATUS.SPEAKING;
    const statusLabel = STATUS_LABELS[status] || STATUS_LABELS[ASSISTANT_STATUS.IDLE];
    const micDenied = micPermission === 'denied';

    useEffect(() => {
        listRef.current?.scrollTo({ top: listRef.current.scrollHeight, behavior: 'smooth' });
    }, [messages, isThinking, isListening, interimTranscript]);

    useEffect(() => {
        if (!isOpen) {
            setShowVoiceSettings(false);
            setDragOffsetY(0);
            setIsDragging(false);
            return undefined;
        }
        const isDesktopPointer =
            typeof window !== 'undefined' &&
            window.matchMedia?.('(min-width: 769px) and (hover: hover) and (pointer: fine)').matches;
        if (isDesktopPointer) {
            inputRef.current?.focus();
        }
        const onKeyDown = (event) => {
            if (event.key === 'Escape') close();
        };
        window.addEventListener('keydown', onKeyDown);
        return () => window.removeEventListener('keydown', onKeyDown);
    }, [isOpen, close]);

    // --- Touch & Pointer Swipe Up / Swipe Down gesture handlers ---
    const beginDrag = useCallback((clientY, target) => {
        // Ignore drags starting on action buttons inside header
        if (target?.closest?.('button, select, input')) return false;
        dragStateRef.current = {
            active: true,
            startY: clientY,
            lastY: clientY,
            startTime: performance.now(),
            moved: false,
        };
        setIsDragging(true);
        return true;
    }, []);

    const updateDrag = useCallback((clientY) => {
        const st = dragStateRef.current;
        if (!st.active) return;
        const deltaY = clientY - st.startY;
        st.lastY = clientY;
        if (Math.abs(deltaY) > 6) {
            st.moved = true;
        }

        // Rubber-band resistance when pulling upwards past expanded state
        if (!isMinimized && deltaY < 0) {
            setDragOffsetY(Math.max(-36, deltaY * 0.25));
        } else if (isMinimized && deltaY < 0) {
            // Pulling up from minimized state
            setDragOffsetY(Math.max(-260, deltaY * 0.65));
        } else {
            // Pulling down
            setDragOffsetY(Math.max(0, deltaY));
        }
    }, [isMinimized]);

    const finishDrag = useCallback(() => {
        const st = dragStateRef.current;
        if (!st.active) return;
        st.active = false;

        const deltaY = st.lastY - st.startY;
        const elapsed = Math.max(1, performance.now() - st.startTime);
        const velocityY = deltaY / elapsed; // px per ms

        setIsDragging(false);
        setDragOffsetY(0);

        if (!st.moved) return;

        if (!isMinimized) {
            // From expanded: fast or deep swipe down closes; moderate swipe down minimizes to peek
            if (deltaY > 220 || (deltaY > 95 && velocityY > 1.05)) {
                close();
            } else if (deltaY > 50 || velocityY > 0.45) {
                setIsMinimized(true);
            }
        } else {
            // From minimized (peek): swipe up expands; swipe down closes
            if (deltaY < -40 || velocityY < -0.35) {
                setIsMinimized(false);
            } else if (deltaY > 60 || velocityY > 0.45) {
                close();
            }
        }
    }, [close, isMinimized, setIsMinimized]);

    const handleTouchStart = (e) => {
        const touch = e.touches?.[0];
        if (!touch) return;
        beginDrag(touch.clientY, e.target);
    };

    const handleTouchMove = (e) => {
        if (!dragStateRef.current.active) return;
        const touch = e.touches?.[0];
        if (!touch) return;
        updateDrag(touch.clientY);
    };

    const handleTouchEnd = () => {
        finishDrag();
    };

    const handlePointerDown = (e) => {
        if (e.pointerType === 'touch') return; // Handled by touch events
        if (!beginDrag(e.clientY, e.target)) return;
        e.currentTarget.setPointerCapture?.(e.pointerId);
    };

    const handlePointerMove = (e) => {
        if (e.pointerType === 'touch' || !dragStateRef.current.active) return;
        updateDrag(e.clientY);
    };

    const handlePointerUp = (e) => {
        if (e.pointerType === 'touch') return;
        finishDrag();
    };

    const handleHandleClick = () => {
        // Only toggle on tap if the user didn't drag
        if (dragStateRef.current.moved) {
            dragStateRef.current.moved = false;
            return;
        }
        toggleMinimized();
    };

    const handleSend = () => {
        if (!draft.trim() || isThinking) return;
        clearSpeechError();
        submitText(draft);
        setDraft('');
        inputRef.current?.blur();
    };

    const handleInputKeyDown = (event) => {
        if (event.key === 'Enter' && !event.shiftKey) {
            event.preventDefault();
            handleSend();
        }
    };

    const panelTransformStyle =
        dragOffsetY !== 0 ? { transform: `translateY(${Math.round(dragOffsetY)}px)` } : undefined;

    return (
        <>
            {!isOpen && (
                <button
                    type="button"
                    className={`va-fab va-fab--${status}`}
                    onClick={toggle}
                    aria-label="Abrir asistente"
                    aria-expanded={false}
                >
                    <Sparkles size={22} />
                </button>
            )}

            {isOpen && (
                <div
                    className={`va-backdrop ${isMinimized ? 'is-minimized' : ''}`}
                    onClick={isMinimized ? undefined : close}
                    role="presentation"
                >
                    <section
                        className={`va-panel va-panel--${status} ${isMinimized ? 'is-minimized' : ''} ${isDragging ? 'is-dragging' : ''}`}
                        style={panelTransformStyle}
                        role="dialog"
                        aria-modal={!isMinimized}
                        aria-label="Asistente de voz"
                        onClick={(event) => event.stopPropagation()}
                    >
                        <div
                            className="va-drag-zone"
                            onTouchStart={handleTouchStart}
                            onTouchMove={handleTouchMove}
                            onTouchEnd={handleTouchEnd}
                            onTouchCancel={handleTouchEnd}
                            onPointerDown={handlePointerDown}
                            onPointerMove={handlePointerMove}
                            onPointerUp={handlePointerUp}
                            onPointerCancel={handlePointerUp}
                        >
                            <div
                                className="va-sheet-handle-wrap"
                                onClick={handleHandleClick}
                                role="button"
                                tabIndex={0}
                                aria-label={isMinimized ? 'Desliza hacia arriba o toca para expandir' : 'Desliza hacia abajo o toca para reducir'}
                                onKeyDown={(e) => {
                                    if (e.key === 'Enter' || e.key === ' ') {
                                        e.preventDefault();
                                        toggleMinimized();
                                    }
                                }}
                            >
                                <span className="va-sheet-handle" aria-hidden="true" />
                            </div>

                            <header className="va-header">
                                <div className="va-header-title">
                                    <span className={`va-orb va-orb--${status}`} aria-hidden="true" />
                                    <div>
                                        <div className="va-title-row">
                                            <h2>Asistente</h2>
                                            <span className={`va-status-pill va-status-pill--${status}`}>{statusLabel}</span>
                                        </div>
                                        <span className="va-demo-badge">
                                            {user?.companyName && user.companyName !== 'System'
                                                ? user.companyName
                                                : 'UPay'}
                                            {' · '}
                                            {!streamingEnabled
                                                ? 'Modo clásico'
                                                : wsStatus === 'connected'
                                                ? 'WS en vivo'
                                                : 'Streaming'}
                                        </span>
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
                                        <>
                                            <button
                                                type="button"
                                                className={`va-icon-btn ${showVoiceSettings ? 'is-active' : ''}`}
                                                onClick={() => setShowVoiceSettings((prev) => !prev)}
                                                aria-label="Elegir voz y modo"
                                                aria-expanded={showVoiceSettings}
                                                title="Elegir voz y modo"
                                            >
                                                <SlidersHorizontal size={16} />
                                            </button>
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
                                        </>
                                    )}
                                    <button
                                        type="button"
                                        className="va-icon-btn"
                                        onClick={toggleMinimized}
                                        aria-label={isMinimized ? 'Expandir panel' : 'Reducir panel'}
                                        title={isMinimized ? 'Expandir panel' : 'Reducir panel'}
                                    >
                                        {isMinimized ? <ChevronUp size={17} /> : <ChevronDown size={17} />}
                                    </button>
                                    <button
                                        type="button"
                                        className="va-icon-btn"
                                        onClick={clearConversation}
                                        aria-label="Reiniciar conversación"
                                        title="Reiniciar conversación"
                                    >
                                        <RotateCcw size={16} />
                                    </button>
                                    <button type="button" className="va-icon-btn" onClick={close} aria-label="Cerrar">
                                        <X size={18} />
                                    </button>
                                </div>
                            </header>
                        </div>

                        {ttsSupported && showVoiceSettings && (
                            <div className="va-voice-settings" role="region" aria-label="Configuración de voz">
                                <div className="va-voice-row">
                                    <span className="va-voice-label">Modo de voz</span>
                                    <div className="va-voice-pills">
                                        {voiceStyles.map((style) => (
                                            <button
                                                key={style.id}
                                                type="button"
                                                className={`va-voice-pill ${voiceStyle === style.id ? 'is-selected' : ''}`}
                                                onClick={() => selectVoiceStyle(style.id)}
                                            >
                                                {style.label}
                                            </button>
                                        ))}
                                    </div>
                                </div>
                                <div className="va-voice-row">
                                    <label className="va-voice-label" htmlFor="va-voice-select">
                                        Voz / Acento ({availableVoices.length || 1} disp.)
                                    </label>
                                    <select
                                        id="va-voice-select"
                                        className="va-voice-select"
                                        value={selectedVoiceURI}
                                        onChange={(e) => selectVoice(e.target.value)}
                                    >
                                        <option value="">Automática (Español prioritario)</option>
                                        {availableVoices.map((v) => (
                                            <option key={v.voiceURI} value={v.voiceURI}>
                                                {v.name} ({v.lang})
                                            </option>
                                        ))}
                                    </select>
                                </div>
                                <div className="va-voice-row">
                                    <span className="va-voice-label">Idioma y Privacidad de Voz</span>
                                    <div className="va-voice-pills">
                                        <button
                                            type="button"
                                            className={`va-voice-pill ${assistantLang === 'es-CO' ? 'is-selected' : ''}`}
                                            onClick={() => setAssistantLang('es-CO')}
                                        >
                                            ES (es-CO)
                                        </button>
                                        <button
                                            type="button"
                                            className={`va-voice-pill ${assistantLang === 'en-US' ? 'is-selected' : ''}`}
                                            onClick={() => setAssistantLang('en-US')}
                                        >
                                            EN (en-US)
                                        </button>
                                        <button
                                            type="button"
                                            className={`va-voice-pill ${speakAmounts ? 'is-selected' : ''}`}
                                            onClick={() => setSpeakAmounts(!speakAmounts)}
                                            aria-pressed={speakAmounts}
                                        >
                                            Montos: {speakAmounts ? 'ON' : 'OFF'}
                                        </button>
                                        <button
                                            type="button"
                                            className={`va-voice-pill ${speakCustomerNames ? 'is-selected' : ''}`}
                                            onClick={() => setSpeakCustomerNames(!speakCustomerNames)}
                                            aria-pressed={speakCustomerNames}
                                        >
                                            Clientes: {speakCustomerNames ? 'ON' : 'OFF'}
                                        </button>
                                        {typeof toggleStreaming === 'function' && (
                                            <button
                                                type="button"
                                                className={`va-voice-pill ${streamingEnabled ? 'is-selected' : ''}`}
                                                onClick={toggleStreaming}
                                                aria-pressed={streamingEnabled}
                                                title="Activar respuestas en tiempo real (WebSocket / SSE) o modo clásico JSON"
                                            >
                                                Streaming: {streamingEnabled ? 'ON' : 'OFF'}
                                            </button>
                                        )}
                                        {typeof toggleNeuralTts === 'function' && (
                                            <button
                                                type="button"
                                                className={`va-voice-pill ${streamingEnabled && neuralTtsEnabled ? 'is-selected' : ''}`}
                                                onClick={toggleNeuralTts}
                                                aria-pressed={Boolean(streamingEnabled && neuralTtsEnabled)}
                                                disabled={!streamingEnabled}
                                                title={
                                                    streamingEnabled
                                                        ? 'Usar voz neuronal en streaming cuando esté disponible'
                                                        : 'Activa Streaming: ON para usar Voz HD neuronal'
                                                }
                                            >
                                                Voz HD: {streamingEnabled && neuralTtsEnabled ? 'ON' : 'OFF'}
                                            </button>
                                        )}
                                    </div>
                                </div>
                            </div>
                        )}

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
                                    <p className={message.isTyping ? 'va-typing-text' : undefined}>
                                        {message.streamedText !== undefined ? message.streamedText : message.text}
                                    </p>
                                    {message.role === 'assistant' && <AssistantData data={message.data} />}
                                    {message.role === 'assistant' && (message.source === 'local' || message.traceId) && (
                                        <div className="va-msg-footer">
                                            {message.source === 'local' ? (
                                                <span className="va-msg-meta">Resuelto localmente</span>
                                            ) : (
                                                <span className="va-msg-meta">Capturado · RL</span>
                                            )}
                                            {message.traceId && (
                                                <div className="va-feedback-btns" role="group" aria-label="Calificar respuesta">
                                                    <button
                                                        type="button"
                                                        className={`va-fb-btn ${message.reward === 1 ? 'is-positive' : ''}`}
                                                        onClick={() => rateMessage(message.id, 1)}
                                                        aria-label="Respuesta útil"
                                                        title="Marcar como buena respuesta (+1)"
                                                    >
                                                        <ThumbsUp size={12} />
                                                    </button>
                                                    <button
                                                        type="button"
                                                        className={`va-fb-btn ${message.reward === -1 ? 'is-negative' : ''}`}
                                                        onClick={() => rateMessage(message.id, -1)}
                                                        aria-label="Respuesta por mejorar"
                                                        title="Marcar para ajuste (-1)"
                                                    >
                                                        <ThumbsDown size={12} />
                                                    </button>
                                                </div>
                                            )}
                                        </div>
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
                                    <span>{progressNote || 'Pensando…'}</span>
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

                        <div className="va-input-bar" role="group" aria-label="Entrada del asistente">
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
                                inputMode="text"
                                enterKeyHint="send"
                                autoComplete="off"
                                autoCorrect="off"
                                spellCheck={false}
                                value={draft}
                                onChange={(event) => setDraft(event.target.value)}
                                onKeyDown={handleInputKeyDown}
                                placeholder={isListening ? 'Escuchando tu voz…' : 'Escribe o pulsa el micrófono…'}
                                maxLength={500}
                                aria-label="Mensaje para el asistente"
                            />
                            <button
                                type="button"
                                className="va-send-btn"
                                onClick={handleSend}
                                disabled={!draft.trim() || isThinking}
                                aria-label="Enviar"
                            >
                                <Send size={18} />
                            </button>
                        </div>
                    </section>
                </div>
            )}
        </>
    );
};

export default VoiceAssistantPanel;
