import axios from "axios";
import crypto from "crypto";
//import { registerTransaction } from "./googleSheet";
//const queue = require("./modules/queue");
//const log = require("../logger");
// Cambia esta URL por la de tu servidor y endpoint
const WEBHOOK_URL = "https://pagos.tumotoya.online/apinode/webhooks/wompi";
const WOMPI_INTEGRITY_SECRET = "prod_events_K50mCvxN8NkOjdYMWVkLmVhOwWRwMSXM"; // Matches config.js privateKeyEvents

// JSON simulado del webhook
const uniqueId = Date.now();
// Cambia a true para probar una firma inválida
const FORCE_INVALID_SIGNATURE = false;

const payload = {
  "event": "transaction.updated",
  "data": {
    "transaction": {
      "id": `131987-1771059807-93907`,
      "created_at": "2026-02-14T09:03:27.773Z",
      "finalized_at": "2026-02-14T09:03:28.313Z",
      "amount_in_cents": 3500000,
      "reference": "YAG36H-2026-02-25-HI",
      "customer_email": "YAG36H@PocketBike.app",
      "currency": "COP",
      "payment_method_type": "NEQUI",
      "payment_method": {
        "type": "NEQUI",
        "extra": {
          "is_three_ds": false,
          "transaction_id": "SANDBOX-17710598087zLPhp",
          "three_ds_auth_type": null,
          "external_identifier": "17710598082B0IzU"
        },
        "phone_number": "3991111111"
      },
      "status": "PENDING",
      "status_message": null,
      "shipping_address": null,
      "redirect_url": "https://pocketbike.app/apinode/",
      "payment_source_id": null,
      "payment_link_id": null,
      "customer_data": {
        "full_name": "XZQ78H PocketBike",
        "phone_number": "3991111111"
      },
      "billing_data": null,
      "origin": null
    }
  },
  "sent_at": "2026-02-14T09:03:28.569Z",
  "timestamp": 1771059808,
  "signature": {
    "checksum": "", // Calculated below
    "properties": [
      "transaction.id",
      "transaction.status",
      "transaction.amount_in_cents"
    ]
  },
  "environment": "test"
}

const payload2 = {
  "event": "transaction.updated", "data":
  {
    "transaction": {
      "id": "1362970-1772161998-78582", "created_at": "2026-02-27T03:13:18.588Z",
      "finalized_at": "2026-02-27T03:58:24.000Z", "amount_in_cents": 3500000,
      "reference": "YAG21H-2026-02-27-BJ", "customer_email": "YAG21H@PocketBike.app",
      "currency": "COP", "payment_method_type": "NEQUI", "payment_method":
      {
        "type": "NEQUI", "extra":
        {
          "is_three_ds": false, "transaction_id": "350-123-674225-1772161999JYJo", "three_ds_auth_type": null,
          "external_identifier": "1772161999JYJo", "nequi_transaction_id": "350-123-674225-1772161999JYJo"
        },
        "afe_decision": "FRAUD_CHECK", "phone_number": "3016862185"
      }, "status": "DECLINED", "status_message": "La transacción caducó", "shipping_address": null, "redirect_url": "https://pocketbike.app/apinode/", "payment_source_id": null, "payment_link_id": null, "customer_data": { "full_name": "YAG21H PocketBike", "phone_number": "3016862185" }, "billing_data": null, "origin": null
    }
  }, "sent_at": "2026-02-27T04:00:25.512Z", "timestamp": 1772164825, "signature": { "checksum": "1c1a17a9cb4f8038a26f56ca83c158a61fbcb2e75d55742ceea31b1a939df683", "properties": ["transaction.id", "transaction.status", "transaction.amount_in_cents"] }, "environment": "prod"
}


// Calculate Signature
function calculateSignature(payload, secret) {
  const { data, timestamp } = payload;
  const transaction = data.transaction;
  const properties = [
    transaction.id,
    transaction.status,
    transaction.amount_in_cents
  ];
  const joined = properties.join('') + timestamp + secret;
  console.log("joined", joined);
  return crypto.createHash('sha256').update(joined).digest('hex');
}
console.log(payload2.signature.checksum);
console.log(calculateSignature(payload2, WOMPI_INTEGRITY_SECRET));
//payload2.signature.checksum = calculateSignature(payload2, WOMPI_INTEGRITY_SECRET);

if (FORCE_INVALID_SIGNATURE) {
  console.log("⚠️ SIMULANDO FIRMA INVÁLIDA...");
  payload2.signature.checksum = "bad_checksum_123";
}

// Función para enviar el webhook
async function sendWebhook() {

  try {
    const res = await axios.post(WEBHOOK_URL, payload2, {
      headers: { "Content-Type": "application/json" },
    });
    console.log("✅ Webhook simulado enviado:", res.data);
  } catch (error) {
    console.error("❌ Error al enviar webhook:", error.message);
    if (error.response) {
      console.error("Response Data:", error.response.data);
    }
  }
}

// Ejecutar
sendWebhook();
