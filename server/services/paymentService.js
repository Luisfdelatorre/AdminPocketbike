import invoiceRepository from '../repositories/invoiceRepository.js';
import paymentRepository from '../repositories/paymentRepository.js';
import contractRepository from '../repositories/contractRepository.js';
import deviceRepository from '../repositories/deviceRepository.js';
import wompiService from './wompiService.js';
import { Transaction, TIMEZONE, PAYMENTMESSAGES, ENGINE_COMMANDS } from '../config/config.js';
import dayjs from '../config/dayjs.js';
import logger from '../config/logger.js';
import { Invoice } from '../models/Invoice.js';
import { Device } from '../models/Device.js';
import { Payment } from '../models/index.js';
import { Company } from '../models/Company.js';
import companyService from './companyService.js';
import helpers from '../utils/helpers.js';


const { INVOICE_DAYTYPE_TRANSLATION } = Transaction;

const { INVOICE_DAYTYPE, PAYMENT_TYPE, TEMPORARY_RESERVATION_TIMEOUT, MAX_NEQUI_PAYMENT_TIMEOUT, MAX_RETRY_ATTEMPTS, RETRY_CHECK_INTERVAL, PAYMENT_STATUS } = Transaction;

// Aliases for user code compatibility
const PS = PAYMENT_STATUS;
const PM = PAYMENTMESSAGES;

