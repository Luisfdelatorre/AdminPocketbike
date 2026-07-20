# Relaciones de datos

Estado: referencia activa. Revisada el 2026-07-20.

La aplicación usa MongoDB y Mongoose. Varias relaciones están denormalizadas por rendimiento; no todas se expresan como referencias Mongoose.

## Mapa actual

```text
Company
  ├─< User.accessibleCompanies / User.companyId
  ├─< Device.companyId
  ├─< Contract.companyId
  ├─< Invoice.companyId
  └─< Payment.companyId

Device
  ├─ activeContractId ──> Contract.contractId  (denormalizado)
  ├─< Invoice.deviceIdName / deviceId
  └─< Payment.deviceIdName / deviceId

Invoice
  └─ transaction.id/reference ──> datos del Payment aplicado

Payment
  └─ invoiceId ──> Invoice._id/invoiceId según el flujo
```

## Company

Es el límite principal de datos administrativos. Los demás modelos copian `companyId` y, en algunos casos, `companyName` para filtrar y mostrar sin consultas adicionales. Las consultas deben preservar este aislamiento.

## User

`User.companyId` representa la compañía activa o principal y `accessibleCompanies` enumera compañías permitidas. `isSuperAdmin`, rol y permisos complementan la autorización. La contraseña se almacena en `passwordHash` y se excluye de la serialización JSON.

## Device y Contract

`Contract.companyId` usa `ObjectId`; `Device.companyId` está tipado actualmente como `String`. Esta diferencia es parte del estado real y debe considerarse al comparar o migrar datos.

El dispositivo copia `contractId`, `activeContractId`, `hasActiveContract`, tarifa y reglas operativas. Esa duplicación reduce lecturas en corte, curfew y estado del dispositivo, pero obliga a sincronizar ambos documentos.

## Invoice y Payment

`Invoice` representa un día o evento facturable. Su `_id` y `invoiceId` suelen usar el formato basado en dispositivo y fecha. El esquema vigente no contiene `contractId`.

`Payment` conserva `invoiceId`, `reference`, identificadores propios y de Wompi, compañía y dispositivo. No debe suponerse una relación uno-a-uno universal:

- algunos pagos se aplican a una sola factura;
- ciertos flujos pueden aplicar un pago a varias facturas pendientes;
- días libres, préstamos, cuota inicial y ajustes tienen semánticas distintas;
- `reference`, `paymentId`, `_id` y `wompiTransactionId` no son intercambiables.

La factura guarda una instantánea de la transacción aplicada en `transaction.id`, `transaction.reference`, `transaction.finalized_at` y `transaction.type`.

## DeviceAccess

Es un mecanismo separado de acceso temporal o permanente por dispositivo. Guarda `deviceId`, hash del PIN, expiración, límite de usos y estado. No equivale al `devicePin` del contrato, aunque ambos participan en flujos de acceso por PIN.

## Reglas de evolución

- Confirmar el tipo real de cada identificador antes de crear joins lógicos.
- Tratar campos denormalizados como un conjunto que debe actualizarse de forma coherente.
- Diseñar migración, compatibilidad y rollback antes de añadir o renombrar campos persistidos.
- No declarar cardinalidad uno-a-uno si el flujo permite aplicaciones múltiples.
- Revisar índices al agregar filtros frecuentes; no añadir `populate` en rutas críticas sin medir su costo.
- Verificar modelos, repositorios y datos reales: los documentos históricos no son fuente de esquema.

Para el flujo funcional consulta [CONTRACT_SYSTEM.md](CONTRACT_SYSTEM.md) y [ARCHITECTURE.md](ARCHITECTURE.md).
