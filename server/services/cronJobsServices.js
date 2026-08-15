import logger from "../config/logger.js";
import ContractRepository from "../repositories/contractRepository.js";
import invoiceRepository from "../repositories/invoiceRepository.js";
import dayjs from "../config/dayjs.js";
import { Company } from "../models/Company.js";
import companyService from "./companyService.js";

import { Device } from "../models/Device.js";
import { Invoice } from "../models/Invoice.js";
import { Transaction } from "../config/config.js";


const { MAX_RETRY_ATTEMPTS, RETRY_CHECK_INTERVAL } = Transaction;

import paymentService from './paymentService.js';
import deviceServices from "./deviceServices.js";


async function performScheduledTasks(time, getEntry) {
  const entry = getEntry(); // lectura en vivo de this.scheduledMap.get(time), resuelta en este instante
  if (!entry) return;

  const { cutOff, curfewStart, curfewEnd } = entry;
  const cutOffIds = [...cutOff];
  const curfewStartIds = [...curfewStart];
  const curfewEndIds = [...curfewEnd];
  if (cutOffIds.length) {
    try {
      await performScheduledCutOff(time, cutOffIds);
    } catch (err) {
      logger.error(`❌ Error cutOff ${time}:`, err);
    }
  }
  if (curfewStartIds.length) {
    try {
      await performCurfewStart(curfewStartIds);
    } catch (err) {
      logger.error(`❌ Error curfewStart ${time}:`, err);
    }
  }
  if (curfewEndIds.length) {
    try {
      await performCurfewEnd(curfewEndIds);
    } catch (err) {
      logger.error(`❌ Error curfewEnd ${time}:`, err);
    }
  }
}

