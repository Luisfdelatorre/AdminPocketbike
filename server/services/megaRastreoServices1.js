// megaRastreoService.lite.js
import { io } from 'socket.io-client';
import megaRastreoApi from '../api/megaRastreoApi1.js';
import megaRastreoWebApi from '../api/megaRastreoWebApi.js';
import { Login, Url, ENGINESTOP, ENGINERESUME, Transaction } from '../config/config.js';
const { MAX_RETRY_ATTEMPTS, RETRY_CHECK_INTERVAL } = Transaction;
import logger from '../config/logger.js';
import { Device } from '../models/Device.js';
import https from "https";

const HOST = "s1.megarastreo.co";
const PORT = 8443;
const NAMESPACE = "/position";
const URL = `https://${HOST}:${PORT}${NAMESPACE}`;




class MegaRastreoServiceLite {
    constructor() {
        this.socket = null;
        this.flushMap = {};
        this.flushTimer = null;
        this.subscribedImeis = [];
    }

    async fetchDevices(processedSize = 50) {
        let devices = [];
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
                    devices = devices.concat(objects);
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
        console.log(devices[0]);
        const webDevices = await megaRastreoWebApi.fetchDevices();
        console.log(`--Fetched ${Object.keys(webDevices).length} devices from Web`);

        const allDevices = devices.map(d => {
            console.log(webDevices[d.name.replace(/\s+/g, '')]);
            const { id, imei } = webDevices[d.name.replace(/\s+/g, '')];
            return {
                _id: d.deviceId,
                name: d.name.replace(/\s+/g, ''),
                model: d.model,
                category: d.icon,
                lastUpdate: d.interaction?.lastUpdatedTime,
                deviceId: d.deviceId,
                uniqueId: d.device.name,
                nequiNumber: d.phone,
                simCardNumber: d.simCard?.name,
                imei: imei,
                webDeviceId: id,
            };
        });
        return allDevices;
    }

    async stopDevice(mobileId) {
        return megaRastreoWebApi.stopDevice(mobileId);
    }

    async resumeDevice(mobileId) {
        return megaRastreoWebApi.resumeDevice(mobileId);
    }
    async checkDeviceStatus(commandId) {
        return megaRastreoWebApi.confirmCommand(commandId);
    }

    async getDetailedStatus(commandId) {
        // return megaRastreoWebApi.getDetailedStatus(commandId);
    }

    /**
     * Executes a hardware command and verifies its completion via retries.
     * Hardware only: This method does NOT touch the database.
     * @param {Number|String} webDeviceId - Platform numeric ID
     * @param {String} commandType - 'stop' or 'resume'
     * @param {Object} options - { maxAttempts, interval, onProgress }
     * @returns {Promise<Boolean>} - True if confirmed, false otherwise
     */
    async executeAndVerify(webDeviceId, commandType, options = {}) {
        const {
            maxAttempts = MAX_RETRY_ATTEMPTS,
            interval = RETRY_CHECK_INTERVAL,
            onProgress = null
        } = options;

        logger.info(`[GPS] Executing ${commandType} for device ${webDeviceId}...`);

        let responseId;
        try {
            if (commandType === ENGINESTOP) {
                responseId = await this.stopDevice(webDeviceId);
            } else if (commandType === ENGINERESUME) {
                responseId = await this.resumeDevice(webDeviceId);
            } else {
                throw new Error(`Invalid command type: ${commandType}`);
            }
        } catch (error) {
            logger.error(`[GPS] Failed to send ${commandType} command:`, error);
            return false;
        }

        for (let attempt = 1; attempt <= maxAttempts; attempt++) {
            // Initial delay or interval wait
            await new Promise(r => setTimeout(r, interval));

            if (onProgress) {
                onProgress({ attempt, maxAttempts, responseId, commandType });
            }

            try {
                const confirmed = await this.checkDeviceStatus(responseId);
                if (confirmed) {
                    logger.info(`[GPS] ${commandType} confirmed for ${webDeviceId} after ${attempt} attempts.`);
                    return true;
                }
            } catch (error) {
                logger.warn(`[GPS] Check attempt ${attempt} for ${webDeviceId} failed: ${error.message}`);
            }
        }

        logger.warn(`[GPS] ${commandType} command for ${webDeviceId} not confirmed after ${maxAttempts} attempts.`);
        return false;
    }

