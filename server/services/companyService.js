
import { Company } from '../models/Company.js';
import WompiAdapter from '../adapters/wompiAdapter/wompiAdapter.js';
import { megaRastreoWebApiByCompany } from '../api/megaRastreoWebApi.js';
import logger from '../config/logger.js';

class CompanyService {
    constructor() {
        this.wompiAdapters = new Map();
    }

    /**
     * Get or create a WompiAdapter instance for the specified company.
     * @param {string} companyId 
     * @returns {Promise<WompiAdapter>}
     */
    async getWompiAdapter(companyId) {
        if (!companyId) {
            // Return default adapter if no companyId provided (compatible with existing logic)
            // Default config logic needs to be handled if WompiAdapter supports it (it seems to support null config)
            return new WompiAdapter(null);
        }

        if (this.wompiAdapters.has(companyId)) {
            return this.wompiAdapters.get(companyId);
        }

        try {
            const company = await Company.findById(companyId);
            let wompiConfig = null;
            if (company && company.wompiConfig) {
                wompiConfig = company.wompiConfig;
                logger.debug(`[CompanyService] Using custom Wompi config for company: ${company.name}`);
            }

            const adapter = new WompiAdapter(wompiConfig);
            this.wompiAdapters.set(companyId, adapter);
            return adapter;
        } catch (error) {
            logger.error(`[CompanyService] Error getting Wompi adapter for company ${companyId}:`, error);
            // Fallback to default or throw? Current logic falls back to default if company not found but here we might want to propagate error or return default
            return new WompiAdapter(null);
        }
    }

    /**
     * Get the GPS adapter for the specified company.
     * Delegates to megaRastreoWebApi factory.
     * @param {string} companyId 
     * @returns {object} GPS API adapter
     */
    getGpsAdapter(companyId) {
        // Just delegate to the existing factory which handles caching
        return megaRastreoWebApiByCompany(companyId);
    }
}

export default new CompanyService();
