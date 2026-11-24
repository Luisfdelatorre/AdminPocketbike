/**
 * Authenticated, Tenant-Isolated WebSocket Server — UPay AI Voice Assistant
 *
 * Mounts on HTTP `upgrade` for `/api/v1/ai/ws` and `/apinode/ai/ws`.
 * Guarantees (Reqs. 3, 4, 5, 10, 11):
 *  - Verifies JWT during WebSocket upgrade (`Sec-WebSocket-Protocol: upay.jwt.<token>`,
 *    `Authorization: Bearer <token>`, or `?token=`) using `authService.verifyToken`.
 *  - Binds each connection to its verified `{ userId, role, isSuperAdmin, companyId }` tenant context
 *    and re-checks token expiration + rate limits on every `start_turn`.
 *  - Emits strictly typed monotonic envelopes:
 *    `{ turnId, sequence, type, timestamp, payload }`.
 *  - Enforces turn-scoped `AbortController` cancellation on `cancel_turn`, new overlapping turns,
 *    or socket disconnect so stale text/audio never continues running.
 */

import { WebSocketServer } from 'ws';
import { validateChatRequest } from '../../client/src/services/voiceAssistant/schemaValidator.js';
import { streamAssistantTurn } from '../services/aiAssistantStreamService.js';
import { resetTenantSession } from '../services/aiAssistantAgentRuntime.js';

let cachedAuthService = null;
const defaultVerifyToken = async (token) => {
    if (!cachedAuthService) {
        const mod = await import('../services/authService.js');
        cachedAuthService = mod.default || mod;
    }
    return cachedAuthService.verifyToken(token);
};

const WS_PATHS = new Set(['/api/v1/ai/ws', '/apinode/ai/ws']);
const RATE_LIMIT_WINDOW_MS = 60 * 1000;
const RATE_LIMIT_MAX_TURNS = Number(process.env.AI_RATE_LIMIT_PER_MIN) || 30;
const HEARTBEAT_INTERVAL_MS = 25 * 1000;
const rateBuckets = new Map();

const isAiAssistantAllowed = () => {
    if (process.env.AI_ASSISTANT_ENABLED === 'false' || process.env.AI_DEMO_ENABLED === 'false') {
        return false;
    }
    return true;
};

const checkWsRateLimit = (key) => {
    const now = Date.now();
    if (rateBuckets.size > 500) {
        for (const [k, v] of rateBuckets.entries()) {
            if (now - v.windowStart > RATE_LIMIT_WINDOW_MS) rateBuckets.delete(k);
        }
    }
    const bucket = rateBuckets.get(key);
    if (!bucket || now - bucket.windowStart > RATE_LIMIT_WINDOW_MS) {
        rateBuckets.set(key, { windowStart: now, count: 1 });
        return true;
    }
    if (bucket.count >= RATE_LIMIT_MAX_TURNS) {
        return false;
    }
    bucket.count += 1;
    return true;
};

/**
 * Extracts JWT from WebSocket upgrade request without requiring query-string exposure.
 */
export const extractUpgradeToken = (req) => {
    const authHeader = req.headers?.authorization;
    if (typeof authHeader === 'string' && authHeader.startsWith('Bearer ')) {
        return authHeader.slice(7).trim();
    }

    const rawProtocols = req.headers?.['sec-websocket-protocol'];
    if (typeof rawProtocols === 'string') {
        const parts = rawProtocols.split(',').map((p) => p.trim());
        const jwtProto = parts.find((p) => p.startsWith('upay.jwt.'));
        if (jwtProto) {
            return jwtProto.slice('upay.jwt.'.length).trim();
        }
    }

    try {
        const parsedUrl = new URL(req.url || '/', 'http://localhost');
        const qToken = parsedUrl.searchParams.get('token');
        if (qToken) return qToken.trim();
    } catch {
        // Ignore malformed URL
    }

    return null;
};

const rejectUpgrade = (socket, statusCode = 401, statusText = 'Unauthorized') => {
    try {
        socket.write(
            `HTTP/1.1 ${statusCode} ${statusText}\r\n` +
                'Connection: close\r\n' +
                'Content-Type: text/plain; charset=utf-8\r\n\r\n' +
                `${statusText}\n`
        );
    } catch {
        // Ignore write errors
    } finally {
        try {
            socket.destroy();
        } catch {
            // Ignore destroy errors
        }
    }
};

/**
 * Attaches the assistant WebSocket server to an existing Node `http.Server` instance.
 *
 * @param {import('node:http').Server} httpServer
 * @param {{
 *   verifyTokenFn?: (token: string) => object,
 *   streamTurnFn?: typeof streamAssistantTurn,
 * }} options
 */
