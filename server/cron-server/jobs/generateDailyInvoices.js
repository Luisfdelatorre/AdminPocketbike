import logger from "../../config/logger.js";
import dayjs from "../../config/dayjs.js";
import { Company } from "../../models/Company.js";
import { Device } from "../../models/Device.js";
import { Invoice } from "../../models/Invoice.js";
import ContractRepository from "../../repositories/contractRepository.js";
import invoiceRepository from "../../repositories/invoiceRepository.js";
import paymentService from "../../services/paymentService.js";
import companyService from "../../services/companyService.js";

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

export default {
  id: 'generateDailyInvoices',
  name: 'Generación Diaria de Facturas',
  description: 'Calcula y genera facturas automáticas (más sincronización de KMs).',
  type: 'system',
  run: async () => {
    try {
      const today = dayjs().startOf('day').toDate();
      logger.info("🚀 Starting global daily invoice generation for:", today);

      const enabledCompanies = await Company.find({ automaticInvoicing: true, isActive: true }).lean();

      if (!enabledCompanies || enabledCompanies.length === 0) {
        logger.info('No companies have automatic invoicing enabled. Skipping.');
        return;
      }

      const companyIds = enabledCompanies.map(c => c._id);

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

      await syncYesterdayKm();
    } catch (err) {
      logger.error('Error generando invoices diarios', err);
    }
  }
};
