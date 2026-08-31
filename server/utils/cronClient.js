import http from 'http';
import logger from '../config/logger.js';

/**
 * Sends a real-time HTTP reload trigger to microCronServer using Node's built-in http module
 */
export const triggerCronReload = async () => {
    return new Promise((resolve) => {
        try {
            console.log('[CRON-CLIENT] Sending HTTP reload request to microCronServer on port 8085...');
            const req = http.request({
                hostname: '127.0.0.1',
                port: 8085,
                path: '/reload',
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Content-Length': 0
                },
                timeout: 2000
            }, (res) => {
                if (res.statusCode >= 200 && res.statusCode < 300) {
                    console.log('[CRON-CLIENT] ✅ Triggered real-time reload on microCronServer (port 8085)');
                    logger.info('[CRON-CLIENT] Triggered real-time reload on microCronServer (port 8085)');
                } else {
                    console.warn(`[CRON-CLIENT] ⚠️ microCronServer returned status ${res.statusCode}`);
                }
                resolve();
            });

            req.on('error', (err) => {
                console.warn(`[CRON-CLIENT] ⚠️ microCronServer not reached on port 8085 (${err.message})`);
                logger.warn(`[CRON-CLIENT] microCronServer not reached on port 8085 (${err.message})`);
                resolve();
            });

            req.on('timeout', () => {
                req.destroy();
                resolve();
            });

            req.end();
        } catch (err) {
            console.warn(`[CRON-CLIENT] ⚠️ Error triggering reload: ${err.message}`);
            resolve();
        }
    });
};
