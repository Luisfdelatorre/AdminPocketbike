import { useCallback, useEffect, useRef, useState } from 'react';

const getSpeechRecognitionCtor = () => {
    if (typeof window === 'undefined') return null;
    return window.SpeechRecognition || window.webkitSpeechRecognition || null;
};

export const SPEECH_ERROR_MESSAGES = Object.freeze({
    'not-allowed': 'Permiso de micrófono denegado. Habilítalo en el icono del candado de la barra de direcciones o escribe tu consulta abajo.',
    'service-not-allowed': 'El servicio de reconocimiento de voz no está permitido en este contexto. Usa el campo de texto.',
    'audio-capture': 'No se detectó ningún micrófono disponible. Conecta uno o escribe tu consulta.',
    'no-speech': 'No se detectó voz. Acércate al micrófono e inténtalo de nuevo.',
    'network': 'Error de red en el servicio de voz del navegador. Puedes escribir tu consulta directamente.',
    'aborted': null,
});

/**
 * Custom hook wrapping the Web Speech API (SpeechRecognition / webkitSpeechRecognition)
 * with microphone permission inspection, interim transcript streaming, repeated-phrase
 * deduplication (Section 14), and Spanish/English error messages.
 */
export default function useSpeechRecognition({
    lang = 'es-CO',
    onFinalTranscript,
    onStart,
    onEnd,
    onError,
} = {}) {
    const [isSupported] = useState(() => Boolean(getSpeechRecognitionCtor()));
    const [isListening, setIsListening] = useState(false);
    const [interimTranscript, setInterimTranscript] = useState('');
    const [permissionState, setPermissionState] = useState('prompt'); // 'prompt' | 'granted' | 'denied'
    const [error, setError] = useState(null);

    const recognitionRef = useRef(null);
    const lastFinalSubmissionRef = useRef({ text: '', timestamp: 0 });
    const callbacksRef = useRef({ onFinalTranscript, onStart, onEnd, onError });

    useEffect(() => {
        callbacksRef.current = { onFinalTranscript, onStart, onEnd, onError };
    }, [onFinalTranscript, onStart, onEnd, onError]);

    useEffect(() => {
        if (typeof navigator === 'undefined' || !navigator.permissions?.query) return undefined;
        let permissionStatus = null;
        let mounted = true;

        navigator.permissions
            .query({ name: 'microphone' })
            .then((status) => {
                if (!mounted) return;
                permissionStatus = status;
                setPermissionState(status.state);
                status.onchange = () => {
                    if (mounted) setPermissionState(status.state);
                };
            })
            .catch(() => {
                // Firefox/Safari may not support querying 'microphone' in navigator.permissions
            });

        return () => {
            mounted = false;
            if (permissionStatus) permissionStatus.onchange = null;
        };
    }, []);

    const stopListening = useCallback(() => {
        if (!recognitionRef.current) return;
        try {
            recognitionRef.current.stop();
        } catch {
            // Ignore errors if already stopped
        }
    }, []);

    const clearError = useCallback(() => setError(null), []);

    const startListening = useCallback(() => {
        const Ctor = getSpeechRecognitionCtor();
        if (!Ctor) {
            const unsupported = {
                code: 'unsupported',
                message:
                    lang === 'en-US'
                        ? 'Your browser does not support Web Speech API voice recognition. Use Chrome, Edge, Safari, or type below.'
                        : 'Tu navegador no soporta reconocimiento de voz (Web Speech API). Usa Chrome, Edge o Safari, o escribe tu consulta.',
            };
            setError(unsupported);
            callbacksRef.current.onError?.(unsupported);
            return false;
        }

        if (recognitionRef.current) {
            try {
                recognitionRef.current.abort();
            } catch {
                // Ignore abort errors
            }
        }

        setError(null);
        setInterimTranscript('');

        try {
            const recognition = new Ctor();
            recognition.lang = lang === 'en-US' ? 'en-US' : 'es-CO';
            recognition.continuous = false;
            recognition.interimResults = true;
            recognition.maxAlternatives = 1;

            let finalCollected = '';
            let submitted = false;

            recognition.onstart = () => {
                setIsListening(true);
                setPermissionState('granted');
                callbacksRef.current.onStart?.();
            };

            recognition.onresult = (event) => {
                let interim = '';
                for (let i = event.resultIndex; i < event.results.length; i++) {
                    const res = event.results[i];
                    const transcript = res[0]?.transcript || '';
                    if (res.isFinal) {
                        finalCollected += ` ${transcript}`;
                    } else {
                        interim += transcript;
                    }
                }
                setInterimTranscript(interim.trim());
            };

            recognition.onerror = (event) => {
                const code = event?.error || 'unknown';
                if (code === 'not-allowed' || code === 'service-not-allowed') {
                    setPermissionState('denied');
                }
                const message =
                    code in SPEECH_ERROR_MESSAGES
                        ? SPEECH_ERROR_MESSAGES[code]
                        : `Error de reconocimiento de voz (${code}). Puedes escribir tu consulta.`;

                if (message) {
                    const errPayload = { code, message };
                    setError(errPayload);
                    callbacksRef.current.onError?.(errPayload);
                }
            };

            recognition.onend = () => {
                setIsListening(false);
                setInterimTranscript('');
                recognitionRef.current = null;
                const cleanFinal = finalCollected.trim();

                if (cleanFinal && !submitted) {
                    submitted = true;
                    const now = Date.now();
                    const prev = lastFinalSubmissionRef.current;
                    // Deduplicate identical final phrase fired twice within 1.5s on mobile WebKit/Blink
                    if (prev.text === cleanFinal && now - prev.timestamp < 1500) {
                        callbacksRef.current.onEnd?.();
                        return;
                    }
                    lastFinalSubmissionRef.current = { text: cleanFinal, timestamp: now };
                    callbacksRef.current.onFinalTranscript?.(cleanFinal);
                } else {
                    callbacksRef.current.onEnd?.();
                }
            };

            recognitionRef.current = recognition;
            recognition.start();
            return true;
        } catch {
            const startErr = {
                code: 'start-failed',
                message: 'No se pudo iniciar el micrófono. Verifica los permisos o escribe tu consulta.',
            };
            setIsListening(false);
            setError(startErr);
            callbacksRef.current.onError?.(startErr);
            return false;
        }
    }, [lang]);

    useEffect(() => {
        return () => {
            if (recognitionRef.current) {
                try {
                    recognitionRef.current.abort();
                } catch {
                    // Ignore
                }
                recognitionRef.current = null;
            }
        };
    }, []);

    return {
        isSupported,
        isListening,
        interimTranscript,
        permissionState,
        error,
        startListening,
        stopListening,
        clearError,
    };
}
