import invoiceRepository from '../repositories/invoiceRepository.js';
import paymentRepository from '../repositories/paymentRepository.js';
import contractRepository from '../repositories/contractRepository.js';
import deviceRepository from '../repositories/deviceRepository.js';
import wompiService from './wompiService.js';
import { Transaction, TIMEZONE, PAYMENTMESSAGES, ENGINERESUME } from '../config/config.js';
import dayjs from '../config/dayjs.js';
import logger from '../config/logger.js';
import { Invoice } from '../models/Invoice.js';
import { Device } from '../models/Device.js';
import { Payment } from '../models/index.js';
import { Company } from '../models/Company.js';
import WompiAdapter from '../adapters/wompiAdapter/wompiAdapter.js';
import gpsServices from './megaRastreoServices1.js';
import companyService from './companyService.js';


const { INVOICE_DAYTYPE_TRANSLATION } = Transaction;

const { INVOICE_DAYTYPE, PAYMENT_TYPE, TEMPORARY_RESERVATION_TIMEOUT, MAX_NEQUI_PAYMENT_TIMEOUT, MAX_RETRY_ATTEMPTS, RETRY_CHECK_INTERVAL, PAYMENT_STATUS } = Transaction;

// Aliases for user code compatibility
const PS = PAYMENT_STATUS;
const PM = PAYMENTMESSAGES;

// Helper function for state change notifications
const notifyStateChange = (fn, status, msj, refOrObj) => {
    console.log("--notifyStateChange", fn, status, msj, refOrObj);
    let obj = { status, message: msj };
    if (typeof refOrObj === 'string') obj.reference = refOrObj;
    else if (typeof refOrObj === 'object' && refOrObj !== null) Object.assign(obj, refOrObj);
    if (fn && typeof fn === 'function') fn(obj);
};

// Active polling map/Set for device status checks or payment monitoring
const activePolls = new Map();

export class PaymentService {

    /**
     * Calculate detailed payment status for a contract (User's logic)
     */
    async calculatePaymentStatus(contract) {
        const deviceIdName = contract.deviceIdName;
        const { monthlyFreeDaysAvailable } = await invoiceRepository.getFreeDaysStatus(deviceIdName, contract.freeDaysLimit);
        const { isOverdue } = await invoiceRepository.getOverdueStatus(deviceIdName);
        const oldestUnpaidInvoice = await invoiceRepository.findLastUnPaid(deviceIdName);
        const pendingPayment = await paymentRepository.findPendingPayment(deviceIdName, MAX_NEQUI_PAYMENT_TIMEOUT);

        return {
            deviceIdName,
            customerPhone: contract.customerPhone,
            dailyRate: contract.dailyRate,
            pendingInvoiceDate: oldestUnpaidInvoice?.date,
            freeDaysAvailable: monthlyFreeDaysAvailable,
            isOverdue,
            pendingPayment: pendingPayment ? pendingPayment.getPendingFormat() : null
        };
    }

    /**
     * Apply a free day usage
     */
    async applyFreeDay(deviceIdName, contractId, companyId) {
        const dummyOnUpdate = (update) => {
            logger.info(`[FREE DAY] Activation status: ${update.status} - ${update.message}`);
        };
        const contract = await contractRepository.getActiveContractByDevice(deviceIdName);
        if (!contract) {
            return { success: false, message: 'Contract not found' };
        }
        // Check free days status
        const { monthlyFreeDaysAvailable } = await invoiceRepository.getFreeDaysStatus(deviceIdName, contract.freeDaysLimit);

        if (monthlyFreeDaysAvailable < 1) {
            return { success: false, message: 'No tienes mas dias disponibles' };
        }
        const unpaidInvoice = await invoiceRepository.findOrCreateUnpaidInvoice(deviceIdName, contract, companyId);
        const payment = await paymentRepository.createFreePayment(deviceIdName, contract, unpaidInvoice, companyId);
        const paidInvoice = await unpaidInvoice.applyPayment(payment);

        // Activate device

        const yesterday = dayjs().add(-1, 'day').startOf('day');
        const invoiceDate = dayjs(paidInvoice.date).startOf('day');
        if (!invoiceDate.isBefore(yesterday)) {
            await this.activateDevice(paidInvoice, payment.reference, dummyOnUpdate, companyId);
        } else {
            logger.info(`[FREE DAY] Activation warning: ${e.message}`);
        }
        // Get updated device status
        const deviceStatus = await gpsServices.getDetailedStatus(unpaidInvoice.deviceId);

        return {
            success: true,
            message: 'Free day applied successfully',
            deviceIdName,
            invoiceId: unpaidInvoice._id,
            deviceStatus
        };
    };
    async processInitialFee(contract, device, initialFee, startDate) {
        try {
            const date = new Date(startDate); // Use contract start date
            const invoice = await invoiceRepository.createNextDayInvoice(device.name, initialFee, device.deviceId, device.companyId, date);
            // 2. Create Payment
            console.log("invoice", invoice);
            const payment = await paymentRepository.createInitialFeePayment(device, contract, invoice, initialFee);
            // Link payment to invoice
            await invoice.applyPayment(payment);
        } catch (err) {
            console.error('Error processing initial fee:', err);
            // Don't fail the contract creation, just log error
        }
    }

