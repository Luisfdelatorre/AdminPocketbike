import { cronLogger as logger } from "../../config/logger.js";
import dayjs from "../../config/dayjs.js";
import companyRepository from "../../repositories/companyRepository.js";
import deviceRepository from "../../repositories/deviceRepository.js";
import invoiceRepository from "../../repositories/invoiceRepository.js";
import companyService from "../../services/companyService.js";
import { Invoice } from "../../models/Invoice.js";

const syncDailyKm = async (now = new Date()) => {
  try {
    logger.info("[Cron] Execution started: Sincronización de Kilometraje Diario");
    const companies = await companyRepository.getActiveCompanies();

    let totalUpdated = 0;

    for (const company of companies) {
      try {
        const gpsAdapter = await companyService.getGpsAdapterByCompany(company._id);
        const odoMap = await gpsAdapter.fetchLatestOdometerMap();
        const devices = await deviceRepository.getDevicesByCompanyId(company._id);

        const updateInvoices = [];
        const updateDevices = [];

        if (devices && devices.length > 0) {
          for (const device of devices) {
            const gpsKey = device.gpsId != null ? String(device.gpsId).trim() : null;
            const currentTotalKm = (gpsKey && odoMap[gpsKey] != null) ? odoMap[gpsKey] : null;

            if (currentTotalKm == null) {
              continue; // Sin reporte de posición GPS
            }

            const previousTotalKm = device.telemetry?.totalKm;
            let dayDistance = 0;

            if (previousTotalKm != null && currentTotalKm >= previousTotalKm) {
              dayDistance = Math.round((currentTotalKm - previousTotalKm) * 10) / 10;
            }

            updateInvoices.push({
              invoiceId: Invoice.generateInvoiceId(device.name, now),
              distance: dayDistance
            });

            updateDevices.push({
              deviceId: device._id,
              totalKm: currentTotalKm
            });
          }
        }

        if (updateInvoices.length > 0) {
          const res = await invoiceRepository.bulkUpdateInvoiceDistances(updateInvoices);
          totalUpdated += res.modifiedCount || 0;
        }

        if (updateDevices.length > 0) {
          await deviceRepository.bulkUpdateDeviceOdometers(updateDevices);
        }

        logger.info(`[KM SYNC] Empresa ${company.name}: ${updateInvoices.length} dispositivos procesados`);
      } catch (cErr) {
        logger.error(`[KM SYNC] Error for company ${company.name}:`, cErr);
      }
    }

    logger.info(`[Cron] Execution finished: Sincronización de Kilometraje Diario (${totalUpdated} facturas actualizadas)`);
  } catch (err) {
    logger.error('Error syncing daily km in cron:', err);
  }
};

/**
 * Método 2: Sincronización histórica del día anterior consultando el reporte de resumen de Traccar.
 * Permite agregar/recalcular los kilómetros de ayer mediante api/reports/summary.
 */
const syncYesterdayKm = async (date = new Date()) => {
  try {
    const yesterday = dayjs(date).subtract(1, 'day').startOf('day');
    logger.info(`[Cron] Execution started: Sincronización de Kilometraje de Ayer (${yesterday.format('YYYY-MM-DD')})`);
    const companies = await companyRepository.getActiveCompanies();

    let totalUpdated = 0;

    for (const company of companies) {
      try {
        const gpsAdapter = await companyService.getGpsAdapterByCompany(company._id);
        const fetchFn = gpsAdapter?.adapter?.fetchPreviousDayKmDevice || gpsAdapter?.fetchPreviousDayKmDevice;

        if (typeof fetchFn !== 'function') {
          logger.warn(`[KM SYNC YESTERDAY] Skipping company ${company.name}: GPS adapter does not implement fetchPreviousDayKmDevice`);
          continue;
        }

        const devices = await deviceRepository.getDevicesByCompanyId(company._id);
        const gpsIds = devices.map(d => d.gpsId).filter(Boolean);

        if (gpsIds.length === 0) continue;

        const kmData = await fetchFn.call(gpsAdapter.adapter || gpsAdapter, date, gpsIds);
        if (!kmData || !Array.isArray(kmData)) continue;

        const kmMap = {};
        for (const report of kmData) {
          if (report.deviceId != null) {
            kmMap[String(report.deviceId).trim()] = report.distanceKm ?? 0;
          }
        }

        const updateInvoices = [];
        for (const device of devices) {
          if (!device.gpsId) continue;
          const key = String(device.gpsId).trim();
          const distanceKm = kmMap[key];
          if (distanceKm === undefined) continue;

          updateInvoices.push({
            invoiceId: Invoice.generateInvoiceId(device.name, yesterday.toDate()),
            distance: distanceKm
          });
        }

        if (updateInvoices.length > 0) {
          const res = await invoiceRepository.bulkUpdateInvoiceDistances(updateInvoices);
          totalUpdated += res.modifiedCount || 0;
        }

        logger.info(`[KM SYNC YESTERDAY] Empresa ${company.name}: ${updateInvoices.length} facturas actualizadas`);
      } catch (cErr) {
        logger.error(`[KM SYNC YESTERDAY] Error for company ${company.name}:`, cErr);
      }
    }

    logger.info(`[Cron] Execution finished: Sincronización de Kilometraje de Ayer (${totalUpdated} facturas actualizadas)`);
  } catch (err) {
    logger.error('Error syncing yesterday km:', err);
  }
};

export { syncDailyKm, syncYesterdayKm };

export default {
  id: 'syncDailyKm',
  name: 'Sincronizar Kilómetros del Día',
  description: 'Obtiene el reporte de kilometraje de Traccar/GPS del día y actualiza las facturas correspondientes.',
  type: 'system',
  run: syncDailyKm,
  syncDailyKm,
  syncYesterdayKm
};
