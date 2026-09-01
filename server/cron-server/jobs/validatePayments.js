import logger from "../../config/logger.js";
import paymentService from "../../services/paymentService.js";

const runValidatePayments = async (time) => {
    try {
        const recoveryResults = await paymentService.reconcilePendingPayments(0);
        if (recoveryResults && recoveryResults.length > 0) {
            logger.info(`[Cron] Wompi pending payment recovery completed: ${recoveryResults.length} payments processed`);
        }
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
