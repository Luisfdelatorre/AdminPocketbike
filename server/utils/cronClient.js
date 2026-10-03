import axios from 'axios';
import logger from '../config/logger.js';

const CRON_PORT = process.env.CRON_PORT || 8085;
const cronApi = axios.create({
    baseURL: `http://127.0.0.1:${CRON_PORT}`,
    headers: { 'Content-Type': 'application/json' }
});

/**
 * Sends a real-time HTTP reload trigger to microCronServer
 */
export const triggerCronReload = async () => {
    try {
        logger.info(`[CRON-CLIENT] Sending reload request to microCronServer on port ${CRON_PORT}...`);
        const res = await cronApi.post('/reload', {}, { timeout: 3000 });
        if (res.data?.success) {
            logger.info('[CRON-CLIENT] ✅ Triggered real-time reload on microCronServer');
        }
        return res.data;
    } catch (err) {
        logger.warn(`[CRON-CLIENT] ⚠️ microCronServer reload failed or unreachable on port ${CRON_PORT}: ${err.message}`);
        return null;
    }
};

/**
 * Sends a real-time HTTP request to microCronServer to execute cutoffDebtors for a company.
 * @param {string} companyId 
 * @param {object} [options={}] 
 * @returns {Promise<{results: Array, successCount: number, alreadyOffCount: number, failedCount: number}>}
 */
export const triggerCutoffDebtors = async (companyId, options = {}) => {
    try {
        logger.info(`[CRON-CLIENT] Sending cutoff-debtors request to microCronServer for company ${companyId}...`);
        const res = await cronApi.post('/cutoff-debtors', {
            companyId,
            forceAllDebtors: true,
            ...options
        }, {
            timeout: 60000
        });

        return res.data;
    } catch (err) {
        const errorMsg = err.response?.data?.error || err.message;
        logger.error(`[CRON-CLIENT] ❌ microCronServer cutoff-debtors failed: ${errorMsg}`);
        throw new Error(errorMsg);
    }
};

export default {
    triggerCronReload,
    triggerCutoffDebtors
};
