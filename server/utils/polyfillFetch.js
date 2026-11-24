import crypto from 'node:crypto';
import v8 from 'node:v8';
import fetch, { Headers, Request, Response, FormData, File, Blob } from 'node-fetch';

// Ensure Web API globals exist in all Node.js (16/18/20+) and nodemon environments
if (typeof globalThis.Response === 'undefined') {
    globalThis.Response = Response;
}
if (typeof globalThis.Request === 'undefined') {
    globalThis.Request = Request;
}
if (typeof globalThis.Headers === 'undefined') {
    globalThis.Headers = Headers;
}
if (typeof globalThis.fetch === 'undefined') {
    globalThis.fetch = fetch;
}
if (typeof globalThis.FormData === 'undefined') {
    globalThis.FormData = FormData;
}
if (typeof globalThis.File === 'undefined') {
    globalThis.File = File;
}
if (typeof globalThis.Blob === 'undefined') {
    globalThis.Blob = Blob;
}

// Polyfill `structuredClone` (Node < 17) required by `@openai/agents` & `zod`
if (typeof globalThis.structuredClone !== 'function') {
    globalThis.structuredClone = (value) => {
        if (value === undefined || value === null || typeof value !== 'object') {
            return value;
        }
        try {
            return v8.deserialize(v8.serialize(value));
        } catch {
            return JSON.parse(JSON.stringify(value));
        }
    };
}

// Polyfill `globalThis.crypto` & `crypto.randomUUID` (Node < 19 global crypto / Node < 16.7)
const generateFallbackUUID = () => {
    if (typeof crypto.randomUUID === 'function') {
        return crypto.randomUUID();
    }
    const bytes = crypto.randomBytes(16);
    bytes[6] = (bytes[6] & 0x0f) | 0x40;
    bytes[8] = (bytes[8] & 0x3f) | 0x80;
    const hex = bytes.toString('hex');
    return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-${hex.slice(12, 16)}-${hex.slice(16, 20)}-${hex.slice(20, 32)}`;
};

if (typeof globalThis.crypto === 'undefined') {
    globalThis.crypto = {
        randomUUID: generateFallbackUUID,
        getRandomValues: (typedArray) => crypto.randomFillSync(typedArray),
    };
} else if (typeof globalThis.crypto.randomUUID !== 'function') {
    try {
        globalThis.crypto.randomUUID = generateFallbackUUID;
    } catch {
        // Read-only WebCrypto object fallback
    }
}

// Polyfill `CustomEvent` (Node < 18.7) required by `@openai/agents`
if (typeof globalThis.CustomEvent === 'undefined') {
    if (typeof globalThis.Event === 'function') {
        class CustomEventPolyfill extends globalThis.Event {
            constructor(type, eventInitDict = {}) {
                super(type, eventInitDict);
                this.detail = eventInitDict?.detail ?? null;
            }
        }
        globalThis.CustomEvent = CustomEventPolyfill;
    } else {
        class MinimalCustomEvent {
            constructor(type, eventInitDict = {}) {
                this.type = String(type);
                this.detail = eventInitDict?.detail ?? null;
                this.bubbles = Boolean(eventInitDict?.bubbles);
                this.cancelable = Boolean(eventInitDict?.cancelable);
                this.timeStamp = Date.now();
            }
        }
        globalThis.CustomEvent = MinimalCustomEvent;
    }
}

// Polyfill `AbortSignal.any` & `AbortSignal.timeout` (Node < 20.3 / < 17.3) required by `@openai/agents-core`
if (typeof globalThis.AbortSignal !== 'undefined') {
    if (typeof globalThis.AbortSignal.any !== 'function') {
        globalThis.AbortSignal.any = (signals) => {
            const controller = new AbortController();
            const list = Array.from(signals || []).filter(Boolean);
            for (const sig of list) {
                if (sig.aborted) {
                    controller.abort(sig.reason);
                    return controller.signal;
                }
            }
            const cleanups = [];
            const onAbort = (sig) => {
                for (const fn of cleanups) fn();
                cleanups.length = 0;
                controller.abort(sig.reason);
            };
            for (const sig of list) {
                const handler = () => onAbort(sig);
                sig.addEventListener('abort', handler, { once: true });
                cleanups.push(() => sig.removeEventListener('abort', handler));
            }
            return controller.signal;
        };
    }

    if (typeof globalThis.AbortSignal.timeout !== 'function') {
        globalThis.AbortSignal.timeout = (ms) => {
            const controller = new AbortController();
            const timer = setTimeout(() => {
                const err = new Error('The operation was aborted due to timeout');
                err.name = 'TimeoutError';
                controller.abort(err);
            }, ms);
            timer.unref?.();
            return controller.signal;
        };
    }
}

export { fetch, Headers, Request, Response, FormData, File, Blob };
