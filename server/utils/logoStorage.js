import fs from 'fs/promises';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const LOGOS_DIR = path.resolve(__dirname, '../../uploads/logos');

const MIME_TO_EXT = {
    'jpeg': '.jpg',
    'jpg': '.jpg',
    'png': '.png',
    'webp': '.webp',
    'svg+xml': '.svg',
    'gif': '.gif'
};

/**
 * Saves a base64 image data URI to disk as a static file in uploads/logos/.
 * If the input is already a URL or relative path, it is returned untouched.
 *
 * @param {string} identifier - Unique ID (e.g. companyId or slug)
 * @param {string} logoData - Base64 data URI or existing path/URL
 * @returns {Promise<string>} The relative path to serve (e.g. '/uploads/logos/6a49...png')
 */
export async function saveLogoToFile(identifier, logoData) {
    if (!logoData || logoData === '/pocketbike_60x60.jpg') {
        return '/pocketbike_60x60.jpg';
    }

    if (typeof logoData === 'string' && logoData.startsWith('data:image/')) {
        try {
            const matches = logoData.match(/^data:image\/([a-zA-Z0-9+.-]+);base64,(.+)$/);
            if (!matches) {
                console.warn(`[logoStorage] Invalid base64 image data for ${identifier}`);
                return '/pocketbike_60x60.jpg';
            }

            const rawMime = matches[1].toLowerCase();
            const base64Content = matches[2];
            const ext = MIME_TO_EXT[rawMime] || '.png';
            const fileName = `${identifier}${ext}`;
            const targetPath = path.join(LOGOS_DIR, fileName);

            await fs.mkdir(LOGOS_DIR, { recursive: true });
            const buffer = Buffer.from(base64Content, 'base64');
            await fs.writeFile(targetPath, buffer);

            return `/uploads/logos/${fileName}`;
        } catch (err) {
            console.error(`[logoStorage] Failed to save logo to file for ${identifier}:`, err);
            return '/pocketbike_60x60.jpg';
        }
    }

    return logoData;
}

export default {
    saveLogoToFile
};

