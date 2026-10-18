import logger from "../../config/logger.js";
import dayjs from "../../config/dayjs.js";
import companyRepository from "../../repositories/companyRepository.js";
import deviceRepository from "../../repositories/deviceRepository.js";
import invoiceRepository from "../../repositories/invoiceRepository.js";
import companyService from "../../services/companyService.js";

const runSyncYesterdayKm = async () => {
  try {
    logger.info("[Cron] Execution started: Sincronización de Kilometraje del Día Anterior");
    const yesterday = dayjs().subtract(1, 'day').startOf('day');
    const yesterdayStr = yesterday.format('YYYY-MM-DD');
    const companies = await companyRepository.getActiveCompanies();

    let totalUpdated = 0;

    for (const company of companies) {
      try {
        const gpsAdapter = await companyService.getGpsAdapterByCompany(company._id);
        if (!gpsAdapter?.adapter?.fetchPreviousDayKmDevice) continue;

        const devices = await deviceRepository.getDevicesByCompanyId(company._id);
        const gpsIds = devices.map(d => d.gpsId).filter(Boolean);

        if (gpsIds.length === 0) continue;

        const kmData = await gpsAdapter.adapter.fetchPreviousDayKmDevice(new Date(), gpsIds);
        if (!kmData || !Array.isArray(kmData)) continue;

        const kmMap = {};
        for (const report of kmData) {
          kmMap[report.deviceId] = report.distanceKm ?? 0;
        }

        const updateItems = [];
        for (const device of devices) {
          const distanceKm = kmMap[device.gpsId];
          if (distanceKm === undefined) continue;
          updateItems.push({
            invoiceId: `${device.name}-${yesterdayStr}`,
            distance: distanceKm
          });
        }

        if (updateItems.length > 0) {
          const res = await invoiceRepository.bulkUpdateInvoiceDistances(updateItems);
          totalUpdated += res.modifiedCount || 0;
        }
      } catch (cErr) {
        logger.error(`[KM SYNC] Error for company ${company.name}:`, cErr);
      }
    }
    logger.info(`[Cron] Execution finished: Sincronización de Kilometraje (${totalUpdated} facturas actualizadas)`);
  } catch (err) {
    logger.error('Error syncing yesterday km in cron:', err);
  }
};

export { runSyncYesterdayKm as syncYesterdayKm, runSyncYesterdayKm };

export default {
  id: 'syncYesterdayKm',
  name: 'Sincronizar Kilómetros del Día Anterior',
  description: 'Obtiene el reporte de kilometraje de Traccar/GPS del día anterior y actualiza las facturas correspondientes.',
  type: 'system',
  run: runSyncYesterdayKm
};
