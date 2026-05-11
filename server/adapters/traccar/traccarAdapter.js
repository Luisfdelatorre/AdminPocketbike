import WebSocket from 'ws';
import { Transaction, ENGINERESUME, ENGINESTOP, Url, Login, ENGINE_COMMANDS } from '../../config/config.js';
import { CommandBody } from '../../utils/CommandBody.js';
import logger from '../../config/logger.js';
import TraccarApi from './traccarApi.js';

// ─────────────────────────────────────────────
//  Constants
// ─────────────────────────────────────────────
const DEFAULT_MAX_RETRY_ATTEMPTS = 12;       // 12 × 5 s = 60 s
const DEFAULT_RETRY_CHECK_INTERVAL = 5_000;
const DEFAULT_DEVICE_ONLINE_TIMEOUT = 180_000;
const WS_RECONNECT_DELAY = 20_000;



class MyTraccar {

    // ─────────────────────────────────────────
    //  Constructor — credentials from DB via config
    // ─────────────────────────────────────────
    constructor(config = {}) {
        this.host = config.host || Url.Traccar;
        this.user = config.user || Login.Traccar.user;
        this.password = config.password || Login.Traccar.password;

        // TraccarApi owns the axios instance + credentials
        this._api = new TraccarApi({
            host: this.host,
            user: this.user,
            password: this.password,
        });

        this._ws = null;
        this.JSESSIONID = null;
        this._positionCallback = null; // set by GpsService for auto-update
        this._onFlushCallback = null;
        this.flushMap = {};
        this.flushTimer = null;
    }

    // ─────────────────────────────────────────
    //  Device queries
    // ─────────────────────────────────────────
    fetchDevices = async (params = {}) => {
        const res = await this._api.getDeviceList(params);
        return res.data
            .filter(d => d.attributes?.DailyPayment === true)
            .map(d => ({ ...d, gpsId: d.id }));
    };

    fetchPreviousDayKmDevice = async (now = new Date()) => {
        const start = new Date(now);
        start.setDate(start.getDate() - 1);
        const end = new Date(start);
        end.setHours(23, 59, 59, 999);

        const res = await this._api.getDayKmDevice({
            groupId: 1,
            from: start.toISOString().replace('Z', '+00:00'),
            to: end.toISOString().replace('Z', '+00:00'),
        });
        return res.data;
    };

    getDetailedStatus = async (deviceId) => {
        const empty = { online: false, ignition: false, cutOff: false, batteryLevel: 0, lastUpdate: null };
        try {
            //  await this.initWebSocket(); // Ensure auth cookie is present
            const res = await this._api.getPositions({ deviceId });
            if (!res.data?.length) return empty;

            const pos = res.data[res.data.length - 1];
            const online = (Date.now() - new Date(pos.deviceTime).getTime()) <
                (Transaction.DEVICE_ONLINE_TIMEOUT || DEFAULT_DEVICE_ONLINE_TIMEOUT);
            return {
                online,
                cutOff: ((pos.attributes.status >> 27) & 1) === 0,
                ignition: pos.attributes.ignition,
                batteryLevel: pos.attributes.batteryLevel ?? 100,
                lastUpdate: pos.deviceTime,
            };
        } catch (e) {
            logger.error('Error getting detailed status', e);
            return empty;
        }
    };

    // ─────────────────────────────────────────
    //  Engine commands
    // ─────────────────────────────────────────
    changeEngineStatus = async (deviceId, command) => {
        logger.info('ER', { deviceId, command });
        const commandType = command === ENGINE_COMMANDS.STOP ? ENGINESTOP : ENGINERESUME;
        return await this._sendCommand(deviceId, commandType);
    };
    resumeDevice = async (deviceId, name = '') => {
        logger.info('ER', { deviceId, name });
        return await this._sendCommand(deviceId, ENGINERESUME);
    };

    stopDevice = async (deviceId, name = '') => {
        logger.info('ES', { deviceId, name });
        return await this._sendCommand(deviceId, ENGINESTOP);
    };

