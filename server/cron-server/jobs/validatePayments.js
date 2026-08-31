import logger from "../../config/logger.js";
import dayjs from "../../config/dayjs.js";
import { Company } from "../../models/Company.js";
import companyService from "../../services/companyService.js";
import deviceServices from "../../services/deviceServices.js";

const runValidatePayments = async (time, companyIds = []) => {
    try {
        logger.info(`[Cron] Execution started: Validación Diaria de Pagos${time ? ` at ${time}` : ''}`);
        const executionTime = dayjs();
        const filter = Array.isArray(companyIds) && companyIds.length > 0 ? { _id: { $in: companyIds } } : { isActive: { $ne: false } };
        const companies = await Company.find(filter).lean();

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
    description: 'Valida los pagos diarios y actualiza los estados de cuenta respetando el horario de corte de cada empresa.',
    type: 'system',
    run: runValidatePayments
};
