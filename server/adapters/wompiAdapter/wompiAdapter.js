import crypto from 'crypto';
import logger from '../../config/logger.js';
import wompiApi from './wompiApi.js';
import helper from '../../utils/helpers.js';
import { Transaction, Login, Url } from '../../config/config.js';
import dayjs from '../../config/dayjs.js';

const { PAYMENT_TYPE, currencyCode, defaultCustomer } = Transaction;
const { Wompi } = Login;
class WompiAdapter {
  constructor(reponseData) {
    this.reponseData = reponseData;
    this.integritySecret = Wompi.privateKeyEvents;
  }
  init(reponseData) {
    if (!reponseData || typeof reponseData !== 'object') {
      throw new Error('Invalid webhook data');
    }

    this.reponseData = reponseData;

    return this;
  }

  //requests

  async createTransactionRequest(phone, unpaidInvoice, acceptanceToken, companyId) {
    const reference = helper.generateReference(unpaidInvoice._id);
    const body = this.buildTransactionBody(phone, unpaidInvoice, reference, acceptanceToken);
    let transactionData;
    try {
      const response = await wompiApi.createTransaction(body);
      transactionData = response.data.data;
    } catch (error) {
      if (error.response) {
        console.error('[WOMPI] Create Transaction Failed Data:', JSON.stringify(error.response.data, null, 2));
      }
      throw error;
    }
    const paymentData = this.formatPaymentResponse(transactionData, {
      deviceIdName: unpaidInvoice.deviceIdName,
      unpaidInvoiceId: unpaidInvoice._id,
      deviceId: unpaidInvoice.deviceId,
      invoiceDate: unpaidInvoice.date,
      companyId: companyId,
      type: PAYMENT_TYPE.WOMPI,
      amount: transactionData.amount_in_cents / 100,
    });
    this.init(paymentData);
    return paymentData;
  }
  formatPaymentResponse(data, additionalFields = {}) {
    try {
      const paymentPayload = {
        ...data,
        _id: data?.id,
        paymentId: data?.id,
        used: false,
        ...additionalFields
      };
      return paymentPayload;
    } catch (error) {
      logger.error('Error formatting payment response:', error);
      throw error;
    }
  }
  async getTransactionStatus(transactionId) {
    const response = await wompiApi.getTransactionData(transactionId);
    const data = response.data.data;

    // Convert Wompi's UTC timestamp to local timezone (default: America/Bogota)
    const finalizedAt = data?.finalized_at ? dayjs(data.finalized_at).toDate() : null;

    const paymentDataUpdate = {
      _id: data?.id,
      status: data?.status,
      finalized_at: finalizedAt,
      reference: data?.reference
    };
    return paymentDataUpdate;
  }

  async getMerchantData() {
    try {
      //console.log('[WOMPI] Fetching Merchant Data:', {
      //  publicKey: Wompi.publicKey,
      //  headers: Wompi.AUTH
      //});
      const response = await wompiApi.getMerchantData();
      //console.log(response);
      return response.data.data.presigned_acceptance.acceptance_token;
    } catch (error) {
      if (error.response) {
        logger.error('[WOMPI] Error fetching merchant data details:', JSON.stringify(error.response.data, null, 2));
      }
      logger.error('[WOMPI] Error fetching merchant data:', error.message);
      throw error;
    }
  }
  _validateRequiredFields(obj, fields) {
    return fields.filter(f => obj[f] === undefined || obj[f] === null);
  }

  validateWebhookData() {
    if (!this.reponseData) {
      return { valid: false, reason: 'No webhook data' };
    }

    const { event, data, sent_at, signature } = this.reponseData;
    const transaction = data?.transaction;

    if (!event || !transaction || !sent_at || !signature) {
      return { valid: false, reason: 'Missing required fields' };
    }

    const { reference } = transaction;
    if (!reference) {
      logger.warn('[WOMPI] Referencia vacía');
      return { valid: false, reason: 'Missing reference' };
    }

    const parts = reference.split('-');
    const name = parts[0] || null;
    if (!name) {
      return { valid: false, reason: 'Wrong format reference' };
    }

    const requiredFields = ['id', 'status', 'amount_in_cents', 'reference'];
    const missingFields = this._validateRequiredFields(transaction, requiredFields);
    if (missingFields.length > 0) {
      logger.error(`[WOMPI] Transaction incompleta. Faltan: ${missingFields.join(', ')}`);
      return { valid: false, reason: `Missing fields: ${missingFields.join(', ')}` };
    }

    return {
      valid: true,
      event,
      transaction,
      sent_at,
      signature,
      name
    };
  }

