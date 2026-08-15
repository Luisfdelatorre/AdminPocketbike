import logger from "../../config/logger.js";
import dayjs from "../../config/dayjs.js";
import { Company } from "../../models/Company.js";
import { Device } from "../../models/Device.js";
import companyService from "../../services/companyService.js";
import deviceServices from "../../services/deviceServices.js";
import { ENGINESTOP } from "../../config/config.js";

const verifyAndMarkCutOffBatch = async (batch, companyId) => {
  logger.info(`[CUT-OFF] Starting BATCH engine stop verification for ${batch.length} devices in company ${companyId}...`);
  try {
    const gpsAdapter = await companyService.getGpsAdapter(companyId);
    const targetIds = batch.map(d => d.gpsId).filter(Boolean);
    
    const responseIds = await gpsAdapter.executeAndVerifyBatch(targetIds, ENGINESTOP, { companyConfig: companyId });
    
    const successfulIds = batch.filter(d => responseIds.includes(d.gpsId)).map(d => d._id);
    if (successfulIds.length > 0) {
      await Device.updateMany({ _id: { $in: successfulIds } }, { $set: { cutOff: true, cutOffDate: new Date() } });
      logger.info(`[CUT-OFF] Marked ${successfulIds.length} devices as cutOff`);
    }
  } catch (err) {
    logger.error(`[CUT-OFF] Batch error:`, err);
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

export default {
  id: 'performScheduledCutOff',
  name: 'Apagado Automático',
  description: 'Apaga los motores de los dispositivos que tienen facturas vencidas.',
  type: 'company',
  run: performScheduledCutOff
};
