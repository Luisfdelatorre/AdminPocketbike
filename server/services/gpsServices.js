// megaRastreoService.lite.js
import { Login, Url, ENGINE_COMMANDS, Transaction, GPS_SERVICES, ENGINESTOP, ENGINERESUME } from '../config/config.js';
const { MAX_RETRY_ATTEMPTS, RETRY_CHECK_INTERVAL } = Transaction;
import logger from '../config/logger.js';
import dayjs from '../config/dayjs.js';
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
        const config = {
            ...(company?.gpsConfig?.toObject ? company.gpsConfig.toObject() : company?.gpsConfig),
            groupId: company?.traccarGroupId || company?.gpsConfig?.groupId
        };
        if (this.serviceType === GPS_SERVICES.TRACCAR) {
            this.adapter = new MyTraccar(config); // inject company config
        } else {
            this.adapter = new MegaRastreo(config); // inject company config
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

    async fetchPreviousDayKmDevice(date = new Date(), options = null) {
        if (this.adapter && typeof this.adapter.fetchPreviousDayKmDevice === 'function') {
            return this.adapter.fetchPreviousDayKmDevice(date, options);
        }
        return [];
    }

    async fetchLatestOdometerMap() {
        if (this.adapter && typeof this.adapter.fetchLatestOdometerMap === 'function') {
            return this.adapter.fetchLatestOdometerMap();
        }
        return {};
    }

    async executeAndVerifyBatch(deviceIds, command, options = {}) {
        if (!deviceIds || deviceIds.length === 0) return {};
        let responseIds = [];
        try {
            responseIds = await this.adapter.sendCommands(deviceIds, command);
        } catch (error) {
            logger.error(`[GPS] Failed to send bulk ${command} commands:`, error);
            return responseIds;
        }
        return responseIds;
    }
    async sendEngineCommand(gpsId, command, options = {}) {
        let responseId;
        try {
            responseId = await this.adapter.changeEngineStatus(gpsId, command);
        } catch (error) {
            logger.error(`[GPS] Failed to send ${command} command:`, error);
            return false;
        }

        logger.info(`[GPS] ${command} command queued for ${gpsId}. Waiting for confirmation via websocket.`);

        // Return confirmed: true to indicate it was successfully queued
        return { confirmed: true, offline: false };
    }

    // Legacy alias
    async executeAndVerify(gpsId, command, options = {}) {
        return this.sendEngineCommand(gpsId, command, options);
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
