/**
 * Browser Text-to-Speech (TTS) wrapper using window.speechSynthesis.
 *
 * Includes:
 *  - Voice catalog discovery (`getAvailableVoices`, `onVoicesUpdated`) sorted with
 *    Spanish voices first (`es-CO`, `es-MX`, `es-419`, `es-US`, `es-ES`, `es-*`).
 *  - User-selectable `voiceURI` and voice style presets (`VOICE_STYLES`: normal,
 *    ejecutiva, pausada, grave).
 *  - Firefox/iOS/Safari workarounds (async cancel guard, OS fallback voice, GC reference,
 *    and user-gesture `unlockTTS()`).
 */

let cachedVoices = [];
let activeUtterance = null;
let speakTimer = null;
let unlocked = false;
const voiceListeners = new Set();

export const VOICE_STYLES = Object.freeze([
    { id: 'normal', label: 'Normal', rate: 1.0, pitch: 1.0 },
    { id: 'ejecutiva', label: 'Ejecutiva · Rápida', rate: 1.18, pitch: 1.03 },
    { id: 'pausada', label: 'Suave · Pausada', rate: 0.9, pitch: 0.96 },
    { id: 'grave', label: 'Grave · Profunda', rate: 0.98, pitch: 0.84 },
]);

export const getVoiceStyle = (styleId) =>
    VOICE_STYLES.find((s) => s.id === styleId) || VOICE_STYLES[0];

export const isTTSSupported = () =>
    typeof window !== 'undefined' &&
    'speechSynthesis' in window &&
    typeof window.SpeechSynthesisUtterance !== 'undefined';

const normalizeLang = (lang = '') => String(lang).toLowerCase().replace('_', '-');

const isSpanishVoice = (voice) =>
    normalizeLang(voice?.lang).startsWith('es') ||
    /spanish|español|helena|sabina|paulina|laura|pablo|jorge|monica|soledad|gonzalo|salome|raul/i.test(
        voice?.name || ''
    );

const spanishPriorityScore = (voice) => {
    const lang = normalizeLang(voice?.lang);
    if (lang.startsWith('es-co')) return 100;
    if (lang.startsWith('es-mx')) return 90;
    if (lang.startsWith('es-419')) return 85;
    if (lang.startsWith('es-us')) return 80;
    if (lang.startsWith('es-es')) return 75;
    if (lang.startsWith('es-ar') || lang.startsWith('es-cl')) return 70;
    if (lang.startsWith('es')) return 65;
    if (isSpanishVoice(voice)) return 60;
    if (voice?.default) return 20;
    return 10;
};

const refreshVoices = () => {
    if (!isTTSSupported()) return [];
    try {
        const list = window.speechSynthesis.getVoices() || [];
        if (list.length > 0) {
            cachedVoices = [...list].sort((a, b) => {
                const diff = spanishPriorityScore(b) - spanishPriorityScore(a);
                return diff !== 0 ? diff : String(a.name).localeCompare(String(b.name));
            });
            voiceListeners.forEach((cb) => {
                try {
                    cb(cachedVoices);
                } catch {
                    // Ignore listener errors
                }
            });
        }
    } catch {
        // Ignore browser voice enumeration errors
    }
    return cachedVoices;
};

if (typeof window !== 'undefined' && 'speechSynthesis' in window) {
    refreshVoices();
    if ('onvoiceschanged' in window.speechSynthesis) {
        window.speechSynthesis.addEventListener?.('voiceschanged', refreshVoices);
    }
}

/**
 * Returns sorted list of voices (Spanish voices prioritized at the top).
 * If the device has Spanish voices, returns all Spanish voices plus the default voice;
 * otherwise returns all system voices.
 */
export const getAvailableVoices = () => {
    const voices = cachedVoices.length ? cachedVoices : refreshVoices();
    if (!voices.length) return [];

    const spanish = voices.filter(isSpanishVoice);
    const list = spanish.length > 0 ? spanish : voices;

    return list.map((v) => ({
        voiceURI: v.voiceURI || v.name,
        name: v.name,
        lang: v.lang || 'es',
        isSpanish: isSpanishVoice(v),
        isDefault: Boolean(v.default),
    }));
};

export const onVoicesUpdated = (callback) => {
    if (typeof callback !== 'function') return () => {};
    voiceListeners.add(callback);
    refreshVoices();
    return () => voiceListeners.delete(callback);
};

const pickVoice = (preferredVoiceURI = null) => {
    const voices = cachedVoices.length ? cachedVoices : refreshVoices();
    if (!voices.length) return null;

    if (preferredVoiceURI) {
        const chosen = voices.find(
            (v) => v.voiceURI === preferredVoiceURI || v.name === preferredVoiceURI
        );
        if (chosen) return chosen;
    }

    // cachedVoices is already sorted by spanishPriorityScore descending
    return voices[0] || null;
};

/**
 * Call inside a click/tap handler to prime the speech synthesis engine
 * before an async `await` (required by Firefox/Safari autoplay policies).
 */
export const unlockTTS = () => {
    if (!isTTSSupported()) return;
    refreshVoices();
    try {
        if (window.speechSynthesis.paused) {
            window.speechSynthesis.resume();
        }
        if (!unlocked && !window.speechSynthesis.speaking) {
            const silent = new window.SpeechSynthesisUtterance('');
            silent.volume = 0;
            window.speechSynthesis.speak(silent);
            unlocked = true;
        }
    } catch {
        // Ignore unlock errors
    }
};

