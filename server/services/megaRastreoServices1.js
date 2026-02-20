// megaRastreoService.lite.js
import { io } from 'socket.io-client';
import megaRastreoApi from '../api/megaRastreoApi1.js'; //api
import MegaRastreoApiWeb from '../api/megaRastreoWebApi.js';//web scraping
import { Login, Url, ENGINESTOP, ENGINERESUME, Transaction } from '../config/config.js';
const { MAX_RETRY_ATTEMPTS, RETRY_CHECK_INTERVAL } = Transaction;
import logger from '../config/logger.js';
import https from "https";
import { Company } from '../models/Company.js';

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
        this.onFlush = null;
    }

    async getDeviceListByCompany(company) {
        return this.fetchDevices(company);
    }

    async fetchDevices(company) {
        let devices = [];


        console.log(`--Starting full sync...`);

        /* ... existing commented out code ... */
        console.log(`--Fetched ${devices.length} devices from API`);
        const webDevices = await new MegaRastreoApiWeb(company).fetchDevices()
        console.log(`--Fetched ${Array.isArray(webDevices) ? webDevices.length : 0} devices from Web`);

        const allDevices = webDevices.map(d => {
            return {
                name: d.placa.replace(/\s+/g, ''),
                model: d.model,
                category: d.icono,
                lastUpdate: d.fecha_gps,
                imei: d.imei,
                megaDeviceId: d.id,//  deviceId fom we api 
                cutOff: 0,
            };
        });
        return allDevices;
    }

    async stopDevice(megaDeviceId, company) {
        return new MegaRastreoApiWeb(company).stopDevice(megaDeviceId);
    }

    async resumeDevice(megaDeviceId, company) {
        return new MegaRastreoApiWeb(company).resumeDevice(megaDeviceId);
    }
    async checkDeviceStatus(commandId, company) {
        return new MegaRastreoApiWeb(company).confirmCommand(commandId);
    }

    async getDetailedStatus(commandId) {
        // return megaRastreoWebApi.getDetailedStatus(commandId);
    }

    /**
     * Executes a hardware command and verifies its completion via retries.
     * Hardware only: This method does NOT touch the database.
     * @param {Number|String} deviceId - Platform numeric ID (megaDeviceId)
     * @param {String} commandType - 'stop' or 'resume'
     * @param {Object} options - { maxAttempts, interval, onProgress }
     * @returns {Promise<Boolean>} - True if confirmed, false otherwise
     */
    async executeAndVerify(deviceId, commandType, options = {}) {
        const {
            maxAttempts = MAX_RETRY_ATTEMPTS,
            interval = RETRY_CHECK_INTERVAL,
            onProgress = null,
            companyConfig = null
        } = options;

        logger.info(`[GPS] Executing ${commandType} for device ${deviceId}...`);

        let responseId;
        try {
            if (commandType === ENGINESTOP) {
                responseId = await this.stopDevice(deviceId, companyConfig);
            } else if (commandType === ENGINERESUME) {
                responseId = await this.resumeDevice(deviceId, companyConfig);
            } else {
                throw new Error(`Invalid command type: ${commandType}`);
            }
        } catch (error) {
            logger.error(`[GPS] Failed to send ${commandType} command:`, error);
            return false;
        }

        for (let attempt = 1; attempt <= maxAttempts; attempt++) {
            // Check confirmation
            try {
                const confirmed = await this.checkDeviceStatus(responseId, companyConfig);
                if (confirmed) {
                    logger.info(`[GPS] ${commandType} confirmed for ${deviceId} after ${attempt - 1} delayed attempts.`);
                    return true;
                }
            } catch (error) {
                logger.warn(`[GPS] Check attempt ${attempt} for ${deviceId} failed: ${error.message}`);
            }

            // Wait for next attempt if not the last one
            if (attempt < maxAttempts) {
                if (onProgress) {
                    onProgress({ attempt, maxAttempts, responseId, commandType });
                }
                await new Promise(r => setTimeout(r, interval));
            }
        }

        logger.warn(`[GPS] ${commandType} command for ${deviceId} not confirmed after ${maxAttempts} attempts.`);
        return false;
    }

    updateDevice(pos) {
        const imei = pos.imei;
        if (!imei) return; // invalid data
        // logger.debug(`[GPS] Updating device ${imei}...`, pos.motor, pos.fecha_gps);
        const ignition = (pos.motor === '1');
        const online = (pos.conectado === 'S');
        const rawDate = pos.fecha_gps || pos.sys_date;
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
    async startAutoUpdate(imeis, onFlushCallback = null) {

        if (this.socket) return; // singleton

        if (!imeis || !Array.isArray(imeis)) {
            logger.warn("⚠️ startAutoUpdate called without valid imeis array.");
            return;
        }

        this.subscribedImeis = imeis;
        this.onFlush = onFlushCallback;

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

        if (this.onFlush) {
            try {
                await this.onFlush(batch);
            } catch (error) {
                logger.error("[GPS] Error in onFlush callback:", error);
            }
        } else {
            logger.debug("[GPS] No onFlush callback provided, dropping batch.");
        }
    }
}

// 🔥 Singleton enforced here
export default new MegaRastreoServiceLite();
