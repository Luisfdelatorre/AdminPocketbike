import { cronLogger as logger } from "../../config/logger.js";
import { Device } from "../../models/Device.js";
import companyService from "../../services/companyService.js";
import deviceServices from "../../services/deviceServices.js";
import { ENGINERESUME } from "../../config/config.js";

const performCurfewEnd = async (time, companyIds) => {
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
        return !hasUnpaid && !device.telemetry?.cutOff;
      });

      logger.info(`[CURFEW] Out of ${curfewDevices.length} curfew devices, resuming ${devicesToResume.length} (unpaid or already cut-off skipped).`);

      const gpsAdapter = await companyService.getGpsAdapterByCompany(companyId);

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
  id: 'performCurfewEnd',
  name: 'Fin de Toque de Queda',
  description: 'Restaura el encendido de los motores al terminar el toque de queda (omitiendo los que tengan deudas).',
  type: 'company',
  run: performCurfewEnd
};
