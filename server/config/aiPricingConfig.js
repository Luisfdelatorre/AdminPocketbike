/**
 * Decoupled OpenAI Model Pricing Configuration — UPay AI Assistant
 *
 * Maintained separately from system prompts and agent runtime logic.
 * Prices are expressed in USD per 1,000,000 tokens based on official OpenAI API pricing.
 *
 * Note on OpenAI reasoning & cache-write billing:
 * - In OpenAI Responses API, `output_tokens` ALREADY includes `output_tokens_details.reasoning_tokens`
 *   billed at the model's output rate (so reasoning tokens must NOT be double-billed on top of `outputTokens`).
 * - OpenAI automatic Prompt Caching has $0.00 cache-write surcharge (`cacheWritePer1M: 0`),
 *   while `cacheWritePer1M` is supported for providers/models that bill cache creation separately.
 */

export const PRICING_CATALOG_VERSION = '2026-11-openai-official-v1';

export const MODEL_PRICING_PER_1M_USD = Object.freeze({
    'gpt-4o-mini': Object.freeze({
        uncachedInputPer1M: 0.15,
        cachedInputPer1M: 0.075,
        outputPer1M: 0.6,
        cacheWritePer1M: 0.0,
    }),
    'gpt-4o': Object.freeze({
        uncachedInputPer1M: 2.5,
        cachedInputPer1M: 1.25,
        outputPer1M: 10.0,
        cacheWritePer1M: 0.0,
    }),
    'gpt-4.1-mini': Object.freeze({
        uncachedInputPer1M: 0.4,
        cachedInputPer1M: 0.1,
        outputPer1M: 1.6,
        cacheWritePer1M: 0.0,
    }),
    'gpt-4.1-nano': Object.freeze({
        uncachedInputPer1M: 0.1,
        cachedInputPer1M: 0.025,
        outputPer1M: 0.4,
        cacheWritePer1M: 0.0,
    }),
    'gpt-4.1': Object.freeze({
        uncachedInputPer1M: 2.0,
        cachedInputPer1M: 0.5,
        outputPer1M: 8.0,
        cacheWritePer1M: 0.0,
    }),
});

/**
 * Resolves pricing for a configured model name (normalizing dated snapshots such as
 * `gpt-4o-mini-2024-07-18` or fallback suffixes like `gpt-4o-mini (fallback)`),
 * with optional environment variable overrides.
 */
export const getModelPricingUSD = (modelName = 'gpt-4o-mini') => {
    const clean = String(modelName || 'gpt-4o-mini')
        .trim()
        .replace(/\s*\(fallback\)\s*$/i, '')
        .toLowerCase();

    let matched = MODEL_PRICING_PER_1M_USD[clean];
    if (!matched) {
        if (clean.startsWith('gpt-4o-mini')) matched = MODEL_PRICING_PER_1M_USD['gpt-4o-mini'];
        else if (clean.startsWith('gpt-4.1-nano')) matched = MODEL_PRICING_PER_1M_USD['gpt-4.1-nano'];
        else if (clean.startsWith('gpt-4.1-mini')) matched = MODEL_PRICING_PER_1M_USD['gpt-4.1-mini'];
        else if (clean.startsWith('gpt-4.1')) matched = MODEL_PRICING_PER_1M_USD['gpt-4.1'];
        else if (clean.startsWith('gpt-4o')) matched = MODEL_PRICING_PER_1M_USD['gpt-4o'];
        else matched = MODEL_PRICING_PER_1M_USD['gpt-4o-mini'];
    }

    const envUncached = Number(process.env.AI_PRICE_UNCACHED_PER_1M);
    const envCached = Number(process.env.AI_PRICE_CACHED_PER_1M);
    const envOutput = Number(process.env.AI_PRICE_OUTPUT_PER_1M);
    const envCacheWrite = Number(process.env.AI_PRICE_CACHE_WRITE_PER_1M);

    return {
        model: clean,
        pricingVersion: PRICING_CATALOG_VERSION,
        uncachedInputPer1M: Number.isFinite(envUncached) && envUncached >= 0 ? envUncached : matched.uncachedInputPer1M,
        cachedInputPer1M: Number.isFinite(envCached) && envCached >= 0 ? envCached : matched.cachedInputPer1M,
        outputPer1M: Number.isFinite(envOutput) && envOutput >= 0 ? envOutput : matched.outputPer1M,
        cacheWritePer1M: Number.isFinite(envCacheWrite) && envCacheWrite >= 0 ? envCacheWrite : matched.cacheWritePer1M,
    };
};

export default {
    PRICING_CATALOG_VERSION,
    MODEL_PRICING_PER_1M_USD,
    getModelPricingUSD,
};
