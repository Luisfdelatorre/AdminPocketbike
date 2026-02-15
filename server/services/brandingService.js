import path from 'path';
import { fileURLToPath } from 'url';
import { Device } from '../models/Device.js';
import { Company } from '../models/Company.js';
import fs from 'fs/promises';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

/**
 * Get company branding information based on device name
 * @param {string} deviceName - The device identifier
 * @returns {Promise<{displayName: string, logo: string}>}
 */
export async function getCompanyBranding(deviceName) {
    try {
        // Find device by name
        const device = await Device.findOne({ name: deviceName }).lean();

        let displayName = 'PocketBike';
        let logo = '/pocketbike_60x60.jpg';

        if (device && device.companyId) {
            // Get company branding
            const company = await Company.findById(device.companyId)
                .select('displayName logo')
                .lean();

            if (company) {
                displayName = company.displayName || 'PocketBike';
                logo = company.logo || '/pocketbike_60x60.jpg';
            }
        }

        return { displayName, logo };
    } catch (error) {
        console.error('Error fetching company branding:', error);
        // Return default branding on error
        return {
            displayName: 'PocketBike',
            logo: '/pocketbike_60x60.jpg'
        };
    }
}

/**
 * Inject branding data into HTML template
 * @param {string} htmlPath - Path to the HTML file
 * @param {Object} branding - Branding data {displayName, logo}
 * @returns {Promise<string>} - HTML with injected branding
 */
export async function injectBrandingIntoHTML(htmlPath, branding) {
    try {
        // Read HTML file
        let html = await fs.readFile(htmlPath, 'utf-8');

        // Create branding script
        const brandingScript = `
            <script>
                window.__COMPANY_BRANDING__ = {
                    displayName: ${JSON.stringify(branding.displayName)},
                    logo: ${JSON.stringify(branding.logo)}
                };
            </script>
        `;

        // Inject before closing </head> tag
        html = html.replace('</head>', `${brandingScript}</head>`);

        return html;
    } catch (error) {
        console.error('Error injecting branding into HTML:', error);
        throw error;
    }
}

/**
 * Get the path to the payment page HTML file
 * @returns {string} - Absolute path to the HTML file
 */
export function getPaymentPagePath() {
    return path.join(__dirname, '../../client/pay/index.html');
}