    async applyLoan(deviceIdName, contractId, companyId) {
        const dummyOnUpdate = (update) => {
            logger.info(`[LOAN] Activation status: ${update.status} - ${update.message}`);
        };
        console.log("applyLoan", deviceIdName, contractId, companyId);

        const contract = await contractRepository.getActiveContractByDevice(deviceIdName);
        if (!contract) throw new Error('Contract not found');

        let existingUnpaid = await invoiceRepository.findLastUnPaid(deviceIdName);
        const yesterday = dayjs().subtract(1, 'days').startOf('day');

        if (existingUnpaid) {
            const invoiceDate = dayjs(existingUnpaid.date).startOf('day');
            if (invoiceDate.isSameOrAfter(yesterday)) {

                const payment = await paymentRepository.createLoanPayment(deviceIdName, contract, existingUnpaid);

                await existingUnpaid.applyPayment(payment);

                try {
                    const yesterday = dayjs().add(-1, 'day').startOf('day');
                    if (!invoiceDate.isBefore(yesterday)) {
                        await this.activateDevice(existingUnpaid, `LOAN-${payment._id}`, dummyOnUpdate, companyId);
                    }


                } catch (e) {
                    logger.error(`[LOAN] Activation error: ${e.message}`);
                }
            } else {
                return { success: false, message: 'Cannot request loan for old debts' };
            }
        }

        // Return status
        const deviceStatus = await this.getDataStatus(deviceIdName);
        return {
            success: true,
            message: 'Loan applied successfully',
            deviceIdName,
            invoiceId: existingUnpaid?._id,
            dailyRate: contract.dailyRate,
            deviceStatus
        };
    }

    /**
     * Register a device cutoff event
     */
    async registerCutOff(deviceIdName) {
        // Find the invoice responsible for the cutoff
        // Usually the oldest unpaid invoice? Or the last unpaid one?
        // "ese device fue apagado en ese invoice por falta de pago"
        // Likely the last unpaid invoice that is overdue using findLastUnPaid
        const invoice = await invoiceRepository.findLastUnPaid(deviceIdName);
        if (invoice) {
            await invoiceRepository.setCutOff(invoice._id, true);
            return { success: true, invoiceId: invoice._id };
        }
        return { success: false, message: 'No unpaid invoice found to mark as cutoff' };
    }

    /**
     * Get Device Status (Traccar)
     */
    async getDataStatus(deviceId) {
        try {
            console.log('Device ID:', deviceId);
            const details = await gpsServices.getDetailedStatus(deviceId);
            console.log('Device Status:', details);
            return {
                ...details,
                deviceId
            };
        } catch (error) {
            logger.error('[DEVICE STATUS] Error checking status:', error);
            throw error;
        }
    };

