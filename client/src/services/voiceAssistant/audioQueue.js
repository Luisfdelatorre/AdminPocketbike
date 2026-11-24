/**
 * Turn-Scoped Sentence Audio Queue — UPay AI Assistant (Reqs. 9 & 10)
 *
 * Buffers incoming `audio_chunk` events (`{ sentenceIndex, chunkIndex, isFinalChunk, mimeType, audioBase64 }`),
 * reassembles each sentence in exact `chunkIndex` order, and plays sentences strictly in
 * `sentenceIndex = 0, 1, 2...` order with instant turn-scoped cancellation and interruption.
 */

const decodeBase64ToUint8Array = (b64 = '') => {
    if (typeof atob === 'function') {
        const binary = atob(b64);
        const bytes = new Uint8Array(binary.length);
        for (let i = 0; i < binary.length; i++) {
            bytes[i] = binary.charCodeAt(i);
        }
        return bytes;
    }
    return new Uint8Array(Buffer.from(b64, 'base64'));
};

export class AudioStreamQueue {
    constructor({
        onSpeakingChange = null,
        onFirstAudio = null,
        onPlaybackError = null,
        AudioImpl = typeof window !== 'undefined' && typeof window.Audio === 'function' ? window.Audio : null,
    } = {}) {
        this.onSpeakingChange = onSpeakingChange;
        this.onFirstAudio = onFirstAudio;
        this.onPlaybackError = onPlaybackError;
        this.AudioImpl = AudioImpl;

        this.activeTurnId = null;
        this.sentenceBuffers = new Map(); // sentenceIndex -> { chunks: Map<chunkIndex, Uint8Array>, finalCount: number|null, mimeType }
        this.readySentences = new Map(); // sentenceIndex -> { bytes: Uint8Array, mimeType: string }
        this.nextSentenceToPlay = 0;
        this.currentAudio = null;
        this.currentObjectUrl = null;
        this.isPlaying = false;
        this.firstAudioFired = false;
    }

    isSupported() {
        return typeof this.AudioImpl === 'function';
    }

    /**
     * Resets queue and binds strictly to `turnId`. Any chunks from other turns are ignored.
     */
    beginTurn(turnId) {
        this.stop();
        this.activeTurnId = turnId;
        this.nextSentenceToPlay = 0;
        this.firstAudioFired = false;
    }

    /**
     * Enqueues a streamed audio chunk for `turnId`.
     */
    enqueueChunk(turnId, payload = {}) {
        if (!turnId || turnId !== this.activeTurnId) {
            return false; // Drop stale audio from cancelled or older turns (Req. 10)
        }
        const {
            sentenceIndex = 0,
            chunkIndex = 0,
            isFinalChunk = false,
            mimeType = 'audio/mpeg',
            audioBase64 = '',
        } = payload;

        if (!Number.isInteger(sentenceIndex) || sentenceIndex < 0) return false;
        if (!Number.isInteger(chunkIndex) || chunkIndex < 0) return false;

        let entry = this.sentenceBuffers.get(sentenceIndex);
        if (!entry) {
            entry = { chunks: new Map(), totalChunks: null, mimeType };
            this.sentenceBuffers.set(sentenceIndex, entry);
        }

        if (audioBase64) {
            entry.chunks.set(chunkIndex, decodeBase64ToUint8Array(audioBase64));
        }
        if (isFinalChunk) {
            entry.totalChunks = audioBase64 ? chunkIndex + 1 : chunkIndex;
        }

        // Assemble sentence as soon as all chunks [0 .. totalChunks - 1] have arrived
        if (entry.totalChunks !== null && entry.chunks.size >= entry.totalChunks) {
            let totalLen = 0;
            const ordered = [];
            for (let i = 0; i < entry.totalChunks; i++) {
                const part = entry.chunks.get(i);
                if (!part) return true; // Still waiting on an out-of-order chunk
                ordered.push(part);
                totalLen += part.byteLength;
            }
            this.sentenceBuffers.delete(sentenceIndex);
            if (totalLen > 0) {
                const merged = new Uint8Array(totalLen);
                let offset = 0;
                for (const part of ordered) {
                    merged.set(part, offset);
                    offset += part.byteLength;
                }
                this.readySentences.set(sentenceIndex, { bytes: merged, mimeType: entry.mimeType });
                this._drainPlayable();
            } else if (sentenceIndex === this.nextSentenceToPlay) {
                this.nextSentenceToPlay += 1;
                this._drainPlayable();
            }
        }

        return true;
    }

