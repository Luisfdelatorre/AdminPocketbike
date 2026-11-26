import path from 'path';
import { fileURLToPath } from 'url';
import { Device } from '../models/Device.js';
import { Company } from '../models/Company.js';
import fs from 'fs/promises';
import { resolveLogoUrl } from './companyLogoService.js';

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
                // Base64 logos are served by a cacheable endpoint instead of being inlined in the HTML
                logo = resolveLogoUrl(device.companyId, company.logo);
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

import settingRepository from '../repositories/settingRepository.js';

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

        // Build status catalog for pre-injection (zero extra HTTP requests)
        let statusMap = {};
        try {
            const allConfigs = await settingRepository.getAllStatusConfigs();
            Object.entries(allConfigs).forEach(([k, cfg]) => {
                const item = {
                    badgeLabel: cfg.badgeLabel || cfg.label || k,
                    color: cfg.color || '#6b7280',
                    bg: cfg.bg || 'transparent'
                };
                statusMap[k] = item;
                if (cfg.badgeLabel && cfg.badgeLabel.toUpperCase() !== k.toUpperCase()) {
                    statusMap[cfg.badgeLabel.toUpperCase()] = item;
                }
            });
        } catch (err) {
            console.error('Error getting status configs for HTML injection:', err);
        }

        const initialData = {
            deviceId: deviceName,
            branding: { displayName, logo },
            statusMap
        };

        const injectedScript = `<script id="pb-injected-data">window.__INITIAL_DATA__ = ${JSON.stringify(initialData)};</script>`;
        if (html.includes('</head>')) {
            html = html.replace('</head>', `${injectedScript}\n</head>`);
        } else {
            html = `${injectedScript}\n${html}`;
        }

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
