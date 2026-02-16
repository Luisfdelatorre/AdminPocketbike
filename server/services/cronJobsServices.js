import logger from "../config/logger.js";
import ContractRepository from "../repositories/contractRepository.js";
import invoiceRepository from "../repositories/invoiceRepository.js";
import deviceRepository from "../repositories/deviceRepository.js";
import dayjs from "../config/dayjs.js";
import { Company } from "../models/Company.js";
import gpsServices from "./megaRastreoServices1.js";
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
            device.webDeviceId, // deviceId
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
const verifyAndMarkCutOff = async (deviceName, deviceId, webDeviceId) => {
  logger.info(`[CUT-OFF] Device ${deviceName} engine stop verification starting...`);

  const confirmed = await gpsServices.executeAndVerify(webDeviceId, ENGINESTOP, {
    maxAttempts: MAX_RETRY_ATTEMPTS,
    interval: RETRY_CHECK_INTERVAL
  });

  if (!confirmed) {
    logger.warn(`[CUT-OFF] Device ${deviceName} engine stop command not confirmed after retries.`);
    // Update database flag (2 = Sent but not confirmed)
    await deviceRepository.updateCutOffStatus(deviceId, 2);
  } else {
    logger.info(`[CUT-OFF] Device ${deviceName} engine stop confirmed.`);
    // Update database flag (1 = Confirmed)
    await deviceRepository.updateCutOffStatus(deviceId, 1);
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
            await verifyAndMarkCutOff(deviceName, device.deviceId, device.webDeviceId);
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
