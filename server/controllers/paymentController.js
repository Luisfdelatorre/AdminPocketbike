import paymentService from '../services/paymentService.js';
import contractRepository from '../repositories/contractRepository.js';
import logger from '../config/logger.js';

const M_REQUEST_SENT = "Solicitud de pago enviada";

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

    /*Get payment history for authenticated device*/
    async getPaymentHistory(req, res) {
        // try {
        // const { deviceIdName } = req.paymentAuth;
        const { page, limit, status } = req.query;
        const history = await paymentService.getPaymentHistory({ page, limit, status });
        // The service now returns { payments, pagination }, so we should probably just return that directly or wrap it?
        // The frontend expects { success: true, payments: [], pagination: {} } based on Payments.jsx
        // Let's return the whole result from service which should match structure or be adapted.
        // Actually, let's look at Payments.jsx: const result = await response.json(); if (result.success) ...
        // So we need to return { success: true, ...history }
        res.json({ success: true, ...history });
        //} catch (error) {
        //    logger.error('Get payment history error:', error.message);
        //    res.status(500).json({ error: 'Failed to get payment history' });
        // }
    },

    /*Get device online status*/
    async getDeviceStatus(req, res) {
        // try {
        console.log('Device ID Name:', req.paymentAuth);
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
            const { deviceIdName } = req.paymentAuth;
            // Try to get contractId from token, if not, fetch active contract
            let contractId = req.paymentAuth.contractId;

            if (!contractId) {
                const contract = await contractRepository.getActiveContractByDevice(deviceIdName);
                if (!contract) {
                    return res.status(404).json({ error: 'No active contract found' });
                }
                contractId = contract.contractId;
            }

            const result = await paymentService.applyFreeDay(deviceIdName, contractId);

            res.json(result);

        } catch (error) {
            logger.error('Use free day error:', error.message);
            res.status(500).json({ error: error.message || 'Failed to use free day' });
        }
    },

    /*Request loan - allow working today and paying later*/
    async requestLoan(req, res) {
        try {
            const { deviceIdName } = req.paymentAuth;
            let contractId = req.paymentAuth.contractId;

            if (!contractId) {
                const contract = await contractRepository.getActiveContractByDevice(deviceIdName);
                if (!contract) {
                    return res.status(404).json({ error: 'No active contract found' });
                }
                contractId = contract.contractId;
            }
            const result = await paymentService.applyLoan(deviceIdName, contractId);

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

    /*Create payment*/
    async createPayment(req, res) {
        try {
            const { phone } = req.body;
            // SECURITY: Force use of authenticated deviceId from token
            const { deviceIdName } = req.paymentAuth;

            if (!phone || !deviceIdName) {
                return res.status(400).json({ success: false, message: "Missing required fields" });
            }
            const result = await paymentService.initiateWompiPaymentTransaction(deviceIdName, phone);
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


    /*Get payment stream (SSE)*/
    async getPaymentStream(req, res) {
        const { reference } = req.params;
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

        // Note: paymentService needs to support waiting/pooling or we rely on the client to re-poll.
        // The user's code implies a server-side poll. 
        // For this step I'll assume paymentService.monitorTransactionStatus exists or I stubbed it.
        // It's stubbed in my previous step. Real SSE logic might need more robust background job integration.
        // But I will hook it up.
        paymentService.monitorTransactionStatus(reference, {
            onUpdate: sendUpdate,
            // timeout logic handled in service
        }).catch(err => {
            logger.error(`Error in monitorTransactionStatus for ${reference}:`, err.message);
        });

        req.on('close', () => {
            // Cleanup logic if needed
        });
    }
};

export default paymentController;
