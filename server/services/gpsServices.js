// megaRastreoService.lite.js
import { Login, Url, ENGINE_COMMANDS, Transaction, GPS_SERVICES } from '../config/config.js';
const { MAX_RETRY_ATTEMPTS, RETRY_CHECK_INTERVAL } = Transaction;
import logger from '../config/logger.js';
import { Company } from '../models/Company.js';
import dayjs from '../config/dayjs.js';

import companyService from './companyService.js';
import MyTraccar from '../adapters/traccar/traccarAdapter.js';
import MegaRastreo from '../adapters/megaRastreo/megaRastreoAdapter.js';

const HOST = "s1.megarastreo.co";
const PORT = 8443;
const NAMESPACE = "/position";
const URL = `https://${HOST}:${PORT}${NAMESPACE}`;

class GpsService {
    static calculateBatteryLevel(lastUpdate, maxBatteryLevel = 600) {
        const diffSeconds = dayjs().diff(dayjs(lastUpdate), 'second');
        if (diffSeconds > 600) return 0;
        return Math.max(0, ((maxBatteryLevel - diffSeconds) / maxBatteryLevel) * 100);
    }

    constructor(company) {
        this.flushMap = {};
        this.flushTimer = null;
        this.onFlush = null;
        this.serviceType = company?.gpsService || GPS_SERVICES.TRACCAR;
        if (this.serviceType === GPS_SERVICES.TRACCAR) {
            this.adapter = new MyTraccar(company?.gpsConfig); // inject company config
        } else {
            this.adapter = new MegaRastreo(company?.gpsConfig); // inject company config
        }
    }

    // Allows deviceServices to cluster connections by GPS server
    getAdapterKey() {
        if (this.adapter instanceof MyTraccar) {
            return `traccar_${this.adapter.host}`;
        }
        return `megarastreo_${Url.MegarastreoBase}`;
    }

    // Adds tracking numbers to an already running socket (Deduplication)
    addImeis(newImeis) {
        // Traccar WS does not filter by IMEI; it pushes all devices visible to the logged-in user.
        // MegaRastreo needs explicit IMEIs arrays appended.
        if (this.adapter && typeof this.adapter.addImeis === 'function') {
            this.adapter.addImeis(newImeis);
        } else if (this.adapter instanceof MyTraccar) {
            logger.info(`🔌 Ignoring addImeis for Traccar (streams all devices allowed by login).`);
        }
    }


    async getDeviceListByCompany(company) {
        return this.fetchDevices(company);
    }
    async fetchDevices(company) {
        // Resolve adapter via companyService — single creation point

        const devices = await this.adapter.fetchDevices();
        // Stamp company info onto each device
        return devices.map(d => ({
            ...d,
            ...(company?._id && { companyId: company._id }),
            ...(company?.name && { companyName: company.name }),
        }));
    }
    // These methods accept companyId and resolve the adapter themselves
    async stopDevice(gpsId) {
        return this.adapter.stopDevice(gpsId);
    }
    async resumeDevice(gpsId) {
        return this.adapter.resumeDevice(gpsId);
    }
    async getDetailedStatus(deviceId) {
        return this.adapter.getDetailedStatus(deviceId);
    }

    async checkDeviceStatus(gpsId) {
        return this.adapter.checkDeviceStatus(gpsId);
    }

    async executeAndVerifyBatch(deviceIds, command, options = {}) {
        const {
            maxAttempts = MAX_RETRY_ATTEMPTS,
            interval = RETRY_CHECK_INTERVAL,
            onProgress = null,
            onDeviceConfirmed = null, // Callback para streaming the status to DB early
        } = options;
        const commandType = command === ENGINE_COMMANDS.STOP ? 'STOP' : 'RESUME';
        if (!deviceIds || deviceIds.length === 0) return {};

        const adapter = this.adapter;
        let responseIds = [];

        try {
            if (command === ENGINE_COMMANDS.STOP) {
                responseIds = await adapter.stopDevices(deviceIds);
            } else if (command === ENGINE_COMMANDS.RESUME) {
                // Not strictly needed in bulk yet, but for symmetry we can implement it
                // responseIds = await adapter.resumeDevices(deviceIds);
                throw new Error(`Bulk resume not implemented yet`);
            } else {
                throw new Error(`Invalid command type: ${command}`);
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
    async executeAndVerify(gpsId, command, options = {}) {
        const {
            maxAttempts = MAX_RETRY_ATTEMPTS,
            interval = RETRY_CHECK_INTERVAL,
            onProgress = null
        } = options;

        let responseId;
        try {
            responseId = await this.adapter.changeEngineStatus(gpsId, command)
        } catch (error) {
            logger.error(`[GPS] Failed to send ${command} command:`, error);
            return false;
        }

        for (let attempt = 1; attempt <= maxAttempts; attempt++) {
            // Check confirmation
            try {
                // responseId sometimes comes back as a full command object from Traccar
                const cmdLogInfo = typeof responseId === 'object' ? (responseId.id || responseId.type) : responseId;
                logger.debug(`[GPS] Checking device status confirmation for: ${cmdLogInfo} (Attempt ${attempt}/${maxAttempts})`);
                const confirmed = await this.adapter.confirmCommand(responseId, gpsId, command);
                if (confirmed) {
                    logger.info(`[GPS] ${command} confirmed for ${gpsId} after ${attempt - 1} delayed attempts.`);
                    return true;
                }
            } catch (error) {
                logger.warn(`[GPS] Check attempt ${attempt} for ${gpsId} failed: ${error.message}`);
            }

            // Wait for next attempt if not the last one
            if (attempt < maxAttempts) {
                if (onProgress) {
                    onProgress({ attempt, maxAttempts, responseId, command });
                }
                await new Promise(r => setTimeout(r, interval));
            }
        }

        logger.warn(`[GPS] ${command} command for ${gpsId} not confirmed after ${maxAttempts} attempts.`);
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
    async startAutoUpdate(devices, onFlushCallback = null) {
        if (this.adapter && typeof this.adapter.startAutoUpdate === 'function') {
            await this.adapter.startAutoUpdate(devices, onFlushCallback);
        }
    }

    stopAutoUpdate() {
        this.adapter.stopAutoUpdate();

    }


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
export default GpsService;
