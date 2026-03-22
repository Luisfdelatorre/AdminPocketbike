import deviceRepository from '../repositories/deviceRepository.js';
import { Device } from '../models/Device.js';
import { Company } from '../models/Company.js';
import { Transaction, PAYMENTMESSAGES as PM, GPS_SERVICES } from '../config/config.js';
import GpsService from '../services/gpsServices.js';
import companyService from '../services/companyService.js';
import helper from '../utils/helpers.js';
import logger from '../utils/logger.js';

// Centralized Day.js
import dayjs from '../config/dayjs.js';

const {
    JWT_SECRET, JWT_EXPIRY,
    PAYMENT_STATUS: PS,
    PAYMENT_TYPE,
    INVOICE_DAYTYPE,
    MAX_NEQUI_PAYMENT_TIMEOUT,
    TEMPORARY_RESERVATION_TIMEOUT,
    MAX_RETRY_ATTEMPTS,
    RETRY_CHECK_INTERVAL,
    INVOICE_DAYTYPE_TRANSLATION
} = Transaction;

const deviceStateCache = new Map();


const bulkWriteDevices = async (gpsDevices) => {
    // Prepare clean docs: generate _id from name + strip empty objects
    const safeDocs = gpsDevices.map(d => {
        const withId = { ...d, _id: helper.generateDeviceId(d.name) };
        return Object.fromEntries(
            Object.entries(withId).filter(([, v]) =>
                !(v !== null && typeof v === 'object' && !Array.isArray(v) && Object.keys(v).length === 0)
            )
        );
    });

    return deviceRepository.insertDevicesBatch(safeDocs);
}



const initializeGpsUpdates = async () => {
    // 1. Fetch all companies
    const companies = await Company.find({}).lean();

    // 2. Pre-populate in-memory cache to avoid DB storm
    const allDevices = await Device.find({}, 'gpsId imei ignition lastUpdate cutOff batteryLevel').lean();
    for (const d of allDevices) {
        if (d.gpsId) deviceStateCache.set(String(d.gpsId), { ...d, _lastDbWrite: Date.now() });
        if (d.imei) deviceStateCache.set(String(d.imei), { ...d, _lastDbWrite: Date.now() });
    }
    console.log(`🧠 In-memory GPS state cache initialized with ${allDevices.length} devices.`);

    const onFlush = async (batch) => {
        if (!batch || batch.length === 0) return;

        const bulkOps = [];
        const NOW = Date.now();

        // Traccar and MegaRastreo adapters yield identical payloads: { filter, ignition, lastUpdate, cutOff, batteryLevel }
        for (const update of batch) {
            // Dedupe id
            const rawId = update.filter.gpsId || update.filter.imei;
            if (!rawId) continue;

            const idKey = String(rawId);
            const existing = deviceStateCache.get(idKey);

            let hasRealChange = !existing;
            let timeSinceLastWrite = Infinity;
            if (existing) {
                if (existing.ignition !== update.ignition) hasRealChange = true;
                if (update.cutOff !== undefined && existing.cutOff !== update.cutOff) hasRealChange = true;
                if (update.batteryLevel !== null && existing.batteryLevel !== update.batteryLevel) hasRealChange = true;
                timeSinceLastWrite = NOW - (existing._lastDbWrite || 0);
            }

            // Flush rule: Real change in state OR 5 seconds heartbeat elapsed
            if (hasRealChange || timeSinceLastWrite >= 5000) {
                const setDoc = {
                    ignition: update.ignition,
                    lastUpdate: update.lastUpdate
                };
                if (update.cutOff !== undefined) setDoc.cutOff = update.cutOff;
                if (update.batteryLevel !== null) setDoc.batteryLevel = update.batteryLevel;

                const finalFilter = { ...update.filter };
                if (finalFilter.gpsId) {
                    finalFilter.gpsId = Number(finalFilter.gpsId); // Force number, since raw MongoDB documents hold integers
                }

                bulkOps.push({
                    updateOne: {
                        filter: finalFilter, // use the safely typed filter
                        update: { $set: setDoc }
                    }
                });

                // Update memory cache
                deviceStateCache.set(idKey, {
                    ...existing,
                    ...update,
                    _lastDbWrite: NOW
                });
            }
        }

        // Send filtered updates to DB
        if (bulkOps.length > 0) {
            try {
                await deviceRepository.upsertDevicesBatch(bulkOps);
            } catch (error) {
                logger.error('Error in GPS onFlush filter:', error);
            }
        }
    };

    // 2. Initialize per-company adapter based on service requirement
    for (const c of companies) {
        const gpsAdapter = await companyService.getGpsAdapter(c._id);

        if (gpsAdapter && typeof gpsAdapter.startAutoUpdate === 'function') {
            let imeis = [];
            const isMegaRastreo = c.serviceType === GPS_SERVICES.MEGARASTREO;

            if (isMegaRastreo) {
                const devices = await deviceRepository.getDevicesByCompanyId(c._id);
                imeis = devices.map(d => d.imei).filter(Boolean);
            }

            await gpsAdapter.startAutoUpdate(imeis, onFlush);
        }
    }
};

