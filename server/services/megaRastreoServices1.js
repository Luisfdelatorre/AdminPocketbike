// megaRastreoService.lite.js
import { io } from 'socket.io-client';
import megaRastreoApi from '../api/megaRastreoApi1.js';
import { Login, Url } from '../config/config.js';
import logger from '../config/logger.js';

class MegaRastreoServiceLite {
    constructor() {
        this.jwtToken = Login.MEGARASTREO.jwtToken;
        this.socket = null;
        this.flushMap = new Map();
        this.flushTimer = null;
    }

    async fetchDevices(processedSize = 50) {
        let allDevices = [];
        let page = 1;
        let hasMore = true;

        console.log(`--Starting full sync...`);

        while (hasMore) {
            try {
                const params = { $size: processedSize, $page: page };
                const res = await megaRastreoApi.getDeviceList(params);
                const objects = res.data.objects || [];

                if (objects.length > 0) {
                    console.log(`--Fetched page ${page}: ${objects.length} devices`);
                    allDevices = allDevices.concat(objects);
                    page++;
                } else {
                    console.log('--No more devices found.');
                    hasMore = false;
                }
            } catch (error) {
                console.error(`Error fetching page ${page}:`, error.message);
                hasMore = false; // Stop on error
            }
        }
        return allDevices;
    }

    async stopDevice(mobileId) {
        return megaRastreoApi.stopDevice(mobileId);
    }

    async resumeDevice(mobileId) {
        return megaRastreoApi.resumeDevice(mobileId);
    }

    startAutoUpdate() {
        if (this.socket) return;//singleton

        this.socket = io(`${Url.Base}/positions`, {
            transports: ['websocket'],
            query: { token: this.jwtToken },
            reconnection: true,
        });

        this.socket.on('connect', () => {
            logger.info('[MEGA] WS connected');
            this.socket.emit('setFilter', {});
        });

        this.socket.on('reconnect', () => {
            logger.info('[MEGA] WS reconnected');
            this.socket.emit('setFilter', {});
        });

        this.socket.on('element', (pos) => this.updateDevice(pos));

        this.flushTimer = setInterval(() => this.flushUpdates(), 1000);
    }

    stopAutoUpdate() {
        if (this.flushTimer) clearInterval(this.flushTimer);
        if (this.socket) this.socket.close();
    }

    updateDevice(pos) {
        const deviceId = pos?.deviceId;
        if (!deviceId) return;
        const cutOff = pos?.attributes?.blocked === true || pos?.attributes?.status === 133;
        const ignition = !!pos?.sensors?.ignition;
        const batteryLevel = pos?.attributes?.batteryLevel ?? undefined;
        const lastUpdate = new Date(pos.deviceTime || pos.serverTime || Date.now());

        const update = {
            cutOff,
            ignition,
            lastUpdate,
        };

        // solo setea batteryLevel si viene
        if (batteryLevel !== undefined) {
            update.batteryLevel = batteryLevel;
        }

        this.flushMap.set(deviceId, {
            filter: { deviceId },
            update,
        });
    }


    async flushUpdates() {
        if (!this.flushMap.size) return;

        const batch = [...this.flushMap.values()];
        this.flushMap.clear();

        await Promise.allSettled(
            batch.map(({ filter, update }) =>
                this.Device.updateOne(filter, { $set: update })
            )
        );
    }
}

// 🔥 Singleton enforced here
export default new MegaRastreoServiceLite();