    /**
     * Initiate Wompi Payment (Wrapper around createPaymentIntent logic)
     */
    /*Initiate a new payment*/
    /*Initiate a new payment*/
    async initiateWompiPaymentTransaction(deviceIdName, phone, companyId) {
        this.validatePaymentInput(deviceIdName, phone);
        await this.checkDuplicatePayment(deviceIdName);
        const contract = await contractRepository.getActiveContractByDevice(deviceIdName);
        const unpaidInvoice = await invoiceRepository.findOrCreateUnpaidInvoice(deviceIdName, contract, companyId);

        const wompiAdapter = await companyService.getWompiAdapter(companyId);

        console.log('wompiAdapter', wompiAdapter);
        const acceptanceToken = await wompiAdapter.getMerchantData();
        const paymentData = await wompiAdapter.createTransactionRequest(phone, unpaidInvoice, acceptanceToken, companyId);
        console.log('paymentData', paymentData);
        const payment = await paymentRepository.upsertPayment(paymentData);
        if (unpaidInvoice) {
            await unpaidInvoice.reserve(payment);
            logger.info(`[PAYMENT] Invoice ${unpaidInvoice.getId()} reserved for plate: ${deviceIdName}`);
        }
        return { paymentData };
    }
    /*Monitor transaction status*/
    async monitorTransactionStatus(reference, { onUpdate, timeout = TEMPORARY_RESERVATION_TIMEOUT }) {
        try {

            notifyStateChange(onUpdate, PS.S_PENDING, PM.M_PENDING_ALT_1, reference);
            const paymentData = await this.pollPaymentStatus(reference, onUpdate, timeout);
            const paymentIntance = await paymentRepository.upsertPayment(paymentData);
            if (paymentData.status === PS.S_APPROVED) {
                notifyStateChange(onUpdate, PS.S_APPROVED, PM.M_APPROVED, reference);
                const result = await this.processApprovedPayment(paymentIntance, onUpdate);
                notifyStateChange(onUpdate, PS.S_COMPLETED, PM.M_COMPLETED, result.simplePayment);
            } else if (paymentData.status === PS.S_TIMEOUT) {
                logger.info(`[PAYMENT] Validation timed out for ${reference}`);
                return;
            } else {
                // Release invoice reservation if applicable
                if (paymentData.invoiceId) {
                    await invoiceRepository.unreserveInvoice(paymentData.invoiceId);
                }
                notifyStateChange(onUpdate, PS.S_DECLINED, PM.M_DECLINED, {
                    reference,
                    status: paymentData.status
                });
            }

        } catch (error) {
            logger.error('[PAYMENT] Error:', error);
            notifyStateChange(onUpdate, PS.S_ERROR, PM.M_ERROR, {
                reference,
                error: error.message
            });
            throw error;
        }
    };

    async pollPaymentStatus(reference, onUpdate, timeout = TEMPORARY_RESERVATION_TIMEOUT) {
        // If a polling process exists for this reference, join it
        console.log("activePolls", reference, activePolls);
        if (activePolls.has(reference)) {
            logger.info(`[PAYMENT] Joining existing poll for reference: ${reference}`);
            const active = activePolls.get(reference);
            // Add the new listener to receive updates
            active.listeners.push(onUpdate);
            return active.promise;
        }

        let intervalId;
        const listeners = [onUpdate]; // Array to store all active listeners for this reference

        const promise = new Promise(async (resolve, reject) => {
            const startTime = Date.now();

            // We need the companyId to get the correct Wompi config for polling
            // We can get it from the payment record
            const payment = await paymentRepository.getPaymentByReference(reference);
            const wompiAdapter = await companyService.getWompiAdapter(payment?.companyId);

            intervalId = setInterval(async () => {
                try {
                    // Verifica timeout
                    if (Date.now() - startTime > timeout) {
                        clearInterval(intervalId);
                        activePolls.delete(reference);
                        listeners.forEach(listener => notifyStateChange(listener, PS.S_TIMEOUT, PM.M_TIMEOUT, reference));
                        resolve({ status: PS.S_TIMEOUT, reference });
                        return;
                    }

                    // Consulta Wompi
                    const paymentData = await wompiAdapter.getTransactionStatus(reference);
                    console.log('Payment data:', paymentData);

                    // Si está en estado final
                    if ([PS.S_APPROVED, PS.S_DECLINED, PS.S_VOIDED, PS.S_ERROR].includes(paymentData.status)) {
                        clearInterval(intervalId);
                        activePolls.delete(reference);
                        resolve(paymentData);
                        return;
                    }

                    // Aún en espera - Notificar a todos los listeners
                    const message = (Date.now() / 5000 | 0) % 2 === 0 ? PM.M_PENDING_ALT_1 : PM.M_PENDING_ALT_2;
                    listeners.forEach(listener => notifyStateChange(listener, PS.S_PENDING, message, reference));

                } catch (error) {
                    clearInterval(intervalId);
                    activePolls.delete(reference);
                    logger.error('[PAYMENT] Polling error:', error);
                    reject(error);
                }
            }, 5000);
        });

        // Store the active polling process
        activePolls.set(reference, { promise, listeners, intervalId });
        return promise;
    };
    async processApprovedPayment(paymentData, onUpdate) {
        const { reference } = paymentData;
        try {
            const payment = await paymentRepository.claimPaymentForProcessing(paymentData);
            if (!payment) {
                logger.warn(`[PAYMENT] Payment ${reference} already used or locked. Skipping reprocessing.`);
                notifyStateChange(onUpdate, PS.S_APPROVED, PM.M_ALREADY_PROCESSED, { reference });
                return { success: true, alreadyProcessed: true };
            }

            logger.info(`----[PAYMENT] Payment locked for processing: ${payment.deviceIdName}`, { reference });
            notifyStateChange(onUpdate, PS.S_PROCESSING, PM.M_PROCESSING, { reference });
            const invoice = await invoiceRepository.processInvoicePaymentAtomically(payment);
            if (!invoice) {
                throw new Error('Invoice not found or could not be processed');
            }
            await payment.markAsUsed(invoice);
            try {
                const contract = await contractRepository.getActiveContractByDevice(payment.deviceIdName);
                if (contract) {
                    const amountPaid = payment.amount_in_cents ? payment.amount_in_cents / 100 : payment.amount;
                    const daysPaid = contract.dailyRate > 0 ? amountPaid / contract.dailyRate : 0;
                    await contractRepository.updateContractProgress(contract.contractId, amountPaid, daysPaid);

                    logger.info(`[CONTRACT] Updated progress for ${contract.contractId}: +${amountPaid} (${daysPaid.toFixed(2)} days)`);
                } else {
                    logger.warn(`[CONTRACT] No active contract found for device ${payment.deviceIdName} during payment processing.`);
                }
            } catch (err) {
                logger.error(`[CONTRACT] Failed to update contract progress: ${err.message}`);
            }

            notifyStateChange(onUpdate, PS.S_INVOICE_UPDATED, PM.M_INVOICE_UPDATED, {
                reference,
                invoiceId: invoice.id
            });

            const yesterday = dayjs().add(-1, 'day').startOf('day');
            const invoiceDate = dayjs(invoice.date).startOf('day');

            if (invoiceDate.isSameOrAfter(yesterday)) {
                await this.activateDevice(payment.deviceId, reference, onUpdate, payment.companyId);

            } else {
                logger.info(`[DEVICE] Activation skipped - invoice date out of range (not yesterday/today): ${invoice.date}`);
            }

            const simplePayment = payment.getSimple();
            return { success: true, simplePayment };

        } catch (error) {
            logger.error('[PAYMENT] Error processing approved payment:', error);
            throw error;
        }
    };

