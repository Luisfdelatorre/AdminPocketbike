import axios from 'axios';
import deviceRepository from '../repositories/deviceRepository.js';
import invoiceRepository from '../repositories/invoiceRepository.js';
import { Device } from '../models/Device.js';
import companyRepository from '../repositories/companyRepository.js';
import { Company } from '../models/Company.js';
import { Transaction, PAYMENTMESSAGES as PM, GPS_SERVICES, GPS_THROTTLE } from '../config/config.js';
import GpsService from '../services/gpsServices.js';
import companyService from './companyService.js';
import alertService from './alertService.js';

import helper from '../utils/helpers.js';
import logger from '../utils/logger.js';
import { sseService } from '../utils/sseService.js';
import { deviceStateCache } from '../utils/memoryStorage.js';

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



const bulkWriteDevices = async (gpsDevices) => {
    // ID generation and doc cleanup is handled inside deviceRepository.insertDevicesBatch
    return deviceRepository.insertDevicesBatch(gpsDevices);
}

// SSE Aggregation Buffer (companyId -> Map<gpsId, ssePayload>)
const SSE_BATCH_WINDOW_MS = 2500; // 2.5s aggregation window for routine telemetry
const SSE_URGENT_WINDOW_MS = 300; // 300ms near-instant flush for cutOff / powerCut
const _pendingSseByCompany = new Map();
let _sseFlushTimer = null;
let _lastSseFlushTime = 0;

const flushSseUpdates = () => {
    if (_sseFlushTimer) {
        clearTimeout(_sseFlushTimer);
        _sseFlushTimer = null;
    }
    if (_pendingSseByCompany.size === 0) return;

    _lastSseFlushTime = Date.now();
    for (const [companyId, devicesMap] of _pendingSseByCompany.entries()) {
        if (devicesMap.size > 0) {
            const companyUpdates = Array.from(devicesMap.values());
            sseService.broadcast('device_update', companyUpdates, { companyId });
        }
    }
    _pendingSseByCompany.clear();
};

const scheduleSseFlush = (isUrgent) => {
    const now = Date.now();
    if (isUrgent) {
        if (_sseFlushTimer) clearTimeout(_sseFlushTimer);
        _sseFlushTimer = setTimeout(flushSseUpdates, SSE_URGENT_WINDOW_MS);
        return;
    }

    if (!_sseFlushTimer) {
        const timeSinceLast = now - _lastSseFlushTime;
        const delay = Math.max(100, SSE_BATCH_WINDOW_MS - timeSinceLast);
        _sseFlushTimer = setTimeout(flushSseUpdates, delay);
    }
};

