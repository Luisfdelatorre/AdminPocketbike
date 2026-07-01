import logger from "../config/logger.js";
import ContractRepository from "../repositories/contractRepository.js";
import invoiceRepository from "../repositories/invoiceRepository.js";
import deviceRepository from "../repositories/deviceRepository.js";
import dayjs from "../config/dayjs.js";
import { Company } from "../models/Company.js";

import { Device } from "../models/Device.js";
import { Invoice } from "../models/Invoice.js";
import { Transaction, ENGINESTOP, ENGINERESUME } from "../config/config.js";


const { MAX_RETRY_ATTEMPTS, RETRY_CHECK_INTERVAL } = Transaction;


//const dayjs = require('../config/dayjs');
//const activationQueue = require('./ActivationQueueService');
// Start the queue service
//activationQueue.start();

import paymentService from './paymentService.js';
import companyService from "./companyService.js";
import deviceServices from "./deviceServices.js";

const generateDailyInvoices = async () => {
  try {
    // Use today's date, normalized to start of day
    const today = dayjs().startOf('day').toDate();
    logger.info("🚀 Starting global daily invoice generation for:", today);

    // 1. Find companies with automatic invoicing enabled
    const enabledCompanies = await Company.find({ automaticInvoicing: true, isActive: true }).lean();

    if (!enabledCompanies || enabledCompanies.length === 0) {
      logger.info('No companies have automatic invoicing enabled. Skipping.');
      return;
    }

    const companyIds = enabledCompanies.map(c => c._id);

    // 2. Fetch all devices that are marked as having an active contract AND belong to enabled companies
    const devices = await Device.find({
      hasActiveContract: true,
      companyId: { $in: companyIds }
    }).lean();

    if (!devices || devices.length === 0) {
      logger.info('No devices with active contracts found for invoice generation.');
      return;
    }

    logger.info(`🚀 Found ${devices.length} devices with active contracts spanning ${enabledCompanies.length} companies for processing.`);

    for (const device of devices) {
      try {
        const contract = await ContractRepository.getActiveContractByDevice(device.name);
        if (!contract) {
          logger.warn(`Device ${device.name} has hasActiveContract=true but no active contract found.`);
          continue;
        }

        // Use denormalized dailyRate directly from the device record for efficiency
        const amount = device.dailyRate || 0;

        if (amount > 0) {
          const invoice = await invoiceRepository.findOrCreateInvoiceByName(
            device.name,           // deviceIdName
            device.deviceId,       // deviceId
            amount,                // amount / dailyRate
            today,                 // date  ← must be before companyId
            device.companyId       // companyId
          );
          // Check for FIXED_WEEKDAY automatic free day policy
          if (contract.freeDayPolicy === 'FIXED_WEEKDAY' && today.getDay() === contract.fixedFreeDayOfWeek) {
            if (invoice && invoice.paid === false) {
              logger.info(`🎉 Automatic Fixed Free Day triggered for device ${device.name}`);
              await paymentService.applyFreeDayAutomatic(device.name, device.companyId, invoice);
              logger.info(`[FREE DAY AUTO] Applied free day for ${device.name} on ${dayjs(today).format('YYYY-MM-DD')}.`);
            } else {
              logger.info(`[FREE DAY AUTO] Invoice for ${device.name} already paid — skipping.`);
            }
          }
          logger.info(`Invoice generated/verified for ${device.name}: ${invoice._id}`);
        } else {
          logger.warn(`Device ${device.name} has hasActiveContract=true but dailyRate is 0 or missing.`);
        }
      } catch (innerErr) {
        logger.error(`Error generating invoice for device ${device.name}:`, innerErr);
      }
    }
  } catch (err) {
    logger.error('Error generando invoices diarios', err);
  }
};


const verifyAndMarkCutOff = async (deviceName, deviceId, megaDeviceId, companyId) => {
  logger.info(`[CUT-OFF] Device ${deviceName} engine stop verification starting...`);

  try {
    const gpsAdapter = await companyService.getGpsAdapter(companyId);

    // For safety, let's use the `deviceId` (DB ID) if `megaDeviceId` is missing, assuming existing logic populated `megaDeviceId` correctly.
    const targetId = megaDeviceId || deviceId;

    const confirmed = await gpsAdapter.executeAndVerify(targetId, ENGINESTOP, { companyConfig: companyId });

    if (!confirmed) {
      logger.warn(`[CUT-OFF] Device ${deviceName} engine stop command not confirmed after retries.`);
      // Update database flag (2 = Sent but not confirmed)
      await deviceRepository.updateCutOffStatus(deviceId, 2);
    } else {
      logger.info(`[CUT-OFF] Device ${deviceName} engine stop confirmed.`);
      // Update database flag (1 = Confirmed)
      await deviceRepository.updateCutOffStatus(deviceId, 1);
    }
  } catch (error) {
    logger.error(`[CUT-OFF] Error executing cut-off for ${deviceName}:`, error);
  }
};

