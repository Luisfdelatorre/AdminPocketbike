/**
 * Deterministic Local Command Matcher — UPay AI Voice Assistant (Section 10)
 *
 * Evaluates whether a Spanish or English utterance can be resolved deterministically
 * on the client BEFORE calling the backend `/api/v1/ai/chat` endpoint.
 *
 * Returns one of three states:
 *  - `MATCH`: Clear, unambiguous command (e.g. "Go to payments", "Open contracts",
 *    "Clear filters", "Show help"). Includes a validated `plan` ready for `dispatchActionPlan`.
 *  - `AMBIGUOUS`: Command verb with multiple plausible targets (e.g. "Open that", "Filter those").
 *  - `NO_MATCH`: Complex/contextual query or a question containing command keywords
 *    (e.g. "Why can't I open contracts?", "¿Por qué no puedo abrir contratos?").
 */

import { MODULES, MODULE_IDS, CAPABILITIES, CAPABILITY_TYPES } from './capabilities.js';

export const MATCH_STATUS = Object.freeze({
    MATCH: 'MATCH',
    NO_MATCH: 'NO_MATCH',
    AMBIGUOUS: 'AMBIGUOUS',
});

export const normalizeText = (text = '') =>
    String(text)
        .toLowerCase()
        .normalize('NFD')
        .replace(/[\u0300-\u036f]/g, '')
        .replace(/[^a-z0-9ñ\s]/g, ' ')
        .replace(/\s+/g, ' ')
        .trim();

const levenshtein = (a, b) => {
    if (a === b) return 0;
    const m = a.length;
    const n = b.length;
    if (!m) return n;
    if (!n) return m;

    const dp = Array.from({ length: m + 1 }, (_, i) => i);
    for (let j = 1; j <= n; j++) {
        let prev = dp[0];
        dp[0] = j;
        for (let i = 1; i <= m; i++) {
            const temp = dp[i];
            const cost = a[i - 1] === b[j - 1] ? 0 : 1;
            dp[i] = Math.min(dp[i] + 1, dp[i - 1] + 1, prev + cost);
            prev = temp;
        }
    }
    return dp[m];
};

const tokenMatches = (inputToken, keywordToken) => {
    if (inputToken === keywordToken) return 1.0;
    if (keywordToken.length >= 5) {
        const dist = levenshtein(inputToken, keywordToken);
        const maxDist = keywordToken.length >= 7 ? 2 : 1;
        if (dist <= maxDist) return 0.78;
    }
    return 0;
};

/**
 * Patterns that indicate a meta-question, troubleshooting question, negation or conditional
 * statement containing command keywords (e.g., "Why can't I open contracts?").
 * These MUST NOT trigger navigation or filter actions locally.
 */
const QUESTION_OR_NEGATION_GUARD =
    /\b(why|por que|porque|how do i|como puedo|can t|cannot|no puedo|no me deja|error|problem|problema|what happens if|que pasa si|should i|deberia|don t|do not|no abras|no vayas)\b/;

/**
 * Patterns that indicate multi-turn pronouns or ambiguous references without an explicit subject.
 */
const AMBIGUOUS_REFERENCE_GUARD =
    /^(?:open|abre|abrir|filter|filtra|filtrar|show|muestra|mostrar)\s+(?:it|them|those|that|esto|eso|esos|esas|aquello|aquellos)$/;

const NAV_VERB_PREFIX =
    /^(?:go to|open|navigate to|take me to|show me|ir a|ve a|abre|abrir|mostrar|muestrame|llevar a|llevame a)\s+(.+)$/;

const CLEAR_FILTER_PATTERNS = [
    'clear filters',
    'clear the filters',
    'clear filter',
    'reset filters',
    'limpiar filtros',
    'limpia los filtros',
    'quitar filtros',
    'quita los filtros',
    'borrar filtros',
    'restablecer filtros',
];

const HELP_PATTERNS = [
    'help',
    'show help',
    'what can you do',
    'available commands',
    'ayuda',
    'mostrar ayuda',
    'que puedes hacer',
    'que sabes hacer',
    'comandos disponibles',
    'opciones',
];

const NATURAL_MODULE_TARGET_ES = Object.freeze({
    dashboard: 'el panel principal',
    devices: 'las motos',
    summary: 'el resumen de pagos',
    contracts: 'los contratos',
    payments: 'los pagos',
    invoices: 'las facturas',
    alerts: 'las alertas',
    commands: 'el historial de comandos',
    reports: 'los reportes',
    'company-invoices': 'la facturación de empresas',
    settings: 'la configuración',
    users: 'los usuarios',
    companies: 'las empresas',
});