const initializeGpsUpdates = async () => {
    // 2. Pre-populate in-memory cache to avoid DB storm
    logger.info('[GPS] Initializing GPS updates and in-memory cache...');
    const allDevices = await deviceRepository.findForGpsCache();
    allDevices
        .filter(d => d.gpsId != null)
        .forEach(d => {
            deviceStateCache.set(d.gpsId, d);
            deviceStateCache.set(String(d.gpsId), d);
            if (!isNaN(Number(d.gpsId))) {
                deviceStateCache.set(Number(d.gpsId), d);
            }
        });
    let _lastGlobalDbWrite = 0;
    let _pendingUrgentFlush = false;

    const onFlush = async (batch) => {
        if (!batch || batch.length === 0) return;
        const NOW = Date.now();

        let batchHasUrgent = false;

        // 1. Detect state changes (ignition, cutOff, batteryLevel, powerCut)
        for (const update of batch) {
            const rawGpsId = update.filter?.gpsId;
            if (rawGpsId == null) continue;

            const mem = deviceStateCache.get(rawGpsId) ||
                deviceStateCache.get(String(rawGpsId)) ||
                deviceStateCache.get(Number(rawGpsId));
            if (!mem) continue;

            // Resolve cutOff for H02 command ACK if not already determined by hardware status bitfield
            if (update.cutOff === undefined && update.isH02Ack) {
                if (mem.pendingCommand === 'engineResume') {
                    update.cutOff = false;
                } else if (mem.pendingCommand === 'engineStop') {
                    update.cutOff = true;
                } else {
                    update.cutOff = !mem.cutOff;
                }
            }

            if (mem.applyUpdate(update)) {
                if (update.isCommandResult) {
                    deviceRepository.updateDeviceQueuedStatus(mem._id, false)
                        .catch(err => logger.error(`[DeviceServices] Error clearing queued status for device ${mem._id}:`, err));
                }
                if (mem._urgent) {
                    _pendingUrgentFlush = true;
                    batchHasUrgent = true;
                }
                // Only queue for SSE if visual telemetry actually changed
                if (mem._sseChanged) {
                    const cid = mem.companyId?.toString();
                    if (cid) {
                        if (!_pendingSseByCompany.has(cid)) {
                            _pendingSseByCompany.set(cid, new Map());
                        }
                        const payload = typeof mem.toSsePayload === 'function' ? mem.toSsePayload() : mem;
                        _pendingSseByCompany.get(cid).set(mem.gpsId, payload);
                    }
                }

                // Security telemetry alert detection (Power cut, unauthorized ignition, towing/motion in cutoff, etc.)
                if (update.powerCut || (mem.cutOff && (update.motion || update.ignition || (update.speed && update.speed > 5))) || update.rawAlarm) {
                    alertService.processTelemetryAlert(mem, update, {
                        latitude: update.latitude,
                        longitude: update.longitude,
                        speed: update.speed,
                        address: update.address,
                        attributes: { alarm: update.rawAlarm }
                    }).catch(err => logger.error('[DeviceServices] Error in alert processing:', err));
                }
            }
        }

        // 2. Schedule aggregated SSE broadcast (avoids flooding with micro-events)
        if (_pendingSseByCompany.size > 0) {
            scheduleSseFlush(batchHasUrgent);
        }

        // 3. Dynamic throttle for MongoDB: 1s for urgent (cutOff, powerCut, ignition), otherwise 30s
        const throttleLimit = _pendingUrgentFlush ? GPS_THROTTLE.URGENT_MS : GPS_THROTTLE.NORMAL_MS;
        if (NOW - _lastGlobalDbWrite < throttleLimit) return;

        const dbUpdatesList = Array.from(deviceStateCache.values()).filter(mem => mem._dirty);
        if (dbUpdatesList.length === 0) return;

        _lastGlobalDbWrite = NOW;
        _pendingUrgentFlush = false;

        dbUpdatesList.forEach(mem => mem.clearDirty());

        try {
            await deviceRepository.upsertDevicesBatch(dbUpdatesList);
            // logger.debug(`[GPS] Bulk write: ${dbUpdatesList.length} devices updated`);
        } catch (error) {
            logger.error('Error in GPS onFlush:', error);
        }
    };

    // 1. Fetch all companies
    const companies = await companyRepository.getAllCompanies();
    // 3. Initialize per-company adapter based on service requirement
    for (const c of companies) {
        logger.info(`[GPS] Initializing GPS auto update for companys ${c.name} (ID: ${c._id})`);
        const gpsAdapter = await companyService.getGpsAdapterByCompany(c._id);
        // console.log('[GPS] GPS adapter for company', c.name, ':', gpsAdapter);
        if (gpsAdapter && typeof gpsAdapter.startAutoUpdate === 'function') {
            logger.info(`[GPS] Starting GPS auto update for ${c.name} (${c._id}) [${gpsAdapter.serviceType} @ ${gpsAdapter.adapter?.host || 'N/A'}]`);
            await gpsAdapter.startAutoUpdate([], onFlush);
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
/**
 * Control the engine status of a vehicle (stop or resume).
 * Resolves the vehicle by its canonical vehicle ID (_id, id, deviceId), plate name, or gpsId fallback.
 * 
 * @param {string|number} deviceIdentifier - The vehicle ID (e.g. 81634350) or plate name
 * @param {string} command - The command to send ('engineStop' or 'engineResume')
 * @param {string} companyId - The ID of the company
 * @returns {Promise<Object>} Object containing { success: boolean, message?: string, error?: string, queued?: boolean, device?: Object }
 */
const controlEngine = async (deviceIdentifier, command, companyId) => {
    try {
        const rawStr = String(deviceIdentifier ?? '').trim();
        if (!rawStr) {
            return { success: false, error: 'Identificador de vehículo requerido' };
        }

        const numId = !isNaN(Number(rawStr)) ? Number(rawStr) : null;

        // 1. Resolver el vehículo por su identidad canónica (_id, id, deviceId), placa name, o gpsId de fallback
        const queryOr = [];
        if (numId !== null) {
            queryOr.push({ _id: numId });
            queryOr.push({ id: numId });
            queryOr.push({ deviceId: numId });
        }
        queryOr.push({ _id: rawStr });
        queryOr.push({ name: rawStr.toUpperCase() });
        if (numId !== null) {
            queryOr.push({ gpsId: numId });
        }

        const targetDevice = await Device.findOne({ $or: queryOr });
        if (!targetDevice) {
            return {
                success: false,
                error: `Vehículo no encontrado para el identificador: ${deviceIdentifier}`
            };
        }

        const actualGpsId = targetDevice.gpsId;
        if (!actualGpsId) {
            return {
                success: false,
                error: `El vehículo ${targetDevice.name} (ID: ${targetDevice._id}) no tiene un GPS ID asignado en plataforma.`
            };
        }

        const effectiveCompanyId = companyId || targetDevice.companyId;
        const gpsAdapter = await companyService.getGpsAdapterByCompany(effectiveCompanyId);
        if (!gpsAdapter) {
            return { success: false, error: `No GPS adapter configured for company ID: ${effectiveCompanyId}` };
        }

        // 2. Enviar comando a Traccar usando el gpsId actual del vehículo
        logger.info(`[EngineControl] Sending command ${command} to gpsId ${actualGpsId} for vehicle ${targetDevice.name} (ID: ${targetDevice._id}), Company: ${effectiveCompanyId}`);
        const verifyResult = await gpsAdapter.sendEngineCommand(actualGpsId, command);
        let isConfirmed = Boolean(verifyResult.confirmed);
        if (!isConfirmed) {
            return {
                success: false,
                error: `Failed to ${command} engine. The command was not accepted by the adapter.`
            };
        }

        // 3. Marcar encolado en el _id único del vehículo
        await deviceRepository.updateDeviceQueuedStatus(targetDevice._id, true);

        // Actualizar en memoria para sincronización inmediata de SSE y reconocimiento de confirmaciones
        const mem = deviceStateCache.get(actualGpsId) ||
            deviceStateCache.get(String(actualGpsId)) ||
            deviceStateCache.get(Number(actualGpsId));
        if (mem) {
            mem.queued = true;
            mem.pendingCommand = command; // 'engineResume' | 'engineStop'
            mem._dirty = true;
            mem._urgent = true;
            mem._sseChanged = true;
            const cid = mem.companyId?.toString();
            if (cid) {
                if (!_pendingSseByCompany.has(cid)) {
                    _pendingSseByCompany.set(cid, new Map());
                }
                const payload = typeof mem.toSsePayload === 'function' ? mem.toSsePayload() : mem;
                _pendingSseByCompany.get(cid).set(mem.gpsId, payload);
                scheduleSseFlush(true);
            }
        }

        return {
            success: true,
            message: `Command to ${command} engine queued successfully for ${targetDevice.name}. Awaiting confirmation from device.`,
            queued: true,
            device: {
                id: targetDevice._id,
                name: targetDevice.name,
                gpsId: actualGpsId,
                companyId: targetDevice.companyId
            }
        };
    } catch (error) {
        logger.error(`[EngineControl] Error controlling engine for device ${deviceIdentifier}:`, error);
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
const normalizeDeviceName = (name) =>
    String(name ?? "")
        .trim()
        .toUpperCase()
        .replace(/[^A-Z0-9]/g, "");

const syncFromGps = async (companyId) => {
    const company = companyId ? await Company.findById(companyId) : null;
    const adapter = await companyService.getGpsAdapterByCompany(companyId || null);
    const devices = await adapter.fetchDevices();
    if (!devices || devices.length === 0) {
        return { created: 0, updated: 0, errors: 0 };
    }
    // Stamp company info onto filtered device records
    const gpsDevices = devices.map(d => ({
        ...d,
        name: normalizeDeviceName(d.name),
        companyId: company._id.toString(),
        companyName: company.name
    }));
    return bulkWriteDevices(gpsDevices);
};

/**
 * Gets payment status of all devices for a company based on the cutoff strategy and target daily invoice.
 * @param {string} companyId - Company ID
 * @returns {Promise<Array<{device: Object, hasUnpaidInvoice: boolean, invoice: Object|null}>>}
 */
const getCompanyDevicesPaymentStatus = async (companyId, executionTime = dayjs()) => {
    const company = await Company.findById(companyId).lean();
    if (!company || !company.isActive) {
        return [];
    }

    const strategy = company.cutOffStrategy || 1; // 1: Today, 2: Yesterday, 3: Skip
    if (strategy === 3) {
        return [];
    }

    const today = executionTime.clone().startOf('day');
    const yesterday = executionTime.clone().subtract(1, 'day').startOf('day');
    const targetDate = strategy === 1 ? today.toDate() : yesterday.toDate();

    // Find all active devices for this company
    const devices = await Device.find({
        companyId,
        hasActiveContract: true,
        isDeleted: { $ne: true }
    }).lean();

    if (!devices || devices.length === 0) {
        return [];
    }

    // Fetch invoices for target date
    const invoices = await invoiceRepository.findInvoices({
        companyId,
        date: targetDate
    });

    const invoiceMap = new Map();
    invoices.forEach(inv => {
        invoiceMap.set(inv.deviceIdName, inv);
    });

    const results = [];
    for (const device of devices) {
        const invoice = invoiceMap.get(device.name) || null;
        const hasUnpaidInvoice = !invoice || !invoice.paid;
        results.push({
            device,
            hasUnpaidInvoice,
            invoice
        });
    }
    return results;
};

/**
 * Cuts off the engine for all debtor devices of a company.
 * Delegated to cronClient to keep cron communication centralized.
 * @param {string} companyId 
 * @param {object} [options={}]
 * @returns {Promise<{results: Array, successCount: number, alreadyOffCount: number, failedCount: number}>}
 */
const cutoffDebtors = async (companyId, options = {}) => {
    const { triggerCutoffDebtors } = await import('../utils/cronClient.js');
    return await triggerCutoffDebtors(companyId, options);
};

const getDeviceStatusByName = async (deviceIdName) => {
    return deviceRepository.getDeviceStatusByName(deviceIdName);
};

const getDeviceState = (gpsId) => {
    if (gpsId == null) return null;
    return deviceStateCache.get(gpsId) ||
        deviceStateCache.get(String(gpsId)) ||
        deviceStateCache.get(Number(gpsId)) || null;
};

const getAllDevicesEnriched = async (query = {}) => {
    const devices = await deviceRepository.getDevices(query);

    return devices.map(dev => {
        const live = getDeviceState(dev.gpsId);
        const tel = dev.telemetry || {};

        const lastUpdate = live?.lastUpdate || tel.lastUpdate || null;
        const ignition = live?.ignition !== undefined ? live.ignition : (tel.ignition ?? false);
        const cutOff = live?.cutOff !== undefined ? live.cutOff : (tel.cutOff ?? false);
        const batteryLevel = live?.batteryLevel !== undefined ? live.batteryLevel : (tel.batteryLevel ?? null);
        const powerCut = live?.powerCut !== undefined ? live.powerCut : Boolean(tel.powerCut);
        const alarm = live?.alarm !== undefined ? live.alarm : (tel.alarm || null);
        const motion = live?.motion !== undefined ? live.motion : Boolean(tel.motion);
        const queued = live?.queued !== undefined ? live.queued : Boolean(tel.queued);

        const telemetry = {
            lastUpdate,
            ignition,
            cutOff,
            batteryLevel,
            powerCut,
            alarm,
            motion,
            queued
        };

        return {
            ...dev,
            telemetry,
            // Flattened attributes for seamless frontend backward compatibility
            lastUpdate,
            ignition,
            cutOff,
            batteryLevel,
            powerCut,
            alarm,
            motion,
            queued
        };
    });
};

export { getDeviceState, getAllDevicesEnriched };

export default {
    bulkWriteDevices,
    syncFromGps,
    initializeGpsUpdates,
    controlEngine,
    getDeviceStatusByName,
    getDeviceState,
    getAllDevicesEnriched,
    getCompanyDevicesPaymentStatus,
    cutoffDebtors
};


