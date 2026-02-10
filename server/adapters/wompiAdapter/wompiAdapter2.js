// src/adapters/wompiAdapter.js
const axios = require('axios');
const crypto = require('crypto');
const config = require('../../config/default');
const logger = require('../config/logger');

class WompiAdapter {
  constructor() {
    this.baseUrl = config.Url.WompiBaseUrl || 'https://production.wompi.co/v1';
    this.publicKey = config.Login.Wompi.publicKey;
    this.privateKey = config.Login.Wompi.privateKey;
    this.eventSecret = config.Login.Wompi.privateKeyEvents;

    this.client = axios.create({
      baseURL: this.baseUrl,
      headers: {
        Authorization: `Bearer ${this.privateKey}`,
        'Content-Type': 'application/json',
      },
      timeout: 10000,
    });
  }
  /**
   * Generar signature para transacción
   * @private
   * @param {String} reference - Referencia de la transacción
   * @param {Number} amountInCents - Monto en centavos
   * @param {String} currency - Moneda
   * @returns {String} - Hash SHA256
   */
  _generateTransactionSignature(reference, amountInCents, currency) {
    const dataString = `${reference}${amountInCents}${currency}${this.eventSecret}`;

    return crypto.createHash('sha256').update(dataString).digest('hex');
  }

  /**
   * Crear transacción NEQUI push (solicitud de pago)
   * @param {Object} transactionData - Datos de la transacción
   * @returns {Promise<Object>}
   */
  async sendNequiPushNotification(transactionData) {
    try {
      const {
        phoneNumber,
        amountInCents,
        reference,
        customerEmail,
        customerFullName,
        acceptanceToken,
        redirectUrl,
      } = transactionData;

      if (!phoneNumber || !/^3\d{9}$/.test(phoneNumber)) {
        throw new Error('Número de teléfono inválido');
      }
      if (!amountInCents || amountInCents < 1000) {
        throw new Error('Monto inválido (mínimo $10)');
      }

      const signature = this._generateTransactionSignature(
        reference,
        amountInCents,
        config.Transaction.currency || 'COP'
      );

      const payload = {
        acceptance_token: acceptanceToken,
        amount_in_cents: amountInCents,
        currency: config.Transaction.currency || 'COP',
        payment_method: {
          type: 'NEQUI',
          phone_number: phoneNumber,
        },
        reference,
        redirect_url: redirectUrl || config.wompi.redirectUrl,
        customer_email: customerEmail,
        customer_data: {
          phone_number: phoneNumber,
          full_name: customerFullName,
        },
        signature,
      };
      const response = await this.client.post('/transactions', payload);
      return response.data.data;
    } catch (error) {
      logger.error('💥 Error creando transacción NEQUI:', {
        message: error.message,
        response: error.response?.data,
      });
      throw error;
    }
  }

  /**
   * Validar firma del webhook de Wompi
   * @param {Object} transaction - Objeto transaction del webhook
   * @param {Object} signature - Objeto signature con checksum y properties
   * @returns {Boolean}
   */
  validateWebhookSignature(transaction, signature, timestamp) {
    try {
      logger.info('🔐 Validando firma del webhook...');

      const { checksum, properties } = signature;

      if (!checksum || !properties || !Array.isArray(properties)) {
        logger.error('❌ Signature malformada');
        return false;
      }

      logger.info('📋 Properties a validar:', properties);

      // Extraer valores de las propiedades especificadas
      const values = properties.map((prop) => {
        const keys = prop.split('.');
        let value = { transaction };

        for (const key of keys) {
          value = value[key];
          if (value === undefined || value === null) {
            logger.warn(`⚠️  Propiedad ${prop} no encontrada`);
            return '';
          }
        }

        logger.info(`  ✓ ${prop}: ${value}`);
        return String(value); // Convertir a string
      });

      // Concatenar valores + event secret
      const concatenated = values.join('') + timestamp + this.eventSecret;

      logger.info('🔗 String concatenado (sin secret):', concatenated);
      logger.info('🔒 Event secret agregado');

      // Generar hash SHA256
      const calculatedChecksum = crypto
        .createHash('sha256')
        .update(concatenated)
        .digest('hex');

      logger.info('🎯 Checksum esperado:', checksum);
      logger.info('🧮 Checksum calculado:', calculatedChecksum);

      const isValid = calculatedChecksum === checksum;

      if (isValid) {
        logger.info('✅ Firma válida');
      } else {
        logger.error('❌ Firma inválida - Las firmas no coinciden');
      }

      return isValid;
    } catch (error) {
      logger.error('💥 Error validando firma del webhook:', error);
      return false;
    }
  }