const generateDailyInvoices = async () => {
  try {
    // Use today's date, normalized to start of day
    const today = dayjs().startOf('day').toDate();//subtract a day dayjs().subtract(1, 'day').startOf('day').toDate();
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

        if (device.dailyRate > 0) {
          const invoice = await invoiceRepository.findOrCreateInvoiceByName(contract, today);
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

    // Automatically sync yesterday's km from Traccar
    await syncYesterdayKm();
  } catch (err) {
    logger.error('Error generando invoices diarios', err);
  }
};

const syncYesterdayKm = async () => {
  try {
    const yesterday = dayjs().subtract(1, 'day').startOf('day');
    const yesterdayStr = yesterday.format('YYYY-MM-DD');
    const companies = await Company.find({ isActive: true }).lean();

    for (const company of companies) {
      try {
        const gpsAdapter = await companyService.getGpsAdapter(company._id);
        if (!gpsAdapter?.adapter?.fetchPreviousDayKmDevice) continue;

        const devices = await Device.find({ companyId: company._id }).lean();
        const gpsIds = devices.map(d => d.gpsId).filter(Boolean);

        const kmData = await gpsAdapter.adapter.fetchPreviousDayKmDevice(new Date(), gpsIds);
        if (!kmData || !Array.isArray(kmData)) continue;

        const kmMap = {};
        for (const report of kmData) {
          const distanceKm = Math.round((report.distance || 0) / 1000 * 10) / 10;
          kmMap[report.deviceId] = distanceKm;
        }

        for (const device of devices) {
          const distanceKm = kmMap[device.gpsId];
          if (distanceKm === undefined) continue;
          const invoiceId = `${device.name}-${yesterdayStr}`;
          await Invoice.updateOne(
            { _id: invoiceId },
            { $set: { distance: distanceKm } }
          );
        }
      } catch (cErr) {
        logger.error(`[KM SYNC] Error for company ${company.name}:`, cErr);
      }
    }
  } catch (err) {
    logger.error('Error syncing yesterday km in cron:', err);
  }
};


const performScheduledCutOff = async (time, companyIds) => {
  logger.info(`🕒 Starting scheduled cut-off for ${companyIds.length} companies at ${time}`);
  const executionTime = dayjs();

  for (const companyId of companyIds) {
    try {
      const company = await Company.findById(companyId).lean();
      if (!company || !company.isActive) continue;

      const paymentStatuses = await deviceServices.getCompanyDevicesPaymentStatus(company._id, executionTime);
      const devicesToCutOff = [];

      for (const { device, hasUnpaidInvoice, invoice } of paymentStatuses) {
        if (device.exemptFromCutOff === true) continue;
        if (device.cutOff) continue;

        const invoiceDate = invoice?.date ?? executionTime.startOf('day').toDate();
        const timeReached = companyService.isInvoiceDue(company, invoiceDate, executionTime);

        if (hasUnpaidInvoice && timeReached) {
          devicesToCutOff.push(device);
        }
      }

      if (devicesToCutOff.length > 0) {
        logger.info(`🚫 Cutting off ${devicesToCutOff.length} devices for Company: ${company.name} at ${time}`);
        const BATCH_SIZE = 10;
        for (let i = 0; i < devicesToCutOff.length; i += BATCH_SIZE) {
          const batch = devicesToCutOff.slice(i, i + BATCH_SIZE);
          await verifyAndMarkCutOffBatch(batch, company._id);
        }
      }
    } catch (err) {
      logger.error(`Critical error in performScheduledCutOff for company ${companyId}:`, err);
    }
  }
};

const performCurfewStart = async (companyIds) => {
  logger.info(`🌙 Starting Night Curfew for ${companyIds.length} companies.`);
  for (const companyId of companyIds) {
    try {
      logger.info(`🌙 Processing Night Curfew for company: ${companyId}`);
      const devices = await Device.find({
        companyId,
        hasActiveContract: true,
        exemptFromCutOff: { $ne: true },
        cutOff: { $ne: true }
      }).lean();

      if (!devices || devices.length === 0) continue;

      logger.info(`[CURFEW] Stopping ${devices.length} devices.`);
      const gpsAdapter = await companyService.getGpsAdapter(companyId);

      const BATCH_SIZE = 10;
      for (let i = 0; i < devices.length; i += BATCH_SIZE) {
        const batch = devices.slice(i, i + BATCH_SIZE);
        const targetIds = batch.map(d => d.gpsId).filter(Boolean);

        const responseIds = await gpsAdapter.executeAndVerifyBatch(targetIds, ENGINESTOP, {
          companyConfig: companyId
        });

        // Update curfewStatus=true for all that were successfully stopped
        const successfulIds = batch.filter(d => responseIds.includes(d.gpsId)).map(d => d._id);
        if (successfulIds.length > 0) {
          await Device.updateMany({ _id: { $in: successfulIds } }, { $set: { curfewStatus: true } });
          logger.info(`[CURFEW] Successfully turned off ${successfulIds.length} devices.`);
        }
      }
    } catch (err) {
      logger.error(`[CURFEW START] Error for company ${companyId}:`, err);
    }
  }
};

const performCurfewEnd = async (companyIds) => {
  logger.info(`☀️ Ending Night Curfew for ${companyIds.length} companies.`);
  for (const companyId of companyIds) {
    try {
      logger.info(`☀️ Processing Curfew End for company: ${companyId}`);
      // 1. Find all active contract devices for this company that were off due to curfew
      const curfewDevices = await Device.find({
        companyId,
        hasActiveContract: true,
        exemptFromCutOff: { $ne: true },
        curfewStatus: true
      }).lean();

      if (!curfewDevices || curfewDevices.length === 0) {
        logger.info(`[CURFEW END] No devices pending resume for company: ${companyId}`);
        continue;
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
        return !hasUnpaid && !device.cutOff;
      });

      logger.info(`[CURFEW] Out of ${curfewDevices.length} curfew devices, resuming ${devicesToResume.length} (unpaid or already cut-off skipped).`);

      const gpsAdapter = await companyService.getGpsAdapter(companyId);

      const BATCH_SIZE = 10;
      for (let i = 0; i < curfewDevices.length; i += BATCH_SIZE) {
        const batchAll = curfewDevices.slice(i, i + BATCH_SIZE);
        const batchToResume = devicesToResume.filter(d => batchAll.some(b => b._id.toString() === d._id.toString()));

        if (batchToResume.length > 0) {
          const targetIds = batchToResume.map(d => d.gpsId).filter(Boolean);
          await gpsAdapter.executeAndVerifyBatch(targetIds, ENGINERESUME, {
            companyConfig: companyId
          });
        }

        // Clear curfewStatus = false for all attempted in this batch to prevent infinite loops
        const idsToClear = batchAll.map(d => d._id);
        await Device.updateMany({ _id: { $in: idsToClear } }, { $set: { curfewStatus: false } });
      }
    } catch (err) {
      logger.error(`[CURFEW END] Error for company ${companyId}:`, err);
    }
  }
};

export default {
  generateDailyInvoices,
  performCurfewStart,
  performCurfewEnd,
  performScheduledTasks
};
