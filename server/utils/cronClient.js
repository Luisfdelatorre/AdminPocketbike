import logger from '../config/logger.js';

/**
 * Sends a real-time HTTP reload trigger to microCronServer
 */
export const triggerCronReload = async () => {
    try {
        const cronUrl = process.env.CRON_SERVER_URL || 'http://127.0.0.1:8085';
        console.log(`[CRON-CLIENT] Sending reload request to ${cronUrl}/reload...`);
        const response = await fetch(`${cronUrl}/reload`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' }
        });
        if (response.ok) {
            console.log('[CRON-CLIENT] ✅ Triggered real-time reload on microCronServer (port 8085)');
            logger.info('[CRON-CLIENT] Triggered real-time reload on microCronServer (port 8085)');
        }
    } catch (err) {
        console.warn(`[CRON-CLIENT] ⚠️ microCronServer not reached on port 8085 (${err.message})`);
        logger.warn(`[CRON-CLIENT] microCronServer not reached on port 8085 (${err.message})`);
    }
};
