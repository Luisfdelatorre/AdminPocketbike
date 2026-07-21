# Propuesta histórica: vínculo de factura con contrato

Estado: histórico; la propuesta no está presente en el modelo vigente. Revisado el 2026-07-20.

Este documento propuso agregar `contractId` a `Invoice` para asociar directamente cada factura con un contrato.

## Estado actual

`server/models/Invoice.js` no define `contractId`. Las facturas conservan identificadores de dispositivo, compañía, fecha y datos de la transacción. La asociación con el contrato se resuelve indirectamente en los flujos existentes.

No se debe escribir código que dependa de `Invoice.contractId` ni ejecutar una migración basándose en este snapshot.

## Si se retoma la propuesta

Debe tratarse como cambio de esquema y datos:

1. definir cardinalidad y comportamiento para contratos históricos;
2. comprobar facturas que caen fuera del rango o coinciden con más de un contrato;
3. diseñar backfill idempotente, validación y rollback;
4. añadir índices solo después de revisar patrones de consulta;
5. mantener compatibilidad durante el despliegue;
6. medir el impacto sobre generación y lectura de facturas.

La fuente vigente es [DATABASE_RELATIONSHIPS.md](DATABASE_RELATIONSHIPS.md) junto con los modelos y repositorios de la rama activa.