  /**
   * Obtener acceptance token del merchant
   * @returns {Promise<String>}
   */
  async getMerchantAcceptanceToken() {
    try {
      const response = await axios.get(
        `${this.baseUrl}/merchants/${this.publicKey}`,
        { headers: { Accept: 'application/json' } }
      );
      const token = response.data.data.presigned_acceptance.acceptance_token;
      return token;
    } catch (error) {
      logger.error('💥 Error obteniendo acceptance token:', error.message);
      throw error;
    }
  }

  /**
   * Mapear datos del webhook de Wompi a formato interno
   * @param {Object} webhookData - Datos completos del webhook
   * @returns {Object} - Objeto formateado para guardar en BD
   */
  mapWebhookToPayment(webhookData) {
    try {
      logger.info('📦 Mapeando datos del webhook...');

      const { transaction } = webhookData.data;
      const { payment_method, customer_data } = transaction;

      // Extraer información del dispositivo desde la referencia
      const deviceInfo = this.extractDeviceFromReference(transaction.reference);

      const mappedData = {
        // Identificadores
        paymentId: transaction.id,
        referenceCode: transaction.reference,

        // Información del dispositivo
        deviceImei: deviceInfo.deviceImei,

        // Datos del cliente
        customerPhone:
          customer_data?.phone_number || payment_method?.phone_number,
        customerEmail: transaction.customer_email,
        customerName: customer_data?.full_name,

        // Montos y moneda
        amount: transaction.amount_in_cents / 100, // Convertir a pesos
        currency: transaction.currency,

        // Estado
        status: this._mapWompiStatus(transaction.status),
        statusMessage: transaction.status_message,

        // Proveedor y método de pago
        provider: 'WOMPI',
        paymentMethod: payment_method?.type || transaction.payment_method_type,
        paymentMethodType: payment_method?.type,

        // IDs de transacción
        transactionId:
          payment_method?.extra?.nequi_transaction_id ||
          payment_method?.extra?.transaction_id,
        authorizationCode: payment_method?.extra?.external_identifier,

        // Fechas
        paymentDate: new Date(transaction.created_at),
        approvedAt: transaction.finalized_at
          ? new Date(transaction.finalized_at)
          : null,

        // Webhook info
        webhookReceived: true,
        webhookData: webhookData, // Guardar webhook completo para debugging

        // Metadata adicional
        metadata: {
          wompiEvent: webhookData.event,
          environment: webhookData.environment,
          sentAt: new Date(webhookData.sent_at),
          timestamp: webhookData.timestamp,
          threeDS: payment_method?.extra?.is_three_ds || false,
          threeDSAuthType: payment_method?.extra?.three_ds_auth_type,
          afeDecision: payment_method?.afe_decision,
          redirectUrl: transaction.redirect_url,
          paymentSourceId: transaction.payment_source_id,
          paymentLinkId: transaction.payment_link_id,
          origin: transaction.origin,
        },
      };

      logger.info('✅ Datos mapeados correctamente:', {
        paymentId: mappedData.paymentId,
        amount: mappedData.amount,
        status: mappedData.status,
        deviceImei: mappedData.deviceImei,
      });

      return mappedData;
    } catch (error) {
      logger.error('💥 Error mapeando datos del webhook:', error);
      throw error;
    }
  }

  /**
   * Mapear estados de Wompi a estados internos
   * @private
   * @param {String} wompiStatus - Estado de Wompi
   * @returns {String} - Estado interno
   */
  _mapWompiStatus(wompiStatus) {
    const statusMap = {
      APPROVED: 'APPROVED',
      PENDING: 'PENDING',
      DECLINED: 'DECLINED',
      VOIDED: 'VOIDED',
      ERROR: 'ERROR',
    };

    return statusMap[wompiStatus] || 'PENDING';
  }

