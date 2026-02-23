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

        // Check for FIXED_WEEKDAY automatic free day policy
        if (contract.freeDayPolicy === 'FIXED_WEEKDAY' && today.getDay() === contract.fixedFreeDayOfWeek) {
          const existingInvoice = await invoiceRepository.getInvoiceByDeviceAndDate(device.name, today);

          if (existingInvoice) {
            logger.info(`[CRON] Fixed Free Day already applied preventively for ${device.name} on ${dayjs(today).format('YYYY-MM-DD')}. Skipping duplicate generation.`);
            continue; // Skip since it's already there
          }

          logger.info(`🎉 Automatic Fixed Free Day triggered for device ${device.name}`);
          await paymentService.applyFreeDay(device.name, contract.contractId, device.companyId, true);
          continue; // Skip standard invoice generation since applyFreeDay handles it
        }

        // Use denormalized dailyRate directly from the device record for efficiency
        const amount = device.dailyRate || 0;

        if (amount > 0) {
          const invoice = await invoiceRepository.findOrCreateInvoiceByName(
            device.name, // deviceIdName
            device.deviceId, // deviceId
            amount, // dailyRate
            today, // date
            device.companyId
          );
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
import companyService from "./companyService.js";

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

const performDailyCutOff = async () => {
  logger.info("🕒 Starting daily cut-off process (23:59)...");
  try {

    const enabledCompanies = await Company.find({ automaticCutOff: true, isActive: true }).lean();

    if (!enabledCompanies || enabledCompanies.length === 0) {
      logger.info('No companies have automatic cut-off enabled. Skipping.');
      return;
    }

    const today = dayjs().startOf('day');
    const yesterday = dayjs().subtract(1, 'day').startOf('day');

    for (const company of enabledCompanies) {
      const strategy = company.cutOffStrategy || 1; // 1: Today, 2: Yesterday, 3: Skip
      if (strategy === 3) {
        logger.info(`Strategy 3 (Disabled) for company ${company.name}. Skipping.`);
        continue;
      }

      logger.info(`🏢 Processing company: ${company.name} (Strategy: ${strategy})`);

      const devices = await Device.find({
        companyId: company._id,
        hasActiveContract: true,
      }).lean();

      if (!devices || devices.length === 0) {
        logger.info(`No active devices found for company ${company.name}.`);
        continue;
      }

      // 3. Determine the target date based on strategy and fetch all company invoices for that date ONCE
      const targetDateObject = strategy === 1 ? today.toDate() : yesterday.toDate();
      const targetDateLabel = strategy === 1 ? 'Today' : 'Yesterday';
      const targetDateFormatted = strategy === 1 ? today.format('YYYY-MM-DD') : yesterday.format('YYYY-MM-DD');

      console.log(`[DEBUG] Company ${company.name}: Fetching all invoices for ${targetDateLabel} (${targetDateFormatted})`);

      // Retrieve all invoices for this company on the target date efficiently
      const companyInvoices = await invoiceRepository.findInvoices({
        companyId: company._id,
        date: targetDateObject
      });

      // Build a fast lookup map: deviceIdName -> Invoice
      const invoiceMap = new Map();
      companyInvoices.forEach(inv => {
        invoiceMap.set(inv.deviceIdName, inv);
      });

      const devicesToCutOff = [];

      for (const device of devices) {
        console.log(`[DEBUG] Checking device: ${device.name}`);
        try {
          const deviceName = device.name;

          // Helper to check if an invoice is "OK" (paid or special)
          const isUpToDate = (inv) => {
            if (!inv) {
              console.log(`[DEBUG] Device ${deviceName}: No invoice found for this date. Treating as up to date.`);
              return true;
            }
            console.log(`[DEBUG] Device ${deviceName}: Invoice found. Paid: ${inv.paid}, DayType: ${inv.dayType}`);
            if (inv.paid) return true;
            const specialTypes = ['FREE', 'FREEPASS', 'LOAN'];
            return specialTypes.includes(inv.dayType);
          };

          const invTarget = invoiceMap.get(deviceName);
          const shouldCutOff = !isUpToDate(invTarget);

          if (device.exemptFromCutOff === true) {
            logger.info(`🛡️ Device ${deviceName} is exempt from Cut-Off. Skipping.`);
          } else if (shouldCutOff) {
            console.log(`[DEBUG] Device ${deviceName}: SHOULD CUT OFF.`);
            devicesToCutOff.push(device);
          } else {
            logger.info(`✅ Device ${deviceName} is up to date.`);
          }
        } catch (innerErr) {
          logger.error(`Error processing cut-off for device ${device.name}:`, innerErr);
        }
      }

      // 3. Command and Verify engine stop in batches of 10
      if (devicesToCutOff.length > 0) {
        logger.info(`🚫 Cutting off ${devicesToCutOff.length} devices for Company: ${company.name} (Strategy: ${strategy})`);

        const BATCH_SIZE = 10;
        for (let i = 0; i < devicesToCutOff.length; i += BATCH_SIZE) {
          const batch = devicesToCutOff.slice(i, i + BATCH_SIZE);
          await verifyAndMarkCutOffBatch(batch, company._id);
        }
      }

    }

    logger.info("✅ Daily cut-off process completed.");
  } catch (err) {
    logger.error("Critical error in performDailyCutOff job:", err);
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
    // Only resume devices that were actually turned off by curfew AND don't have pending cutOff for unpaid invoices
    const devices = await Device.find({
      companyId,
      hasActiveContract: true,
      exemptFromCutOff: { $ne: true },
      curfewStatus: true,
      cutOff: { $in: [0, null] } // Safely resume ONLY if not marked with unpaid cutoffs
    }).lean();

    if (!devices || devices.length === 0) return;

    logger.info(`[CURFEW] Resuming ${devices.length} devices.`);
    const gpsAdapter = await companyService.getGpsAdapter(companyId);

    const BATCH_SIZE = 10;
    for (let i = 0; i < devices.length; i += BATCH_SIZE) {
      const batch = devices.slice(i, i + BATCH_SIZE);
      const targetIds = batch.map(d => d.megaDeviceId || d.deviceId);

      const resultsMap = await gpsAdapter.executeAndVerifyBatch(targetIds, ENGINERESUME, {
        companyConfig: companyId
      });

      // Clear curfewStatus=false for ALL attempted (even if it failed, to not forever loop, though we can retry if we wanted)
      const idsToClear = batch.map(d => d._id);
      await Device.updateMany({ _id: { $in: idsToClear } }, { $set: { curfewStatus: false } });

      const successCount = Object.values(resultsMap).filter(Boolean).length;
      logger.info(`[CURFEW] Successfully turned back on ${successCount} devices.`);
    }
  } catch (err) {
    logger.error(`[CURFEW END] Error:`, err);
  }
};

export default {
  generateDailyInvoices,
  performDailyCutOff,
  performCurfewStart,
  performCurfewEnd
};
