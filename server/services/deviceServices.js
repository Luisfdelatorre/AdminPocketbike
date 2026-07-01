import deviceRepository from '../repositories/deviceRepository.js';
import invoiceRepository from '../repositories/invoiceRepository.js';
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
        const id = helper.generateDeviceId(d.name);
        const withId = { ...d, _id: id, id: id };
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
        const entry = {
            ignition: d.ignition,
            lastUpdate: d.lastUpdate,
            cutOff: d.cutOff,
            batteryLevel: d.batteryLevel,
            filter: { gpsId: d.gpsId },
            _dirty: false, // starts clean — no real change yet
        };

        deviceStateCache.set(d.gpsId, entry);
    }
    let _lastGlobalDbWrite = 0;
    const onFlush = async (batch) => {
        if (!batch || batch.length === 0) return;
        const NOW = Date.now();

        // 1. Detect real changes and mark dirty only if something actually changed
        for (const update of batch) {
            const mem = deviceStateCache.get(update.filter.gpsId);
            if (!mem) continue;

            const changed =
                mem.ignition !== update.ignition ||
                mem.lastUpdate !== update.lastUpdate ||
                (update.cutOff !== undefined && mem.cutOff !== update.cutOff) ||
                (update.batteryLevel !== null && mem.batteryLevel !== update.batteryLevel);

            if (changed) {
                mem.ignition = update.ignition;
                mem.lastUpdate = update.lastUpdate;
                if (update.cutOff !== undefined) mem.cutOff = update.cutOff;
                if (update.batteryLevel !== null) mem.batteryLevel = update.batteryLevel;
                mem._dirty = true;
                deviceStateCache.set(update.filter.gpsId, mem);
            }
        }

        // 2. Every 5s, flush only dirty devices to DB
        if (NOW - _lastGlobalDbWrite < 5000) return;

        const bulkOps = [];

        for (const [idKey, mem] of deviceStateCache.entries()) {
            if (!mem._dirty) continue; // skip unchanged devices

            bulkOps.push({
                updateOne: {
                    filter: mem.filter,
                    update: {
                        $set: {
                            ignition: mem.ignition,
                            lastUpdate: mem.lastUpdate,
                            cutOff: mem.cutOff,
                            batteryLevel: mem.batteryLevel,
                        }
                    }
                }
            });

            mem._dirty = false; // reset after queuing
        }

        if (bulkOps.length > 0) {
            try {
                await deviceRepository.upsertDevicesBatch(bulkOps);
                logger.info(`GPS bulk write: ${bulkOps.length} devices updated`);
            } catch (error) {
                logger.error('Error in GPS onFlush:', error);
            }
        }

        _lastGlobalDbWrite = NOW;
    };

    // 3. Initialize per-company adapter based on service requirement
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

        // 2. Fetch the correct GPS adapter strategy for this company based on the device's company
        const targetCompanyId = device.companyId || companyId;
        const gpsAdapter = await companyService.getGpsAdapter(targetCompanyId);
        if (!gpsAdapter) {
            return { success: false, error: `No GPS adapter configured for company ID: ${targetCompanyId}` };
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

/**
 * Gets payment status of all devices for a company based on the cutoff strategy and target daily invoice.
 * @param {string} companyId - Company ID
 * @returns {Promise<Array<{device: Object, hasUnpaidInvoice: boolean, invoice: Object|null}>>}
 */
const getCompanyDevicesPaymentStatus = async (companyId) => {
    const company = await Company.findById(companyId).lean();
    if (!company || !company.isActive) {
        return [];
    }

    const strategy = company.cutOffStrategy || 1; // 1: Today, 2: Yesterday, 3: Skip
    if (strategy === 3) {
        return [];
    }

    const today = dayjs().startOf('day');
    const yesterday = dayjs().subtract(1, 'day').startOf('day');
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
 * Cuts off the engine for all debtor devices of a company in parallel.
 * @param {string} companyId 
 * @returns {Promise<{results: Array, successCount: number, alreadyOffCount: number, failedCount: number}>}
 */
const cutoffDebtors = async (companyId) => {
    const company = await Company.findById(companyId).lean();
    if (!company) {
        throw new Error('Company not found');
    }
    const companyCutOffTime = company.cutOffTime || '23:59';
    const strategy = company.cutOffStrategy || 1;
    const currentTimeStr = dayjs().format('HH:mm');

    // 1. Evaluate payment status of all devices for this company
    const paymentStatuses = await getCompanyDevicesPaymentStatus(companyId);

    // 2. Filter devices that have an unpaid invoice (debtors), are not exempt, and whose cut-off time has been reached
    const debtors = paymentStatuses.filter(({ device, hasUnpaidInvoice }) => {
        if (!hasUnpaidInvoice || device.exemptFromCutOff === true) {
            return false;
        }

        // If strategy is "Today" (1), check if today's cut-off time has been reached
        if (strategy === 1) {
            let timeReached = false;
            if (currentTimeStr >= companyCutOffTime) {
                if (device.cutOffTime && device.cutOffTime > currentTimeStr) {
                    timeReached = false;
                } else {
                    timeReached = true;
                }
            } else {
                timeReached = !!(device.cutOffTime && device.cutOffTime <= currentTimeStr);
            }
            return timeReached;
        }

        // For other strategies (e.g., Yesterday), the cut-off time has already passed
        return true;
    });

    if (!debtors.length) {
        return { results: [], successCount: 0, alreadyOffCount: 0, failedCount: 0 };
    }

    // 3. Send cutoff command to each debtor device in parallel for efficiency
    const results = await Promise.all(debtors.map(async ({ device, invoice }) => {
        const id = device._id;
        const name = device.deviceName || device.name || device._id;

        // Skip if already cut off
        if (device.cutOff === true || device.cutOff === 1) {
            return {
                device: name,
                status: 'already_off'
            };
        }
        try {
            const result = await controlEngine(id, 0, companyId);
            return {
                device: name,
                status: result.success ? 'cut_off' : 'failed',
                error: result.error || null
            };
        } catch (err) {
            return { device: name, status: 'error', error: err.message };
        }
    }));

    const successCount = results.filter(r => r.status === 'cut_off').length;
    const alreadyOffCount = results.filter(r => r.status === 'already_off').length;
    const failedCount = results.filter(r => r.status === 'failed' || r.status === 'error').length;

    return {
        results,
        successCount,
        alreadyOffCount,
        failedCount
    };
};

export default {
    bulkWriteDevices,
    syncFromGps,
    initializeGpsUpdates,
    controlEngine,
    getCompanyDevicesPaymentStatus,
    cutoffDebtors
};

