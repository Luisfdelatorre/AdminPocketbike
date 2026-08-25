import crypto from 'crypto';
import logger from '../../config/logger.js';
import wompiApi, { getWompiApi } from './wompiApi.js';
import helper from '../../utils/helpers.js';
import { Transaction, Login, Url } from '../../config/config.js';
import dayjs from '../../config/dayjs.js';
import { Contract } from '../../models/Contract.js';

const { PAYMENT_TYPE, currencyCode, defaultCustomer } = Transaction;

class WompiAdapter {
  constructor(reponseData, config) {
    this.reponseData = reponseData;
    this.config = config;
    this.api = config ? getWompiApi(config) : wompiApi;
    this.integritySecret = config?.integritySecret;
    this.eventsSecret = config?.eventsSecret;
  }
  init(reponseData) {
    if (!reponseData || typeof reponseData !== 'object') {
      throw new Error('Invalid webhook data');
    }

    this.reponseData = reponseData;

    return this;
  }

  //requests

  async createTransactionRequest(phone, unpaidInvoice, contract, paymentMethod = 'NEQUI_PUSH') {
    const daysToPrepay = Contract.getBillingMultiplier(contract.paymentFrequency, contract.freeDayPolicy);
    const targetAmount = contract.dailyRate * daysToPrepay;
    const invoicePayload = unpaidInvoice.toObject();
    invoicePayload.amount = targetAmount;
    const acceptanceToken = await this.getMerchantData();
    const reference = helper.generateReference(unpaidInvoice._id);
    const body = this.buildTransactionBody(phone, invoicePayload, reference, acceptanceToken, paymentMethod);
    let transactionData;
    try {
      logger.debug('[WOMPI] Create Transaction Body:', JSON.stringify(body, null, 2));
      const response = await this.api.createTransaction(body);
      logger.debug('[WOMPI] Create Transaction Response:', JSON.stringify(response.data, null, 2));
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
      gpsId: unpaidInvoice.gpsId,
      invoiceDate: unpaidInvoice.date,
      companyId: contract.companyId || unpaidInvoice.companyId,
      paymentFrequency: contract.paymentFrequency,
      billingMultiplier: daysToPrepay,
      type: PAYMENT_TYPE.WOMPI,
      amount: transactionData.amount_in_cents / 100,
      paymentMethod,
    });
    this.init(paymentData);
    return paymentData;
  }
  formatPaymentResponse(data, additionalFields = {}) {
    try {
      const extra = data?.payment_method?.extra;
      const paymentPayload = {
        ...data,
        _id: data?.id,
        paymentId: data?.id,
        used: false,
        qrImage: extra?.qr_image ?? null,
        qrId: extra?.qr_id ?? null,
        externalIdentifier: extra?.external_identifier ?? null,
        ...additionalFields
      };
      return paymentPayload;
    } catch (error) {
      logger.error('Error formatting payment response:', error);
      throw error;
    }
  }
  async getTransactionStatus(transactionId) {
    const response = await this.api.getTransactionData(transactionId);
    const data = response.data.data;

    // Convert Wompi's UTC timestamp to local timezone (default: America/Bogota)
    const finalizedAt = data?.finalized_at ? dayjs(data.finalized_at).toDate() : null;
    const extra = data?.payment_method?.extra;

    // ── DIAGNOSTIC: log QR image format from Wompi ──────────────────────────
    if (extra?.qr_image) {
      const qrSample = String(extra.qr_image).substring(0, 120);
      logger.info(`[WOMPI-QR-DIAG] qr_image prefix (120 chars): ${qrSample}`);
      logger.info(`[WOMPI-QR-DIAG] payment_method_type: ${data?.payment_method_type}`);
    } else {
      logger.info(`[WOMPI-QR-DIAG] status=${data?.status} – qr_image is null/empty for ref=${data?.reference}`);
    }
    // ────────────────────────────────────────────────────────────────────────

    const paymentDataUpdate = {
      _id: data?.id,
      status: data?.status,
      finalized_at: finalizedAt,
      reference: data?.reference,
      // QR fields — null until Wompi generates them (async, appears after 1-3 polls at 2s)
      qrImage: extra?.qr_image ?? null,
      qrId: extra?.qr_id ?? null,
      externalIdentifier: extra?.external_identifier ?? null,
    };
    return paymentDataUpdate;
  }

  async getMerchantData() {
    try {
      //console.log('[WOMPI] Fetching Merchant Data:', {
      //  publicKey: Wompi.publicKey,
      //  headers: Wompi.AUTH
      //});
      const response = await this.api.getMerchantData();
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

      const concatenated = values.join('') + timestamp + this.eventsSecret;
      console.log("concatenated", concatenated);
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
    const dataString = `${reference}${amountInCents}${currency}${this.integritySecret}`;
    return crypto.createHash('sha256').update(dataString).digest('hex');
  }

  buildTransactionBody(phone, invoicePayload, reference, acceptanceToken, paymentMethod = 'NEQUI_PUSH') {
    const amountInCents = invoicePayload.amount * 100;
    const isSandbox = this.api.publicKey?.includes('_test_') ?? false;

    const base = {
      acceptance_token: acceptanceToken,
      amount_in_cents: amountInCents,
      currency: 'COP',
      signature: this._generateSignature(reference, amountInCents, 'COP'),
      customer_email: helper.generateEmail(invoicePayload.deviceIdName),
      reference: reference,
      redirect_url: Url.redirectUrl,
      customer_data: {
        full_name: `${invoicePayload.deviceIdName} ${defaultCustomer.nameSuffix}`
      },
    };

    if (paymentMethod === 'BANCOLOMBIA_QR') {
      base.payment_method = {
        type: 'BANCOLOMBIA_QR',
        payment_description: 'Pago cuota PocketBike',
        ...(isSandbox && { sandbox_status: 'APPROVED' })
      };
    } else {
      // NEQUI_PUSH — default, sin cambios al comportamiento actual
      base.payment_method = { type: 'NEQUI', phone_number: phone };
      base.customer_data.phone_number = phone;
    }

    return base;
  }


}

export default WompiAdapter;