const MODULE_NAV_MAP = [
    { module: 'dashboard', phrases: ['dashboard', 'the dashboard', 'el dashboard', 'inicio', 'panel principal', 'home'] },
    { module: 'devices', phrases: ['devices', 'motorcycles', 'dispositivos', 'motos', 'motocicletas', 'lista de motos', 'pagina de motos', 'flota'] },
    { module: 'summary', phrases: ['payment summary', 'summary', 'resumen de pagos', 'el resumen de pagos', 'resumen semanal', 'resumen'] },
    { module: 'contracts', phrases: ['contracts', 'contratos', 'los contratos'] },
    { module: 'payments', phrases: ['payments', 'pagos', 'los pagos'] },
    { module: 'invoices', phrases: ['invoices', 'facturas', 'las facturas'] },
    { module: 'alerts', phrases: ['alerts', 'alerts center', 'alertas', 'centro de alertas', 'el centro de alertas'] },
    { module: 'commands', phrases: ['commands', 'command history', 'comandos', 'historial de comandos', 'el historial de comandos'] },
    { module: 'reports', phrases: ['reports', 'reportes', 'informes'] },
    { module: 'company-invoices', phrases: ['company invoices', 'facturacion empresas', 'facturas de empresas'] },
    { module: 'settings', phrases: ['settings', 'configuracion', 'ajustes'] },
    { module: 'users', phrases: ['users', 'usuarios'] },
    { module: 'companies', phrases: ['companies', 'empresas'] },
];

const matchModuleTarget = (rawTarget) => {
    const cleanTarget = normalizeText(rawTarget);
    if (!cleanTarget) return null;

    // 1. Exact phrase match
    for (const entry of MODULE_NAV_MAP) {
        if (entry.phrases.includes(cleanTarget)) {
            return entry.module;
        }
    }

    // 2. Single-word typo-tolerant match for explicit module names (e.g. "cnotratos", "factruas")
    const tokens = cleanTarget.split(' ');
    if (tokens.length === 1 && tokens[0].length >= 5) {
        for (const entry of MODULE_NAV_MAP) {
            for (const phrase of entry.phrases) {
                if (!phrase.includes(' ') && tokenMatches(tokens[0], phrase) > 0) {
                    return entry.module;
                }
            }
        }
    }

    return null;
};

/**
 * Evaluates a user utterance deterministically.
 *
 * @param {string} text
 * @param {{ currentModule?: string, lang?: 'es-CO'|'en-US' }} options
 * @returns {{
 *   status: 'MATCH' | 'NO_MATCH' | 'AMBIGUOUS',
 *   plan: object|null,
 *   capabilityId: string|null,
 *   capability: object|null,
 *   score: number,
 *   resolvedLocally: boolean,
 *   clarificationPrompt?: string,
 * }}
 */
