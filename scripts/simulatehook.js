import axios from "axios";
import crypto from "crypto";
//import { registerTransaction } from "./googleSheet";
//const queue = require("./modules/queue");
//const log = require("../logger");
// Cambia esta URL por la de tu servidor y endpoint
const WEBHOOK_URL = "http://localhost:3000/apinode/webhooks/wompi";
const WOMPI_INTEGRITY_SECRET = "test_events_5iTO7kZHuLzAKn7p2YPZArEhoJ0S9Yj7"; // Matches config.js privateKeyEvents

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
      "reference": "XZQ78H-2026-02-14-N3",
      "customer_email": "XZQ78H@PocketBike.app",
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
      "status": "APPROVED",
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
  return crypto.createHash('sha256').update(joined).digest('hex');
}

payload.signature.checksum = calculateSignature(payload, WOMPI_INTEGRITY_SECRET);

if (FORCE_INVALID_SIGNATURE) {
  console.log("⚠️ SIMULANDO FIRMA INVÁLIDA...");
  payload.signature.checksum = "bad_checksum_123";
}

// Función para enviar el webhook
async function sendWebhook() {

  try {
    const res = await axios.post(WEBHOOK_URL, payload, {
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
