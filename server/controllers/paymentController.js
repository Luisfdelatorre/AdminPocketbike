import paymentService from '../services/paymentService.js';
import deviceRepository from '../repositories/deviceRepository.js';
import contractRepository from '../repositories/contractRepository.js';
import { sseService } from '../utils/sseService.js';
import logger from '../config/logger.js';
import { Transaction, PAYMENTMESSAGES } from '../config/config.js';
import helpers from '../utils/helpers.js';
import { Contract } from '../models/Contract.js';
const { PAYMENT_STATUS, TEMPORARY_RESERVATION_TIMEOUT, DEFAULT_PAYMENT_EMAIL_DOMAIN } = Transaction;
const { M_REQUEST_SENT } = PAYMENTMESSAGES;
const paymentController = {

    /*Get payment status for authenticated device*/
    async getPaymentStatus(req, res) {
        try {
            const { deviceIdName } = req.paymentAuth; // Set by middleware

            const contract = await contractRepository.getActiveContractByDevice(deviceIdName);

            if (!contract) {
                return res.status(404).json({
                    error: 'No active contract found'
                });
            }
            const paymentStatus = await paymentService.calculatePaymentStatus(contract);
            res.json(paymentStatus);
        } catch (error) {
            logger.error('Get payment status error:', error.message);
            res.status(500).json({ error: 'Failed to get payment status' });
        }
    },
    /*Create payment*/
    async createPayment(req, res) {
        try {
            const { phone } = req.body;
            // SECURITY: Force use of authenticated deviceId from token
            const { deviceIdName, companyId } = req.paymentAuth;

            if (!phone || !deviceIdName) {
                return res.status(400).json({ success: false, message: "Missing required fields" });
            }
            const result = await paymentService.initiateWompiPaymentTransaction(deviceIdName, phone, companyId);
            return res.status(200).json({
                success: true,
                message: M_REQUEST_SENT,
                paymentData: result.paymentData,
            });

        } catch (error) {
            if (error.message.includes("Missing required fields")) {
                return res.status(400).json({ success: false, message: error.message });
            }
            if (error.message.includes("not found")) {
                return res.status(404).json({ success: false, message: error.message });
            }
            if (error.message.includes("already")) {
                return res.status(409).json({ success: false, message: error.message });
            }

            return res.status(500).json({ success: false, error: error.message });
        }
    },


    /*Get payment history*/
    async getPaymentHistory(req, res) {
        try {
            const { page, limit, status } = req.query;
            const { isSuperAdmin, companyId, role, companyName } = req.auth || {};

            // Check if it's a device request (req.paymentAuth) or admin request (req.auth)
            // The route seems to be used by Admin panel (req.auth) based on context

            let filter = {};
            if (status) filter.status = status;

            if (req.auth) {
                const isSystemAdmin = isSuperAdmin || (role === 'admin' && companyName === 'System');
                if (!isSystemAdmin) {
                    filter.companyId = companyId;
                }
            }
            const history = await paymentService.getPaymentHistory({ page, limit, filter });
            res.json({ success: true, ...history });

        } catch (error) {
            logger.error('Get payment history error:', error.message);
            res.status(500).json({ error: 'Failed to get payment history' });
        }
    },

    /*Get monthly payment summary grid*/
    async getPaymentSummary(req, res) {
        try {
            const { month, year } = req.query;
            const { isSuperAdmin, companyId, role, companyName } = req.auth || {};
            if (!month || !year) {
                return res.status(400).json({ success: false, error: 'Month and Year are required' });
            }
            let targetCompanyId = null;
            if (req.auth) {
                const isSystemAdmin = isSuperAdmin || (role === 'admin' && companyName === 'System');
                if (!isSystemAdmin) {
                    targetCompanyId = companyId;
                }
            }
            const summary = await paymentService.getPaymentSummary({
                month,
                year,
                companyId: targetCompanyId
            });

            res.json({ success: true, data: summary });

        } catch (error) {
            logger.error('Get payment summary error:', error.message);
            res.status(500).json({ success: false, error: 'Failed to get payment summary' });
        }
    },

    /*Get daily reconciliation report for Wompi vs Bancolombia*/
    async getDailyReconciliationReport(req, res) {
        try {
            const { month, year } = req.query;
            const { isSuperAdmin, companyId, role, companyName } = req.auth || {};
            if (!month || !year) {
                return res.status(400).json({ success: false, error: 'Month and Year are required' });
            }
            
            let targetCompanyId = null;
            if (req.auth) {
                const isSystemAdmin = isSuperAdmin || (role === 'admin' && companyName === 'System');
                if (!isSystemAdmin) {
                    targetCompanyId = companyId;
                }
            }
            
            const result = await paymentService.getDailyReconciliationReport({
                month: Number(month),
                year: Number(year),
                companyId: targetCompanyId
            });

            res.json({ 
                success: true, 
                data: result.report, 
                reconciledDates: result.reconciledDates 
            });

        } catch (error) {
            logger.error('Get reconciliation report error:', error.message);
            res.status(500).json({ success: false, error: 'Failed to get reconciliation report' });
        }
    },

    async toggleReconciliation(req, res) {
        try {
            const { date, reconciled, transactionId } = req.body;
            const { isSuperAdmin, companyId, role, companyName } = req.auth || {};
            if (!date) {
                return res.status(400).json({ success: false, error: 'Date is required' });
            }

            let targetCompanyId = null;
            if (req.auth) {
                const isSystemAdmin = isSuperAdmin || (role === 'admin' && companyName === 'System');
                if (!isSystemAdmin) {
                    targetCompanyId = companyId;
                }
            }

            await paymentService.toggleReconciliation({
                date,
                reconciled: Boolean(reconciled),
                transactionId,
                companyId: targetCompanyId
            });

            sseService.broadcast('reconciliation_update', { companyId: targetCompanyId, date });

            res.json({ success: true });
        } catch (error) {
            logger.error('Toggle reconciliation error:', error.message);
            res.status(500).json({ success: false, error: 'Failed to toggle reconciliation' });
        }
    },

    /*Use free day*/
    async useFreeDay(req, res) {
        try {
            const { deviceIdName, companyId } = req.paymentAuth;
            // Try to get contractId from token, if not, fetch active contract
            let contractId = req.paymentAuth.contractId;
            if (!contractId) {
                const contract = await contractRepository.getActiveContractByDevice(deviceIdName);
                if (!contract) {
                    return res.status(404).json({ error: 'No active contract found' });
                }
                contractId = contract.contractId;
            }
            const result = await paymentService.applyFreeDay(deviceIdName, contractId, companyId);
            res.json(result);
        } catch (error) {
            logger.error('Use free day error:', error.message);
            res.status(500).json({ error: error.message || 'Failed to use free day' });
        }
    },

    /*Request loan - allow working today and paying later*/
    async requestLoan(req, res) {
        try {
            const { deviceIdName, companyId } = req.paymentAuth;
            let contractId = req.paymentAuth.contractId;

            if (!contractId) {
                const contract = await contractRepository.getActiveContractByDevice(deviceIdName);
                if (!contract) {
                    return res.status(404).json({ error: 'No active contract found' });
                }
                contractId = contract.contractId;
            }
            const result = await paymentService.applyLoan(deviceIdName, contractId, companyId);

            res.json(result);

        } catch (error) {
            logger.error('Request loan error:', error.message);
            res.status(200).json({ success: false, message: error.message || 'Failed to request loan' });
        }
    },

    /*Get public device info (for pre-filling payment form)*/
    async getDeviceInfo(req, res) {
        try {
            const { deviceIdName } = req.params;
            const contract = await contractRepository.getActiveContractByDevice(deviceIdName);

            if (!contract) {
                return res.status(404).json({ success: false, error: 'Device not found' });
            }

            const status = await paymentService.calculatePaymentStatus(contract);

            res.json({
                success: true,
                phoneNumber: status.customerPhone,
                amount: status.amount,
                freeDays: status.freeDaysAvailable
            });

        } catch (error) {
            logger.error('Get device info error:', error.message);
            res.status(500).json({ success: false, error: 'Failed to get device info' });
        }
    },



    /*Get payment stream (SSE)*/
    async getPaymentStream(req, res) {
        const { reference } = req.params;
        console.log("reference", req.params);
        res.setHeader('Content-Type', 'text/event-stream');
        res.setHeader('Cache-Control', 'no-cache');
        res.setHeader('Connection', 'keep-alive');
        res.flushHeaders();
        res.write(`data: ${JSON.stringify({ status: 'CONNECTED', reference })}\n\n`);

        let closed = false;

        const closeStream = () => {
            if (closed) return;
            closed = true;
            if (!res.writableEnded) res.end();
        };

        const sendUpdate = (update) => {
            if (closed || res.writableEnded) return; // guard against write after end
            try {
                res.write(`data: ${JSON.stringify(update)}\n\n`);
                if (['COMPLETED', 'FAILED', 'TIMEOUT', 'ERROR', 'DECLINED'].includes(update.status)) {
                    closeStream();
                }
            } catch (error) {
                logger.error(`SSE write error for ${reference}:`, error.message);
                closeStream();
            }
        };

        paymentService.monitorTransactionStatus(reference, {
            onUpdate: sendUpdate,
            timeout: TEMPORARY_RESERVATION_TIMEOUT
        }).catch(err => {
            logger.error(`Error in monitorTransactionStatus for ${reference}:`, err.message);
            closeStream();
        });

        req.on('close', () => {
            closed = true; // client disconnected — silence any further writes
        });
    },

    /*Stream payments as CSV file for the requested month/year*/
    async exportCSV(req, res) {

        try {
            const { isSuperAdmin, companyId, role, companyName } = req.auth || {};
            let { month, year } = req.query;

            const now = new Date();
            month = Number(month || now.getMonth() + 1);
            year = Number(year || now.getFullYear());

            let filter = {};
            const isSystemAdmin = isSuperAdmin || (role === 'admin' && companyName === 'System');
            if (!isSystemAdmin) filter.companyId = companyId;

            // Date range for the requested month
            const from = new Date(year, month - 1, 1);
            const to = new Date(year, month, 1); // exclusive start of next month
            filter.createdAt = { $gte: from, $lt: to };

            const { payments } = await paymentService.getPaymentHistory({ limit: 9999, filter });

            const headers = [
                'Fecha', 'Dispositivo', 'Monto (COP)', 'Estado',
                'Referencia', 'Tipo Pago', 'Telefono', 'Factura', 'Empresa'
            ];

            const esc = v => `"${String(v ?? '').replace(/"/g, '""')}"`;

            const rows = payments.map(p => [
                esc(p.finalized_at
                    ? new Date(p.finalized_at).toLocaleString('es-CO')
                    : new Date(p.createdAt).toLocaleString('es-CO')),
                esc(p.deviceIdName || p.deviceId),
                esc(p.amount ?? 0),
                esc(p.status),
                esc(p.reference),
                esc(p.payment_method_type || p.paymentMethodType),
                esc(p.phone_number),
                esc(p.invoiceId || p.unpaidInvoiceId),
                esc(p.companyName)
            ].join(','));

            const monthStr = String(month).padStart(2, '0');
            const filename = `pagos_${year}-${monthStr}.csv`;
            const csv = '\uFEFF' + [headers.join(','), ...rows].join('\n');

            res.setHeader('Content-Type', 'text/csv; charset=utf-8');
            res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
            res.send(csv);

        } catch (error) {
            logger.error('Export CSV error:', error.message);
            res.status(500).json({ success: false, error: 'Failed to export CSV' });
        }
    },
    /*Admin: apply a manual adjustment (REPAIR / DAMAGE / MAINTENANCE / WORKSHOP)*/
    async manualAdjustment(req, res) {
        try {
            const { companyId } = req.auth;
            const { invoiceId, adjustmentType, amount, adjustmentReference, note } = req.body;
            if (!invoiceId || !adjustmentType) {
                return res.status(400).json({ success: false, error: 'invoiceId and adjustmentReason are required' });
            }
            const VALID_REASONS = ['REPAIR', 'DAMAGE', 'MAINTENANCE', 'WORKSHOP', 'OFFICE', 'OFICINA', 'INCAPACITY', 'INCAPACIDAD', 'MANUAL', 'NEQUI', 'EFECTIVO', 'TRANSFERENCIA', 'BANCOLOMBIA'];
            if (!VALID_REASONS.includes(adjustmentType)) {
                return res.status(400).json({ success: false, error: `adjustmentReason must be one of ${VALID_REASONS.join(', ')}` });
            }
            const result = await paymentService.applyManualAdjustment(invoiceId, companyId, { adjustmentType, amount, adjustmentType, adjustmentReference, note });
            sseService.broadcast('payment-updated', {
                type: 'payment',
                invoiceId,
                amount,
                adjustmentType,
                result,
                timestamp: new Date().toISOString()
            });
            return res.json({ success: true, data: result });
        } catch (error) {
            logger.error('Manual adjustment error:', error.message);
            return res.status(500).json({ success: false, error: error.message });
        }
    },
};

export default paymentController;
