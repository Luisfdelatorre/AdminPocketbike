/**
 * Browser WebSocket Client for UPay AI Assistant (`/api/v1/ai/ws` & `/apinode/ai/ws`)
 *
 * Features (Reqs. 3, 4, 6, 10, 11, 13):
 *  - Authenticates via `Sec-WebSocket-Protocol: ['upay-auth', 'upay.jwt.<token>']`
 *    so credentials stay out of URLs and OpenAI keys never leave the backend.
 *  - Validates every incoming server envelope with `validateWsEventEnvelope`
 *    and enforces monotonic per-turn `sequence` ordering.
 *  - Supports instant turn-scoped cancellation (`cancelTurn(turnId)`) that drops
 *    any late `text_delta` or `audio_chunk` frames from cancelled/previous turns.
 *  - Reconnects with bounded exponential backoff and exposes readiness so callers
 *    can fall back seamlessly to `POST /api/v1/ai/chat` if WS is unavailable.
 */

import { validateWsEventEnvelope } from './schemaValidator.js';

const API_BASE =
    import.meta.env?.VITE_API_BASE_URL || import.meta.env?.VITE_API_URL || '/api/v1';
const CONNECT_TIMEOUT_MS = 1800;
const TURN_IDLE_TIMEOUT_MS = 22000;
const MAX_AUTO_RECONNECTS = 3;

const logWs = (...args) => {
    if (typeof window === 'undefined') return;
    try {
        if (localStorage.getItem('va_debug_logs') === 'false') return;
    } catch {
        // Ignore storage errors
    }
    console.log('[UPay AI · WS]', ...args);
};

export const buildAssistantWsUrl = (locationObj = typeof window !== 'undefined' ? window.location : null) => {
    if (!locationObj) return 'ws://127.0.0.1:8084/api/v1/ai/ws';
    const wsProto = locationObj.protocol === 'https:' ? 'wss:' : 'ws:';
    const cleanBase = String(API_BASE).replace(/\/+$/, '');
    if (/^https?:\/\//i.test(cleanBase)) {
        return `${cleanBase.replace(/^http/i, 'ws')}/ai/ws`;
    }
    const prefix = cleanBase.startsWith('/') ? cleanBase : `/${cleanBase}`;
    return `${wsProto}//${locationObj.host}${prefix}/ai/ws`;
};

export class AssistantWsClient {
    constructor({ WebSocketImpl = typeof WebSocket !== 'undefined' ? WebSocket : null, urlBuilder = buildAssistantWsUrl } = {}) {
        this.WebSocketImpl = WebSocketImpl;
        this.urlBuilder = urlBuilder;
        this.ws = null;
        this.token = null;
        this.sessionKey = null;
        this.connectPromise = null;
        this.reconnectAttempts = 0;
        this.reconnectTimer = null;
        this.intentionallyClosed = false;
        this.activeTurn = null; // { turnId, lastSeq, onEvent, resolve, reject, idleTimer }
        this.cancelledTurnIds = new Set();
        this.statusListeners = new Set();
        this.connectionStatus = 'disconnected';
    }

    isSupported() {
        return typeof this.WebSocketImpl === 'function';
    }

    onStatusChange(listener) {
        if (typeof listener !== 'function') return () => {};
        this.statusListeners.add(listener);
        return () => this.statusListeners.delete(listener);
    }

    _setStatus(next) {
        if (this.connectionStatus === next) return;
        this.connectionStatus = next;
        this.statusListeners.forEach((cb) => {
            try {
                cb(next);
            } catch {
                // Ignore listener error
            }
        });
    }

    /**
     * Binds client to the current authenticated user/company session.
     * Automatically resets socket if token or company session changed (Req. 6 & 11).
     */
    syncSession({ token, sessionKey }) {
        if (!token || !this.isSupported()) {
            this.disconnect();
            this.token = null;
            this.sessionKey = null;
            return;
        }
        if (this.token !== token || this.sessionKey !== sessionKey) {
            this.disconnect();
            this.token = token;
            this.sessionKey = sessionKey;
            this.intentionallyClosed = false;
            this.reconnectAttempts = 0;
            this.ensureConnected().catch(() => {});
        }
    }

