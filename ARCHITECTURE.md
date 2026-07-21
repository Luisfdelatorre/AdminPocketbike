# Arquitectura de AdminPocketbike

Estado: documento activo. Revisado el 2026-07-20.

## Vista general

```text
Browser
  ├─ Panel React / HashRouter
  └─ Página pública de pago
          │
          ▼
Express /apinode y /p
  Routes → Controllers → Services → Repositories → Mongoose → MongoDB
                          │
                          ├─ Wompi
                          └─ Proveedores GPS
```

El frontend usa llamadas relativas bajo `/apinode`. En desarrollo, Vite (`5173`) redirige `/apinode` y `/p` a Express (`8084`). En producción Express sirve `dist/` y mantiene el fallback de la SPA.

## Capas del servidor

- `server/routes/`: definición de endpoints y middleware de acceso.
- `server/controllers/`: traducción HTTP, validación básica y respuesta.
- `server/services/`: reglas de negocio y coordinación de casos de uso.
- `server/repositories/`: consultas y persistencia.
- `server/models/`: esquemas Mongoose e invariantes del documento.
- `server/adapters/` y `server/api/`: integración con servicios externos.
- `server/cron-server/`: tareas programadas de facturación y control.

Una intervención debe conservar esta dirección de dependencias. La UI no debe conocer detalles de Mongoose y los controladores no deben absorber lógica de dominio que pertenezca a servicios o repositorios.

## Frontend

- `client/src/App.jsx`: rutas del panel administrativo.
- `client/src/pages/`: pantallas y composición de flujos.
- `client/src/components/`: piezas reutilizables.
- `client/src/services/api.js`: cliente Axios y catálogo de llamadas.
- `client/src/context/`: estado transversal, incluida autenticación.
- `client/src/styles/`: tokens y estilos globales o compartidos.

La navegación principal usa `HashRouter`. Las rutas administrativas viven dentro de `AdminLayout`; la página del dispositivo usa `/Id/:deviceId`.

## Flujo de contratos y cobro

1. Se valida el dispositivo y que no tenga otro contrato activo.
2. Se aplican valores predeterminados de la compañía cuando faltan reglas.
3. Se crea `Contract` y se copian al `Device` los datos operativos necesarios.
4. Si existe cuota inicial, el servicio de pagos crea y aplica el movimiento correspondiente.
5. Las facturas diarias representan deuda, pago, día libre, préstamo o ajuste.
6. Un pago aprobado se aplica a una o más facturas según el flujo y actualiza el progreso del contrato cuando corresponde.
7. Las reglas de corte y toque de queda usan los datos denormalizados del dispositivo para evitar búsquedas adicionales en tareas frecuentes.

La denormalización es intencional para rendimiento. Cualquier cambio en `Contract`, `Device`, `Invoice` o `Payment` debe revisar los puntos de sincronización y no asumir relaciones que no estén realmente persistidas.

## Autenticación y multiempresa

Los JWT identifican usuarios administrativos o accesos de dispositivo. Las rutas no tienen una política única implícita: cada router define si usa `authenticate`, `verifyToken` u otro control. Para cambios de seguridad se debe revisar la ruta concreta, no inferir protección por el prefijo.

El alcance de compañía viaja en el token y en campos `companyId` denormalizados. Las consultas administrativas deben filtrar por la compañía autorizada salvo flujos explícitos de superadministración.

## Rendimiento

- Las consultas frecuentes usan índices y campos denormalizados.
- Dashboard agrupa lecturas independientes con `Promise.all` donde es seguro.
- Pagos e historiales se paginan desde repositorio.
- No se deben añadir secuencias de solicitudes dependientes si pueden resolverse con una respuesta agregada.
- Una migración de contrato de API no implica migrar datos: debe distinguirse entre renombrar/adaptar interfaces, cambiar esquemas y ejecutar una migración persistente.

Antes de cambiar un contrato de API, identifica consumidores, compatibilidad temporal, orden de carga y mediciones de rendimiento. Consulta [CONTRACT_SYSTEM.md](CONTRACT_SYSTEM.md), [DATABASE_RELATIONSHIPS.md](DATABASE_RELATIONSHIPS.md) y las reglas de [AGENTS.md](AGENTS.md).

## Operación local

- Frontend: `http://localhost:5173`.
- API: `http://localhost:8084/apinode`.
- MongoDB: `127.0.0.1:27018` mediante el túnel configurado.
- Salud: `GET /apinode/health`.

El puerto por defecto definido internamente no sustituye al script `npm run dev:api`, que fija `PORT=8084` para el entorno de desarrollo del proyecto.
