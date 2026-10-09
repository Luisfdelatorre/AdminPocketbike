import { cronLogger as logger } from "../../config/logger.js";
import dayjs from "../../config/dayjs.js";
import ContractRepository from "../../repositories/contractRepository.js";
import invoiceRepository from "../../repositories/invoiceRepository.js";
import paymentService from "../../services/paymentService.js";

export default {
  id: 'generateDailyInvoices',
  name: 'Generación Diaria de Facturas',
  description: 'Calcula y genera facturas automáticas.',
  type: 'system',
  run: async () => {
    try {
      const today = dayjs().startOf('day').toDate();
      const todayStr = dayjs(today).format('YYYY-MM-DD');
      logger.info("🚀 Starting global daily invoice generation for:", todayStr);

      // Fetch all active contracts across the system in a single batch query
      const activeContracts = await ContractRepository.getActiveContracts();

      if (!activeContracts || activeContracts.length === 0) {
        logger.info('No active contracts found for invoice generation.');
        return;
      }

      logger.info(`🚀 Found ${activeContracts.length} active contracts for processing.`);

      // 1. Obtener Lista A: Lista de deviceIdName que YA tienen factura generada para hoy
      const existingDeviceNames = await invoiceRepository.getExistingDeviceNamesForDate(today);
      const listA = new Set(existingDeviceNames);

      // 2. Filtrar los contratos activos cuyo deviceIdName NO está en la Lista A
      const missingContracts = activeContracts.filter(c => !listA.has(c.deviceIdName));

      logger.info(`📊 Estado de Facturas Diarias: ${listA.size} ya generadas (Lista A), ${missingContracts.length} faltantes por crear.`);

      // 4. Pass ONLY the filtered missing contracts to bulk creation
      if (missingContracts.length > 0) {
        const bulkResult = await invoiceRepository.bulkCreateInvoicesForContracts(missingContracts, today);
        logger.info(`✨ Bulk created ${bulkResult.created} missing daily invoices.`);
      }

      // 5. Apply Automatic Fixed Free Day policy in bulk for matching contracts
      const freeDayContracts = activeContracts.filter(c => 
        c.freeDayPolicy === 'FIXED_WEEKDAY' && today.getDay() === c.fixedFreeDayOfWeek
      );

      if (freeDayContracts.length > 0) {
        logger.info(`🎉 Found ${freeDayContracts.length} contracts matching today's Fixed Free Day policy. Applying in bulk...`);
        await paymentService.applyFreeDayAutomaticBulk(freeDayContracts, today);
      }
    } catch (err) {
      logger.error('Error generando invoices diarios', err);
    }
  }
};