    resumeDeviceWithRetry = async (deviceId, name = '') => {
        logger.info('ER-RETRY', { deviceId, name });
        await this._sendCommand(deviceId, ENGINERESUME);
        return await this._checkDeviceWithRetries(deviceId, 1);
    };

    stopDeviceWithRetry = async (deviceId, name = '') => {
        logger.info('ES-RETRY', { deviceId, name });
        await this._sendCommand(deviceId, ENGINESTOP);
        return await this._checkDeviceWithRetries(deviceId, 0);
    };

    stopDevices = async (deviceIds = []) => {
        if (!deviceIds.length) return [];
        logger.info('ES (Bulk)', { deviceIds });

        const results = await Promise.all(
            deviceIds.map(async id => {
                try { await this.stopDevice(id); return id; }
                catch (e) { logger.error(`Error stopping device ${id}`, e); return null; }
            })
        );
        return results.filter(Boolean);
    };

    // ─────────────────────────────────────────
    //  Status checks & confirmations
    // ─────────────────────────────────────────
    checkDeviceStatus = async (deviceId, command) => {
        try {
            // await this.initWebSocket(); // Ensure auth cookie is present
            const res = await this._api.getPositions({ deviceId });
            if (!res.data?.length) return 1;
            const pos = res.data[res.data.length - 1];

            const status = pos?.attributes?.status || null;
            const result = pos?.attributes?.result || null;
            let data = {
                status: pos.attributes?.status,
                ignition: pos.attributes?.ignition ?? false,
                lastUpdate: pos.deviceTime,
                batteryLevel: pos.attributes?.batteryLevel ?? null,
            }
            if (status != undefined) {
                data.cutOff = ((status <= 255 && (status & 128) !== 0) || (status > 255 && ((status >> 27) & 1) == 0));
            }
            if (result == "Cut off the fuel supply: Success!") {
                data.cutOff = true;
            }

            return data;
        } catch (e) {
            logger.error('Error checking device status', e);
            return 1;
        }
    };

    confirmCommand = async (responseId, deviceId, command) => {
        const data = await this.checkDeviceStatus(deviceId);
        return data.cutOff == !command;
    };

    confirmCommands = async (commandIds = [], command) => {
        if (!commandIds.length) return {};

        const entries = await Promise.all(
            commandIds.map(async id => {
                try { return [id, await this.confirmCommand(id, id, command)]; }
                catch (e) { logger.error(`Error confirming command ${id}`, e); return [id, false]; }
            })
        );
        return Object.fromEntries(entries);
    };

    // ─────────────────────────────────────────
    //  WebSocket
    // ─────────────────────────────────────────
    startAutoUpdate = async (devices, onFlushCallback) => {
        console.log('startAutoUpdate', onFlushCallback);
        if (onFlushCallback) this._onFlushCallback = onFlushCallback;
        try {
            const res = await this._api.createSession();
            const cookie = res.headers['set-cookie'];
            this.JSESSIONID = Array.isArray(cookie) ? cookie.join('; ') : cookie;
        } catch (e) {
            logger.error('WebSocket auth failed', e.message);
            setTimeout(() => this.startAutoUpdate(), WS_RECONNECT_DELAY);
            return;
        }
        this.openWebSocket();
    };