// Helper function for state change notifications
const notifyStateChange = (fn, status, msj, refOrObj) => {
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

        let policy = contract.freeDayPolicy;
        if (!policy && contract.companyId) {
            const company = await Company.findById(contract.companyId).select('contractDefaults.freeDayPolicy').lean();
            if (company?.contractDefaults?.freeDayPolicy) {
                policy = company.contractDefaults.freeDayPolicy;
            }
        }

        return {
            deviceIdName,
            customerPhone: contract.customerPhone,
            dailyRate: contract.dailyRate,
            pendingInvoiceDate: oldestUnpaidInvoice?.date,
            freeDaysAvailable: monthlyFreeDaysAvailable,
            freeDayPolicy: policy, // Ultimate fallback 
            isOverdue,
            pendingPayment: pendingPayment ? pendingPayment.getPendingFormat() : null
        };
    }

    /**
     * Apply a free day usage
     * @param {string} deviceIdName
     * @param {string} contractId
     * @param {string} companyId
     * @param {boolean} isAutomaticTrigger - If true, skips monthly limit checks and GPS activation commands
     */
    async applyFreeDay(deviceIdName, contractId, companyId, isAutomaticTrigger = false) {
        const dummyOnUpdate = (update) => {
            logger.info(`[FREE DAY] Activation status: ${update.status} - ${update.message}`);
        };
        const contract = await contractRepository.getActiveContractByDevice(deviceIdName);
        if (!contract) {
            return { success: false, message: 'Contract not found' };
        }

        if (!isAutomaticTrigger) {
            const { monthlyFreeDaysAvailable } = await invoiceRepository.getFreeDaysStatus(deviceIdName, contract.freeDaysLimit);
            if (monthlyFreeDaysAvailable < 1) {
                return { success: false, message: 'No tienes mas dias disponibles' };
            }
        }

        const unpaidInvoice = await invoiceRepository.findOrCreateUnpaidInvoice(deviceIdName, contract, companyId);
        const payment = await paymentRepository.createFreePayment(deviceIdName, contract, unpaidInvoice, companyId);
        const paidInvoice = await unpaidInvoice.applyPayment(payment);

        let deviceStatus = null;

        // Skip calling the physical device activation if this is just an automatic scheduled billing day setup
        if (!isAutomaticTrigger) {
            const yesterday = dayjs().add(-1, 'day').startOf('day');
            const invoiceDate = dayjs(paidInvoice.date).startOf('day');
            if (!invoiceDate.isBefore(yesterday)) {
                await this.activateDevice(paidInvoice.gpsId, payment.reference, dummyOnUpdate, companyId);
            } else {
                logger.info(`[FREE DAY] Activation warning: Invoice date too old`);
            }

            // Get updated device status only if we potentially interacted with it
            const gpsAdapter = await companyService.getGpsAdapter(companyId);
            deviceStatus = await gpsAdapter.getDetailedStatus(unpaidInvoice.deviceId);

        }

        return {
            success: true,
            message: isAutomaticTrigger ? 'Automatic free day recorded successfully' : 'Free day applied successfully',
            deviceIdName,
            invoiceId: unpaidInvoice._id,
            deviceStatus
        };
    };
    async applyFreeDayAutomatic(deviceIdName, companyId, unpaidInvoice) {
        const contract = await contractRepository.getActiveContractByDevice(deviceIdName);
        if (!contract) {
            return { success: false, message: 'Contract not found' };
        }
        const payment = await paymentRepository.createFreePayment(deviceIdName, contract, unpaidInvoice, companyId);
        await unpaidInvoice.applyPayment(payment);
        logger.info(`[FREE DAY AUTO] Applied free day for ${deviceIdName}, invoice: ${unpaidInvoice._id}`);
    }
    async applyManualAdjustment(invoiceId, companyId, { adjustmentType, amount, adjustmentReference, note }) {
        const invoice = await Invoice.findOne({ _id: invoiceId, paid: false });
        if (!invoice) {
            throw new Error('Invoice not found or already paid');
        }
        const deviceIdName = invoice.deviceIdName;
        const contract = await contractRepository.getActiveContractByDevice(deviceIdName);
        if (!contract) {
            throw new Error('Active contract not found for this device');
        }

        // REPAIR/MAINTENANCE/WORKSHOP → $0 (free day for customer), DAMAGE → full invoice amount
        const isFreeAdjustment = ['REPAIR', 'MAINTENANCE', 'WORKSHOP'].includes(adjustmentType);
        const paymentAmount = isFreeAdjustment ? 0 : (amount ?? invoice.amount);

        const payment = await paymentRepository.createManualPayment({
            deviceIdName,
            contract,
            invoice,
            companyId,
            amount: paymentAmount,
            adjustmentType,
            adjustmentReference: adjustmentReference,
            note,
        });
        // Attach adjustmentType + adjustmentReference so applyPayment can persist them on the invoice
        payment.adjustmentType = adjustmentType;
        payment.adjustmentReference = adjustmentReference;
        await invoice.applyPayment(payment);
        logger.info(`[MANUAL ADJ] ${adjustmentType} applied for ${deviceIdName}, invoice: ${invoice._id}, amount: ${paymentAmount}`);
        return {
            success: true,
            invoiceId: invoice._id,
            deviceIdName,
            adjustmentType,
            amount: paymentAmount,
        };
    }
    async processInitialFee(contract, device, initialFee) {
        try {
            // Remove timezone name in parentheses if present to ensure dayjs parsing robustness
            const startDateStr = contract.startDate;
            const cleanDate = typeof startDateStr === 'string' ? startDateStr.replace(/\s*\(.*\)$/, '') : startDateStr;
            const date = dayjs(cleanDate).startOf('day');

            const invoice = await invoiceRepository.createNextDayInvoice(device.name, initialFee, device.deviceId, device.companyId, date, device.megaDeviceId);
            // 2. Create Payment
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
                    if (!invoiceDate.isBefore(yesterday)) {
                        await this.activateDevice(existingUnpaid.gpsId, `LOAN-${payment._id}`, dummyOnUpdate, companyId);
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
    async registerCutOff(deviceIdName) {
        const invoice = await invoiceRepository.findLastUnPaid(deviceIdName);
        if (invoice) {
            await invoiceRepository.setCutOff(invoice._id, true);
            return { success: true, invoiceId: invoice._id };
        }
        return { success: false, message: 'No unpaid invoice found to mark as cutoff' };
    }
    async getDataStatus(deviceIdName) {
        try {
            const device = await deviceRepository.getDeviceByName(deviceIdName);
            if (!device) {
                logger.warn(`[DEVICE STATUS] Device not found for name: ${deviceIdName}`);
                return { deviceIdName, engineOn: null, cutOff: null };
            }
            const { companyId, gpsId } = device;
            const gpsAdapter = await companyService.getGpsAdapter(companyId);
            const details = await gpsAdapter.checkDeviceStatus(gpsId);

            return {
                online: dayjs().diff(dayjs(details.lastUpdate), 'second') < Transaction.DEVICE_ONLINE_TIMEOUT,
                cutOff: details.cutOff,
                ignition: details.ignition,
                batteryLevel: details.batteryLevel || helpers.calculateBatteryLevel(details.lastUpdate),
                lastUpdate: details.lastUpdate
            };
        } catch (error) {
            logger.error('[DEVICE STATUS] Error checking status:', error);
            throw error;
        }
    };
    async initiateWompiPaymentTransaction(deviceIdName, phone, companyId) {
        this.validatePaymentInput(deviceIdName, phone);
        await this.checkDuplicatePayment(deviceIdName);
        const contract = await contractRepository.getActiveContractByDevice(deviceIdName);
        let unpaidInvoice = await invoiceRepository.findOrCreateUnpaidInvoice(deviceIdName, contract, companyId);

        if (
            contract.freeDayPolicy === 'FIXED_WEEKDAY' &&
            contract.fixedFreeDayOfWeek !== undefined &&
            unpaidInvoice?.paid === false &&
            dayjs(unpaidInvoice.date).day() === contract.fixedFreeDayOfWeek
        ) {
            logger.info(`[PAYMENT] Free day fallback — auto-applying free day for ${deviceIdName} before Wompi.`);
            await this.applyFreeDayAutomatic(deviceIdName, companyId, unpaidInvoice);
            // Get the next unpaid invoice (next day) to proceed with payment
            unpaidInvoice = await invoiceRepository.findOrCreateUnpaidInvoice(deviceIdName, contract, companyId);
        }
        console.log("****unpaidInvoice", unpaidInvoice);

        const wompiAdapter = await companyService.getWompiAdapter(companyId);

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
            let payment = await paymentRepository.claimPaymentForProcessing(paymentData);
            console.log('Payment locked for processing:', payment);

            if (!payment) {
                // Distinguish: truly not found (webhook for untracked payment) vs already used
                const existing = await Payment.findById(paymentData._id).lean();
                if (existing) {
                    // Payment exists but already used — skip to avoid double-processing
                    logger.warn(`[PAYMENT] Payment ${reference} already used. Skipping reprocessing.`);
                    notifyStateChange(onUpdate, PS.S_APPROVED, PM.M_ALREADY_PROCESSED, { reference });
                    return { success: true, alreadyProcessed: true };
                }

                // Payment not found in DB — webhook arrived for untracked payment, hydrate it
                logger.info(`[PAYMENT] Payment ${reference} not found in DB — hydrating from webhook data.`);
                payment = await this.hydratePaymentFromWebhook(paymentData);
                if (!payment) {
                    logger.warn(`[PAYMENT] Could not hydrate payment for reference ${reference}. Skipping.`);
                    return { success: false, reason: 'Could not hydrate payment' };
                }
                // Re-lock the freshly upserted payment
                payment = await paymentRepository.claimPaymentForProcessing(payment);
                if (!payment) {
                    logger.warn(`[PAYMENT] Hydrated payment ${reference} could not be claimed. Skipping.`);
                    return { success: false, reason: 'Hydrated payment claim failed' };
                }
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
                    if (contract.freeDayPolicy === 'FIXED_WEEKDAY' && contract.fixedFreeDayOfWeek !== undefined) {
                        const nextDayOfWeek = dayjs(invoice.date).add(1, 'day').day();
                        if (nextDayOfWeek === contract.fixedFreeDayOfWeek) {
                            logger.info(`[PAYMENT] Tomorrow is Fixed Free Day (${contract.fixedFreeDayOfWeek}) for ${payment.deviceIdName}. Preventive auto-generation triggered.`);
                            await this.applyFreeDay(payment.deviceIdName, contract.contractId, payment.companyId, true);
                        }
                    }

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
                // --- Curfew check: skip activation if we are in the night curfew window ---
                const company = await Company.findById(payment.companyId).select('curfew').lean();
                const curfew = company?.curfew;
                const start = curfew.startTime.split(':');
                const end = curfew.endTime.split(':');
                let inCurfew = false;
                if (curfew?.enabled && curfew.startTime && curfew.endTime) {
                    const now = dayjs();
                    const base = now.startOf('day');
                    const curfewStart = base.add(parseInt(start[0]), 'hour').add(parseInt(start[1]), 'minute');
                    const curfewEnd = base.add(parseInt(end[0]), 'hour').add(parseInt(end[1]), 'minute');
                    // Handle overnight ranges (e.g. 00:05 → 04:00)
                    inCurfew = curfewStart.isBefore(curfewEnd)
                        ? now.isSameOrAfter(curfewStart) && now.isBefore(curfewEnd)
                        : now.isSameOrAfter(curfewStart) || now.isBefore(curfewEnd);
                }

                if (inCurfew) {
                    logger.info(`[DEVICE] Activation skipped - curfew active (${curfew.startTime}–${curfew.endTime}) for device: ${payment.megaDeviceId}`);
                    notifyStateChange(onUpdate, PS.S_COMPLETED, `Pago registrado ✅. El dispositivo se activará al finalizar el toque de queda (${curfew.endTime}).`, reference);
                } else {
                    console.log(`[TRACE-1] processApprovedPayment → activateDevice | megaDeviceId=${payment.megaDeviceId} companyId=${payment.companyId}`);
                    await this.activateDevice(payment.gpsId, reference, onUpdate, payment.companyId);
                }
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
    async hydratePaymentFromWebhook(paymentData) {
        try {
            const { _id, reference, amount_in_cents, finalized_at, payment_method_type } = paymentData;
            const deviceIdName = reference?.split('-')[0];
            if (!deviceIdName) {
                logger.error(`[PAYMENT] Cannot parse deviceIdName from reference: ${reference}`);
                return null;
            }
            const device = await deviceRepository.getDeviceByName(deviceIdName);
            if (!device) {
                logger.error(`[PAYMENT] Device not found for name: ${deviceIdName}`);
                return null;
            }

            const { companyId, gpsId, deviceId } = device;

            // Find the oldest unpaid invoice for this device (the one the payment covers)
            const unpaidInvoice = await invoiceRepository.findLastUnPaid(deviceIdName);
            const invoiceId = unpaidInvoice?._id || unpaidInvoice?.invoiceId || null;

            const now = dayjs().toDate();
            const hydratedPayment = {
                _id,
                paymentId: _id,
                reference,
                status: PAYMENT_STATUS.S_APPROVED,
                amount: amount_in_cents ? amount_in_cents / 100 : 0,
                amount_in_cents: amount_in_cents || 0,
                currency: paymentData.currency || 'COP',
                payment_method_type: payment_method_type || PAYMENT_TYPE.WOMPI,
                type: PAYMENT_TYPE.WOMPI,
                deviceIdName,
                deviceId: String(deviceId || ''),
                gpsId: String(gpsId || ''),
                companyId,
                invoiceId,
                unpaidInvoiceId: invoiceId,
                invoiceDate: unpaidInvoice?.date || null,
                finalized_at: finalized_at || now,
                created_at: now,
                used: false,
            };

            logger.info(`[PAYMENT] Hydrating payment ${_id} for device ${deviceIdName}, invoice ${invoiceId}`);
            return await paymentRepository.upsertPayment(hydratedPayment);
        } catch (err) {
            logger.error(`[PAYMENT] Error hydrating payment from webhook: ${err.message}`);
            return null;
        }
    }
    validatePaymentInput = (deviceIdName, phone) => {
        if (!phone || !deviceIdName) {
            throw new Error("Missing required fields: phone and deviceIdName");
        }
    }
    checkDuplicatePayment = async (deviceIdName) => {
        const pendingPayment = await paymentRepository.findPendingPayment(deviceIdName, TEMPORARY_RESERVATION_TIMEOUT);
        if (pendingPayment) {
            throw new Error("A payment is already being processed for this device");
        }
    }
    async activateDevice(gpsId, reference, onUpdate, companyId) {
        if (onUpdate) onUpdate({ status: 'DEVICE_ACTIVATING', message: 'Activando dispositivo...' });
        try {
            const gpsService = await companyService.getGpsAdapter(companyId);
            console.log(`[TRACE-6] activateDevice → gpsService.executeAndVerify | gpsId=${gpsId}`);
            const isConfirmed = await gpsService.executeAndVerify(gpsId, ENGINE_COMMANDS.RESUME, {
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
                logger.info(`[DEVICE] Activation confirmed for ${gpsId}`);
                try {
                    // Use deviceId (Traccar ID) for repository update
                    await deviceRepository.updateCutOffStatus(gpsId, 0); // 0 = Active/No CutOff
                    logger.info(`[DEVICE] CutOff flag updated to 0 for device: ${gpsId}`);

                    if (onUpdate) onUpdate({ status: PS.S_DEVICE_ACTIVE, message: PM.M_DEVICE_ACTIVE });
                } catch (dbError) {
                    logger.error(`[DEVICE] Failed to update cutOff flag in DB for ${gpsId}:`, dbError);
                }
            } else {
                logger.warn(`[DEVICE] Activation not confirmed after retries for ${gpsId}`);
                if (onUpdate) onUpdate({ status: 'DEVICE_QUEUED', message: 'Dispositivo en cola (Sin confirmación)' });
            }
        } catch (error) {
            logger.error(`[DEVICE] Error retrieving GPS adapter or executing command for ${gpsId}:`, error);
            if (onUpdate) onUpdate({ status: PS.S_ERROR, message: 'Error de conexión con GPS' });
        }
    }
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
    async getPaymentSummary({ month, year, companyId }) {
        try {

            const today = dayjs();
            const isCurrentMonth = today.year() === year && today.month() + 1 === month;
            const isStartOfMonth = today.date() <= 3;
            const lookBackDays = (isCurrentMonth && isStartOfMonth) ? 2 : 0;
            const startDate = dayjs().year(year).month(month - 1).startOf('month').subtract(lookBackDays, 'day').toDate();
            const endDate = dayjs().year(year).month(month - 1).endOf('month').add(1, 'day').toDate();
            const deviceMap = {};
            const deviceQuery = { date: { $gte: startDate, $lte: endDate } };
            if (companyId) deviceQuery.companyId = companyId;

            // 4. Fetch data in parallel
            const [invoices, payments] = await Promise.all([
                invoiceRepository.findInvoices(deviceQuery),
                paymentRepository.getTotalPerDayByDevice(deviceQuery)
            ]);
            const allInvoices = await invoiceRepository.findInvoices({ date: { $gte: startDate, $lte: endDate } });
            console.log(`[DEBUG] invoices with companyId filter: ${invoices.length}, without: ${allInvoices.length}`, allInvoices.map(i => ({ id: i._id, cId: i.companyId })));
            const paymentsObj = payments.length > 0 ? payments[0] : {};

            invoices.forEach((invoice) => {
                const dateKey = dayjs(invoice.date).format('YYYY-MM-DD');
                const day = dayjs(invoice.date).date();
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

                const isFuture = dayjs(invoice.date).startOf('day').isAfter(dayjs().startOf('day'));
                if (invoice.dayType !== 'FREE' && invoice.dayType !== 'ADJUSTMENT' && !isFuture) {
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
