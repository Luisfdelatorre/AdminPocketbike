import companyService from '../services/companyService.js';
import { getWompiApi } from '../adapters/wompiAdapter/wompiApi.js';
import { Payment } from '../models/index.js';
import { Company } from '../models/Company.js';
import { Login } from '../config/config.js';
const { Wompi } = Login;
import logger from '../config/logger.js';

const validateWompiSignature = async (req, res, next) => {
    try {

        logger.info(`Webhook Wompi`, req.body);

        const reference = req.body.data.transaction.reference;
        if (!reference) {
            logger.warn('Invalid webhook structure', validated);
            return res.status(400).json(validated);
        }
        console.log("reference", reference);
        // const payment = await Payment.findOne({ reference });

        const wompiAdapter = await companyService.getWompiAdapter('69b26d6f318e40e31d1d2495');
        wompiAdapter.init(req.body);
        // 1️⃣ Validate Webhook Data Structure
        const validated = wompiAdapter.validateWebhookData();
        if (!validated.valid) {
            logger.warn('Invalid webhook structure', validated);
            return res.status(400).json(validated);
        }
        // 2️⃣ Validate Signature
        const signatureCheck = await wompiAdapter.validateWebhookSignature();
        if (!signatureCheck.ok) {
            logger.warn('Invalid webhook signature', signatureCheck);
            return res.status(403).json(signatureCheck);
        }

        // 3️⃣ Attach adapter to request for controller to use (optional but efficient)
        req.wompiAdapter = wompiAdapter;
        req.validated = validated;

        next();
    } catch (err) {
        logger.error('Error in Wompi validation middleware', err);
        return res.status(500).json({ error: 'Internal Server Error' });
    }
};

export { validateWompiSignature };
