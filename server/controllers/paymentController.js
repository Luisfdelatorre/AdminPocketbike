import paymentService from '../services/paymentService.js';
import contractRepository from '../repositories/contractRepository.js';
import logger from '../config/logger.js';
import { Transaction, PAYMENTMESSAGES } from '../config/config.js';
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
            console.log("Auth:", req.auth);

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
            console.log("Auth:", req.auth);

            // if (!month || !year) {
            //     return res.status(400).json({ success: false, error: 'Month and Year are required' });
            // }

            // let targetCompanyId = null;

            // // Admin logic
            // if (req.auth) {
            //     const isSystemAdmin = isSuperAdmin || (role === 'admin' && companyName === 'System');
            //     if (!isSystemAdmin) {
            //         targetCompanyId = companyId;
            //     }
            // }

            // console.log("Target Company ID:", targetCompanyId);
            // console.log("Month:", month);
            // console.log("Year:", year);
            // const summary = await paymentService.getPaymentSummary({
            //     month,
            //     year,
            //     companyId: targetCompanyId
            // });

            // res.json({ success: true, data: summary });

        } catch (error) {
            logger.error('Get payment summary error:', error.message);
            res.status(500).json({ success: false, error: 'Failed to get payment summary' });
        }
    },

    /*Get device online status*/
    async getDeviceStatus(req, res) {
        // try {
        const { deviceIdName, deviceId } = req.paymentAuth;
        const status = await paymentService.getDataStatus(deviceId);
        res.json(status);
        // } catch (error) {
        //  logger.error(`Error in getDeviceStatus for ${req.paymentAuth?.deviceId}:`, error.message);
        // res.status(500).json({ error: 'Failed to get device status' });
        //  }
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
            console.log("Device ID:", deviceIdName);
            console.log("Contract ID:", contractId);
            console.log("Company ID:", companyId);

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
                amount: status.dailyRate,
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
        let stopMonitoring = null;
        const sendUpdate = (update) => {
            try {
                res.write(`data: ${JSON.stringify(update)}\n\n`);
                if (['COMPLETED', 'FAILED', 'TIMEOUT', 'ERROR'].includes(update.status)) {
                    res.end();
                }
            } catch (error) {
                logger.error(`SSE write error for ${reference}:`, error.message);
                res.end();
            }
        };
        paymentService.monitorTransactionStatus(reference, {
            onUpdate: sendUpdate,
            timeout: TEMPORARY_RESERVATION_TIMEOUT
        }).catch(err => {
            logger.error(`Error in monitorTransactionStatus for ${reference}:`, err.message);
        });

        req.on('close', () => {
            if (stopMonitoring) stopMonitoring();
        });
    }
};

export default paymentController;
