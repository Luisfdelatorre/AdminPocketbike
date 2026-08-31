import logger from "../../config/logger.js";
import paymentService from "../../services/paymentService.js";

const runValidatePayments = async (time) => {
    try {
        logger.info(`[Cron] Execution started: Conciliación de Pagos Pendientes Wompi${time ? ` at ${time}` : ''}`);
        
        // Audit and reconcile all pending Wompi payments (regardless of age)
        const recoveryResults = await paymentService.reconcilePendingPayments(0);
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
