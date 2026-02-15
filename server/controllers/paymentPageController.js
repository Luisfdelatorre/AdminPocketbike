import * as brandingService from '../services/brandingService.js';

/**
 * Serve payment page with company branding injected
 * @param {Request} req - Express request object
 * @param {Response} res - Express response object
 */
export async function servePaymentPage(req, res) {
    try {
        const deviceName = req.params.id;

        // Get company branding for the device
        const branding = await brandingService.getCompanyBranding(deviceName);

        // Get HTML path
        const htmlPath = brandingService.getPaymentPagePath();

        // Inject branding into HTML
        const html = await brandingService.injectBrandingIntoHTML(htmlPath, branding);

        res.send(html);
    } catch (error) {
        console.error('Error serving payment page:', error);

        // Fallback to static file
        try {
            const htmlPath = brandingService.getPaymentPagePath();
            res.sendFile(htmlPath);
        } catch (fallbackError) {
            console.error('Error serving fallback payment page:', fallbackError);
            res.status(500).json({
                success: false,
                error: 'Failed to serve payment page'
            });
        }
    }
}

export default {
    servePaymentPage
};
