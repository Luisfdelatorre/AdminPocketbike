# Propuesta histórica: pagos agrupados

Estado: histórico y no implementado como contrato vigente. Revisado el 2026-07-20.

Este documento describía una propuesta para pagar varias facturas mediante una sola transacción. El cliente todavía exporta una función hacia `/payments/create-batch-intent`, pero el router actual no monta ese endpoint.

## Qué pretendía resolver

- seleccionar varias facturas pendientes;
- calcular un total único;
- generar una referencia de lote;
- aplicar el pago aprobado a todas las facturas seleccionadas;
- evitar cobros parciales o dobles.

## Estado real

No debe asumirse que el flujo está disponible. Implementarlo requiere una intervención nueva que defina:

- idempotencia y reserva de facturas;
- cardinalidad entre `Payment` e `Invoice`;
- rollback ante aplicación parcial;
- firma y verificación Wompi;
- compatibilidad con pagos existentes;
- autorización por dispositivo y compañía;
- pruebas concurrentes y de reintentos.

La relación actual no es estrictamente uno-a-uno para todos los flujos, pero tampoco existe un modelo formal de lote. Consulta [DATABASE_RELATIONSHIPS.md](DATABASE_RELATIONSHIPS.md) y los servicios actuales antes de diseñarlo.
