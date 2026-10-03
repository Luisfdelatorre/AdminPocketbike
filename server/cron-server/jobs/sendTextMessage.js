import { cronLogger as logger } from "../../config/logger.js";

const runSendTextMessage = async () => {
    try {
        logger.info("[Cron] Execution started: Envío de Mensajes SMS");
        // TODO: Implement SMS sending logic
        logger.info("[Cron] Execution finished: Envío de Mensajes SMS");
    } catch (error) {
        logger.error(`[Cron] Error in sendTextMessage: ${error.message}`);
    }
};

export default {
    id: 'sendTextMessage',
    name: 'Envío de SMS',
    description: 'Envía mensajes de texto programados a los usuarios.',
    type: 'system',
    run: runSendTextMessage
};
