import { Transaction, ENGINERESUME, ENGINESTOP, Url } from '../config/config.js';
import { getDeviceList, getDayKmDevice, changeEngineStatus, getPositions } from './traccarApi.js';
import { CommandBody } from '../utils/CommandBody.js';
import logger from '../config/logger.js';

class MyTraccar {
    constructor(p) {
        this.JSESSIONID = '';
        this.asyncUpdate;
    }

    fetchDeviceList = async () => {
        const res = await getDeviceList();
        return res.data;
    };
    fetchPreviousDayKmDevice = async (now) => {
        //const now = new Date();
        const start = new Date(now);
        start.setDate(now.getDate() - 1); // Subtract one day to get yesterday's date
        const end = new Date(start);
        end.setHours(23, 59, 59, 999); // Set time to the end of the day

        // Convert to the required ISO string format with UTC offset
        const from = start.toISOString().replace('Z', '+00:00');
        const to = end.toISOString().replace('Z', '+00:00');

        try {
            const response = await getDayKmDevice({
                groupId: 1,
                from: from,
                to: to,
            });

            return response.data;
        } catch (error) {
            console.error('Error fetching data:', error);
            throw error;
        }
    };

    resumeDevice = async (deviceId, name = '') => {
        logger.info('ER', { deviceId, name });
        return await this.changeEngineStatus(deviceId, ENGINERESUME);
    };

    stopDevice = async (deviceId, name = '') => {
        logger.info('ES', { deviceId, name });
        return await this.changeEngineStatus(deviceId, ENGINESTOP);
    };

    resumeDeviceWithRetry = async (deviceId, name = '') => {
        logger.info('ER-RETRY', { deviceId, name });
        await this.changeEngineStatus(deviceId, ENGINERESUME);
        return await this.checkDeviceWithRetries(deviceId, 1);
    };

    stopDeviceWithRetry = async (deviceId, name = '') => {
        logger.info('ES-RETRY', { deviceId, name });
        await this.changeEngineStatus(deviceId, ENGINESTOP);
        return await this.checkDeviceWithRetries(deviceId, 0);
    };

    checkDeviceWithRetries = async (traccarId, expectedStatus) => {
        const maxAttempts = Transaction.MAX_RETRY_ATTEMPTS || 12; // Default 1 min (5s * 12)
        const checkInterval = Transaction.RETRY_CHECK_INTERVAL || 5000;

        for (let attempt = 1; attempt <= maxAttempts; attempt++) {
            await new Promise(r => setTimeout(r, checkInterval));
            try {
                const currentStatus = await this.checkDeviceStatus(traccarId);
                logger.info(`[DEVICE] Check ${traccarId} attempt ${attempt}: status=${currentStatus}, expected=${expectedStatus}`);

                if (currentStatus === expectedStatus) {
                    return true;
                }
            } catch (error) {
                logger.warn(`[DEVICE] Check ${traccarId} attempt ${attempt} failed:`, error.message);
            }
        }
        return false;
    };

    changeEngineStatus = async (id, command) => {
        try {
            const commandBody = new CommandBody(command, id, 0);
            const commandResponse = await changeEngineStatus(commandBody);
            return commandResponse.data[0];
        } catch (error) {
            console.error('Error changing engine status:', error);
            throw error;
        }
    };

    checkDeviceStatus = async (id) => {
        try {
            const res = await getPositions({ id });
            if (res.data && res.data.length > 0) {
                // Use the last position in the array (latest)
                const position = res.data[res.data.length - 1];
                logger.info(`Checking position time: ${position.deviceTime} | Status: ${position.attributes.status}`);

                if (position.attributes.status !== undefined) {
                    // 4294966271 (FFFFFBFF) => bit 10 is 0. Assuming 0 = Stopped/Cut, 1 = Active.
                    return (position.attributes.status >> 10) & 1;
                }
                return 1;
            }
            return 1; // Default to active if not found
        } catch (e) {
            logger.error('Error checking device status', e);
            return 1;
        }
    };

    getDetailedStatus = async (deviceId) => {
        try {
            const res = await getPositions({ deviceId });
            if (res.data && res.data.length > 0) {
                const position = res.data[res.data.length - 1];
                const lastUpdate = new Date(position.deviceTime);
                const diff = Date.now() - lastUpdate.getTime();
                // Check online (within configured timeout or default 3 mins)
                const online = diff < Transaction.DEVICE_ONLINE_TIMEOUT;
                // Check ignition
                let ignition = position.attributes.ignition;
                // Also get the 'active' status (not cut)
                const cutOff = ((position.attributes.status >> 27) & 1) == 0;
                // Get battery level
                let batteryLevel = 100;
                if (position.attributes.batteryLevel !== undefined) {
                    batteryLevel = position.attributes.batteryLevel;
                }
                return {
                    online,
                    cutOff,
                    ignition,
                    batteryLevel,
                    lastUpdate: position.deviceTime
                };
            }
            return { online: false, ignition: false, cutOff: false, batteryLevel: 0, lastUpdate: null };
        } catch (e) {
            logger.error('Error getting detailed status', e);
            return { online: false, ignition: false, cutOff: false, batteryLevel: 0, lastUpdate: null };
        }
    };
    changePaidStatus = (d) => {
        this.requestPut(Url.Devices + '/' + d.id, d.getData());
    };

}
export default new MyTraccar();


