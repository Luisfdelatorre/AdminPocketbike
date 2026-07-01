import axios from "axios";
import crypto from "crypto";

const WEBHOOK_URL = "https://admin.pocketbike.app/apinode/webhooks/wompi";//"http://192.168.1.150:8084/apinode/webhooks/wompi";
const WOMPI_INTEGRITY_SECRET = "prod_events_TpPLiX3mc0PxEzquqhT5t2WaSZeaDzer"; // Matches config.js privateKeyEvents

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

const payload2 = { "event": "transaction.updated", "data": { "transaction": { "id": "1133374-1778585495-15670", "created_at": "2026-05-12T11:31:35.702Z", "finalized_at": "2026-05-12T12:16:44.221Z", "amount_in_cents": 3500000, "reference": "FPY25I-2026-05-11-VT", "customer_email": "FPY25I@PocketBike.app", "currency": "COP", "payment_method_type": "NEQUI", "payment_method": { "type": "NEQUI", "extra": { "is_three_ds": false, "transaction_id": "350-123-27246383-1778585496DaVm", "three_ds_auth_type": null, "external_identifier": "1778585496DaVm", "nequi_transaction_id": "350-123-27246383-1778585496DaVm" }, "afe_decision": "FRAUD_CHECK", "phone_number": "3168505421" }, "status": "APPROVED", "status_message": null, "shipping_address": null, "redirect_url": "https://pocketbike.app/apinode/", "payment_source_id": null, "payment_link_id": null, "customer_data": { "full_name": "FPY25I PocketBike", "phone_number": "3168505421" }, "billing_data": null, "origin": null } }, "sent_at": "2026-05-12T12:16:44.728Z", "timestamp": 1778588204, "signature": { "checksum": "da9236910d28e9339bc01bb26792a39a9ac524ee61cef49619c8ad3ce0e62aba", "properties": ["transaction.id", "transaction.status", "transaction.amount_in_cents"] }, "environment": "prod" }



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
  //console.log("joined", joined);
  return crypto.createHash('sha256').update(joined).digest('hex');
}
console.log(payload2.signature.checksum);
console.log(calculateSignature(payload2, WOMPI_INTEGRITY_SECRET));
//payload2.signature.checksum = calculateSignature(payload2, WOMPI_INTEGRITY_SECRET);


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
