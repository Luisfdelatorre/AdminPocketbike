import { cronLogger as logger } from "../../config/logger.js";
import dayjs from "../../config/dayjs.js";
import { Company } from "../../models/Company.js";
import { Device } from "../../models/Device.js";
import companyService from "../../services/companyService.js";
import deviceServices from "../../services/deviceServices.js";
import { ENGINESTOP } from "../../config/config.js";

const verifyAndMarkCutOffBatch = async (batch, companyId) => {
  logger.info(`[CUT-OFF] Starting BATCH engine stop verification for ${batch.length} devices in company ${companyId}...`);
  try {
    const gpsAdapter = await companyService.getGpsAdapterByCompany(companyId);
    const targetIds = batch.map(d => d.gpsId).filter(Boolean);

    const responseIds = await gpsAdapter.executeAndVerifyBatch(targetIds, ENGINESTOP, { companyConfig: companyId });

    const successfulIds = batch.filter(d => responseIds.includes(d.gpsId)).map(d => d._id);
    if (successfulIds.length > 0) {
      await Device.updateMany(
        { _id: { $in: successfulIds } },
        { $set: { 'telemetry.cutOff': true, cutOffDate: new Date() } }
      );
      logger.info(`[CUT-OFF] Marked ${successfulIds.length} devices as cutOff`);
    }
    const failedIds = batch.filter(d => !responseIds.includes(d.gpsId)).map(d => d._id);
    return { successfulIds, failedIds };
  } catch (err) {
    logger.error(`[CUT-OFF] Batch error:`, err);
    return { successfulIds: [], failedIds: batch.map(d => d._id) };
  }
};

const performScheduledCutOff = async (time, companyIds, options = {}) => {
  const ids = Array.isArray(companyIds) ? companyIds : [companyIds];
  logger.info(`🕒 Starting scheduled cut-off for ${ids.length} companies at ${time}`);
  const executionTime = dayjs();

  const allResults = [];
  let totalSuccessCount = 0;
  let totalAlreadyOffCount = 0;
  let totalFailedCount = 0;

  for (const companyId of ids) {
    try {
      const company = await Company.findById(companyId).lean();
      if (!company || !company.isActive) continue;

      const paymentStatuses = await deviceServices.getCompanyDevicesPaymentStatus(company._id, executionTime);
      const devicesToCutOff = [];

      for (const { device, hasUnpaidInvoice, invoice } of paymentStatuses) {
        if (device.exemptFromCutOff === true) continue;
        if (device.telemetry?.cutOff) {
          totalAlreadyOffCount++;
          allResults.push({
            device: device.deviceName || device.name || device._id,
            status: 'already_off'
          });
          continue;
        }

        const invoiceDate = invoice?.date ?? executionTime.startOf('day').toDate();
        const timeReached = options.forceAllDebtors
          ? true
          : companyService.isInvoiceDue(company, invoiceDate, executionTime);

        if (hasUnpaidInvoice && timeReached) {
          devicesToCutOff.push(device);
        }
      }

      if (devicesToCutOff.length > 0) {
        logger.info(`🚫 Cutting off ${devicesToCutOff.length} devices for Company: ${company.name} at ${time}`);
        const BATCH_SIZE = 10;
        for (let i = 0; i < devicesToCutOff.length; i += BATCH_SIZE) {
          const batch = devicesToCutOff.slice(i, i + BATCH_SIZE);
          const { successfulIds } = await verifyAndMarkCutOffBatch(batch, company._id);

          batch.forEach(d => {
            const isSuccess = successfulIds.some(id => String(id) === String(d._id));
            if (isSuccess) {
              totalSuccessCount++;
              allResults.push({
                device: d.deviceName || d.name || d._id,
                status: 'cut_off'
              });
            } else {
              totalFailedCount++;
              allResults.push({
                device: d.deviceName || d.name || d._id,
                status: 'failed'
              });
            }
          });
        }
      }
    } catch (err) {
      logger.error(`Critical error in performScheduledCutOff for company ${companyId}:`, err);
    }
  }

  return {
    results: allResults,
    successCount: totalSuccessCount,
    alreadyOffCount: totalAlreadyOffCount,
    failedCount: totalFailedCount
  };
};

export { performScheduledCutOff, verifyAndMarkCutOffBatch };

export default {
  id: 'performScheduledCutOff',
  name: 'Apagado Automático',
  description: 'Apaga los motores de los dispositivos que tienen facturas vencidas.',
  type: 'company',
  run: performScheduledCutOff
};