    ensureConnected() {
        if (!this.isSupported() || !this.token) {
            return Promise.reject(new Error('WS_UNAVAILABLE'));
        }
        if (this.ws && this.ws.readyState === 1) {
            return Promise.resolve(this.ws);
        }
        if (this.connectPromise) {
            return this.connectPromise;
        }

        this.intentionallyClosed = false;
        this._setStatus('connecting');

        this.connectPromise = new Promise((resolve, reject) => {
            let settled = false;
            let ws;
            const timer = setTimeout(() => {
                if (settled) return;
                settled = true;
                this.connectPromise = null;
                this._setStatus('error');
                try {
                    ws?.close();
                } catch {
                    // Ignore
                }
                reject(new Error('WS_CONNECT_TIMEOUT'));
            }, CONNECT_TIMEOUT_MS);
            timer.unref?.();

            try {
                const url = this.urlBuilder();
                logWs('Conectando a', url);
                ws = new this.WebSocketImpl(url, ['upay-auth', `upay.jwt.${this.token}`]);
            } catch (err) {
                clearTimeout(timer);
                this.connectPromise = null;
                this._setStatus('error');
                reject(err);
                return;
            }

            this.ws = ws;

            ws.onopen = () => {
                if (settled) return;
                settled = true;
                clearTimeout(timer);
                this.connectPromise = null;
                this.reconnectAttempts = 0;
                logWs('Conectado (WS en vivo)');
                this._setStatus('connected');
                resolve(ws);
            };

            ws.onmessage = (event) => {
                this._handleMessage(event?.data);
            };

            ws.onerror = () => {
                if (!settled) {
                    settled = true;
                    clearTimeout(timer);
                    this.connectPromise = null;
                    logWs('Error de conexión WS');
                    this._setStatus('error');
                    reject(new Error('WS_CONNECTION_ERROR'));
                }
            };

            ws.onclose = (closeEvt) => {
                clearTimeout(timer);
                if (this.ws === ws) {
                    this.ws = null;
                }
                this.connectPromise = null;
                logWs('Conexión cerrada', { code: closeEvt?.code || 1000, intentional: this.intentionallyClosed });

                // Fail any in-flight turn cleanly so caller can handle or retry
                if (this.activeTurn) {
                    const pending = this.activeTurn;
                    this._clearActiveTurn();
                    pending.reject(new Error(`WS_CLOSED_MID_TURN:${closeEvt?.code || 1006}`));
                }

                if (!settled) {
                    settled = true;
                    this._setStatus('disconnected');
                    reject(new Error('WS_CLOSED_BEFORE_OPEN'));
                    return;
                }

                this._setStatus('disconnected');
                const unrecoverableAuthClose = closeEvt?.code === 4401 || closeEvt?.code === 4403;
                if (
                    !this.intentionallyClosed &&
                    !unrecoverableAuthClose &&
                    this.token &&
                    this.reconnectAttempts < MAX_AUTO_RECONNECTS
                ) {
                    const delay = Math.min(4000, 500 * 2 ** this.reconnectAttempts);
                    this.reconnectAttempts += 1;
                    this.reconnectTimer = setTimeout(() => {
                        this.reconnectTimer = null;
                        this.ensureConnected().catch(() => {});
                    }, delay);
                    this.reconnectTimer.unref?.();
                }
            };
        });

        return this.connectPromise;
    }

    _resetTurnIdleTimer() {
        if (!this.activeTurn) return;
        if (this.activeTurn.idleTimer) {
            clearTimeout(this.activeTurn.idleTimer);
        }
        this.activeTurn.idleTimer = setTimeout(() => {
            if (!this.activeTurn) return;
            const timedOutTurn = this.activeTurn;
            this.cancelTurn(timedOutTurn.turnId);
            timedOutTurn.reject(new Error('WS_TURN_TIMEOUT'));
        }, TURN_IDLE_TIMEOUT_MS);
        this.activeTurn.idleTimer.unref?.();
    }

    _clearActiveTurn() {
        if (this.activeTurn?.idleTimer) {
            clearTimeout(this.activeTurn.idleTimer);
        }
        this.activeTurn = null;
    }