    // ─────────────────────────────────────────
    //  Private helpers
    // ─────────────────────────────────────────
    openWebSocket = () => {
        let wsUrl = this.host.match(/^https?:\/\//)
            ? this.host.replace(/^http/, 'ws') + '/api/socket'
            // If the host has no schema, default to wss://
            : `wss://${this.host}/api/socket`;

        const ws = new WebSocket(wsUrl, [], { headers: { Cookie: this.JSESSIONID } });

        ws.on('open', () => logger.info('WebSocket connected'));
        ws.on('message', this.onMessage);
        ws.on('error', (err) => { logger.error('WebSocket error', err); ws.close(); });
        ws.on('close', async () => {
            logger.warn(`WebSocket closed — fetching positions manually before reconnect...`);
            await this._performFallbackFetch();
            setTimeout(() => this.startAutoUpdate(), WS_RECONNECT_DELAY);
        });
        this._ws = ws;
    };

    onMessage = (raw) => {
        try {
            const data = JSON.parse(raw);
            if (data.devices) {
                //this.updatePositions(data);
            }
            if (data.positions) {
                this.updatePositions(data.positions);
            }
            if (data.events) {
                //  if (!features.disableEvents) {
                // dispatch(eventsActions.add(data.events));
                // }
                //setEvents(data.events);
            }
            if (data.logs) {
                //  dispatch(sessionActions.updateLogs(data.logs));
            }
        } catch (error) {
            logger.warn('Unparseable WS message:', raw?.toString(), error.message);
        }
    };

    updatePositions = (data) => {
        if (!data) return;

        const standardBatch = [];
        const positions = Array.isArray(data) ? data : [data];

        for (const p of positions) {
            if (!p?.deviceId) continue;
            const status = p?.attributes?.status || null;
            const result = p?.attributes?.result || null;
            let updateData = {
                filter: { gpsId: p.deviceId },
                ignition: p.attributes?.ignition ?? false,
                lastUpdate: p.deviceTime ? new Date(p.deviceTime) : new Date(),
                batteryLevel: p.attributes?.batteryLevel ?? null,
            }
            if (status != undefined) {
                updateData.cutOff = ((status <= 255 && (status & 128) !== 0) || (status > 255 && ((status >> 27) & 1) == 0));
            }
            if (result == "Cut off the fuel supply: Success!") {
                updateData.cutOff = true;
            }

            standardBatch.push(updateData);
        }

        this._onFlushCallback(standardBatch);
    };


    // Recovers positions and devices missed during WS downtime
    _performFallbackFetch = async () => {
        try {
            // Fetch devices
            const devicesRes = await this._api.getDeviceList();
            if (devicesRes.data?.length) {
                this._simulateWsMessage({ devices: devicesRes.data });
            }

            // Fetch positions
            const positionsRes = await this._api.getPositions();
            if (positionsRes.data?.length) {
                this._simulateWsMessage({ positions: positionsRes.data });
            }
        } catch (error) {
            logger.error('Failed to perform WS fallback fetch:', error.message);
        }
    };

    _simulateWsMessage = (data) => {
        this._processWsData(data);
    };

    // Register a callback for incoming position events (used by GpsService.startAutoUpdate)
    setPositionCallback = (fn) => {
        this._positionCallback = fn;
    };


    stopAutoUpdate = () => {
        if (this.flushTimer) {
            clearInterval(this.flushTimer);
            this.flushTimer = null;
        }
        if (this._ws) {
            this._ws.close();
            this._ws = null;
        }
    }

    flushUpdates = async () => {
        const keys = Object.keys(this.flushMap);
        if (keys.length === 0) return;

        const batch = Object.values(this.flushMap);
        this.flushMap = {}; // Reset map for the next interval

        if (this._onFlushCallback) {
            try {
                await this._onFlushCallback(batch);
            } catch (error) {
                logger.error("[Traccar] Error in onFlushCallback:", error);
            }
        }
    };




    _sendCommand = async (id, command) => {
        const body = new CommandBody(command, id, 0);
        const res = await this._api.sendCommand(body);
        return res.data;
    };

    _checkDeviceWithRetries = async (traccarId, expectedStatus) => {
        const maxAttempts = Transaction.MAX_RETRY_ATTEMPTS || DEFAULT_MAX_RETRY_ATTEMPTS;
        const checkInterval = Transaction.RETRY_CHECK_INTERVAL || DEFAULT_RETRY_CHECK_INTERVAL;

        for (let attempt = 1; attempt <= maxAttempts; attempt++) {
            await new Promise(r => setTimeout(r, checkInterval));
            try {
                const status = await this.checkDeviceStatus(traccarId);
                logger.info(`[DEVICE] ${traccarId} attempt ${attempt}: status=${status}, expected=${expectedStatus}`);
                if (status === expectedStatus) return true;
            } catch (e) {
                logger.warn(`[DEVICE] ${traccarId} attempt ${attempt} failed:`, e.message);
            }
        }
        return false;
    };
}

export default MyTraccar;