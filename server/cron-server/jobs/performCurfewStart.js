import logger from "../../config/logger.js";
import { Device } from "../../models/Device.js";
import companyService from "../../services/companyService.js";
import { ENGINESTOP } from "../../config/config.js";

const performCurfewStart = async (time, companyIds) => {
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

export default {
  id: 'performCurfewStart',
  name: 'Inicio de Toque de Queda',
  description: 'Apaga los motores de todos los dispositivos al llegar la hora de toque de queda nocturno.',
  type: 'company',
  run: performCurfewStart
};
