import companyService from '../services/companyService.js';
import { Device } from '../models/Device.js';
import { Payment } from '../models/index.js';
import logger from '../config/logger.js';

const validateWompiSignature = async (req, res, next) => {
    try {
        logger.info(`Webhook Wompi received`);

        const transaction = req.body?.data?.transaction;
        const reference = transaction?.reference;

        if (!reference) {
            logger.warn('Webhook missing reference');
            return res.status(400).json({ valid: false, reason: 'Missing reference' });
        }

        // 1️⃣ Try to find the existing payment by Wompi transaction ID (primary path)
        const transactionId = transaction?.id;
        let wompiAdapter;

        if (transactionId) {
            const payment = await Payment.findById(transactionId).select('companyId').lean();
            if (payment?.companyId) {
                wompiAdapter = await companyService.getWompiAdapter(payment.companyId);
            }
        }

        // 2️⃣ Payment not found yet (webhook arrived before payment record) — look up via device
        if (!wompiAdapter) {
            const deviceIdName = reference.split('-')[0];
            const device = await Device.findOne({ name: deviceIdName }).select('companyId').lean();
            if (device?.companyId) {
                wompiAdapter = await companyService.getWompiAdapter(device.companyId);
            }
        }

        // 3️⃣ Last resort: default adapter
        if (!wompiAdapter) {
            logger.warn(`[WOMPI] Could not resolve company for transaction ${transactionId}, using default adapter`);
            wompiAdapter = await companyService.getWompiAdapter(null);
        }

        wompiAdapter.init(req.body);

        // 4️⃣ Validate Webhook Data Structure
        const validated = wompiAdapter.validateWebhookData();
        if (!validated.valid) {
            logger.warn('Invalid webhook structure', validated);
            return res.status(400).json(validated);
        }

        // 5️⃣ Validate Signature
        const signatureCheck = await wompiAdapter.validateWebhookSignature();
        if (!signatureCheck.ok) {
            logger.warn('Invalid webhook signature', signatureCheck);
            return res.status(403).json(signatureCheck);
        }

        // 6️⃣ Attach adapter to request for controller to use
        req.wompiAdapter = wompiAdapter;
        req.validated = validated;

        next();
    } catch (err) {
        logger.error('Error in Wompi validation middleware', err);
        return res.status(500).json({ error: 'Internal Server Error' });
    }
};

export { validateWompiSignature };
