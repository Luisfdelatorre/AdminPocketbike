import { CAPABILITIES, CAPABILITY_TYPES } from './capabilities.js';

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
 * Local intent matcher with accent normalization and fuzzy typo tolerance.
 * Resolves navigation and help locally without network round-trips, and
 * pre-matches query capabilities before calling the demo endpoint.
 *
 * @param {string} text
 * @returns {{ capabilityId: string|null, capability: object|null, score: number, resolvedLocally: boolean }}
 */
export const matchLocalIntent = (text = '') => {
    const normalized = normalizeText(text);
    if (!normalized) {
        return { capabilityId: null, capability: null, score: 0, resolvedLocally: false };
    }

    const padded = ` ${normalized} `;
    const inputTokens = normalized.split(' ').filter(Boolean);
    let best = null;

    for (const capability of CAPABILITIES) {
        let capScore = 0;

        for (const rawKeyword of capability.keywords) {
            const kw = normalizeText(rawKeyword);
            if (!kw) continue;
            const kwTokens = kw.split(' ');

            // Exact phrase match weighs the number of words in the keyword
            if (padded.includes(` ${kw} `)) {
                capScore += kwTokens.length * 1.25;
                continue;
            }

            // Fuzzy token-by-token match for typos (e.g. "cnotratos", "recuado")
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
            if (allMatched) {
                capScore += matchedWeight;
            }
        }

        if (capScore > 0 && (!best || capScore > best.score)) {
            best = { capability, score: capScore };
        }
    }

    if (!best) {
        return { capabilityId: null, capability: null, score: 0, resolvedLocally: false };
    }

    const resolvedLocally =
        best.capability.type === CAPABILITY_TYPES.NAVIGATE ||
        best.capability.type === CAPABILITY_TYPES.HELP;

    return {
        capabilityId: best.capability.id,
        capability: best.capability,
        score: Number(best.score.toFixed(2)),
        resolvedLocally,
    };
};

export default { matchLocalIntent, normalizeText };
