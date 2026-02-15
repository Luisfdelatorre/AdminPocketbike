import logger from "../config/logger.js";
import ContractRepository from "../repositories/contractRepository.js";
import invoiceRepository from "../repositories/invoiceRepository.js";
import deviceRepository from "../repositories/deviceRepository.js";
import dayjs from "../config/dayjs.js";
import { Company } from "../models/Company.js";
import gpsServices from "./megaRastreoServices1.js";
import { Device } from "../models/Device.js";
import { Transaction } from "../config/config.js";

const { MAX_RETRY_ATTEMPTS, RETRY_CHECK_INTERVAL } = Transaction;


//const dayjs = require('../config/dayjs');
//const activationQueue = require('./ActivationQueueService');
// Start the queue service
//activationQueue.start();

const generateDailyInvoices = async () => {
  try {
    // Use today's date, normalized to start of day
    const today = dayjs().startOf('day').toDate();
    console.log("🚀 Generating daily invoices for:", today);

    // 1. Find companies with automatic invoicing enabled

    const enabledCompanies = await Company.find({ automaticInvoicing: true }).select('_id');


    if (!enabledCompanies || enabledCompanies.length === 0) {
      logger.info('No companies have automatic invoicing enabled. Skipping daily invoice generation.');
      return;
    }

    const enabledCompanyIds = enabledCompanies.map(c => c._id);
    console.log("🚀 Enabled companies:", enabledCompanyIds);
    // 2. Fetch contracts only for these companies
    // Assuming ContractRepository allows filtering by companyId (using $in)
    const contracts = await ContractRepository.getAllContracts({ companyId: { $in: enabledCompanyIds } });
    if (!contracts || contracts.length === 0) {
      logger.info('No active contracts found for enabled companies.');
      return;
    }

    for (const contract of contracts) {
      // Check for active contract
      const device = await deviceRepository.getDeviceByName(contract.deviceIdName);
      console.log("🚀 Device:", device);
      if (device) {
        const amount = contract.dailyRate;
        const invoice = await invoiceRepository.findOrCreateInvoiceByName(
          device.name,//deviceIdName
          device.webDeviceId,//deviceId
          amount,//dailyRate
          today,//date
          contract.companyId
        );
        logger.info('Invoice generado:', invoice._id);
      }
    }
  } catch (err) {
    logger.error('Error generando invoices diarios', err);
  }
};
const validatePayments = async () => {
  /*try {
    const devices = await storage.getDevices();
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    if (!devices || devices.length === 0) {
      logger.warn('No devices found for status check.');
      return;
    }

    for (const device of devices) {
      try {
        const name = normalizeName(device.name);
        // 1 Check payment status (find latest paid invoice)
        const latestPaid = await storage.findLatestPaidInvoice(name);
        const engineStatus = await traccarApi.checkDeviceStatus(device.getId());

        if (latestPaid && new Date(latestPaid.date) >= today) {
          // PAID: Ensure it is active
          // if (engineStatus === 0) {
          // Locked -> Resume
          await activationQueue.add(device.getId(), 'activate');
          logger.info('ER', { name: device.name, reason: 'Payment up-to-date' });
          // }
        } else {
          // NOT PAID: Ensure it is stopped
          // Check for LOAN exception
          const oldestUnpaid = await invoiceRepository.findLastUnPaid(name); // Use repository method which calls model

          if (oldestUnpaid && oldestUnpaid.dayType === 'LOAN') {
            // Exception: Loan active -> Resume/Keep Active
            await activationQueue.add(device.getId(), 'activate');
            logger.info('ER', { name: device.name, reason: 'Active Loan' });
          } else if (engineStatus === 1) {
            
            await activationQueue.add(device.getId(), 'deactivate');
            logger.info('ES', { name: device.name, reason: 'Payment overdue' });
          }
        }
      } catch (innerErr) {
        logger.error(`Error processing device ${device.name}`, innerErr);
      }
    }
  } catch (err) {
    logger.error('Error checking all devices', err);
  }*/
};

const performDailyCutOff = async () => {
  try {
    logger.info("🕒 Starting daily cut-off process (23:59)...");

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
        isDeleted: false,
        disabled: false
      }).lean();

      if (!devices || devices.length === 0) {
        logger.info(`No active devices found for company ${company.name}.`);
        continue;
      }

      for (const device of devices) {
        try {
          const deviceName = device.name;
          let shouldCutOff = false;

          // Helper to check if an invoice is "OK" (paid or special)
          const isUpToDate = (inv) => {
            if (!inv) return true; // No invoice for this day -> treated as OK
            if (inv.paid) return true;
            const specialTypes = ['FREE', 'FREEPASS', 'LOAN'];
            return specialTypes.includes(inv.dayType);
          };

          if (strategy === 1) {
            // Strategy 1: Check today's invoice
            const invToday = await invoiceRepository.findByDate(deviceName, today.toDate());
            if (!isUpToDate(invToday)) {
              shouldCutOff = true;
            }
          } else if (strategy === 2) {
            // Strategy 2: Check yesterday's invoice
            const invYesterday = await invoiceRepository.findByDate(deviceName, yesterday.toDate());
            if (!isUpToDate(invYesterday)) {
              shouldCutOff = true;
            }
          }

          if (shouldCutOff) {
            logger.info(`🚫 Cutting off device ${deviceName} (Company: ${company.name}, Strategy: ${strategy}): Unpaid invoice detected.`);

            // 3. Command engine stop
            const responseId = await gpsServices.stopDevice(device.deviceId);

            // Verify command confirmation
            let confirmed = false;
            for (let attempt = 1; attempt <= MAX_RETRY_ATTEMPTS; attempt++) {
              await new Promise(r => setTimeout(r, RETRY_CHECK_INTERVAL));
              try {
                confirmed = await gpsServices.checkDeviceStatus(responseId);
                if (confirmed) {
                  logger.info(`[CUT-OFF] Device ${deviceName} engine stop confirmed after ${attempt} attempts.`);
                  break;
                }
              } catch (error) {
                logger.warn(`[CUT-OFF] Check attempt ${attempt} for ${deviceName} failed:`, error.message);
              }
            }

            if (!confirmed) {
              logger.warn(`[CUT-OFF] Device ${deviceName} engine stop command sent but not confirmed after retries.`);
              // 4. Update database flag (2 = Sent but not confirmed)
              await deviceRepository.updateCutOffStatus(device.deviceId, 2);
            } else {
              // 4. Update database flag (1 = Confirmed)
              await deviceRepository.updateCutOffStatus(device.deviceId, 1);
            }
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
  validatePayments,
  performDailyCutOff,
};