/**
 * Controls the engine (stop/resume) for a given device by communicating with the GPS provider.
 * @param {string} id - The MongoDB ID of the device.
 * @param {number} command - The command to send (0 = stop, 1 = resume).
 * @param {string} companyId - The ID of the company.
 * @returns {Promise<Object>} Object containing { success: boolean, message?: string, error?: string, cutOff?: boolean }
 */
const controlEngine = async (id, command, companyId) => {
    try {
        // 1. Validate device existence and GPS mapping
        const device = await deviceRepository.getDeviceById(id * 1);
        if (!device) {
            return { success: false, error: 'Device not found in local database.' };
        }

        const gpsId = device.gpsId;
        if (!gpsId) {
            return { success: false, error: 'Device does not have a valid GPS ID assigned.' };
        }

        // 2. Fetch the correct GPS adapter strategy for this company
        const gpsAdapter = await companyService.getGpsAdapter(companyId);
        if (!gpsAdapter) {
            return { success: false, error: `No GPS adapter configured for company ID: ${companyId}` };
        }

        // 3. Send command and verify execution with the hardware
        logger.info(`[EngineControl] Sending command ${command} to device ${id} (GPS ID: ${gpsId}, Company: ${companyId})`);
        const isConfirmed = await gpsAdapter.executeAndVerify(gpsId, command);

        if (!isConfirmed) {
            const action = command === 0 ? 'stop' : 'resume';
            return {
                success: false,
                error: `Failed to ${action} engine. The command was sent but not confirmed by the device.`
            };
        }

        // 4. Update the local DB state bypassing strict schema validations on unrelated fields
        const newCutOffState = !command; // 0 = stop (true), 1 = resume (false)
        await deviceRepository.updateDeviceCutOff(device._id, newCutOffState);

        return {
            success: true,
            message: `Engine ${command === 0 ? 'stopped' : 'resumed'} successfully`,
            cutOff: newCutOffState
        };

    } catch (error) {
        logger.error(`[EngineControl] Error controlling engine for device ${id}:`, error);
        return {
            success: false,
            error: `Internal server error during engine control: ${error.message}`
        };
    }
};

/**
 * Sync devices from GPS platform into the local DB.
 * @param {string|null} companyId
 * @returns {Promise<{created, updated, errors}>}
 */
const syncFromGps = async (companyId) => {
    const company = companyId ? await Company.findById(companyId) : null;
    const adapter = await companyService.getGpsAdapter(companyId || null);
    const devices = await adapter.fetchDevices();
    if (!devices || devices.length === 0) {
        return { created: 0, updated: 0, errors: 0 };
    }
    // Stamp company info onto filtered device records
    const gpsDevices = company
        ? devices.map(d => ({
            ...d,
            companyId: company._id.toString(),
            companyName: company.name
        }))
        : activeDevices;
    return bulkWriteDevices(gpsDevices);
};

export default {
    bulkWriteDevices,
    syncFromGps,
    initializeGpsUpdates,
    controlEngine
};

