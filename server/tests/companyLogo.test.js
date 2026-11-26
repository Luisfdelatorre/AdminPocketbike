import { describe, it, beforeEach, afterEach } from 'node:test';
import assert from 'node:assert/strict';
import { Company } from '../models/Company.js';
import {
    parseLogoDataUri,
    resolveLogoUrl,
    logoVersion,
    invalidateCompanyLogo,
    DEFAULT_LOGO,
    LOGO_ROUTE,
    MAX_LOGO_BYTES,
} from '../services/companyLogoService.js';
import { serveCompanyLogo } from '../routes/brandingRoutes.js';

const COMPANY_ID = '507f1f77bcf86cd799439011';
const PNG_BYTES = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);
const PNG_URI = `data:image/png;base64,${PNG_BYTES.toString('base64')}`;

const mockRes = () => {
    const res = { statusCode: 200, headers: {}, body: null, redirectTo: null };
    res.status = (code) => { res.statusCode = code; return res; };
    res.setHeader = (k, v) => { res.headers[k.toLowerCase()] = v; };
    res.json = (body) => { res.body = body; return res; };
    res.end = (body) => { res.body = body ?? null; return res; };
    res.redirect = (code, url) => { res.statusCode = code; res.redirectTo = url; return res; };
    return res;
};

describe('Company logo: data URI parsing and URLs', () => {
    it('decodes whitelisted images and rejects everything else', () => {
        const parsed = parseLogoDataUri(PNG_URI);
        assert.equal(parsed.mime, 'image/png');
        assert.deepEqual(parsed.buffer, PNG_BYTES);
        assert.equal(parsed.version, logoVersion(PNG_URI));

        assert.equal(parseLogoDataUri('data:image/jpg;base64,' + PNG_BYTES.toString('base64')).mime, 'image/jpeg');
        assert.equal(parseLogoDataUri('data:text/html;base64,PGgxPg=='), null);
        assert.equal(parseLogoDataUri('data:image/x-icon;base64,AAAA'), null);
        assert.equal(parseLogoDataUri('data:image/png;base64,'), null);
        assert.equal(parseLogoDataUri('data:image/png,<svg>'), null);
        const huge = `data:image/png;base64,${Buffer.alloc(MAX_LOGO_BYTES + 1).toString('base64')}`;
        assert.equal(parseLogoDataUri(huge), null);
    });

    it('turns data URIs into a short versioned URL and keeps plain paths', () => {
        const url = resolveLogoUrl(COMPANY_ID, PNG_URI);
        assert.equal(url, `${LOGO_ROUTE}/${COMPANY_ID}?v=${logoVersion(PNG_URI)}`);
        assert.ok(url.length < 80);
        assert.equal(resolveLogoUrl(COMPANY_ID, '/uploads/logo.png'), '/uploads/logo.png');
        assert.equal(resolveLogoUrl(COMPANY_ID, ''), DEFAULT_LOGO);
        assert.equal(resolveLogoUrl('not-an-id', PNG_URI), DEFAULT_LOGO);
        assert.equal(resolveLogoUrl(COMPANY_ID, 'data:text/html;base64,PGgxPg=='), DEFAULT_LOGO);
        assert.equal(resolveLogoUrl(COMPANY_ID, 'javascript:alert(1)'), DEFAULT_LOGO);
        assert.equal(resolveLogoUrl(COMPANY_ID, '/a.png" onerror="alert(1)'), DEFAULT_LOGO);
        assert.equal(resolveLogoUrl(COMPANY_ID, '//evil.example/x.png'), DEFAULT_LOGO);
        assert.equal(resolveLogoUrl(COMPANY_ID, 'https://cdn.example.com/logo.png'), 'https://cdn.example.com/logo.png');
    });
});

describe('Company logo: endpoint', () => {
    let originalFindById;
    let storedLogo;
    let lookups;

    beforeEach(() => {
        originalFindById = Company.findById;
        storedLogo = PNG_URI;
        lookups = 0;
        Company.findById = () => ({ select: () => ({ lean: async () => { lookups += 1; return storedLogo === null ? null : { logo: storedLogo }; } }) });
        invalidateCompanyLogo(COMPANY_ID);
    });

    afterEach(() => {
        Company.findById = originalFindById;
        invalidateCompanyLogo(COMPANY_ID);
    });

    it('serves binary with immutable cache when the version matches', async () => {
        const res = mockRes();
        await serveCompanyLogo({ params: { companyId: COMPANY_ID }, query: { v: logoVersion(PNG_URI) }, headers: {} }, res);
        assert.equal(res.statusCode, 200);
        assert.equal(res.headers['content-type'], 'image/png');
        assert.match(res.headers['cache-control'], /immutable/);
        assert.equal(res.headers['x-content-type-options'], 'nosniff');
        assert.match(res.headers['content-security-policy'], /sandbox/);
        assert.deepEqual(res.body, PNG_BYTES);
    });

    it('answers 304 for a matching ETag and uses the cache', async () => {
        const v = logoVersion(PNG_URI);
        await serveCompanyLogo({ params: { companyId: COMPANY_ID }, query: { v }, headers: {} }, mockRes());
        const res = mockRes();
        await serveCompanyLogo({ params: { companyId: COMPANY_ID }, query: { v }, headers: { 'if-none-match': `"${v}"` } }, res);
        assert.equal(res.statusCode, 304);
        assert.equal(lookups, 1, 'second request served from cache');
    });

    it('reloads when the page references a newer version and uses short cache for stale ones', async () => {
        await serveCompanyLogo({ params: { companyId: COMPANY_ID }, query: {}, headers: {} }, mockRes());
        storedLogo = `data:image/gif;base64,${Buffer.from('GIF89a').toString('base64')}`;
        const res = mockRes();
        await serveCompanyLogo({ params: { companyId: COMPANY_ID }, query: { v: logoVersion(storedLogo) }, headers: {} }, res);
        assert.equal(res.headers['content-type'], 'image/gif');
        assert.equal(lookups, 2);

        const stale = mockRes();
        await serveCompanyLogo({ params: { companyId: COMPANY_ID }, query: { v: 'oldversion00' }, headers: {} }, stale);
        assert.equal(stale.headers['cache-control'], 'public, max-age=300');
    });

    it('redirects to the default logo when there is no usable image and rejects bad ids', async () => {
        storedLogo = '/pocketbike_60x60.jpg';
        const res = mockRes();
        await serveCompanyLogo({ params: { companyId: COMPANY_ID }, query: {}, headers: {} }, res);
        assert.equal(res.statusCode, 302);
        assert.equal(res.redirectTo, DEFAULT_LOGO);

        const bad = mockRes();
        await serveCompanyLogo({ params: { companyId: '../../etc' }, query: {}, headers: {} }, bad);
        assert.equal(bad.statusCode, 400);
    });
});
