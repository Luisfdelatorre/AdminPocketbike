import logger from "../config/logger.js";
import ContractRepository from "../repositories/contractRepository.js";
// const { registerTransaction, addDayliInvoice } = require('../googleSheet');
import invoiceRepository from "../repositories/invoiceRepository.js";
import deviceRepository from "../repositories/deviceRepository.js";
import dayjs from "../config/dayjs.js";
import { Company } from "../models/Company.js";

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

export default {
  generateDailyInvoices,
  validatePayments,
};