    _cleanupCurrentAudio() {
        if (this.currentAudio) {
            try {
                this.currentAudio.onended = null;
                this.currentAudio.onerror = null;
                this.currentAudio.pause?.();
                this.currentAudio.src = '';
            } catch {
                // Ignore
            }
            this.currentAudio = null;
        }
        if (this.currentObjectUrl && typeof URL !== 'undefined' && URL.revokeObjectURL) {
            try {
                URL.revokeObjectURL(this.currentObjectUrl);
            } catch {
                // Ignore
            }
            this.currentObjectUrl = null;
        }
    }

    _setSpeaking(flag) {
        if (this.isPlaying === flag) return;
        this.isPlaying = flag;
        this.onSpeakingChange?.(flag);
    }

    _drainPlayable() {
        if (this.isPlaying || !this.activeTurnId) return;
        const nextReady = this.readySentences.get(this.nextSentenceToPlay);
        if (!nextReady) return;

        this.readySentences.delete(this.nextSentenceToPlay);
        this.nextSentenceToPlay += 1;

        if (!this.isSupported()) {
            this.onPlaybackError?.(new Error('AUDIO_ELEMENT_UNSUPPORTED'));
            return;
        }

        const turnSnapshot = this.activeTurnId;
        this._cleanupCurrentAudio();

        try {
            let srcUrl = '';
            if (typeof URL !== 'undefined' && typeof Blob !== 'undefined' && URL.createObjectURL) {
                const blob = new Blob([nextReady.bytes], { type: nextReady.mimeType || 'audio/mpeg' });
                srcUrl = URL.createObjectURL(blob);
                this.currentObjectUrl = srcUrl;
            } else {
                // Fallback data URI for non-Blob test environments
                const b64 = Buffer.from(nextReady.bytes).toString('base64');
                srcUrl = `data:${nextReady.mimeType || 'audio/mpeg'};base64,${b64}`;
            }

            const audio = new this.AudioImpl(srcUrl);
            this.currentAudio = audio;
            this._setSpeaking(true);

            if (!this.firstAudioFired) {
                this.firstAudioFired = true;
                this.onFirstAudio?.();
            }

            const advance = () => {
                if (this.activeTurnId !== turnSnapshot) return;
                this._cleanupCurrentAudio();
                this.isPlaying = false;
                if (this.readySentences.has(this.nextSentenceToPlay)) {
                    this._drainPlayable();
                } else {
                    this.onSpeakingChange?.(false);
                }
            };

            audio.onended = advance;
            audio.onerror = (err) => {
                this.onPlaybackError?.(err);
                advance();
            };

            const playPromise = audio.play?.();
            if (playPromise && typeof playPromise.catch === 'function') {
                playPromise.catch((err) => {
                    this.onPlaybackError?.(err);
                    advance();
                });
            }
        } catch (err) {
            this._cleanupCurrentAudio();
            this._setSpeaking(false);
            this.onPlaybackError?.(err);
        }
    }

    /**
     * Immediately stops playback and discards all buffered sentences/chunks.
     */
    stop() {
        this.activeTurnId = null;
        this.sentenceBuffers.clear();
        this.readySentences.clear();
        this.nextSentenceToPlay = 0;
        this._cleanupCurrentAudio();
        this._setSpeaking(false);
    }
}

export default AudioStreamQueue;
