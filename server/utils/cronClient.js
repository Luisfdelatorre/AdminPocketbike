import logger from '../config/logger.js';

/**
 * Sends a real-time HTTP reload trigger to microCronServer
 */
export const triggerCronReload = async () => {
    try {
        const cronUrl = process.env.CRON_SERVER_URL || 'http://127.0.0.1:8085';
        const response = await fetch(`${cronUrl}/reload`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' }
        });
        if (response.ok) {
            logger.info('[CRON-CLIENT] Triggered real-time reload on microCronServer (port 8085)');
        }
    } catch (err) {
        logger.warn(`[CRON-CLIENT] microCronServer not reached on port 8085 (${err.message})`);
    }
};
