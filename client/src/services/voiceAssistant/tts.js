/**
 * Browser Text-to-Speech (TTS) wrapper using window.speechSynthesis.
 * Prioritizes Spanish voices (es-CO, es-MX, es-ES, es-*).
 */

export const isTTSSupported = () =>
    typeof window !== 'undefined' &&
    'speechSynthesis' in window &&
    typeof window.SpeechSynthesisUtterance !== 'undefined';

const pickSpanishVoice = () => {
    if (!isTTSSupported()) return null;
    const voices = window.speechSynthesis.getVoices() || [];
    if (!voices.length) return null;

    const preferredLangs = ['es-co', 'es-mx', 'es-419', 'es-us', 'es-es', 'es'];
    for (const target of preferredLangs) {
        const match = voices.find((v) => (v.lang || '').toLowerCase().startsWith(target));
        if (match) return match;
    }
    return null;
};

export const stopSpeaking = () => {
    if (!isTTSSupported()) return;
    try {
        window.speechSynthesis.cancel();
    } catch {
        // Ignore browser synthesis cancel errors
    }
};

/**
 * Speaks `text` aloud and triggers lifecycle callbacks.
 * @param {string} text
 * @param {{ onStart?: () => void, onEnd?: () => void, onError?: (err: any) => void, rate?: number, pitch?: number }} options
 * @returns {boolean} true if speech was queued
 */
export const speakText = (text, { onStart, onEnd, onError, rate = 1.03, pitch = 1.0 } = {}) => {
    if (!isTTSSupported() || !text || !String(text).trim()) {
        onEnd?.();
        return false;
    }

    stopSpeaking();

    try {
        const utterance = new window.SpeechSynthesisUtterance(String(text).trim());
        const voice = pickSpanishVoice();
        if (voice) {
            utterance.voice = voice;
            utterance.lang = voice.lang;
        } else {
            utterance.lang = 'es-CO';
        }
        utterance.rate = rate;
        utterance.pitch = pitch;

        utterance.onstart = () => onStart?.();
        utterance.onend = () => onEnd?.();
        utterance.onerror = (event) => {
            if (event?.error === 'canceled' || event?.error === 'interrupted') {
                onEnd?.();
                return;
            }
            onError?.(event);
            onEnd?.();
        };

        window.speechSynthesis.speak(utterance);
        return true;
    } catch (err) {
        onError?.(err);
        onEnd?.();
        return false;
    }
};

export default { isTTSSupported, speakText, stopSpeaking };
