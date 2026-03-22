
import { Company } from '../models/Company.js';
import WompiAdapter from '../adapters/wompiAdapter/wompiAdapter.js';
import MegaRastreo from '../adapters/megaRastreo/megaRastreoAdapter.js';
import { User } from '../models/User.js';
import { Contract } from '../models/Contract.js';
import logger from '../config/logger.js';
import { GPS_SERVICES } from '../config/components/constants.js';
import GpsService from './gpsServices.js';

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
            const adapter = new WompiAdapter(null, company?.wompiConfig);
            this.wompiAdapters.set(key, adapter);
            logger.debug(`[CompanyService] Wompi adapter created for company: ${company?.name}`);
            return adapter;
        } catch (error) {
            logger.error(`[CompanyService] Error getting Wompi adapter for company ${companyId}:`, error);
            return new WompiAdapter(null);
        }
    }

    async getGpsAdapter(companyId) {


        // No companyId: return a default MegaRastreo instance (legacy fallback)
        if (!companyId) {
            return new GpsService(null);
        }

        // Return cached instance if already created for this company
        const key = String(companyId);
        if (this.gpsAdapters.has(key)) {
            return this.gpsAdapters.get(key);
        }

        // Not cached: load company config and create the right adapter
        try {
            const company = await Company.findById(companyId);
            const adapter = new GpsService(company);
            const serviceType = company?.gpsService || GPS_SERVICES.TRACCAR;
            this.gpsAdapters.set(key, adapter);
            logger.debug(`[CompanyService] GPS adapter created for company ${company?.name} (${serviceType})`);
            return adapter;
        } catch (error) {
            logger.error(`[CompanyService] Error getting GPS adapter for company ${companyId}:`, error);
            return new GpsService(null); // fallback to default
        }
    }
}

export default new CompanyService();
