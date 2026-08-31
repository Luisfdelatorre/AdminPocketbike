import logger from "../../config/logger.js";
import webhookService from "../../services/webhookService.js";

const runValidatePayments = async (time) => {
    try {
        logger.info(`[Cron] Execution started: Conciliación de Pagos Pendientes Wompi${time ? ` at ${time}` : ''}`);
        
        // Audit and reconcile pending Wompi payments older than 5 minutes
        const recoveryResults = await webhookService.recoverPendingPayments(5);
        logger.info(`[Cron] Wompi pending payment recovery completed: ${recoveryResults?.length || 0} payments processed`);

        logger.info("[Cron] Execution finished: Conciliación de Pagos Pendientes Wompi");
    } catch (error) {
        logger.error(`[Cron] Error in validatePayments: ${error.message}`);
    }
};

export default {
    id: 'validatePayments',
    name: 'Validar Pagos',
    description: 'Concilia automáticamente transacciones pendientes con Wompi cada 5 minutos.',
    type: 'system',
    run: runValidatePayments
};