    _handleMessage(rawData) {
        let parsed;
        try {
            parsed = JSON.parse(String(rawData || ''));
        } catch {
            return;
        }
        if (!parsed || parsed.type === 'pong') return;

        const checked = validateWsEventEnvelope(parsed);
        if (!checked.success) return;

        const env = checked.data;

        // Drop stale frames from cancelled or non-active turns immediately (Req. 10)
        if (this.cancelledTurnIds.has(env.turnId)) return;
        if (!this.activeTurn || this.activeTurn.turnId !== env.turnId) return;

        // Enforce strictly increasing sequence numbers per turn (Req. 4)
        if (env.sequence <= this.activeTurn.lastSeq) return;
        this.activeTurn.lastSeq = env.sequence;
        this._resetTurnIdleTimer();

        try {
            this.activeTurn.onEvent?.(env);
        } catch {
            // Protect socket loop from UI callback errors
        }

        if (env.type === 'turn_completed') {
            const current = this.activeTurn;
            this._clearActiveTurn();
            current.resolve(env.payload);
        } else if (env.type === 'turn_failed') {
            const current = this.activeTurn;
            this._clearActiveTurn();
            const err = new Error(env.payload?.message || 'Turn failed');
            err.code = env.payload?.code || 'TURN_FAILED';
            err.turnFailedPayload = env.payload;
            current.reject(err);
        }
    }

    /**
     * Starts a streaming turn over the authenticated WebSocket.
     */
    async startTurn({ turnId, payload, onEvent }) {
        // Cancel any previous turn before starting a new one
        if (this.activeTurn) {
            this.cancelTurn(this.activeTurn.turnId);
        }

        const ws = await this.ensureConnected();

        return new Promise((resolve, reject) => {
            this.activeTurn = {
                turnId,
                lastSeq: 0,
                onEvent,
                resolve,
                reject,
                idleTimer: null,
            };
            this._resetTurnIdleTimer();

            try {
                ws.send(
                    JSON.stringify({
                        type: 'start_turn',
                        turnId,
                        payload,
                    })
                );
            } catch (err) {
                this._clearActiveTurn();
                reject(err);
            }
        });
    }

    /**
     * Cancels `turnId` locally and notifies backend to abort OpenAI + TTS streams immediately.
     */
    cancelTurn(turnId = null) {
        const targetId = turnId || this.activeTurn?.turnId || null;
        if (targetId) {
            this.cancelledTurnIds.add(targetId);
            if (this.cancelledTurnIds.size > 40) {
                const oldest = this.cancelledTurnIds.values().next().value;
                this.cancelledTurnIds.delete(oldest);
            }
        }

        if (this.activeTurn && (!targetId || this.activeTurn.turnId === targetId)) {
            const cancelled = this.activeTurn;
            this._clearActiveTurn();
            const cancelErr = new Error('TURN_CANCELLED');
            cancelErr.code = 'TURN_CANCELLED';
            cancelled.reject(cancelErr);
        }

        if (this.ws && this.ws.readyState === 1 && targetId) {
            try {
                this.ws.send(JSON.stringify({ type: 'cancel_turn', turnId: targetId }));
            } catch {
                // Ignore send errors on closing socket
            }
        }
    }

    /**
     * Clears the server-side OpenAI Agents SDK conversation session for this socket.
     */
    resetConversation() {
        if (this.activeTurn) {
            this.cancelTurn(this.activeTurn.turnId);
        }
        if (this.ws && this.ws.readyState === 1) {
            try {
                this.ws.send(JSON.stringify({ type: 'reset_conversation' }));
                return true;
            } catch {
                return false;
            }
        }
        return false;
    }

    disconnect() {
        this.intentionallyClosed = true;
        if (this.reconnectTimer) {
            clearTimeout(this.reconnectTimer);
            this.reconnectTimer = null;
        }
        if (this.activeTurn) {
            this.cancelTurn(this.activeTurn.turnId);
        }
        if (this.ws) {
            try {
                this.ws.close(1000, 'Client disconnect');
            } catch {
                // Ignore
            }
            this.ws = null;
        }
        this.connectPromise = null;
        this._setStatus('disconnected');
    }
}

export default AssistantWsClient;
