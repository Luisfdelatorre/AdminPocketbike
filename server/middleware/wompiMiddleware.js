import WompiAdapter from '../adapters/wompiAdapter/wompiAdapter.js';
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
