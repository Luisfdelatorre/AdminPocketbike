import logger from "../../config/logger.js";
import dayjs from "../../config/dayjs.js";
import companyRepository from "../../repositories/companyRepository.js";
import companyService from "../../services/companyService.js";
import deviceServices from "../../services/deviceServices.js";
import webhookService from "../../services/webhookService.js";

const runValidatePayments = async (time, companyIds = []) => {
    try {
        logger.info(`[Cron] Execution started: Validación Diaria de Pagos${time ? ` at ${time}` : ''}`);
        
        // 1. Audit pending Wompi payments older than 5 minutes
        try {
            logger.info("[Cron] Checking for pending Wompi payments...");
            const recoveryResults = await webhookService.recoverPendingPayments(5);
            logger.info(`[Cron] Wompi pending payment recovery completed: ${recoveryResults?.length || 0} payments checked`);
        } catch (wompiErr) {
            logger.error(`[Cron] Error recovering pending Wompi payments: ${wompiErr.message}`);
        }

        // 2. Audit daily invoice debt status for active companies
        const executionTime = dayjs();
        const allActive = await companyRepository.getActiveCompanies();
        const companies = Array.isArray(companyIds) && companyIds.length > 0
            ? allActive.filter(c => companyIds.includes(c._id.toString()))
            : allActive;

        for (const company of companies) {
            try {
                const paymentStatuses = await deviceServices.getCompanyDevicesPaymentStatus(company._id, executionTime);
                let dueCount = 0;

                for (const { device, hasUnpaidInvoice, invoice } of paymentStatuses) {
                    const invoiceDate = invoice?.date ?? executionTime.startOf('day').toDate();
                    const isDue = companyService.isInvoiceDue(company, invoiceDate, executionTime);
                    if (hasUnpaidInvoice && isDue) {
                        dueCount++;
                    }
                }

                logger.info(`[Cron] Validation for Company "${company.name}" (CutOffTime: ${company.cutOffTime || '23:59'}, Strategy: ${company.cutOffStrategy || 1}): ${dueCount} devices with due debt`);
            } catch (compErr) {
                logger.error(`[Cron] Error validating payments for company ${company._id}: ${compErr.message}`);
            }
        }

        logger.info("[Cron] Execution finished: Validación Diaria de Pagos");
    } catch (error) {
        logger.error(`[Cron] Error in validatePayments: ${error.message}`);
    }
};

export default {
    id: 'validatePayments',
    name: 'Validar Pagos',
    description: 'Concilia pagos pendientes con Wompi y valida estados de cuenta respetando el horario de corte de cada empresa.',
    type: 'system',
    run: runValidatePayments
};