export const matchLocalIntent = (text = '', { currentModule = 'dashboard', lang = 'es-CO' } = {}) => {
    const normalized = normalizeText(text);
    const isEn =
        lang === 'en-US' ||
        /\b(go to|open|clear|show help|what can you do|filter|those|them)\b/i.test(text);

    if (!normalized) {
        return {
            status: MATCH_STATUS.NO_MATCH,
            plan: null,
            capabilityId: null,
            capability: null,
            score: 0,
            resolvedLocally: false,
        };
    }

    // 1. Reject questions/negations that merely mention command keywords ("Why can't I open contracts?")
    if (QUESTION_OR_NEGATION_GUARD.test(normalized)) {
        return {
            status: MATCH_STATUS.NO_MATCH,
            plan: null,
            capabilityId: null,
            capability: null,
            score: 0,
            resolvedLocally: false,
        };
    }

    // 2. Detect ambiguous pronoun commands ("Open that", "Filter those")
    if (AMBIGUOUS_REFERENCE_GUARD.test(normalized)) {
        return {
            status: MATCH_STATUS.AMBIGUOUS,
            plan: null,
            capabilityId: null,
            capability: null,
            score: 0,
            resolvedLocally: false,
            clarificationPrompt: isEn
                ? 'Could you specify which section or record you want to use?'
                : '¿Podrías especificar a qué sección o registro te refieres?',
        };
    }

    // 3. Help command ("Show help", "¿Qué puedes hacer?", "Ayuda")
    if (HELP_PATTERNS.includes(normalized)) {
        return {
            status: MATCH_STATUS.MATCH,
            plan: {
                scope: 'current_screen',
                targetModule: currentModule,
                actions: [{ name: 'showHelp', params: { topic: 'general' } }],
                responseTemplate: '',
                needsClarification: false,
            },
            capabilityId: 'help',
            capability: CAPABILITIES.find((c) => c.id === 'help') || null,
            score: 2.5,
            resolvedLocally: true,
        };
    }

    // 4. Clear filters command ("Clear filters", "Clear the filters", "Limpiar filtros")
    if (CLEAR_FILTER_PATTERNS.includes(normalized)) {
        return {
            status: MATCH_STATUS.MATCH,
            plan: {
                scope: 'current_screen',
                targetModule: currentModule,
                actions: [{ name: 'clearFilters', params: { module: currentModule } }],
                responseTemplate: isEn ? 'Done, I cleared the filters.' : 'Quité los filtros.',
                needsClarification: false,
            },
            capabilityId: 'clearFilters',
            capability: null,
            score: 2.5,
            resolvedLocally: true,
        };
    }

    // 5. Explicit navigation command ("Go to payments", "Open contracts", "Abre contratos", "Ir a facturas")
    const navMatch = normalized.match(NAV_VERB_PREFIX);
    const candidateTarget = navMatch ? navMatch[1] : normalized;

    // Only treat as pure navigation if the user didn't also specify filter adjectives ("rejected", "suspended", "active", "overdue")
    const hasFilterQualifier =
        /\b(rejected|approved|pending|failed|suspended|overdue|active|completed|cancelled|yesterday|last week|rechazados|aprobados|pendientes|apagadas|apagados|morosos|activos|activas|abiertas|ayer|semana)\b/.test(
            normalized
        );

    if (!hasFilterQualifier) {
        const targetMod = matchModuleTarget(candidateTarget);
        if (targetMod && MODULE_IDS.includes(targetMod)) {
            const modDef = MODULES[targetMod];
            const capId = `nav.${targetMod}`;
            const cap = CAPABILITIES.find((c) => c.id === capId) || {
                id: capId,
                type: CAPABILITY_TYPES.NAVIGATE,
                route: modDef.route,
                module: targetMod,
                label: modDef.label,
            };
            const scope = targetMod === currentModule ? 'current_screen' : 'other_screen';
            const naturalTargetEs = NATURAL_MODULE_TARGET_ES[targetMod] || modDef.label.toLowerCase();

            return {
                status: MATCH_STATUS.MATCH,
                plan: {
                    scope,
                    targetModule: targetMod,
                    actions: [{ name: 'navigate', params: { module: targetMod } }],
                    responseTemplate: isEn
                        ? `Done, showing ${modDef.labelEn.toLowerCase()}.`
                        : `Listo, ya te muestro ${naturalTargetEs}.`,
                    needsClarification: false,
                },
                capabilityId: cap.id,
                capability: cap,
                score: 2.5,
                resolvedLocally: true,
            };
        }
    }

    // 6. All other requests (filtered queries, contextual follow-ups, searches) go through `/api/v1/ai/chat`
    // We still compute legacy `capabilityId` when matching a demo query keyword for backward compatibility
    let bestDemoCap = null;
    const padded = ` ${normalized} `;
    const inputTokens = normalized.split(' ').filter(Boolean);

    for (const capability of CAPABILITIES) {
        if (capability.type !== CAPABILITY_TYPES.QUERY) continue;
        let capScore = 0;
        for (const rawKeyword of capability.keywords) {
            const kw = normalizeText(rawKeyword);
            if (!kw) continue;
            const kwTokens = kw.split(' ');
            if (padded.includes(` ${kw} `)) {
                capScore += kwTokens.length * 1.25;
                continue;
            }
            let matchedWeight = 0;
            let allMatched = true;
            for (const kwTok of kwTokens) {
                let bestTok = 0;
                for (const inTok of inputTokens) {
                    const s = tokenMatches(inTok, kwTok);
                    if (s > bestTok) bestTok = s;
                }
                if (bestTok === 0) {
                    allMatched = false;
                    break;
                }
                matchedWeight += bestTok;
            }
            if (allMatched) capScore += matchedWeight;
        }
        if (capScore > 0 && (!bestDemoCap || capScore > bestDemoCap.score)) {
            bestDemoCap = { capability, score: capScore };
        }
    }

    return {
        status: MATCH_STATUS.NO_MATCH,
        plan: null,
        capabilityId: bestDemoCap?.capability.id ?? null,
        capability: bestDemoCap?.capability ?? null,
        score: bestDemoCap ? Number(bestDemoCap.score.toFixed(2)) : 0,
        resolvedLocally: false,
    };
};

export default {
    MATCH_STATUS,
    matchLocalIntent,
    normalizeText,
};
