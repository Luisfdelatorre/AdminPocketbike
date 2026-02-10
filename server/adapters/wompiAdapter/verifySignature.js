const crypto = require('crypto');
const logger = require('../../utils/logger');

function verifySignature(payload, integritySecret) {
  const { signature, timestamp, transaction } = payload;
  if (!signature?.checksum || !Array.isArray(signature.properties))
    return false;

  // Flattened access to transaction.* fields
  const joined =
    signature.properties
      .map((prop) => {
        const value = prop
          .split('.')
          .reduce((acc, key) => acc?.[key], transaction);
        return value ?? '';
      })
      .join('') +
    timestamp +
    integritySecret;

  const hash = crypto
    .createHmac('sha256', integritySecret)
    .update(joined)
    .digest('hex');

  const valid = hash === signature.checksum;
  if (!valid)
    logger.warn(
      `⚠️ Invalid signature. Expected: ${hash}, Received: ${signature.checksum}`
    );

  return valid;
}

module.exports = { verifySignature };