export const attachAssistantWebSocketServer = (
    httpServer,
    { verifyTokenFn = defaultVerifyToken, streamTurnFn = streamAssistantTurn } = {}
) => {
    if (!httpServer || typeof httpServer.on !== 'function') {
        throw new Error('attachAssistantWebSocketServer requires a valid http.Server instance');
    }

    const wss = new WebSocketServer({
        noServer: true,
        maxPayload: 64 * 1024,
        handleProtocols: (protocols) => {
            if (protocols.has('upay-auth')) return 'upay-auth';
            const first = protocols.values().next().value;
            return first || false;
        },
    });

    const heartbeatTimer = setInterval(() => {
        for (const ws of wss.clients) {
            if (ws.isAlive === false) {
                try {
                    ws.terminate();
                } catch {
                    // Ignore
                }
                continue;
            }
            ws.isAlive = false;
            try {
                ws.ping();
            } catch {
                // Ignore
            }
        }
    }, HEARTBEAT_INTERVAL_MS);
    heartbeatTimer.unref?.();

    const onUpgrade = async (req, socket, head) => {
        let pathname = '';
        try {
            pathname = new URL(req.url || '/', 'http://localhost').pathname;
        } catch {
            return;
        }

        if (!WS_PATHS.has(pathname)) {
            return; // Leave other upgrade handlers untouched
        }

        if (!isAiAssistantAllowed()) {
            rejectUpgrade(socket, 403, 'Forbidden');
            return;
        }

        const token = extractUpgradeToken(req);
        if (!token) {
            rejectUpgrade(socket, 401, 'Unauthorized');
            return;
        }

        let decoded;
        try {
            decoded = await verifyTokenFn(token);
        } catch {
            rejectUpgrade(socket, 401, 'Unauthorized');
            return;
        }

        if (!decoded || typeof decoded !== 'object' || decoded.deviceIdName) {
            // Block device PIN tokens from admin voice assistant WS
            rejectUpgrade(socket, 403, 'Forbidden');
            return;
        }

        const sessionAuth = Object.freeze({
            userId: decoded.userId || decoded.id || decoded.email || 'user',
            email: decoded.email || null,
            role: decoded.role || 'viewer',
            isSuperAdmin: decoded.isSuperAdmin === true,
            companyId: decoded.companyId ? String(decoded.companyId) : null,
            companyName: decoded.companyName || null,
            exp: typeof decoded.exp === 'number' ? decoded.exp : null,
        });

        wss.handleUpgrade(req, socket, head, (ws) => {
            ws.sessionAuth = sessionAuth;
            ws.isAlive = true;
            wss.emit('connection', ws, req);
        });
    };

    httpServer.on('upgrade', onUpgrade);

    wss.on('connection', (ws, req) => {
        if (process.env.NODE_ENV !== 'test') {
            let safePath = '/api/v1/ai/ws';
            try {
                safePath = new URL(req?.url || '/api/v1/ai/ws', 'http://localhost').pathname;
            } catch {
                // Keep default safe path
            }
            console.log(
                `${new Date().toISOString()} - WS ${safePath} connected (user: ${ws.sessionAuth?.userId || 'unknown'})`
            );
        }
        const activeTurns = new Map(); // turnId -> AbortController
        const turnSequences = new Map(); // turnId -> lastSequence

        ws.on('pong', () => {
            ws.isAlive = true;
        });

        const sendTypedEvent = (turnId, type, payload = {}) => {
            if (ws.readyState !== ws.OPEN) return false;
            const nextSeq = (turnSequences.get(turnId) || 0) + 1;
            turnSequences.set(turnId, nextSeq);
            const envelope = {
                turnId,
                sequence: nextSeq,
                type,
                timestamp: new Date().toISOString(),
                payload,
            };
            try {
                ws.send(JSON.stringify(envelope));
                return true;
            } catch {
                return false;
            }
        };

        const abortTurn = (turnId) => {
            const ctrl = activeTurns.get(turnId);
            if (ctrl) {
                activeTurns.delete(turnId);
                try {
                    ctrl.abort(new Error('TURN_CANCELLED'));
                } catch {
                    // Ignore abort errors
                }
            }
        };

        const abortAllTurns = () => {
            for (const [id, ctrl] of activeTurns.entries()) {
                activeTurns.delete(id);
                try {
                    ctrl.abort(new Error('CONNECTION_CLOSED'));
                } catch {
                    // Ignore
                }
            }
        };

        ws.on('message', async (rawData) => {
            let msg;
            try {
                msg = JSON.parse(String(rawData || ''));
            } catch {
                return;
            }

            if (!msg || typeof msg !== 'object') return;

            if (msg.type === 'ping') {
                if (ws.readyState === ws.OPEN) {
                    ws.send(JSON.stringify({ type: 'pong', timestamp: new Date().toISOString() }));
                }
                return;
            }

            if (msg.type === 'cancel_turn') {
                if (typeof msg.turnId === 'string' && msg.turnId) {
                    abortTurn(msg.turnId);
                } else {
                    abortAllTurns();
                }
                return;
            }

            if (msg.type === 'reset_conversation') {
                abortAllTurns();
                await resetTenantSession(ws.sessionAuth).catch(() => {});
                return;
            }

            if (msg.type !== 'start_turn') {
                return;
            }

            const turnId =
                typeof msg.turnId === 'string' && msg.turnId.trim()
                    ? msg.turnId.trim().slice(0, 80)
                    : `turn_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`;

            if (process.env.NODE_ENV !== 'test') {
                console.log(`${new Date().toISOString()} - WS start_turn (${turnId})`);
            }

            const auth = ws.sessionAuth;

            // 1. Re-verify JWT expiry on every turn (Req. 6 & 11)
            if (auth?.exp && Date.now() / 1000 >= auth.exp) {
                sendTypedEvent(turnId, 'turn_failed', {
                    code: 'SESSION_EXPIRED',
                    message: 'Tu sesión expiró. Inicia sesión nuevamente.',
                });
                try {
                    ws.close(4401, 'Session expired');
                } catch {
                    // Ignore
                }
                return;
            }

            // 2. Enforce tenant isolation if client payload explicitly asserts a companyId
            const requestedCompanyId = msg.payload?.companyId ? String(msg.payload.companyId) : null;
            if (
                requestedCompanyId &&
                auth?.companyId &&
                !auth.isSuperAdmin &&
                requestedCompanyId !== auth.companyId
            ) {
                sendTypedEvent(turnId, 'turn_failed', {
                    code: 'TENANT_MISMATCH',
                    message: 'La empresa activa cambió. Reconectando sesión del asistente.',
                });
                try {
                    ws.close(4403, 'Tenant mismatch');
                } catch {
                    // Ignore
                }
                return;
            }

            // 3. Per-user rate limit
            if (!checkWsRateLimit(auth?.userId || 'anon')) {
                sendTypedEvent(turnId, 'turn_failed', {
                    code: 'RATE_LIMITED',
                    message: 'Demasiadas consultas seguidas. Espera unos segundos e intenta de nuevo.',
                });
                return;
            }

            // 4. Validate chat payload deterministically
            const validation = validateChatRequest(msg.payload || {});
            if (!validation.success) {
                sendTypedEvent(turnId, 'turn_failed', {
                    code: 'INVALID_REQUEST',
                    message: validation.error || 'Solicitud inválida.',
                });
                return;
            }

            // 5. Cancel any stale in-flight turn on this socket before starting the new one (Req. 10)
            abortAllTurns();

            const abortController = new AbortController();
            activeTurns.set(turnId, abortController);

            try {
                await streamTurnFn({
                    turnId,
                    traceId: typeof msg.payload?.traceId === 'string' ? msg.payload.traceId : turnId,
                    viaVoice: Boolean(msg.payload?.viaVoice),
                    ...validation.data,
                    ttsOptions: msg.payload?.tts && typeof msg.payload.tts === 'object' ? msg.payload.tts : {},
                    upstreamMode: msg.payload?.upstreamMode === 'ws' ? 'ws' : undefined,
                    user: auth,
                    signal: abortController.signal,
                    emitEvent: (type, payload) => {
                        if (abortController.signal.aborted) return false;
                        return sendTypedEvent(turnId, type, payload);
                    },
                });
            } catch (err) {
                if (!abortController.signal.aborted) {
                    sendTypedEvent(turnId, 'turn_failed', {
                        code: 'INTERNAL_STREAM_ERROR',
                        message:
                            validation.data.lang === 'en-US'
                                ? 'The assistant could not complete the streaming turn.'
                                : 'El asistente no pudo completar la respuesta en tiempo real.',
                    });
                }
            } finally {
                activeTurns.delete(turnId);
                // Keep turnSequences bounded in memory
                if (turnSequences.size > 50) {
                    const oldestKey = turnSequences.keys().next().value;
                    if (oldestKey && oldestKey !== turnId) turnSequences.delete(oldestKey);
                }
            }
        });

        ws.on('close', () => {
            abortAllTurns();
            turnSequences.clear();
        });

        ws.on('error', () => {
            abortAllTurns();
        });
    });

    const close = () => {
        clearInterval(heartbeatTimer);
        httpServer.off?.('upgrade', onUpgrade);
        for (const ws of wss.clients) {
            try {
                ws.close(1001, 'Server shutting down');
            } catch {
                // Ignore
            }
        }
        wss.close();
    };

    return { wss, close };
};

export default {
    attachAssistantWebSocketServer,
    extractUpgradeToken,
};
