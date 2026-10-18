import { cronLogger as logger } from "../../config/logger.js";
import companyRepository from "../../repositories/companyRepository.js";
import companyService from "../../services/companyService.js";

const runDeviceStatusUpdate = async () => {
    try {
        logger.info("[Cron] Execution started: Revisión de Estado de Dispositivos (Telemetría y Conexión GPS)");
        const companies = await companyRepository.getActiveCompanies();

        for (const company of companies) {
            try {
                const gpsAdapter = await companyService.getGpsAdapterByCompany(company._id);
                if (gpsAdapter && typeof gpsAdapter.getDevices === 'function') {
                    const devices = await gpsAdapter.getDevices();
                    logger.info(`[Cron] Fetched status for ${devices?.length || 0} GPS devices in Company "${company.name}"`);
                }
            } catch (err) {
                logger.error(`[Cron] Error updating device statuses for company ${company._id}: ${err.message}`);
            }
        }

        logger.info("[Cron] Execution finished: Revisión de Estado de Dispositivos");
    } catch (error) {
        logger.error(`[Cron] Error in DeviceStatusUpdate: ${error.message}`);
    }
};

export default {
    id: 'DeviceStatusUpdate',
    name: 'Revisión Dispositivos',
    description: 'Actualiza el estado de conexión GPS (online/offline) y telemetría de los dispositivos periódicamente.',
    type: 'system',
    run: runDeviceStatusUpdate
};