    /*Validate payment input*/
    validatePaymentInput = (deviceIdName, phone) => {
        if (!phone || !deviceIdName) {
            throw new Error("Missing required fields: phone and deviceIdName");
        }
    }
    /*Check for duplicate payment*/
    checkDuplicatePayment = async (deviceIdName) => {
        const pendingPayment = await paymentRepository.findPendingPayment(deviceIdName, TEMPORARY_RESERVATION_TIMEOUT);
        if (pendingPayment) {
            throw new Error("A payment is already being processed for this device");
        }
    }

    /**
     * Activate Device via Traccar
     */
    async activateDevice(deviceIdOrInvoice, reference, onUpdate, companyId) {

        const deviceId = deviceIdOrInvoice?.deviceId || deviceIdOrInvoice;

        if (!deviceId) {
            logger.error(`[DEVICE] Failed to activate: webDeviceId not found for input ${deviceIdOrInvoice}`);
            return;
        }

        // 1. Initial notification
        if (onUpdate) onUpdate({ status: 'DEVICE_ACTIVATING', message: 'Activando dispositivo...' });

        // 2. Execute and verify via centralized service
        const isConfirmed = await gpsServices.executeAndVerify(deviceId, ENGINERESUME, {
            companyConfig: companyId,
            onProgress: (p) => {
                notifyStateChange(onUpdate, PS.S_DEVICE_CHECKING, PM.M_DEVICE_CHECKING, {
                    reference,
                    attempt: p.attempt,
                    maxAttempts: p.maxAttempts,
                    responseId: p.responseId,
                    elapsedSeconds: p.attempt * (RETRY_CHECK_INTERVAL / 1000)
                });
            }
        });

        // 3. Handle result and database update
        if (isConfirmed) {
            logger.info(`[DEVICE] Activation confirmed for ${deviceId}`);
            try {
                // Use deviceId (Traccar ID) for repository update
                await deviceRepository.updateCutOffStatus(deviceId, 0); // 0 = Active/No CutOff
                logger.info(`[DEVICE] CutOff flag updated to 0 for device: ${deviceId}`);

                if (onUpdate) onUpdate({ status: PS.S_DEVICE_ACTIVE, message: PM.M_DEVICE_ACTIVE });
            } catch (dbError) {
                logger.error(`[DEVICE] Failed to update cutOff flag in DB for ${deviceId}:`, dbError);
            }
        } else {
            logger.warn(`[DEVICE] Activation not confirmed after retries for ${deviceId}`);
            if (onUpdate) onUpdate({ status: 'DEVICE_QUEUED', message: 'Dispositivo en cola (Sin confirmación)' });
        }
    }

