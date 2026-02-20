import logger from "../config/logger.js";
import ContractRepository from "../repositories/contractRepository.js";
import invoiceRepository from "../repositories/invoiceRepository.js";
import deviceRepository from "../repositories/deviceRepository.js";
import dayjs from "../config/dayjs.js";
import { Company } from "../models/Company.js";

import { Device } from "../models/Device.js";
import { Transaction, ENGINESTOP } from "../config/config.js";

const { MAX_RETRY_ATTEMPTS, RETRY_CHECK_INTERVAL } = Transaction;


//const dayjs = require('../config/dayjs');
//const activationQueue = require('./ActivationQueueService');
// Start the queue service
//activationQueue.start();

const generateDailyInvoices = async () => {
  try {
    // Use today's date, normalized to start of day
    const today = dayjs().startOf('day').toDate();
    logger.info("🚀 Starting global daily invoice generation for:", today);

    // 1. Fetch all devices that are marked as having an active contract
    const devices = await Device.find({
      hasActiveContract: true,
    }).lean();

    if (!devices || devices.length === 0) {
      logger.info('No devices with active contracts found for invoice generation.');
      return;
    }

    logger.info(`🚀 Found ${devices.length} devices with active contracts for processing.`);

    for (const device of devices) {
      try {
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
    // Use deviceId (which might be the DB ID or external ID depending on adapter expectation)
    // MegaRastreo uses megaDeviceId/externalId. Traccar uses local ID? 
    // The previous code passed megaDeviceId. Traccar adapter likely expects its own ID format.
    // If using Traccar, megaDeviceId might be null or different.
    // Ideally, we should pass the ID the adapter expects.
    // For now, let's stick to what was passed (megaDeviceId) but we might need to verify if Traccar needs something else.
    // Actually, paymentService used `deviceId` (DB id?) for Traccar.
    // Let's pass `megaDeviceId` for MegaRastreo legacy support, but if it's Traccar, it might need `deviceId` (DB ID) or `imei`.
    // Safe bet: Pass both or let the adapter handle it?
    // The previous code passed `megaDeviceId` to `gpsServices.executeAndVerify`.
    // megaRastreoServices1.js's executeAndVerify takes `deviceId`.

    // If company uses Traccar, `megaDeviceId` might be undefined if not set.
    // We should probably rely on `deviceId` (DB ID) if the adapter can handle looking it up, OR ensure we pass the right ID.
    // Given existing `megaRastreoServices1.js` takes `megaDeviceId` (mapped to `deviceId` param), let's prioritize that for MegaRastreo.
    // For Traccar, we might need to check.

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

const performDailyCutOff = async () => {
  logger.info("🕒 Starting daily cut-off process (23:59)...");
  try {


    // 1. Find companies with automatic cut-off enabled
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

      // 2. Fetch active devices for this company
      const devices = await Device.find({
        companyId: company._id,
        hasActiveContract: true,
      }).lean();

      if (!devices || devices.length === 0) {
        logger.info(`No active devices found for company ${company.name}.`);
        continue;
      }

      for (const device of devices) {
        if (device.name !== 'YAG34H') {
          continue;
        }
        console.log(`[DEBUG] Checking device: ${device.name}`);
        try {
          const deviceName = device.name;
          let shouldCutOff = false;

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

          if (strategy === 1) {
            // Strategy 1: Check today's invoice
            console.log(`[DEBUG] Device ${deviceName}: Using Strategy 1 (Today: ${today.format('YYYY-MM-DD')})`);
            const invToday = await invoiceRepository.getInvoiceByDeviceAndDate(deviceName, today.toDate());
            if (!isUpToDate(invToday)) {
              shouldCutOff = true;
            }
          } else if (strategy === 2) {
            // Strategy 2: Check yesterday's invoice
            console.log(`[DEBUG] Device ${deviceName}: Using Strategy 2 (Yesterday: ${yesterday.format('YYYY-MM-DD')})`);
            const invYesterday = await invoiceRepository.getInvoiceByDeviceAndDate(deviceName, yesterday.toDate());
            if (!isUpToDate(invYesterday)) {
              shouldCutOff = true;
            }
          }

          if (shouldCutOff) {
            console.log(`[DEBUG] Device ${deviceName}: SHOULD CUT OFF.`);
            logger.info(`🚫 Cutting off device ${deviceName} (Company: ${company.name}, Strategy: ${strategy}): Unpaid invoice detected.`);

            // 3. Command and Verify engine stop
            await verifyAndMarkCutOff(deviceName, device.deviceId, device.megaDeviceId, company._id);
          } else {
            logger.info(`✅ Device ${deviceName} is up to date.`);
          }
        } catch (innerErr) {
          logger.error(`Error processing cut-off for device ${device.name}:`, innerErr);
        }
      }
    }

    logger.info("✅ Daily cut-off process completed.");
  } catch (err) {
    logger.error("Critical error in performDailyCutOff job:", err);
  }
};

export default {
  generateDailyInvoices,
  performDailyCutOff,
};