const verifyAndMarkCutOffBatch = async (batch, companyId) => {
  logger.info(`[CUT-OFF] Batch engine stop verification starting for ${batch.length} devices...`);

  try {
    const gpsAdapter = await companyService.getGpsAdapter(companyId);

    // Prepare arrays for the adapter
    const targetIds = batch.map(d => d.megaDeviceId || d.deviceId); // Need fallback if megaDeviceId is undefined

    const streamedConfirmedIds = new Set();

    const handleDeviceConfirmed = (targetId) => {
      streamedConfirmedIds.add(targetId);
      // Find original device inside the batch
      const originalDevice = batch.find(d => (d.megaDeviceId || d.deviceId) === targetId);
      if (originalDevice) {
        logger.info(`[CUT-OFF] Device ${originalDevice.name} engine stop confirmed early.`);
        // Fire and forget updating the status async
        deviceRepository.updateCutOffStatus(originalDevice.deviceId, 1).catch(err => {
          logger.error(`Error streaming update for ${originalDevice.name}:`, err);
        });
      }
    };

    // pass onDeviceConfirmed
    const resultsMap = await gpsAdapter.executeAndVerifyBatch(targetIds, ENGINESTOP, {
      companyConfig: companyId,
      onDeviceConfirmed: handleDeviceConfirmed
    });

    // Iterate through the original batch to correlate results and update DB
    // We only process devices that were NOT confirmed early.
    const updatePromises = batch.map(async (device) => {
      const targetId = device.megaDeviceId || device.deviceId;

      // If we already successfully streamed its update, do nothing
      if (streamedConfirmedIds.has(targetId)) return;

      const confirmed = resultsMap[targetId];

      if (!confirmed) {
        logger.warn(`[CUT-OFF] Device ${device.name} engine stop command not confirmed after retries.`);
        return deviceRepository.updateCutOffStatus(device.deviceId, 2); // 2 = Sent but not confirmed
      } else {
        // Technically this shouldn't happen unless the callback missed it, 
        // but we handle it just in case as a fallback.
        logger.info(`[CUT-OFF] Device ${device.name} engine stop confirmed (fallback DB write).`);
        return deviceRepository.updateCutOffStatus(device.deviceId, 1); // 1 = Confirmed
      }
    });

    await Promise.all(updatePromises);
  } catch (error) {
    logger.error(`[CUT-OFF] Error executing batch cut-off:`, error);
  }
};

const performPollingCutOff = async () => {
  logger.info("🕒 Starting 5-minute polling cut-off process...");
  try {
    const enabledCompanies = await Company.find({ automaticCutOff: true, isActive: true }).lean();

    if (!enabledCompanies || enabledCompanies.length === 0) {
      return;
    }

    const currentTimeStr = dayjs().format('HH:mm');

    for (const company of enabledCompanies) {
      const companyCutOffTime = company.cutOffTime || '23:59';

      // 1. Get payment statuses of devices for this company
      const paymentStatuses = await deviceServices.getCompanyDevicesPaymentStatus(company._id);

      const devicesToCutOff = [];

      for (const { device, hasUnpaidInvoice } of paymentStatuses) {
        try {
          if (device.exemptFromCutOff === true) continue;
          if (device.cutOff === 1 || device.cutOff === 2) continue; // Already cut off / pending

          // Time verification
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

          if (hasUnpaidInvoice && timeReached) {
            devicesToCutOff.push(device);
          }
        } catch (innerErr) {
          logger.error(`Error processing cut-off check for device ${device.name}:`, innerErr);
        }
      }

      if (devicesToCutOff.length > 0) {
        logger.info(`🚫 Cutting off ${devicesToCutOff.length} devices for Company: ${company.name} at ${currentTimeStr}`);
        const BATCH_SIZE = 10;
        for (let i = 0; i < devicesToCutOff.length; i += BATCH_SIZE) {
          const batch = devicesToCutOff.slice(i, i + BATCH_SIZE);
          await verifyAndMarkCutOffBatch(batch, company._id);
        }
      }
    }
  } catch (err) {
    logger.error("Critical error in performPollingCutOff job:", err);
  }
};