  async validateWebhookSignature() {
    if (!this.reponseData) return { ok: false, reason: 'No webhook data' };

    const { signature = {}, timestamp, data: { transaction } = {} } = this.reponseData;
    const { checksum, properties } = signature;

    if (!checksum || !Array.isArray(properties) || !properties.length) {
      return { ok: false, reason: 'Malformed signature' };
    }

    try {
      const values = properties.map(prop => {
        const keys = prop.split('.');
        let value = { transaction };
        for (const key of keys) {
          value = value?.[key];
          if (value === undefined || value === null) {
            logger.warn(`[WOMPI] Propiedad ${prop} no encontrada`);
            return '';
          }
        }
        return String(value);
      });

      const concatenated = values.join('') + timestamp + this.integritySecret;
      const calculatedChecksum = crypto.createHash('sha256').update(concatenated).digest('hex');

      // Prevent timing attacks using timingSafeEqual
      const checksumBuffer = Buffer.from(checksum, 'utf8');
      const calculatedBuffer = Buffer.from(calculatedChecksum, 'utf8');


      if (checksumBuffer.length !== calculatedBuffer.length || !crypto.timingSafeEqual(checksumBuffer, calculatedBuffer)) {
        logger.error('[WOMPI] Firma inválida - Las firmas no coinciden');
        return { ok: false, reason: 'Invalid signature' };
      }

      logger.info(`[WOMPI] Firma válida reference: ${transaction?.reference}`);
      return { ok: true, reason: 'Firma válida' };
    } catch (error) {
      logger.error('[WOMPI] Error validando firma del webhook:', error);
      return { ok: false, reason: 'Error validating signature' };
    }
  }

  getReference() {
    if (!this.reponseData) throw new Error('No webhook data set');
    const { transaction } = this.reponseData.data;
    const { reference, id } = transaction;
    return { reference, id };
  }

  getPaymentData() {
    if (!this.reponseData) {
      return { valid: false, reason: 'No data available' };
    }
    const data = this.reponseData;

    // Convert Wompi's UTC timestamp to local timezone (default: America/Bogota)
    const finalizedAt = data.data.transaction.finalized_at
      ? dayjs(data.data.transaction.finalized_at).toDate()
      : null;

    return {
      _id: data.data.transaction.id,
      paymentId: data.data.transaction.id,
      status: data.data.transaction.status,
      reference: data.data.transaction.reference,
      amount_in_cents: data.data.transaction.amount_in_cents,
      currency: data.data.transaction.currency,
      finalized_at: finalizedAt,
      payment_method_type: data.data.transaction.payment_method_type,
      // Add other necessary fields used by paymentService
      wompiTransactionId: data.data.transaction.id
    };
  }
  getEventData() {
    const { event, data, sent_at, signature } = this.reponseData;
    const transaction = data?.transaction;
    const eventId = event + '-' + transaction.id;
    const eventType = event;
    const transactionId = transaction.id;
    const paymentReference = transaction.reference;
    const status = transaction.status;
    const payload = this.reponseData;
    return {
      eventId,
      eventType,
      transactionId,
      paymentReference,
      status,
      signature,
      payload
    }
  }
  isApproved() {
    const { event, data, status: directStatus } = this.reponseData || {};
    const status = data?.transaction?.status || directStatus;

    // Si hay evento, validamos que sea el correcto. Si no (polling), solo el status.
    if (event) {
      return event === 'transaction.updated' && status === 'APPROVED';
    }

    return status === 'APPROVED' || status === 'COMPLETED';
  }

  extractDeviceFromReference(reference) {
    if (!reference) return { name: null, timestamp: null };
    const [name, ts] = reference.split('-');
    const timestamp = ts && !isNaN(Number(ts)) ? Number(ts) : null;
    return { name, timestamp };
  }

  _generateSignature(reference, amountInCents, currency) {
    const dataString = `${reference}${amountInCents}${currency}${Wompi.secretIntegrity}`;
    return crypto.createHash('sha256').update(dataString).digest('hex');
  }

  buildTransactionBody(phone, unpaidInvoice, reference, acceptanceToken) {
    const now = Date.now();
    const amountInCents = unpaidInvoice.amount * 100; // Corrected: Use actual amount
    return {
      acceptance_token: acceptanceToken,
      amount_in_cents: amountInCents,
      currency: currencyCode,
      signature: this._generateSignature(reference, amountInCents, currencyCode),
      customer_email: helper.generateEmail(unpaidInvoice.deviceIdName),
      reference: reference,
      payment_method: { type: 'NEQUI', phone_number: phone },
      redirect_url: Url.redirectUrl,
      customer_data: {
        phone_number: phone,
        full_name: `${unpaidInvoice.deviceIdName} ${defaultCustomer.nameSuffix}`
      },

    };
  }


}

export default WompiAdapter;