    updateDevice(pos) {
        const imei = pos.imei;
        if (!imei) return; // invalid data
        const ignition = (pos.motor === '1');
        const online = (pos.conectado === 'S');
        const rawDate = pos.sys_date || pos.fecha_gps;
        const lastUpdate = rawDate ? new Date(rawDate) : new Date();
        //  const speed = parseFloat(pos.velocidad || '0');
        // const lat = parseFloat(pos.y);
        // const lng = parseFloat(pos.x);
        // "batteryLevel" - if available in 'bateria' or 'battery' or 'pila'
        //const batteryLevel = online;
        const update = {
            ignition,
            lastUpdate
        };
        // 4. Merge into flushMap
        const existing = this.flushMap[imei] || {
            filter: { imei }, // assumes DB uses imei as deviceId
            update: {}
        };

        // Merge properties
        Object.assign(existing.update, update);

        this.flushMap[imei] = existing;
    }


    /*startAutoUpdate() {

        if (this.socket) return;//singleton
        console.log(`🔌 Conectando WS: ${BASE_URL}/positions`);
        this.socket = io(`${BASE_URL}/positions`, {
            query: { token: JWT },
            transports: ["websocket"],
            upgrade: false,
            reconnection: true,
            reconnectionDelayMax: 5000,
            timeout: 20000,
            // path: '/api/socket' // Important for Traccar
        });

        this.socket.on('connect', () => {
            console.log("transport:", this.socket.io.engine.transport.name);
            this.socket.emit('setFilter', {});
        });


        this.socket.on('disconnect', (reason) => {
            console.warn('⚠️ WS desconectado:', reason);
        });

        this.socket.on('connect_error', (err) => {
            console.error('❌ connect_error:', err?.message);
        });

        this.socket.on('error', (err) => {
            console.error('❌ socket error:', err);
        });
        let count = 0;
        this.socket.on('element', (pos) => {
            const now = new Date();
            const deviceTime = new Date(pos.deviceTime || pos.serverTime || now);
            const lagMinutes = (now - deviceTime) / 1000 / 60;


            this.updateDevice(pos);


            console.log(`Lag=${lagMinutes.toFixed(2)} min DeviceId=${pos.deviceId}, Time=${pos.deviceTime}, ServerTime=${pos.serverTime}, `);



        });

        this.flushTimer = setInterval(() => this.flushUpdates(), 1000);
    }*/
    async startAutoUpdate(imeis = null) {

        if (this.socket) return; // singleton

        // Fetch IMEIs if not provided
        if (imeis && Array.isArray(imeis)) {
            this.subscribedImeis = imeis;
        } else {
            const devices = await Device.find({}, 'imei').lean();
            this.subscribedImeis = devices.map(d => d.imei).filter(Boolean);
        }

        console.log(`🔌 Starting MegaRastreo WS for ${this.subscribedImeis.length} devices...`);

        const agent = new https.Agent({
            servername: Url.MegarastreoBase,
        });

        this.socket = io(`https://${Url.MegarastreoBase}:${Url.MegarastreoPort}${Url.MegarastreoNamespace}`,
            {
                agent,
                secure: true,
                rejectUnauthorized: false,
                path: "/socket.io",
                upgrade: true,
                reconnection: true,
                reconnectionDelayMax: 10000,
            });

        const subscribe = () => {
            if (!Array.isArray(this.subscribedImeis) || this.subscribedImeis.length === 0) return;
            this.socket.emit("login_client", this.subscribedImeis);
            console.log("➡️ login_client sent:", this.subscribedImeis.length);
        };

        this.socket.on("connect", () => {
            console.log("✅ connected:", this.socket.id);
            subscribe();
        });
        this.socket.io.on("reconnect", (attempt) => {
            console.log("✅ reconnected after attempts:", attempt);
            subscribe();
        });

        this.socket.on("trama", (track) => {
            this.updateDevice(track);

        });

        this.socket.on("connect_error", (err) => {
            console.log("⚠️ connect_error:", err?.message || err);
        });

        this.socket.on("disconnect", (reason) => {
            console.log("❌ disconnected:", reason);
        });

        this.flushTimer = setInterval(() => this.flushUpdates(), 5000);
    }

    stopAutoUpdate() {
        if (this.flushTimer) clearInterval(this.flushTimer);
        if (this.socket) this.socket.close();
    }

    // ==============================
    // 🔁 DATA PERSISTENCE
    // ==============================
    async flushUpdates() {
        const keys = Object.keys(this.flushMap);
        if (keys.length === 0) return;
        const batch = Object.values(this.flushMap);
        this.flushMap = {}; // Reset
        await Promise.allSettled(
            batch.map(({ filter, update }) =>
                Device.updateOne(filter, { $set: update })
            )
        );
    }
}

// 🔥 Singleton enforced here
export default new MegaRastreoServiceLite();
