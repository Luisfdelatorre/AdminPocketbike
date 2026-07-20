# Diseño histórico: referencias de pago

Estado: histórico y no normativo. Revisado el 2026-07-20.

Este documento registraba un diseño inicial que intentaba derivar toda referencia de pago desde una factura. El sistema actual conserva varios identificadores con semánticas distintas y contiene compatibilidad con datos heredados.

## Identificadores actuales

- `Invoice._id` / `Invoice.invoiceId`: identidad de factura.
- `Payment.paymentId`: identidad lógica del pago.
- `Payment.reference`: referencia de la transacción o del flujo.
- `Payment._id`: identificador persistido; en ciertos flujos coincide con un identificador externo.
- `Payment.wompiTransactionId`: identificador de Wompi cuando existe.
- `Payment.invoiceId`: factura asociada según el flujo.

No son aliases universales y no deben intercambiarse sin revisar el caso de uso. Días libres, préstamos, ajustes, cuota inicial y pagos Wompi pueden producir referencias diferentes.

## Regla para nuevas intervenciones

Antes de modificar referencias:

- inventariar productores y consumidores;
- definir unicidad e idempotencia por tipo de pago;
- revisar webhooks, SSE, conciliación y datos heredados;
- mantener trazabilidad entre pago y facturas aplicadas;
- preparar migración y compatibilidad si cambia un campo persistido.

Consulta [DATABASE_RELATIONSHIPS.md](DATABASE_RELATIONSHIPS.md) y los modelos actuales como fuentes de verdad.
