/**
 * Dual-reply support for the AI assistant.
 *
 * Every plan carries two texts:
 *   - responseTemplate: what the chat SHOWS (precise, written).
 *   - speechTemplate:   what the assistant SAYS (friendly, voice-call style).
 *
 * The spoken variant is optional. When it is missing or untrustworthy, clients
 * derive speech from responseTemplate as before, so dropping it is always safe.
 *
 * Kept free of logger/DB imports so it can be unit tested in isolation.
 */

const PLACEHOLDER_REGEX = /\{\{\s*([a-zA-Z0-9_.-]+)\s*\}\}/g;
// Digit runs, allowing thousand/decimal separators inside them ("1.832.078", "3,5", "12 000").
const FIGURE_REGEX = /\d(?:[\d.,]|\s(?=\d{3}\b))*/g;

const collectPlaceholders = (text = '') =>
    new Set([...String(text).matchAll(PLACEHOLDER_REGEX)].map((m) => m[1]));

const collectFigures = (text = '') =>
    new Set(
        (String(text).replace(PLACEHOLDER_REGEX, ' ').match(FIGURE_REGEX) || [])
            .map((raw) => raw.replace(/[^\d]/g, ''))
            .filter(Boolean)
    );

/**
 * True when every figure and placeholder in `speech` is also present in `display`,
 * so the spoken reply can never claim data the written reply does not show.
 */
export const isSpeechConsistentWithDisplay = (speech = '', display = '') => {
    const displayPlaceholders = collectPlaceholders(display);
    for (const key of collectPlaceholders(speech)) {
        if (!displayPlaceholders.has(key)) return false;
    }
    const displayFigures = collectFigures(display);
    for (const figure of collectFigures(speech)) {
        if (!displayFigures.has(figure)) return false;
    }
    return true;
};

const withoutSpeech = (plan) => {
    if (!plan || typeof plan !== 'object' || !('speechTemplate' in plan)) return plan;
    const { speechTemplate: _dropped, ...rest } = plan;
    return rest;
};

/**
 * Cleans the spoken variant with the same humanizer used for the chat text and
 * drops it when it is empty or not backed by responseTemplate.
 */
export const reconcileSpeechTemplate = (plan, { humanize = (t) => t } = {}) => {
    if (!plan || typeof plan !== 'object') return plan;
    const raw = typeof plan.speechTemplate === 'string' ? plan.speechTemplate.trim() : '';
    if (!raw) return withoutSpeech(plan);
    const speech = String(humanize(raw) || '').trim();
    if (!speech || !isSpeechConsistentWithDisplay(speech, plan.responseTemplate || '')) {
        return withoutSpeech(plan);
    }
    return { ...plan, speechTemplate: speech };
};

/**
 * Applies a guardrail override (goal check, clarification, failure message).
 * When the override rewrites the written reply, the old spoken reply no longer
 * matches it and is discarded.
 */
export const applyPlanOverride = (previous, override) => {
    if (!override) return previous;
    if (override.responseTemplate !== previous?.responseTemplate) {
        return withoutSpeech(override);
    }
    return override;
};

export default {
    isSpeechConsistentWithDisplay,
    reconcileSpeechTemplate,
    applyPlanOverride,
};