  /**
   * Extraer información del dispositivo desde la referencia
   * @param {String} reference - Referencia del pago (ej: "ZHJ38G-1760664905069")
   * @returns {Object} - { deviceImei, timestamp }
   */
  extractDeviceFromReference(reference) {
    try {
      if (!reference) {
        logger.warn('⚠️  Referencia vacía');
        return { deviceImei: null, timestamp: null };
      }

      // Formato esperado: "IMEI-timestamp"
      const parts = reference.split('-');

      const deviceImei = parts[0] || null;
      const timestamp = parts[1] ? parseInt(parts[1]) : null;

      logger.info('📱 Dispositivo extraído:', {
        reference,
        deviceImei,
        timestamp: timestamp ? new Date(timestamp).toISOString() : null,
      });

      return { deviceImei, timestamp };
    } catch (error) {
      logger.error('💥 Error extrayendo dispositivo de referencia:', error);
      return { deviceImei: null, timestamp: null };
    }
  }

  /**
   * Obtener información de una transacción desde la API de Wompi
   * @param {String} transactionId - ID de transacción
   * @returns {Promise<Object>}
   */
  async getTransaction(transactionId) {
    try {
      logger.info(`🔍 Consultando transacción ${transactionId} en Wompi...`);

      const response = await this.client.get(`/transactions/${transactionId}`);

      logger.info('✅ Transacción obtenida:', {
        id: response.data.data.id,
        status: response.data.data.status,
      });

      return response.data.data;
    } catch (error) {
      logger.error(
        `💥 Error obteniendo transacción ${transactionId}:`,
        error.message
      );
      throw error;
    }
  }

  /**
   * Verificar disponibilidad de la API de Wompi
   * @returns {Promise<Boolean>}
   */
  async healthCheck() {
    try {
      const response = await this.client.get('/merchants/' + this.publicKey);
      return response.status === 200;
    } catch (error) {
      logger.error('💥 Health check de Wompi falló:', error.message);
      return false;
    }
  }

  /**
   * Crear un link de pago (opcional)
   * @param {Object} paymentData - Datos del pago
   * @returns {Promise<Object>}
   */
  async createPaymentLink(paymentData) {
    try {
      const {
        amountInCents,
        currency = 'COP',
        customerEmail,
        reference,
        redirectUrl,
        expiresAt,
      } = paymentData;

      const payload = {
        amount_in_cents: amountInCents,
        currency,
        customer_email: customerEmail,
        reference,
        redirect_url: redirectUrl,
      };

      if (expiresAt) {
        payload.expires_at = expiresAt;
      }

      logger.info('🔗 Creando link de pago en Wompi...');

      const response = await this.client.post('/payment_links', payload);

      logger.info('✅ Link de pago creado:', response.data.data.id);

      return response.data.data;
    } catch (error) {
      logger.error('💥 Error creando link de pago:', error.message);
      throw error;
    }
  }

  /**
   * Validar datos del webhook antes de procesar
   * @param {Object} webhookData - Datos del webhook
   * @returns {Boolean}
   */
  validateWebhookData(webhookData) {
    try {
      if (!webhookData.event) {
        logger.error('❌ Webhook sin evento');
        return false;
      }

      if (!webhookData.data?.transaction) {
        logger.error('❌ Webhook sin transaction data');
        return false;
      }

      const transaction = webhookData.data.transaction;

      if (
        !transaction.id ||
        !transaction.status ||
        !transaction.amount_in_cents
      ) {
        logger.error('❌ Transaction incompleta');
        return false;
      }

      if (
        !webhookData.signature?.checksum ||
        !webhookData.signature?.properties
      ) {
        logger.error('❌ Webhook sin signature válida');
        return false;
      }

      return true;
    } catch (error) {
      logger.error('💥 Error validando estructura del webhook:', error);
      return false;
    }
  }
}

module.exports = new WompiAdapter();
