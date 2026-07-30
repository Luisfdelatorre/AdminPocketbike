import path from 'path';
import { fileURLToPath } from 'url';
import { Device } from '../models/Device.js';
import { Company } from '../models/Company.js';
import fs from 'fs/promises';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const brandingCache = new Map();
const CACHE_TTL = 5 * 60 * 1000; // 5 minutes

/**
 * Get company branding information based on device name
 * @param {string} deviceName - The device identifier
 * @returns {Promise<{displayName: string, logo: string}>}
 */
export async function getCompanyBranding(deviceName) {
    const cached = brandingCache.get(deviceName);
    if (cached && (Date.now() - cached.timestamp < CACHE_TTL)) {
        return cached.data;
    }

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

        const data = { displayName, logo };
        brandingCache.set(deviceName, { data, timestamp: Date.now() });
        return data;
    } catch (error) {
        console.error('Error fetching company branding:', error);
        // Return default branding on error
        return {
            displayName: 'PocketBike',
            logo: '/pocketbike_60x60.jpg'
        };
    }
}

let cachedTemplate = null;

export async function injectBrandingIntoHTML(htmlPath, branding, deviceName = '') {
    try {
        if (!cachedTemplate || process.env.NODE_ENV !== 'production') {
            cachedTemplate = await fs.readFile(htmlPath, 'utf-8');
        }
        let html = cachedTemplate;

        // Replace all instances of device ID placeholder
        html = html.replace(/{{DEVICE_ID}}/g, deviceName);

        // Resolve branding details or fallbacks
        const displayName = branding?.displayName || 'PocketBike';
        const logo = branding?.logo || '/pocketbike_60x60.jpg';

        // Replace all instances of company title placeholder
        html = html.replace(/{{COMPANY_NAME}}/g, displayName);
        // Replace all instances of company logo placeholder
        html = html.replace(/{{COMPANY_LOGO}}/g, logo);

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
