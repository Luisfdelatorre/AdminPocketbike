import crypto from 'crypto';
import mongoose from 'mongoose';
import { Company } from '../models/Company.js';

/**
 * Serves company logos stored as base64 data URIs (Company.logo) as cacheable
 * binary responses, so pages reference a short versioned URL instead of
 * inlining the full image several times. Nothing is written to disk and the
 * stored data is not modified.
 */
export const DEFAULT_LOGO = '/pocketbike_60x60.jpg';
export const LOGO_ROUTE = '/api/v1/branding/logo';
export const MAX_LOGO_BYTES = 2 * 1024 * 1024;

const ALLOWED_MIME = new Set(['image/png', 'image/jpeg', 'image/webp', 'image/gif', 'image/svg+xml']);
const CACHE_TTL_MS = 5 * 60 * 1000;
const CACHE_MAX_ENTRIES = 200;

const assetCache = new Map(); // companyId -> { asset, expiresAt }

export const isDataUri = (value) => typeof value === 'string' && value.startsWith('data:image/');

export const logoVersion = (logo) => crypto.createHash('sha1').update(String(logo)).digest('hex').slice(0, 12);

/**
 * Decode a base64 image data URI. Returns null for anything outside the
 * MIME whitelist, malformed payloads or images above MAX_LOGO_BYTES.
 */
export function parseLogoDataUri(logo) {
    if (!isDataUri(logo)) return null;
    const match = /^data:(image\/[a-z0-9.+-]+);base64,([A-Za-z0-9+/=\s]+)$/i.exec(logo);
    if (!match) return null;
    const mime = match[1].toLowerCase() === 'image/jpg' ? 'image/jpeg' : match[1].toLowerCase();
    if (!ALLOWED_MIME.has(mime)) return null;
    const buffer = Buffer.from(match[2].replace(/\s/g, ''), 'base64');
    if (buffer.length === 0 || buffer.length > MAX_LOGO_BYTES) return null;
    return { mime, buffer, version: logoVersion(logo) };
}

/**
 * URL to reference a company logo from HTML. Data URIs become a versioned
 * endpoint URL; plain paths/URLs are returned unchanged.
 */
const SAFE_LOGO_URL = /^(\/(?!\/)[^"'<>\s\\]*|https?:\/\/[^"'<>\s\\]+)$/i;

export function resolveLogoUrl(companyId, logo) {
    if (!logo || typeof logo !== 'string') return DEFAULT_LOGO;
    // Only site paths and http(s) URLs are injected as-is into the HTML template
    if (!isDataUri(logo)) return SAFE_LOGO_URL.test(logo) ? logo : DEFAULT_LOGO;
    if (!companyId || !mongoose.isValidObjectId(companyId) || !parseLogoDataUri(logo)) return DEFAULT_LOGO;
    return `${LOGO_ROUTE}/${companyId}?v=${logoVersion(logo)}`;
}

export function invalidateCompanyLogo(companyId) {
    if (companyId) assetCache.delete(String(companyId));
}

/**
 * Load the decoded logo for a company. `expectedVersion` (from ?v=) forces a
 * reload when the cached copy is older than the URL the page references.
 */
export async function getCompanyLogoAsset(companyId, expectedVersion = null) {
    const key = String(companyId);
    const cached = assetCache.get(key);
    if (cached && cached.expiresAt > Date.now() && (!expectedVersion || cached.asset?.version === expectedVersion)) {
        return cached.asset;
    }

    const company = await Company.findById(key).select('logo').lean();
    const asset = company ? parseLogoDataUri(company.logo) : null;

    if (assetCache.size >= CACHE_MAX_ENTRIES) {
        assetCache.delete(assetCache.keys().next().value);
    }
    assetCache.set(key, { asset, expiresAt: Date.now() + CACHE_TTL_MS });
    return asset;
}

export default {
    resolveLogoUrl,
    getCompanyLogoAsset,
    invalidateCompanyLogo,
    parseLogoDataUri,
};