export const stopSpeaking = () => {
    if (speakTimer) {
        clearTimeout(speakTimer);
        speakTimer = null;
    }
    activeUtterance = null;
    if (!isTTSSupported()) return;
    try {
        if (window.speechSynthesis.speaking || window.speechSynthesis.pending) {
            window.speechSynthesis.cancel();
        }
    } catch {
        // Ignore browser synthesis cancel errors
    }
};

/**
 * Cleans and optionally shortens conversational text for speech synthesis (`speechSynthesis`).
 *  - Strips technical metadata, raw JSON blocks, markdown formatting (`**`, `` ` ``, `#`),
 *    and internal enum codes so TTS never reads machine artifacts aloud.
 *  - Optionally shortens multi-item lists or overly long responses unless `keepFullList` is true.
 */
export const prepareSpokenResponse = (
    text = '',
    { lang = 'es-CO', maxLength = 340, keepFullList = false } = {}
) => {
    let clean = String(text || '').trim();
    if (!clean) return '';

    // Remove fenced code/JSON blocks or inline raw JSON objects if any ever appear
    clean = clean
        .replace(/```[\s\S]*?```/g, ' ')
        .replace(/\{[\s\S]*?"[a-zA-Z0-9_]+"[\s\S]*?\}/g, ' ')
        .replace(/\*\*([^*]+)\*\*/g, '$1')
        .replace(/`([^`]+)`/g, '$1')
        .replace(/^#+\s+/gm, '')
        .replace(/\s*\n+\s*/g, ' ')
        .replace(/\s{2,}/g, ' ')
        .trim();

    if (keepFullList || clean.length <= maxLength) {
        return clean;
    }

    // Shorten long spoken explanations at a natural sentence boundary
    const sentences = clean.match(/[^.!?]+[.!?]+/g);
    if (sentences && sentences.length > 2) {
        let acc = '';
        for (const s of sentences) {
            if ((acc + s).length > maxLength && acc.length > 0) break;
            acc += s;
        }
        const trimmed = acc.trim();
        if (trimmed && trimmed.length < clean.length) {
            const suffix =
                lang === 'en-US'
                    ? ' You can check the full detail on screen.'
                    : ' Puedes ver el detalle completo en pantalla.';
            return `${trimmed}${suffix}`;
        }
    }

    return clean;
};

/**
 * Speaks `text` aloud and triggers lifecycle callbacks.
 * @param {string} text
 * @param {{
 *   onStart?: () => void,
 *   onEnd?: () => void,
 *   onError?: (err: any) => void,
 *   voiceURI?: string|null,
 *   styleId?: string,
 *   rate?: number,
 *   pitch?: number
 * }} options
 * @returns {boolean} true if speech was queued
 */
export const speakText = (
    text,
    { onStart, onBoundary, onEnd, onError, voiceURI = null, styleId = 'normal', rate, pitch } = {}
) => {
    if (!isTTSSupported() || !text || !String(text).trim()) {
        onEnd?.();
        return false;
    }

    if (speakTimer) {
        clearTimeout(speakTimer);
        speakTimer = null;
    }

    const style = getVoiceStyle(styleId);
    const finalRate = typeof rate === 'number' ? rate : style.rate;
    const finalPitch = typeof pitch === 'number' ? pitch : style.pitch;

    const synth = window.speechSynthesis;
    const wasActive = synth.speaking || synth.pending;
    if (wasActive) {
        try {
            synth.cancel();
        } catch {
            // Ignore cancel errors
        }
    }

    const enqueue = () => {
        speakTimer = null;
        try {
            if (synth.paused) {
                synth.resume();
            }

            const cleanText = String(text).trim();
            const utterance = new window.SpeechSynthesisUtterance(cleanText);
            const voice = pickVoice(voiceURI);
            if (voice) {
                utterance.voice = voice;
                if (voice.lang) {
                    utterance.lang = voice.lang;
                }
            } else {
                utterance.lang = 'es-ES';
            }

            utterance.rate = finalRate;
            utterance.pitch = finalPitch;
            utterance.volume = 1;
            activeUtterance = utterance;

            utterance.onstart = () => onStart?.();
            if (typeof onBoundary === 'function') {
                utterance.onboundary = (event) => {
                    if (typeof event?.charIndex === 'number') {
                        onBoundary({
                            charIndex: event.charIndex,
                            charLength: event.charLength || 0,
                        });
                    }
                };
            }
            utterance.onend = () => {
                if (activeUtterance === utterance) activeUtterance = null;
                onEnd?.();
            };
            utterance.onerror = (event) => {
                if (activeUtterance === utterance) activeUtterance = null;
                if (event?.error === 'canceled' || event?.error === 'interrupted') {
                    onEnd?.();
                    return;
                }
                onError?.(event);
                onEnd?.();
            };

            synth.speak(utterance);
            if (synth.paused) {
                synth.resume();
            }
        } catch (err) {
            activeUtterance = null;
            onError?.(err);
            onEnd?.();
        }
    };

    if (wasActive) {
        speakTimer = setTimeout(enqueue, 60);
    } else {
        enqueue();
    }

    return true;
};

export default {
    VOICE_STYLES,
    getVoiceStyle,
    getAvailableVoices,
    onVoicesUpdated,
    isTTSSupported,
    prepareSpokenResponse,
    speakText,
    stopSpeaking,
    unlockTTS,
};
