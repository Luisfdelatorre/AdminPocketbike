import express from 'express';
import mongoose from 'mongoose';
import { getCompanyLogoAsset, DEFAULT_LOGO } from '../services/companyLogoService.js';

const router = express.Router();

/**
 * PUBLIC ROUTE — company logos are already shown on the public payment page.
 * GET /api/v1/branding/logo/:companyId?v=<version>
 */
export async function serveCompanyLogo(req, res) {
    const { companyId } = req.params;
    if (!mongoose.isValidObjectId(companyId)) {
        return res.status(400).json({ success: false, error: 'Invalid company id' });
    }

    const requestedVersion = typeof req.query.v === 'string' ? req.query.v : null;

    try {
        const asset = await getCompanyLogoAsset(companyId, requestedVersion);
        if (!asset) {
            res.setHeader('Cache-Control', 'public, max-age=300');
            return res.redirect(302, DEFAULT_LOGO);
        }

        const etag = `"${asset.version}"`;
        const immutable = requestedVersion === asset.version;
        res.setHeader('ETag', etag);
        res.setHeader('Cache-Control', immutable ? 'public, max-age=31536000, immutable' : 'public, max-age=300');
        res.setHeader('X-Content-Type-Options', 'nosniff');
        res.setHeader('Cross-Origin-Resource-Policy', 'cross-origin');
        // Neutralizes scripts if an SVG logo is opened directly in the browser.
        res.setHeader('Content-Security-Policy', "default-src 'none'; style-src 'unsafe-inline'; sandbox");

        if (req.headers['if-none-match'] === etag) {
            return res.status(304).end();
        }

        res.setHeader('Content-Type', asset.mime);
        res.setHeader('Content-Length', asset.buffer.length);
        return res.end(asset.buffer);
    } catch (error) {
        console.error('[branding] Error serving company logo:', error.message);
        return res.redirect(302, DEFAULT_LOGO);
    }
}

router.get('/logo/:companyId', serveCompanyLogo);

export default router;
