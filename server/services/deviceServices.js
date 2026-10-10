import axios from 'axios';
import deviceRepository from '../repositories/deviceRepository.js';
import invoiceRepository from '../repositories/invoiceRepository.js';
import { Device } from '../models/Device.js';
import companyRepository from '../repositories/companyRepository.js';
import { Company } from '../models/Company.js';
import { Transaction, PAYMENTMESSAGES as PM, GPS_SERVICES, GPS_THROTTLE } from '../config/config.js';
import GpsService from '../services/gpsServices.js';
import companyService from './companyService.js';

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

        const sseUpdatesByCompany = {};

        // 1. Detect state changes (ignition, cutOff, batteryLevel, powerCut)
        for (const update of batch) {
            const rawGpsId = update.filter?.gpsId;
            if (rawGpsId == null) continue;

            const mem = deviceStateCache.get(rawGpsId) ||
                deviceStateCache.get(String(rawGpsId)) ||
                deviceStateCache.get(Number(rawGpsId));
            if (!mem) continue;

            if (mem.applyUpdate(update)) {
                if (mem._urgent) {
                    _pendingUrgentFlush = true;
                }
                const cid = mem.companyId?.toString();
                if (cid) {
                    if (!sseUpdatesByCompany[cid]) sseUpdatesByCompany[cid] = [];
                    sseUpdatesByCompany[cid].push(mem);
                }
            }
        }

        // 2. Broadcast live changes to frontend immediately via SSE
        for (const [companyId, companyUpdates] of Object.entries(sseUpdatesByCompany)) {
            sseService.broadcast('device_update', companyUpdates, { companyId });
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
const controlEngine = async (gpsId, command, companyId) => {
    try {
        const gpsAdapter = await companyService.getGpsAdapterByCompany(companyId);
        console.log('[EngineControl] GPS adapter for company', companyId, ':', gpsAdapter);
        if (!gpsAdapter) {
            return { success: false, error: `No GPS adapter configured for company ID: ${companyId}` };
        }

        // 3. Send command to GPS adapter
        logger.info(`[EngineControl] Sending command ${command} to gpsId ${gpsId}, Company: ${companyId}`);
        const verifyResult = await gpsAdapter.sendEngineCommand(gpsId, command);
        let isConfirmed = Boolean(verifyResult.confirmed);
        if (!isConfirmed) {
            return {
                success: false,
                error: `Failed to ${command} engine. The command was not accepted by the adapter.`
            };
        }

        const targetDevice = await Device.findOne({ gpsId: Number(gpsId) });
        await deviceRepository.updateDeviceQueuedStatus(targetDevice._id, true);

        return {
            success: true,
            message: `Command to ${command} engine queued successfully. Awaiting confirmation from device.`,
            queued: true
        };
    } catch (error) {
        logger.error(`[EngineControl] Error controlling engine for device ${gpsId}:`, error);
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


