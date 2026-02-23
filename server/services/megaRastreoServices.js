// megaRastreoService.lite.js
import { io } from 'socket.io-client';
import megaRastreoApi from '../api/megaRastreoApi1.js'; //api
import { Login, Url, ENGINESTOP, ENGINERESUME, Transaction } from '../config/config.js';
const { MAX_RETRY_ATTEMPTS, RETRY_CHECK_INTERVAL } = Transaction;
import logger from '../config/logger.js';
import https from "https";
import { Company } from '../models/Company.js';

import companyService from './companyService.js';

const HOST = "s1.megarastreo.co";
const PORT = 8443;
const NAMESPACE = "/position";
const URL = `https://${HOST}:${PORT}${NAMESPACE}`;




class GpsService {
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
        // Resolve adapter via companyService — single creation point
        const adapter = await companyService.getGpsAdapter(company?._id);
        const devices = await adapter.fetchDevices();
        // Stamp company info onto each device
        return devices.map(d => ({
            ...d,
            ...(company?._id && { companyId: company._id }),
            ...(company?.name && { companyName: company.name }),
        }));
    }
    // These methods accept companyId and resolve the adapter themselves
    async stopDevice(megaDeviceId, companyId) {
        const adapter = await companyService.getGpsAdapter(companyId);
        return adapter.stopDevice(megaDeviceId);
    }
    async resumeDevice(megaDeviceId, companyId) {
        console.log(`[TRACE-4] GpsService.resumeDevice | megaDeviceId=${megaDeviceId} companyId=${companyId}`);
        const adapter = await companyService.getGpsAdapter(companyId);
        console.log(`[TRACE-5] GpsService.resumeDevice → adapter.resumeDevice | megaDeviceId=${megaDeviceId}`);
        return adapter.resumeDevice(megaDeviceId);
    }
    async checkDeviceStatus(commandId, companyId) {
        const adapter = await companyService.getGpsAdapter(companyId);
        return adapter.confirmCommand(commandId);
    }
    async getDetailedStatus(deviceId, companyId) {
        const adapter = await companyService.getGpsAdapter(companyId);
        return adapter.getDetailedStatus(deviceId);
    }

    async executeAndVerifyBatch(deviceIds, commandType, options = {}) {
        const {
            maxAttempts = MAX_RETRY_ATTEMPTS,
            interval = RETRY_CHECK_INTERVAL,
            onProgress = null,
            onDeviceConfirmed = null, // Callback para streaming the status to DB early
            companyConfig = null   // companyId passed by callers
        } = options;

        if (!deviceIds || deviceIds.length === 0) return {};

        const adapter = await companyService.getGpsAdapter(companyConfig);
        let responseIds = [];

        try {
            if (commandType === ENGINESTOP) {
                responseIds = await adapter.stopDevices(deviceIds);
            } else if (commandType === ENGINERESUME) {
                // Not strictly needed in bulk yet, but for symmetry we can implement it
                // responseIds = await adapter.resumeDevices(deviceIds);
                throw new Error(`Bulk resume not implemented yet`);
            } else {
                throw new Error(`Invalid command type: ${commandType}`);
            }
        } catch (error) {
            logger.error(`[GPS] Failed to send bulk ${commandType} commands:`, error);
            // Return entirely false map
            return deviceIds.reduce((acc, id) => { acc[id] = false; return acc; }, {});
        }

        if (!responseIds || responseIds.length === 0) {
            return deviceIds.reduce((acc, id) => { acc[id] = false; return acc; }, {});
        }

        const commandToDeviceMap = {};
        for (let i = 0; i < responseIds.length; i++) {
            commandToDeviceMap[responseIds[i]] = deviceIds[i];
        }

        const finalStatusMap = deviceIds.reduce((acc, id) => { acc[id] = false; return acc; }, {});
        let pendingCommandIds = [...responseIds];

        for (let attempt = 1; attempt <= maxAttempts; attempt++) {
            if (pendingCommandIds.length === 0) break; // All confirmed

            try {
                const results = await adapter.confirmCommands(pendingCommandIds);

                // Track which commands succeeded in this attempt
                const newlyConfirmed = [];
                for (const cmdId of pendingCommandIds) {
                    if (results[cmdId]) {
                        newlyConfirmed.push(cmdId);
                        const devIdToMark = commandToDeviceMap[cmdId] || cmdId; // Fallback to id itself for Traccar
                        finalStatusMap[devIdToMark] = true;
                        logger.info(`[GPS] ${commandType} confirmed for device ${devIdToMark} after ${attempt - 1} delayed attempts.`);

                        // Fire the callback to allow caller to stream the DB update independently
                        if (onDeviceConfirmed) {
                            try {
                                onDeviceConfirmed(devIdToMark);
                            } catch (err) {
                                logger.error(`[GPS] Error in onDeviceConfirmed callback for device ${devIdToMark}:`, err);
                            }
                        }
                    }
                }

                // Remove newly confirmed from pending list
                pendingCommandIds = pendingCommandIds.filter(cmdId => !newlyConfirmed.includes(cmdId));

            } catch (error) {
                logger.warn(`[GPS] Bulk check attempt ${attempt} failed: ${error.message}`);
            }

            if (pendingCommandIds.length > 0 && attempt < maxAttempts) {
                if (onProgress) {
                    onProgress({ attempt, maxAttempts, pendingCount: pendingCommandIds.length });
                }
                await new Promise(r => setTimeout(r, interval));
            }
        }

        if (pendingCommandIds.length > 0) {
            logger.warn(`[GPS] ${commandType} commands not confirmed for ${pendingCommandIds.length} devices after ${maxAttempts} attempts.`);
        }

        return finalStatusMap;
    }
    async executeAndVerify(deviceId, commandType, options = {}) {
        const {
            maxAttempts = MAX_RETRY_ATTEMPTS,
            interval = RETRY_CHECK_INTERVAL,
            onProgress = null,
            companyConfig = null   // companyId passed by callers
        } = options;

        let responseId;
        try {
            if (commandType === ENGINESTOP) {
                responseId = await this.stopDevice(deviceId, companyConfig);
            } else if (commandType === ENGINERESUME) {
                console.log(`[TRACE-3b] executeAndVerify → resumeDevice | deviceId=${deviceId} companyConfig=${companyConfig}`);
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

// Singleton
export default new GpsService();
