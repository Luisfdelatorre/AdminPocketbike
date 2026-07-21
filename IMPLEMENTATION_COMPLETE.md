# Snapshot histórico: implementación de referencias

Estado: histórico y no normativo. Revisado el 2026-07-20.

Este archivo describía como terminada una etapa temprana de referencias de pago y relación con facturas. Las afirmaciones originales ya no deben usarse para inferir el esquema o los endpoints actuales.

## Conceptos que permanecen

- `Invoice` conserva un identificador basado normalmente en dispositivo y fecha.
- `Payment` posee identificadores y una `reference` usada en los flujos de transacción.
- La factura copia datos de la transacción aplicada.
- La confirmación de pago puede actualizar factura, contrato y dispositivo.

## Aspectos superados

- No existe una regla universal `paymentReference = invoiceId`.
- `reference`, `paymentId`, `_id`, `invoiceId` y `wompiTransactionId` tienen propósitos diferentes.
- Algunos flujos aplican un pago a más de una factura.
- Las rutas actuales usan `/apinode`, no el prefijo documentado originalmente.

Consulta [DATABASE_RELATIONSHIPS.md](DATABASE_RELATIONSHIPS.md), `server/models/Payment.js`, `server/models/Invoice.js` y el servicio de pagos para el comportamiento vigente.
