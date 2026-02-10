const logger = require('../config/logger');

function validateWebhook(webhookData) {
  if (!webhookData || typeof webhookData !== 'object') {
    logger.error('❌ Webhook vacío o malformado');
    return { valid: false, reason: 'Empty or invalid webhookData' };
  }

  const { event, data, sent_at, timestamp, signature } = webhookData;

  if (!event || !data?.transaction || !sent_at || !signature) {
    return { valid: false, reason: 'Missing required fields' };
  }

  const transaction = data.transaction;
  const { reference, status } = transaction;

  if (!reference) {
    logger.warn('⚠️ Referencia vacía');
    return { valid: false, reason: 'Missing reference' };
  }

  // Formato esperado: "IMEI-timestamp"
  const parts = reference.split('-');
  const plate = parts[0] || null;

  if (!plate) {
    return { valid: false, reason: 'Wrong format reference' };
  }

  const requiredFields = ['id', 'status', 'amount_in_cents', 'reference'];
  const missingFields = requiredFields.filter(
    (field) => transaction[field] === undefined || transaction[field] === null
  );

  if (missingFields.length > 0) {
    logger.error(
      `❌ Transaction incompleta. Faltan: ${missingFields.join(', ')}`
    );
    return {
      valid: false,
      reason: `Missing fields: ${missingFields.join(', ')}`,
    };
  }

  // ✅ Todo está bien, devolvemos objeto normalizado
  return {
    event,
    transaction,
    sent_at,
    signature,
    timestamp,
    plate,
    valid: true,
  };
}

module.exports = { validateWebhook };
