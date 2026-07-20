# Sistema de contratos

Estado: documento de dominio activo. Revisado el 2026-07-20.

## Responsabilidad

Un contrato vincula un dispositivo con una compañía y define duración, tarifa, reglas de cobro, PIN de acceso y excepciones operativas. Solo puede existir un contrato `ACTIVE` por `deviceIdName` según la validación del servicio.

## Modelo vigente

`Contract` contiene, entre otros:

- identidad: `contractId`, `deviceIdName`, `deviceId`, `gpsId`;
- compañía: `companyId`, `companyName`;
- plazo: `startDate`, `endDate`, `contractDays`;
- valor: `dailyRate`, `totalAmount`, `paidAmount`;
- progreso: `paidDays`, `remainingDays`;
- estado: `ACTIVE`, `COMPLETED`, `CANCELLED` o `SUSPENDED`;
- cliente: nombre, correo, teléfono y documento;
- reglas: días libres, frecuencia de pago, reactivación, hora de corte y exenciones;
- acceso: `devicePin`, almacenado como hash.

`contractId` se genera con el prefijo `CI`, una versión saneada del nombre del dispositivo y un sufijo corto. No debe usarse como sustituto de `_id` de otros modelos.

## Creación

`ContractService.createContract` coordina el flujo:

1. Obtiene el dispositivo por su identificador.
2. Rechaza la creación si ya hay contrato activo para el nombre del dispositivo.
3. Completa reglas faltantes desde `Company.contractDefaults`.
4. Delega cálculos y persistencia al repositorio.
5. Sincroniza al dispositivo la asociación y reglas operativas denormalizadas.
6. Procesa la cuota inicial cuando `initialFee > 0`.

El repositorio calcula `endDate`, `totalAmount` y `remainingDays`. El dispositivo conserva `activeContractId`, `hasActiveContract`, `dailyRate`, `cutOffTime` y exenciones para responder rápido en procesos operativos.

## Facturación y pagos

Las facturas no guardan actualmente `contractId`. La asociación operacional se resuelve principalmente por dispositivo, compañía y fechas. Por tanto, no se debe documentar ni implementar una relación contractual directa sin diseñar su migración y compatibilidad.

Cuando un pago actualiza el progreso, el importe se normaliza desde centavos o unidades y los días pagados avanzan según `paymentFrequency`. Al alcanzar `contractDays`, el contrato pasa a `COMPLETED`.

Frecuencias admitidas por configuración: `1`, `6`, `7`, `12` y `14`. El multiplicador depende de `freeDayPolicy`; no debe asumirse que frecuencia y días facturables siempre son iguales.

## Endpoints

Todas estas rutas requieren el middleware JWT aplicado por el router:

- `GET /apinode/contracts/devices`
- `GET /apinode/contracts/all`
- `POST /apinode/contracts/create`
- `GET /apinode/contracts/expiring/:daysThreshold`
- `GET /apinode/contracts/:deviceId`
- `GET /apinode/contracts/:deviceId/stats`
- `GET /apinode/contracts/:deviceId/all`
- `PUT /apinode/contracts/:contractId/status`
- `PUT /apinode/contracts/:contractId/update`

## Invariantes para cambios

- No crear un segundo contrato activo para el mismo dispositivo.
- Mantener sincronizados contrato y dispositivo al cambiar reglas denormalizadas.
- No guardar PIN en texto plano ni incluirlo en logs o documentación.
- Recalcular total, fin y días restantes al modificar tarifa o duración.
- Revisar cuota inicial, facturación, corte y dashboard ante cambios de modelo.
- Distinguir claramente una migración de datos, una migración de contrato de API y un refactor interno.

Los esquemas relacionados se detallan en [DATABASE_RELATIONSHIPS.md](DATABASE_RELATIONSHIPS.md).