const performCurfewStart = async (companyId) => {
  logger.info(`🌙 Starting Night Curfew for company: ${companyId}`);
  try {
    const devices = await Device.find({
      companyId,
      hasActiveContract: true,
      exemptFromCutOff: { $ne: true },
      cutOff: { $in: [0, null] }
    }).lean();

    if (!devices || devices.length === 0) return;

    logger.info(`[CURFEW] Stopping ${devices.length} devices.`);
    const gpsAdapter = await companyService.getGpsAdapter(companyId);

    const BATCH_SIZE = 10;
    for (let i = 0; i < devices.length; i += BATCH_SIZE) {
      const batch = devices.slice(i, i + BATCH_SIZE);
      const targetIds = batch.map(d => d.megaDeviceId || d.deviceId);

      const resultsMap = await gpsAdapter.executeAndVerifyBatch(targetIds, ENGINESTOP, {
        companyConfig: companyId
      });

      // Update curfewStatus=true for all that were successfully stopped
      const successfulIds = batch.filter(d => resultsMap[d.megaDeviceId || d.deviceId]).map(d => d._id);
      if (successfulIds.length > 0) {
        await Device.updateMany({ _id: { $in: successfulIds } }, { $set: { curfewStatus: true } });
        logger.info(`[CURFEW] Successfully turned off ${successfulIds.length} devices.`);
      }
    }
  } catch (err) {
    logger.error(`[CURFEW START] Error:`, err);
  }
};

const performCurfewEnd = async (companyId) => {
  logger.info(`☀️ Ending Night Curfew for company: ${companyId}`);
  try {
    // 1. Find all active contract devices for this company that were off due to curfew
    const curfewDevices = await Device.find({
      companyId,
      hasActiveContract: true,
      exemptFromCutOff: { $ne: true },
      curfewStatus: true
    }).lean();

    if (!curfewDevices || curfewDevices.length === 0) {
      logger.info(`[CURFEW END] No devices pending resume for company: ${companyId}`);
      return;
    }

    // 2. Get payment status of devices to check who has unpaid invoices
    const paymentStatuses = await deviceServices.getCompanyDevicesPaymentStatus(companyId);
    const unpaidMap = new Map();
    paymentStatuses.forEach(p => {
      unpaidMap.set(p.device._id.toString(), p.hasUnpaidInvoice);
    });

    // 3. Filter to resume ONLY devices that do NOT have an unpaid invoice
    const devicesToResume = curfewDevices.filter(device => {
      const hasUnpaid = unpaidMap.get(device._id.toString());
      return !hasUnpaid && device.cutOff !== 1 && device.cutOff !== 2;
    });

    logger.info(`[CURFEW] Out of ${curfewDevices.length} curfew devices, resuming ${devicesToResume.length} (unpaid or already cut-off skipped).`);

    const gpsAdapter = await companyService.getGpsAdapter(companyId);

    const BATCH_SIZE = 10;
    for (let i = 0; i < curfewDevices.length; i += BATCH_SIZE) {
      const batchAll = curfewDevices.slice(i, i + BATCH_SIZE);
      const batchToResume = devicesToResume.filter(d => batchAll.some(b => b._id.toString() === d._id.toString()));

      if (batchToResume.length > 0) {
        const targetIds = batchToResume.map(d => d.megaDeviceId || d.deviceId);
        await gpsAdapter.executeAndVerifyBatch(targetIds, ENGINERESUME, {
          companyConfig: companyId
        });
      }

      // Clear curfewStatus = false for all attempted in this batch to prevent infinite loops
      const idsToClear = batchAll.map(d => d._id);
      await Device.updateMany({ _id: { $in: idsToClear } }, { $set: { curfewStatus: false } });
    }
  } catch (err) {
    logger.error(`[CURFEW END] Error:`, err);
  }
};

export default {
  generateDailyInvoices,
  performPollingCutOff,
  performDailyCutOff: performPollingCutOff,
  performCurfewStart,
  performCurfewEnd
};
