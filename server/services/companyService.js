
import { Company } from '../models/Company.js';
import WompiAdapter from '../adapters/wompiAdapter/wompiAdapter.js';
import MegaRastreoApiWeb from '../api/megaRastreoWebApi.js';
import logger from '../config/logger.js';
import MyTraccar from './traccarService.js';

class CompanyService {
    constructor() {
        this.wompiAdapters = new Map();
        this.gpsAdapters = new Map(); // keyed by companyId
    }

    /**
     * Get or create a WompiAdapter instance for the specified company.
     * @param {string} companyId 
     * @returns {Promise<WompiAdapter>}
     */
    async getWompiAdapter(companyId) {
        if (!companyId) {
            return new WompiAdapter(null);
        }

        const key = String(companyId);
        if (this.wompiAdapters.has(key)) {
            return this.wompiAdapters.get(key);
        }

        try {
            const company = await Company.findById(companyId);
            const adapter = new WompiAdapter(company?.wompiConfig || null);
            this.wompiAdapters.set(key, adapter);
            logger.debug(`[CompanyService] Wompi adapter created for company: ${company?.name}`);
            return adapter;
        } catch (error) {
            logger.error(`[CompanyService] Error getting Wompi adapter for company ${companyId}:`, error);
            return new WompiAdapter(null);
        }
    }

    /**
     * Get the GPS adapter for the specified company.
     * Supports 'megarastreo' and 'traccar'.
     * @param {string} companyId 
     * @returns {Promise<object>} GPS API adapter
     */
    async getGpsAdapter(companyId) {
        // No companyId: return a default MegaRastreo instance (legacy fallback)
        if (!companyId) {
            return new MegaRastreoApiWeb();
        }

        // Return cached instance if already created for this company
        const key = String(companyId);
        if (this.gpsAdapters.has(key)) {
            return this.gpsAdapters.get(key);
        }

        // Not cached: load company config and create the right adapter
        try {
            const company = await Company.findById(companyId);
            const serviceType = company?.gpsService || 'megarastreo';

            let adapter;
            if (serviceType === 'traccar') {
                adapter = new MyTraccar(company); // inject company config
            } else {
                adapter = new MegaRastreoApiWeb(company); // inject company config
            }

            this.gpsAdapters.set(key, adapter);
            logger.debug(`[CompanyService] GPS adapter created for company ${company?.name} (${serviceType})`);
            return adapter;
        } catch (error) {
            logger.error(`[CompanyService] Error getting GPS adapter for company ${companyId}:`, error);
            return new MegaRastreoApiWeb(); // fallback to default
        }
    }
}

export default new CompanyService();
