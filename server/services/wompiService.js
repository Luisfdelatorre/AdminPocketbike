import { Url, Login, Transaction } from '../config/config.js';
import crypto from 'crypto';

export class WompiService {

    constructor() {
        this.apiUrl = Url.WompiBaseUrl;
        this.publicKey = Login.Wompi.publicKey;
        this.privateKey = Login.Wompi.privateKey;
        this.integritySecret = Login.Wompi.secretIntegrity;
        this.signature = null;
        this.timestamp = null;
        this.eventData = null;
        this.event = null;
        this.payload = null;
    }

    init(payload) {
        this.payload = payload;
        this.signature = payload.signature;
        this.timestamp = payload.timestamp;
        this.eventData = payload.data;
        this.event = payload.event;
    }

    getEventId() {
        return `${this.event}-${this.eventData.transaction?.id}-${this.timestamp}`;
    }

    /**
     * Create a payment transaction with Wompi
     */
    async createTransaction({
        reference,
        amount,
        currency = 'COP',
        customerEmail = null,
        redirectUrl = null
    }) {
        const url = `${this.apiUrl}/transactions`;

        const payload = {
            acceptance_token: await this.getAcceptanceToken(),
            amount_in_cents: amount,
            currency,
            customer_email: customerEmail || 'default@example.com',
            reference,
            redirect_url: redirectUrl || config.app.frontendUrl,
        };

        try {
            const response = await fetch(url, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${this.privateKey}`,
                },
                body: JSON.stringify(payload),
            });

            const data = await response.json();

            if (!response.ok) {
                throw new Error(data.error?.reason || 'Wompi API error');
            }

            return {
                success: true,
                transactionId: data.data.id,
                reference: data.data.reference,
                status: data.data.status,
                checkoutUrl: `https://checkout.wompi.co/l/${data.data.id}`,
                response: data.data,
            };
        } catch (error) {
            console.error('Wompi createTransaction error:', error);
            throw error;
        }
    }

    /**
     * Create a payment source (for saved cards, Nequi, etc.)
     */
    async createPaymentSource({
        type = 'NEQUI',
        phoneNumber = null,
        token = null
    }) {
        const url = `${this.apiUrl}/payment_sources`;

        const payload = {
            type,
            acceptance_token: await this.getAcceptanceToken(),
        };

        if (type === 'NEQUI' && phoneNumber) {
            payload.phone_number = phoneNumber;
        } else if (type === 'CARD' && token) {
            payload.token = token;
        }

        try {
            const response = await fetch(url, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${this.publicKey}`,
                },
                body: JSON.stringify(payload),
            });

            const data = await response.json();

            if (!response.ok) {
                throw new Error(data.error?.reason || 'Failed to create payment source');
            }

            return data.data;
        } catch (error) {
            console.error('Wompi createPaymentSource error:', error);
            throw error;
        }
    }

    /**
     * Get acceptance token (required for transactions)
     */
    async getAcceptanceToken() {
        const url = `${this.apiUrl}/merchants/${this.publicKey}`;

        try {
            const response = await fetch(url, {
                headers: {
                    'Authorization': `Bearer ${this.publicKey}`,
                },
            });

            const data = await response.json();

            if (!response.ok) {
                throw new Error('Failed to get acceptance token');
            }

            return data.data.presigned_acceptance.acceptance_token;
        } catch (error) {
            console.error('Wompi getAcceptanceToken error:', error);
            throw error;
        }
    }

    /**
     * Verify a transaction status with Wompi API
     */
    async verifyTransaction(transactionId) {
        const url = `${this.apiUrl}/transactions/${transactionId}`;

        try {
            const response = await fetch(url, {
                headers: {
                    'Authorization': `Bearer ${this.publicKey}`,
                },
            });

            const data = await response.json();

            if (!response.ok) {
                throw new Error(data.error?.reason || 'Failed to verify transaction');
            }

            return {
                transactionId: data.data.id,
                reference: data.data.reference,
                status: data.data.status,
                statusMessage: data.data.status_message,
                paymentMethodType: data.data.payment_method_type,
                amount: data.data.amount_in_cents,
                response: data.data,
            };
        } catch (error) {
            console.error('Wompi verifyTransaction error:', error);
            throw error;
        }
    }

    getEventData() {
        const eventId = this.getEventId();
        const event = this.event;
        const eventData = this.eventData;
        const signature = this.signature;
        const payload = this.payload;

        return {
            eventId,
            eventType: event,
            transactionId: eventData.transaction?.id,
            paymentReference: eventData.transaction?.reference,
            status: eventData.transaction?.status,
            signature,
            payload,
        };
    }

    /**
     * Validate webhook signature
     */
    validateWebhookSignature() {
        if (!this.integritySecret) {
            console.warn('⚠️  WOMPI_INTEGRITY_SECRET not configured, skipping signature validation');
            return true;
        }

        try {
            const signature = this.signature;

            // Validate signature structure
            if (!signature || !signature.checksum || !Array.isArray(signature.properties)) {
                console.error('❌ Malformed signature object');
                return false;
            }

            // Concatenate property values in the order specified by Wompi
            const propertyValues = this.concatenateWebhookProperties(signature.properties);

            // Create the message: properties + timestamp + secret
            const message = `${propertyValues}${this.timestamp}${this.integritySecret}`;

            // Generate hash
            const hash = crypto.createHash('sha256').update(message).digest('hex');

            // Compare with checksum
            const isValid = hash === signature.checksum;

            if (!isValid) {
                console.error('❌ Signature mismatch:', {
                    expected: signature.checksum,
                    calculated: hash,
                    message: message.substring(0, 100) + '...'
                });
            }

            return isValid;
        } catch (error) {
            console.error('Webhook signature validation error:', error);
            return false;
        }
    }

    /**
     * Concatenate webhook properties in correct order for signature validation
     * @param {Array} propertyPaths - Array of property paths like ['transaction.id', 'transaction.status']
     */
    concatenateWebhookProperties(propertyPaths) {
        return propertyPaths.map(path => {
            // Extract value from eventData using dot notation path
            const value = this.getNestedValue(this.eventData, path);

            // Convert to string (objects as JSON)
            return typeof value === 'object' && value !== null
                ? JSON.stringify(value)
                : String(value);
        }).join('');
    }

    /**
     * Get nested value from object using dot notation
     * @param {Object} obj - The object to search
     * @param {String} path - Dot notation path like 'transaction.id'
     */
    getNestedValue(obj, path) {
        return path.split('.').reduce((current, key) => {
            return current?.[key];
        }, obj);
    }

    /**
     * Map Wompi status to internal status
     */
    mapStatus(wompiStatus) {
        return config.WOMPI_STATUS_MAP[wompiStatus] || wompiStatus;
    }
}

export default new WompiService();
