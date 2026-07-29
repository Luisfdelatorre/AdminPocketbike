import invoiceRepository from '../repositories/invoiceRepository.js';
import paymentRepository from '../repositories/paymentRepository.js';
import contractRepository from '../repositories/contractRepository.js';
import deviceRepository from '../repositories/deviceRepository.js';
import invoiceServices from './invoiceServices.js';
import wompiService from './wompiService.js';
import { Transaction, TIMEZONE, PAYMENTMESSAGES, ENGINE_COMMANDS, DEFAULT_CUTOFF_TIME } from '../config/config.js';
import dayjs from '../config/dayjs.js';
import logger from '../config/logger.js';
import { Invoice } from '../models/Invoice.js';
import { Device } from '../models/Device.js';
import { Payment, Reconciliation, Contract } from '../models/index.js';
import { Company } from '../models/Company.js';
import companyService from './companyService.js';
import GpsService from './gpsServices.js';
import mongoose from 'mongoose';


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

        // Run independent database queries in parallel to drastically reduce TTFB/latency
        const [
            company,
            latestPaid,
            oldestUnpaidInvoice,
            pendingPayment
        ] = await Promise.all([
            companyService.getCompanyById(contract.companyId),
            invoiceRepository.findLastPaid(deviceIdName),
            invoiceRepository.findLastUnPaid(deviceIdName),
            paymentRepository.findPendingPayment(deviceIdName, MAX_NEQUI_PAYMENT_TIMEOUT)
        ]);

        const now = dayjs();
        const isUpToDate = companyService.isDeviceUpToDate(company, latestPaid, now);
        const isOverdue = !isUpToDate;

        let policy = contract.freeDayPolicy;
        if (!policy && contract.companyId && company) {
            if (company.contractDefaults?.freeDayPolicy) {
                policy = company.contractDefaults.freeDayPolicy;
            }
        }

        const multiplier = Contract.getBillingMultiplier(contract.paymentFrequency, policy);
        const amount = contract.dailyRate * multiplier;

        return {
            deviceIdName,
            customerPhone: contract.customerPhone,
            dailyRate: amount, // Keep user's mapped value
            amount,
            multiplier,
            pendingInvoiceDate: oldestUnpaidInvoice?.date,
            // freeDaysAvailable: monthlyFreeDaysAvailable,
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

        const todayDate = dayjs().startOf('day').toDate();
        let targetInvoice = await Invoice.findOne({ deviceIdName, date: todayDate });

        let paidInvoice;
        let isPrepaidConversion = false;

        if (targetInvoice && targetInvoice.paid && targetInvoice.dayType === 'PAID') {
            logger.info(`[FREE DAY] Today's invoice ${targetInvoice._id} is prepaid. Converting to FREE and extending prepaid period.`);

            const originalTx = targetInvoice.transaction || {};
            const payment = await paymentRepository.createFreePayment(deviceIdName, contract, targetInvoice, companyId);
            paidInvoice = await targetInvoice.applyPayment(payment);

            const lastInvoice = await Invoice.findOne({ deviceIdName }).sort({ date: -1 });
            let nextPrepaidDate = lastInvoice
                ? dayjs(lastInvoice.date).add(1, 'day')
                : dayjs().startOf('day');

            let prepaidCreated = false;
            while (!prepaidCreated) {
                const dateVal = nextPrepaidDate.toDate();
                const invoiceId = Invoice.buildId(deviceIdName, dateVal);

                const isFixedFreeDay = contract.freeDayPolicy === 'FIXED_WEEKDAY' &&
                    contract.fixedFreeDayOfWeek !== undefined &&
                    nextPrepaidDate.day() === contract.fixedFreeDayOfWeek;

                if (isFixedFreeDay) {
                    await Invoice.create({
                        _id: invoiceId,
                        invoiceId: invoiceId,
                        date: dateVal,
                        amount: 0,
                        paidAmount: 0,
                        paid: true,
                        deviceIdName,
                        deviceId: contract.deviceId,
                        gpsId: contract.gpsId,
                        megaDeviceId: contract.megaDeviceId,
                        companyId: contract.companyId,
                        companyName: contract.companyName,
                        contractId: contract.contractId,
                        dayType: 'FREE',
                        transaction: {
                            id: payment._id,
                            reference: payment.reference,
                            finalized_at: payment.finalized_at,
                            type: 'FREE'
                        }
                    });
                    logger.info(`[FREE DAY EXTENSION] Created FREE Sunday invoice ${invoiceId} during extension.`);
                } else {
                    await Invoice.create({
                        _id: invoiceId,
                        invoiceId: invoiceId,
                        date: dateVal,
                        amount: contract.dailyRate,
                        paidAmount: contract.dailyRate,
                        paid: true,
                        deviceIdName,
                        deviceId: contract.deviceId,
                        gpsId: contract.gpsId,
                        megaDeviceId: contract.megaDeviceId,
                        companyId: contract.companyId,
                        companyName: contract.companyName,
                        contractId: contract.contractId,
                        dayType: 'PAID',
                        transaction: {
                            id: originalTx.id || `EXT-${Date.now()}`,
                            reference: originalTx.reference || `EXT-REF-${Date.now()}`,
                            finalized_at: originalTx.finalized_at || new Date(),
                            type: originalTx.type || 'WOMPI'
                        }
                    });
                    logger.info(`[FREE DAY EXTENSION] Created PAID invoice ${invoiceId} to extend prepaid period.`);
                    prepaidCreated = true;
                }
                nextPrepaidDate = nextPrepaidDate.add(1, 'day');
            }

            isPrepaidConversion = true;
        } else {
            const unpaidInvoice = await invoiceRepository.findOrCreateUnpaidInvoice(deviceIdName, contract);
            const payment = await paymentRepository.createFreePayment(deviceIdName, contract, unpaidInvoice, companyId);
            paidInvoice = await unpaidInvoice.applyPayment(payment);
            targetInvoice = unpaidInvoice;
        }

        let deviceStatus = null;

        if (!isAutomaticTrigger) {
            const yesterday = dayjs().add(-1, 'day').startOf('day');
            const invoiceDate = dayjs(paidInvoice.date).startOf('day');
            if (!invoiceDate.isBefore(yesterday)) {
                await this.activateDevice(paidInvoice.gpsId, paidInvoice.transaction.reference, dummyOnUpdate, companyId);
            } else {
                logger.info(`[FREE DAY] Activation warning: Invoice date too old`);
            }

            const gpsAdapter = await companyService.getGpsAdapter(companyId);
            deviceStatus = await gpsAdapter.getDetailedStatus(targetInvoice.deviceId);
        }

        return {
            success: true,
            message: isAutomaticTrigger ? 'Automatic free day recorded successfully' : 'Free day applied successfully',
            deviceIdName,
            invoiceId: targetInvoice._id,
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

        // REPAIR/MAINTENANCE/WORKSHOP/OFFICE/INCAPACITY → $0 (free day for customer), DAMAGE → full invoice amount
        const isFreeAdjustment = ['REPAIR', 'MAINTENANCE', 'WORKSHOP', 'OFFICE', 'OFICINA', 'INCAPACITY', 'INCAPACIDAD'].includes(adjustmentType);
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

        try {
            await contractRepository.updateContractProgress(payment);
        } catch (err) {
            logger.error(`[CONTRACT] Failed to update contract progress for manual payment: ${err.message}`);
        }

        try {
            const company = await companyService.getCompanyById(companyId);
            const now = dayjs();
            const latestPaid = await invoiceRepository.getLatestPaidInvoice(deviceIdName);
            const isUpToDate = companyService.isDeviceUpToDate(company, latestPaid, now);
            if (isUpToDate) {
                const curfew = company?.curfew;
                const inCurfew = companyService.isCurfewActive(curfew, now);
                if (!inCurfew) {
                    const device = await deviceRepository.getDeviceByName(deviceIdName);
                    if (device && device.gpsId) {
                        await this.activateDevice(device.gpsId, payment.paymentReference || invoice._id, null, companyId);
                    }
                }
            }
        } catch (err) {
            logger.error(`[MANUAL ADJ] Failed to check device activation: ${err.message}`);
        }

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
                batteryLevel: details.batteryLevel || GpsService.calculateBatteryLevel(details.lastUpdate),
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
        const multiplier = Contract.getBillingMultiplier(contract.paymentFrequency, contract.freeDayPolicy);
        // Pre-generar facturas del ciclo (idempotente) en lugar de crear una sola factura al vuelo
        await invoiceRepository.ensureCycleInvoicesExist(deviceIdName, contract, multiplier);
        const unpaidInvoice = await invoiceRepository.findOrCreateUnpaidInvoice(deviceIdName, contract);
        const wompiAdapter = await companyService.getWompiAdapter(companyId);
        const paymentData = await wompiAdapter.createTransactionRequest(phone, unpaidInvoice, contract);

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
            console.log('Payment reserved for processing:', payment);

            if (!payment) {
                const existing = await paymentRepository.getPaymentBy_Id(paymentData._id);
                if (existing) {
                    if (existing.used) {
                        logger.warn(`[PAYMENT] Payment ${reference} already used. Skipping reprocessing.`);
                        notifyStateChange(onUpdate, PS.S_APPROVED, PM.M_ALREADY_PROCESSED, { reference });
                        return { success: true, alreadyProcessed: true };
                    }
                    if (existing.processing) {
                        logger.info(`[PAYMENT] Payment ${reference} is currently being processed by another worker. Skipping.`);
                        notifyStateChange(onUpdate, PS.S_PROCESSING, PM.M_PROCESSING, { reference });
                        return { success: true, processing: true };
                    }
                } else {
                    logger.info(`[PAYMENT] Payment ${reference} not found in DB — hydrating from webhook data.`);
                    payment = await this.hydratePaymentFromWebhook(paymentData);
                    if (!payment) {
                        logger.warn(`[PAYMENT] Could not hydrate payment for reference ${reference}. Skipping.`);
                        return { success: false, reason: 'Could not hydrate payment' };
                    }
                    payment = await paymentRepository.claimPaymentForProcessing(payment);
                }
            }

            if (!payment) {
                logger.error(`[PAYMENT] Unable to claim or hydrate payment for reference ${reference}`);
                return { success: false, reason: 'Payment claim failed' };
            }

            const deviceName = payment.deviceIdName || payment.plate || reference;
            logger.info(`----[PAYMENT] Payment reserved for processing: ${deviceName}`, { reference });
            notifyStateChange(onUpdate, PS.S_PROCESSING, PM.M_PROCESSING, { reference });

            const { anchorInvoice, latestPaid } = await invoiceRepository.processInvoicePaymentAtomically(payment);
            if (!anchorInvoice) {
                throw new Error('Invoice not found or could not be processed');
            }

            await payment.markAsUsed(anchorInvoice);

            try {
                await contractRepository.updateContractProgress(payment);
            } catch (err) {
                logger.error(`[CONTRACT] Failed to update contract progress: ${err.message}`);
            }

            notifyStateChange(onUpdate, PS.S_INVOICE_UPDATED, PM.M_INVOICE_UPDATED, {
                reference,
                invoiceId: anchorInvoice.id
            });

            const company = await companyService.getCompanyById(payment.companyId);
            const now = dayjs();
            const isUpToDate = companyService.isDeviceUpToDate(company, latestPaid, now);

            if (isUpToDate) {
                const curfew = company?.curfew;
                const inCurfew = companyService.isCurfewActive(curfew, now);

                if (inCurfew) {
                    logger.info(`[DEVICE] Activation skipped - curfew active (${curfew.startTime}–${curfew.endTime}) for device: ${payment.megaDeviceId}`);
                    notifyStateChange(onUpdate, PS.S_COMPLETED, `Pago registrado ✅. El dispositivo se activará al finalizar el toque de queda (${curfew.endTime}).`, reference);
                } else {
                    console.log(`[TRACE-1] processApprovedPayment → activateDevice | megaDeviceId=${payment.megaDeviceId} companyId=${payment.companyId}`);
                    await this.activateDevice(payment.gpsId, reference, onUpdate, payment.companyId);
                }
            } else {
                const strategy = company?.cutOffStrategy || 1;
                const cutOffTimeStr = company?.cutOffTime || DEFAULT_CUTOFF_TIME;
                const targetDate = companyService.getCutOffTargetDate(strategy, cutOffTimeStr, now);
                const latestPaidStr = latestPaid ? dayjs(latestPaid.date).format('YYYY-MM-DD') : 'None';
                logger.info(`[DEVICE] Activation skipped - device is not up-to-date (strategy: ${strategy}, cutoff: ${cutOffTimeStr}, latest paid: ${latestPaidStr}, target date: ${targetDate ? dayjs(targetDate).format('YYYY-MM-DD') : 'None'})`);
            }

            const simplePayment = payment.getSimple();
            return { success: true, simplePayment };

        } catch (error) {
            logger.error('[PAYMENT] Error processing approved payment:', error);
            await paymentRepository.releaseProcessingLock(paymentData);
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
                    // Use gpsId for repository update to avoid CastError if gpsId is string
                    await deviceRepository.updateCutOffByGpsId(gpsId, 0); // 0 = Active/No CutOff
                    logger.info(`[DEVICE] CutOff flag updated to 0 for device gpsId: ${gpsId}`);

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
            const t0 = Date.now();

            const today = dayjs();
            const startDate = dayjs().year(year).month(month - 1).startOf('month').toDate();
            const endDate = dayjs().year(year).month(month - 1).endOf('month').toDate();
            const todayStart = today.startOf('day'); // compute once, reuse in loop

            const deviceMap = {};
            const deviceQuery = { date: { $gte: startDate, $lte: endDate } };
            if (companyId) deviceQuery.companyId = companyId;

            // Build query to fetch device info (driverName, deviceId) in parallel
            const deviceInfoQuery = companyId ? { companyId } : {};

            // Fetch invoices, payments, device info and active contracts in parallel (single round-trip each)
            const t1 = Date.now();
            const [invoices, payments, deviceDocs, activeContracts] = await Promise.all([
                invoiceRepository.findInvoicesForSummary(deviceQuery),
                paymentRepository.getTotalPerDayByDevice(deviceQuery),
                Device.find(deviceInfoQuery, { name: 1, driverName: 1, _id: 1, cutOff: 1 }).lean(),
                Contract.find({ status: 'ACTIVE', ...(companyId ? { companyId } : {}) }, { deviceIdName: 1, customerName: 1, driverName: 1 }).lean()
            ]);
            logger.info(`[SUMMARY TIMING] DB queries: ${Date.now() - t1}ms | invoices=${invoices.length}`);

            const getFirstName = (nameStr) => {
                if (!nameStr || typeof nameStr !== 'string') return null;
                const first = nameStr.trim().split(/\s+/)[0];
                if (!first) return null;
                return first.charAt(0).toUpperCase() + first.slice(1).toLowerCase();
            };

            const contractDriverMap = {};
            activeContracts.forEach(c => {
                const driver = getFirstName(c.customerName || c.driverName);
                if (c.deviceIdName && driver) {
                    contractDriverMap[c.deviceIdName] = driver;
                }
            });

            // Build a lookup map: deviceName -> { driverName, deviceId, cutOff }
            const deviceInfoMap = {};
            deviceDocs.forEach(d => {
                if (d.name) {
                    const driver = contractDriverMap[d.name] || getFirstName(d.driverName) || null;
                    deviceInfoMap[d.name] = { driverName: driver, deviceId: d._id, cutOff: Boolean(d.cutOff) };
                }
            });

            const paymentsObj = payments.length > 0 ? payments[0] : {};

            const t2 = Date.now();
            invoices.forEach((invoice) => {
                const invoiceDay = dayjs(invoice.date);
                const dateKey = invoiceDay.format('YYYY-MM-DD');
                const day = invoiceDay.date();
                const devName = invoice.deviceIdName;

                if (!deviceMap[devName]) {
                    const info = deviceInfoMap[devName] || {};
                    deviceMap[devName] = {
                        device: {
                            name: devName,
                            deviceId: info.deviceId || invoice.deviceId || devName,
                            driverName: info.driverName || contractDriverMap[devName] || null,
                            unpaidTotal: 0,
                            cutOff: Boolean(info.cutOff)
                        },
                        days: {}
                    };
                }

                const totalPaid = paymentsObj[devName]?.[dateKey]?.totalPaid || 0;

                const isFuture = invoiceDay.startOf('day').isAfter(todayStart);
                const isBeforeToday = invoiceDay.startOf('day').isBefore(todayStart);
                if (invoice.dayType !== 'FREE' && invoice.dayType !== 'ADJUSTMENT' && isBeforeToday) {
                    deviceMap[devName].device.unpaidTotal += invoice.amount - invoice.paidAmount;
                }
                deviceMap[devName].days[day] = {
                    amount: invoice.amount,
                    paidAmount: invoice.paidAmount,
                    dayType: invoice.dayType,
                    distance: invoice.distance || 0,
                    totalPaid
                };
            });
            logger.info(`[SUMMARY TIMING] JS loop: ${Date.now() - t2}ms | total: ${Date.now() - t0}ms`);

            return Object.values(deviceMap);

        } catch (error) {
            logger.error('Error getting monthly payment summary in service:', error);
            throw error;
        }
    }

    async getDailyReconciliationReport({ month, year, companyId }) {
        try {
            const from = new Date(year, month - 1, 1);
            const to = new Date(year, month, 1);

            const match = {
                status: 'APPROVED',
                type: 'WOMPI',
                finalized_at: { $gte: from, $lt: to }
            };

            let companyTz = TIMEZONE || 'America/Bogota';
            let txPercentage = 0.0265;
            let txFixedFee = 700;
            let ivaMultiplier = 1.19;

            if (companyId) {
                match.companyId = new mongoose.Types.ObjectId(companyId);
                const company = await Company.findById(companyId);
                if (company) {
                    if (company.timezone) {
                        companyTz = company.timezone;
                    }
                    if (company.wompiConfig && company.wompiConfig.wompiCommission !== undefined) {
                        txPercentage = Math.abs(company.wompiConfig.wompiCommission);
                    }
                    if (company.billingConfig) {
                        txFixedFee = company.billingConfig.transactionFixedFee ?? 700;
                        const ivaPercent = company.billingConfig.ivaPercentage ?? 0.19;
                        ivaMultiplier = 1 + ivaPercent;
                    }
                }
            }

            // Calculate offset in milliseconds (utcOffset returns minutes)
            const timezoneOffsetMs = dayjs().tz(companyTz).utcOffset() * 60000;

            const results = await Payment.aggregate([
                { $match: match },

                {
                    $group: {
                        _id: {
                            $dateToString: {
                                format: "%Y-%m-%d",
                                date: { $add: ["$finalized_at", timezoneOffsetMs] }
                            }
                        },
                        payments: { $sum: "$amount" },
                        transactions: { $sum: 1 }
                    }
                },

                { $sort: { _id: 1 } },

                {
                    $project: {
                        _id: 0,
                        date: "$_id",
                        payments: 1,
                        transactions: 1,

                        commission: {
                            $ceil: {
                                $multiply: [
                                    {
                                        $add: [
                                            { $multiply: ["$payments", txPercentage] },
                                            { $multiply: ["$transactions", txFixedFee] }
                                        ]
                                    },
                                    ivaMultiplier // IVA
                                ]
                            }
                        }
                    }
                },

                {
                    $addFields: {
                        bancolombia: {
                            $trunc: [
                                { $subtract: ["$payments", "$commission"] },
                                0
                            ]
                        }
                    }
                }
            ]);

            const daysInMonth = dayjs(from).daysInMonth();

            const reportMap = new Map();

            for (let i = 1; i <= daysInMonth; i++) {
                const dateStr = dayjs(new Date(year, month - 1, i)).format('YYYY-MM-DD');

                reportMap.set(dateStr, {
                    date: dateStr,
                    day: i,
                    payments: 0,
                    commission: 0,
                    bancolombia: 0,
                    transactions: 0
                });
            }

            results.forEach(row => {
                reportMap.set(row.date, {
                    date: row.date,
                    day: parseInt(row.date.split('-')[2], 10),
                    payments: row.payments,
                    commission: row.commission,
                    bancolombia: row.bancolombia,
                    transactions: row.transactions
                });
            });

            // Fetch reconciled dates from database
            const reconciliationRecords = await Reconciliation.find({
                companyId: companyId || null,
                date: { $regex: `^${year}-${String(month).padStart(2, '0')}-` }
            }).lean();

            const reconciledDates = {};
            reconciliationRecords.forEach(rec => {
                reconciledDates[rec.date] = {
                    reconciled: rec.reconciled,
                    transactionId: rec.transactionId || ''
                };
            });

            return {
                report: Array.from(reportMap.values()),
                reconciledDates
            };

        } catch (error) {
            logger.error('Error getting daily reconciliation report:', error);
            throw error;
        }
    }

    async toggleReconciliation({ date, reconciled, transactionId, companyId }) {
        try {
            const updateFields = { reconciled };
            if (transactionId !== undefined) {
                updateFields.transactionId = transactionId;
            }
            const result = await Reconciliation.findOneAndUpdate(
                { companyId: companyId || null, date },
                { $set: updateFields },
                { upsert: true, new: true }
            );
            return result;
        } catch (error) {
            logger.error('Error toggling reconciliation in service:', error);
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
