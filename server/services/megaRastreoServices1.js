// megaRastreoService.lite.js
import { io } from 'socket.io-client';
import megaRastreoApi from '../api/megaRastreoApi1.js';
import megaRastreoWebApi from '../api/megaRastreoWebApi.js';
import { Login, Url } from '../config/config.js';
import logger from '../config/logger.js';
import { Device } from '../models/Device.js';
const BASE_URL = process.env.MEGARASTREO_BASE_URL || 'https://api.v2.megarastreo.co';
const JWT = "6810dc94-6117-443d-a47c-23e79ceabf54"; // <-- requerido


class MegaRastreoServiceLite {
    constructor() {
        this.socket = null;
        this.flushMap = {};
        this.flushTimer = null;
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

        const webDevices = await megaRastreoWebApi.fetchDevices();
        console.log(`--Fetched ${Object.keys(webDevices).length} devices from Web`);
        const allDevices = devices.map(d => {
            console.log(webDevices[d.name.replace(/\s+/g, '')]);
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
                webDeviceId: webDevices[d.name.replace(/\s+/g, '')] || null,
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

    updateDevice(pos) {
        console.log(pos?.deviceId, pos.sensors.commandResult);
        if (pos?.deviceId === '69820480ccab39e9a27b6712') {
            console.log(pos);
        }

        const deviceId = pos?.deviceId;
        if (!deviceId) return;

        // -------- cutOff inference ----------
        let cutOff = null;

        if (pos?.attributes?.blocked === true) cutOff = true;
        else if (pos?.attributes?.blocked === false) cutOff = false;

        if (pos?.sensors?.commandResult === true) {
            const msg = pos?.attributes?.result?.toLowerCase?.() || "";
            if (msg.includes("cut off")) cutOff = true;
            else if (msg.includes("restore") || msg.includes("resume")) cutOff = false;
        }

        // -------- derived fields ----------
        const ignition = !!pos?.sensors?.ignition;
        const lastUpdate = new Date(pos?.deviceTime || pos?.serverTime || Date.now());

        // keep "undefined" if not present (so you can avoid overwriting in DB)
        const batteryLevel =
            pos?.attributes?.batteryLevel !== undefined ? pos.attributes.batteryLevel : undefined;

        // -------- flushMap merge ----------
        const existing = this.flushMap[deviceId] || {
            filter: { deviceId },
            update: {}
        };

        if (cutOff != null) existing.update.cutOff = cutOff;
        existing.update.ignition = ignition;
        existing.update.lastUpdate = lastUpdate;
        if (batteryLevel !== undefined) existing.update.batteryLevel = batteryLevel;

        this.flushMap[deviceId] = existing;
    }


    startAutoUpdate() {

        if (this.socket) return;//singleton
        console.log(`🔌 Conectando WS: ${BASE_URL}/positions`);
        this.socket = io(`${BASE_URL}/positions`, {
            transports: ['websocket'],
            query: { token: JWT },
            reconnection: true,
            reconnectionAttempts: Infinity,
            reconnectionDelay: 1000,
            reconnectionDelayMax: 5000,
            timeout: 15000,
            // path: '/api/socket' // Important for Traccar
        });

        this.socket.on('connect', () => {
            console.log('✅ WS conectado. socket.id =', this.socket.id);
            console.log('➡️ Enviando setFilter {}');
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
            console.log(pos?.deviceId, pos.sensors.commandResult);
            count += 1;
            console.log('✅ Recibido evento:', pos.deviceId, pos.attributes.status, pos.attributes.blocked);
            this.updateDevice(pos);

            /*if (pos.mobileId === '6982afdc97ecc874077eb57d') {
                console.log(pos);
                // 1) Command ACK
                const resultText = String(pos?.attributes?.result || '');
                const commandExecuted = (pos?.sensors?.commandResult === true) && (/success/i.test(resultText));
                let fuelCut = 'UNKNOWN';
                if (commandExecuted) {
                    if (/cut off the fuel supply/i.test(resultText)) fuelCut = 'CUT';
                    if (/restore fuel supply/i.test(resultText)) fuelCut = 'RESTORED';
                }
                console.log(fuelCut);
            }*/

            /* const coords = pos?.geometric?.coordinates;
             const lng = Array.isArray(coords) ? coords[0] : null;
             const lat = Array.isArray(coords) ? coords[1] : null;
     
             console.log(
                 `📍 [${count}/${MAX_EVENTS}] mobileId=${pos?.mobileId} time=${pos?.deviceTime} ` +
                 `ignition=${pos?.sensors?.ignition} speed(knots)=${pos?.speed} ` +
                 `coords(lat,lng)=(${lat},${lng})`
             );*/

            // /if (count >= MAX_EVENTS) {
            //  console.log('✅ Recibidos los eventos requeridos. Cerrando...');
            //  cleanupAndExit(0);
            //  }
        });

        this.flushTimer = setInterval(() => this.flushUpdates(), 1000);
    }

    stopAutoUpdate() {
        if (this.flushTimer) clearInterval(this.flushTimer);
        if (this.socket) this.socket.close();
    }


    async flushUpdates() {
        const keys = Object.keys(this.flushMap);
        if (keys.length === 0) return;

        console.log(`Flushing ${keys.length} updates...`);

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
