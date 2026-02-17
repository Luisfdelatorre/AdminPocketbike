import WompiAdapter from '../adapters/wompiAdapter/wompiAdapter.js';
import { getWompiApi } from '../adapters/wompiAdapter/wompiApi.js';
import { Payment } from '../models/index.js';
import { Company } from '../models/Company.js';
import { Login } from '../config/config.js';
const { Wompi } = Login;
import logger from '../config/logger.js';

const validateWompiSignature = async (req, res, next) => {
    try {
        const wompiAdapter = new WompiAdapter(req.body);

        // 1️⃣ Validate Webhook Data Structure
        const validated = wompiAdapter.validateWebhookData();

        if (!validated.valid) {
            logger.warn('Invalid webhook structure', validated);
            return res.status(400).json(validated);
        }

        // 1.5️⃣ Identify company and re-configure adapter with correct integrity secret
        const reference = validated.transaction.reference;
        const payment = await Payment.findOne({ $or: [{ reference }, { paymentId: validated.transaction.id }] });

        if (payment && payment.companyId) {
            const company = await Company.findById(payment.companyId);
            if (company && company.wompiConfig) {
                // Update adapter with company-specific config
                const config = company.wompiConfig;
                wompiAdapter.config = config;
                wompiAdapter.api = getWompiApi(config);
                wompiAdapter.integritySecret = config.integritySecret || Wompi.privateKeyEvents;
                console.log(`[WOMPI] Validating signature with custom secret for company: ${company.name}`);
            }
        }

        // 2️⃣ Validate Signature
        const signatureCheck = await wompiAdapter.validateWebhookSignature();
        console.log("--signatureCheck", signatureCheck);
        if (!signatureCheck.ok) {
            logger.warn('Invalid webhook signature', signatureCheck);
            return res.status(403).json(signatureCheck);
        }

        // 3️⃣ Attach adapter to request for controller to use (optional but efficient)
        req.wompiAdapter = wompiAdapter;

        next();
    } catch (err) {
        logger.error('Error in Wompi validation middleware', err);
        return res.status(500).json({ error: 'Internal Server Error' });
    }
};

export { validateWompiSignature };