    // --- Kept existing methods (refactored) ---

    async createPaymentIntent(deviceIdName, customerEmail = null) {
        const invoice = await invoiceRepository.getOldestUnpaidInvoice(deviceIdName);
        if (!invoice) throw new Error('No unpaid invoices found');

        let payment = await paymentRepository.getPaymentByInvoiceId(invoice.invoiceId || invoice._id);
        if (payment && payment.status === PAYMENT_STATUS.APPROVED) throw new Error('Invoice already paid');

        if (!payment) {
            payment = await paymentRepository.createPayment({
                invoiceId: invoice.invoiceId || invoice._id,
                amount: invoice.amount,
            });
        }

        const wompiResult = await wompiService.createTransaction({
            reference: payment.paymentReference,
            amount: payment.amount,
            currency: 'COP',
            redirectUrl: `${process.env.FRONTEND_URL}/payment/callback?ref=${payment.paymentReference}`,
        });

        payment = await paymentRepository.updatePaymentWithWompiResponse({
            paymentId: payment.paymentId,
            wompiTransactionId: wompiResult.transactionId,
            checkoutUrl: wompiResult.checkoutUrl,
            wompiResponse: wompiResult.response,
        });

        await invoiceRepository.updateInvoiceStatus(
            invoice.invoiceId || invoice._id,
            INVOICE_STATUS.PENDING,
            payment.paymentReference
        );

        return { invoice, payment, checkoutUrl: wompiResult.checkoutUrl };
    }

    /**
     * Get monthly payment summary (Moved from Repository to Service)
     */
    async getPaymentSummary({ month, year, companyId }) {
        try {

            const startDate = dayjs().year(year).month(month - 1).startOf('month').toDate();
            const endDate = dayjs().year(year).month(month - 1).endOf('month').toDate();
            const deviceMap = {};
            const deviceQuery = { date: { $gte: startDate, $lte: endDate } };
            if (companyId) deviceQuery.companyId = companyId;

            // 4. Fetch data in parallel
            const [invoices, payments] = await Promise.all([
                invoiceRepository.findInvoices(deviceQuery),
                paymentRepository.getTotalPerDayByDevice(deviceQuery)
            ]);
            const paymentsObj = payments.length > 0 ? payments[0] : {};
            invoices.forEach((invoice) => {
                const dateKey = dayjs(invoice.date).format('YYYY-MM-DD');
                const day = new Date(invoice.date).getUTCDate();
                const devName = invoice.deviceIdName;
                if (!deviceMap[devName]) {
                    deviceMap[devName] = {
                        device: {
                            name: devName,
                            unpaidTotal: 0
                        },
                        days: {}
                    };
                }
                const totalPaid = paymentsObj[devName]?.[dateKey]?.totalPaid || 0;

                if (invoice.dayType !== 'FREE') {
                    deviceMap[devName].device.unpaidTotal += invoice.amount - invoice.paidAmount;
                }
                deviceMap[devName].days[day] = { ...invoice, totalPaid };
            });

            return Object.values(deviceMap);

        } catch (error) {
            logger.error('Error getting monthly payment summary in service:', error);
            throw error;
        }
    }

    async getPaymentHistory(options = {}) {
        // User requested ENRICHED history
        // Support legacy calls or new object style
        const params = {
            page: options.page || 1,
            limit: options.limit || 50,
            status: options.status || null,
            filter: options.filter || null
        };
        const result = await paymentRepository.getAllPaymentsPaginated(params);
        return result;
    }
    /* async getPaymentHistory(deviceIdName) {
         // 1. Fetch invoices with specific fields
         const startOfMonth = dayjs().startOf('month').toDate();
         const endOfMonth = dayjs().endOf('month').toDate();
         const invoices = await Invoice.find(
             {
                 deviceIdName,
                 date: { $gte: startOfMonth, $lte: endOfMonth }
             },
             {
                 date: 1,
                 amount: 1,
                 dayType: 1,
                 paidAmount: 1,
                 "transaction.finalized_at": 1,
                 "transaction.reference": 1,
                 _id: 0
             }
         )
             .sort({ date: -1 })
             .limit(50)
             .lean();
         invoices.forEach(invoice => {
             invoice.status = INVOICE_DAYTYPE_TRANSLATION[invoice.dayType];
             invoice.paymentDate = invoice.transaction?.finalized_at;
 
         });
         return invoices;
     };*/




}

export default new PaymentService();
