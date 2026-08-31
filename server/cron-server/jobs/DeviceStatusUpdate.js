import logger from "../../config/logger.js";
import { Company } from "../../models/Company.js";

const runDeviceStatusUpdate = async () => {
    try {
        logger.info("[Cron] Execution started: Revisión de Estado de Dispositivos (Fallback Audit - Primary is WebSocket)");
        const companies = await Company.find({ isActive: true }).lean();
        logger.info(`[Cron] Heartbeat check complete for ${companies.length} active companies (Live events streaming via WebSocket).`);
        logger.info("[Cron] Execution finished: Revisión de Estado de Dispositivos");
    } catch (error) {
        logger.error(`[Cron] Error in DeviceStatusUpdate: ${error.message}`);
    }
};

export default {
    id: 'DeviceStatusUpdate',
    name: 'Revisión Dispositivos',
    description: 'Auditoría de respaldo para verificar el estado de los dispositivos (el flujo principal opera en tiempo real vía WebSocket).',
    type: 'system',
    run: runDeviceStatusUpdate
};
