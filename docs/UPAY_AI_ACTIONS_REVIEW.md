# UPay AI — Inventario de Acciones Disponibles para Revisión

> **Estado del documento:** Revisión humana (sin implementación de IA)  
> **Rama de trabajo:** `feat/ai-voice-assistant-demo` *(nota: Git no permite crear `dev/ai-voice-assistant-demo` mientras exista la rama `dev` por colisión de referencias `refs/heads/dev`)*  
> **Fecha de análisis:** 2026-11-22  
> **Alcance:** Frontend React (`client/src/`), Backend API REST (`upay-api`, `/api/v1`), Portal de Pagos (`upay-pay`, `/p/:plate`), Webhooks (`upay-webhook`) y Cron (`upay-cron`).  
> **Advertencia:** Ninguna acción está habilitada ni aprobada automáticamente. Este documento sirve únicamente para revisión y toma de decisiones del propietario de UPay.

---

## 1. Resumen Ejecutivo

### Métricas generales del inventario

| Indicador | Cantidad |
|---|---:|
| **Total de acciones existentes identificadas en código** | **83** |
| **Módulos funcionales analizados** | **14** |
| **Grupo A — Bajo riesgo (ejecución automática candidata)** | **49** |
| **Grupo B — Riesgo medio (requieren confirmación explícita)** | **16** |
| **Grupo C — Riesgo alto (críticas o restringidas)** | **18** |
| **Acciones propuestas (útiles para IA, aún no implementadas)** | **6** |

### Distribución de acciones por categoría funcional

| Tipo de acción | Cantidad |
|---|---:|
| Navegación | 3 |
| Consulta | 22 |
| Filtro / Búsqueda / Ordenamiento | 16 |
| Formulario (creación/edición) | 20 |
| Operación (acción de negocio, GPS, financiera o exportación) | 22 |
| **Total** | **83** |

### Funcionalidades existentes sin interfaz completa o con discrepancias técnicas

Durante el análisis se detectaron capacidades reales del backend que aún no tienen interfaz activa (o cuya conexión frontend/backend presenta discrepancias):

1. **Endpoints de backend sin pantalla activa en el Admin:**
   - `GET /api/v1/contracts/expiring/:daysThreshold` — Consultar contratos próximos a vencer (`server/routes/contracts.js:39`).
   - `GET /api/v1/contracts/:deviceId/all` — Historial completo de contratos de una moto (`server/routes/contracts.js:69`).
   - `GET /api/v1/contracts/:deviceId/stats` — Estadísticas detalladas de un contrato (`server/routes/contracts.js:63`).
   - `POST /api/v1/devices` y `DELETE /api/v1/devices/:deviceId` — Crear y eliminar vehículos manualmente (`server/routes/devicesRoutes.js:21,58`). La UI solo permite editar, sincronizar y asignar.
   - `POST /api/v1/auth/register` y `POST /api/v1/auth/create-device-pin` (`server/routes/auth.js:11,29`).
   - `GET /api/v1/sse/status` — Diagnóstico de clientes SSE conectados (`server/routes/sse.js:25`).
2. **Funciones declaradas en `client/src/services/api.js` sin endpoint coincidente en `server/routes/`:**
   - `verifyDevicePin` apunta a `POST /auth/device-pin`, pero el backend expone `POST /auth/pin-login`.
   - `createPaymentIntent` (`/payments/create-intent`), `createBatchPaymentIntent` (`/payments/create-batch-intent`), `getPaymentStatus` (`/payments/status/:reference`) y `verifyTransaction` (`/payments/verify/:reference`) no están montados en `server/routes/paymentsRoutes.js`.
3. **Páginas React existentes no montadas en `client/src/App.jsx`:**
   - `UnpaidInvoices.jsx` (huérfana), `DevicePinLogin.jsx` y `PaymentPage.jsx` (comentadas en `App.jsx`; el portal de cobro real corre en `upay-pay` bajo `/p/:plate`).
4. **Endpoints cuya protección de permisos requiere revisión antes de exponerlos a IA:**
   - `server/routes/systemJobsRoutes.js` (`/api/v1/system-jobs`): no tiene middleware `verifyToken`/`authenticate` a nivel de ruta.
   - `server/routes/deviceAccess.js` (`/api/v1/device-access`): no tiene middleware de autenticación a nivel de ruta.
   - `server/routes/cronRoutes.js` (`GET /api/v1/cron/available-jobs`): sin middleware de autenticación.
   - `server/routes/invoicesRoutes.js` (`GET /:deviceId/unpaid`): sin `verifyToken`.
   - `server/routes/paymentsRoutes.js` (`POST /create` y `GET /stream/:reference` duplicados en líneas 54 y 65): sin middleware.

---

## 2. Primeras 10 acciones recomendadas para el demo de UPay AI

Estas 10 acciones ya existen en el código, son de **riesgo bajo (solo lectura / navegación / filtros)**, no alteran dinero ni motores y entregan valor inmediato por voz:

| # | ID | Acción | Comando de voz de ejemplo | Por qué se recomienda para el primer demo |
|---:|---|---|---|---|
| 1 | `NAV-001` | Ir a cualquier pantalla del panel | *"Abre el resumen de pagos"* | Demuestra control fluido de la app por voz sin riesgo. |
| 2 | `DASH-001` | Consultar KPIs del Dashboard por mes | *"¿Cómo vamos este mes en recaudo y morosidad?"* | Responde la pregunta diaria #1 del dueño del negocio. |
| 3 | `DEV-002` | Buscar una moto y ver su estado | *"¿Cómo está la moto PMQ44I?"* | Consulta instantánea de encendido, corte, batería y señal GPS. |
| 4 | `DEV-003` | Filtrar flota por alertas/estado | *"Muéstrame las motos desconectadas o con batería baja"* | Ahorra varios clics en el día a día operativo. |
| 5 | `SUM-001` | Consultar matriz mensual de pagos | *"Muéstrame la matriz de pagos de noviembre"* | Vista más utilizada para seguimiento de cobro diario. |
| 6 | `SUM-002` | Filtrar vehículos en mora o cortados | *"Filtra solo las motos en deuda"* | Permite detectar morosos en segundos por voz. |
| 7 | `PAY-002` | Buscar pagos por placa, referencia o estado | *"Busca los pagos pendientes de este mes"* | Útil para soporte rápido cuando un conductor reporta un pago. |
| 8 | `INV-002` | Consultar facturas y deudas por placa | *"Muéstrame las facturas impagas de NGI06I"* | Aclara dudas de cartera sin modificar nada. |
| 9 | `CTR-002` | Buscar y consultar un contrato activo | *"Busca el contrato de la placa DPW18I"* | Muestra cliente, tarifa diaria, avance y PIN al instante. |
| 10 | `ALT-001` | Consultar alertas activas de telemetría | *"¿Qué alertas activas tenemos hoy?"* | Monitoreo en tiempo real de desconexiones o movimiento no autorizado. |

---

## 3. Inventario detallado por módulos

> **Leyenda de roles del sistema:**  
> - `SuperAdmin`: `user.isSuperAdmin === true`  
> - `Admin / Manager`: `role: 'admin'` o `'manager'`  
> - `Viewer`: `role: 'viewer'` (solo lectura restringida)  
> - `Conductor (PIN)`: `authType: 'device'` (portal `/p/:plate`)

---

### Módulo 1: Navegación, Sesión y Contexto de Empresa

| ID | Acción disponible | Ejemplo de comando de voz | Tipo | Riesgo | ¿Requiere confirmación? | Aprobación |
|---|---|---|---|---|---|---|
| `NAV-001` | Navegar a una sección del panel | *"Llévame a contratos"* | Navegación | Bajo | No | ☐ |
| `NAV-002` | Cambiar de empresa activa | *"Cambia a la empresa Pocketbike"* | Operación | Medio | Sí | ☐ |
| `NAV-003` | Cambiar idioma de la interfaz | *"Cambia el idioma a inglés"* | Operación | Bajo | No | ☐ |
| `NAV-004` | Iniciar sesión de administrador | *"Inicia sesión con mi correo"* | Operación | Alto | Sí | ☐ |
| `NAV-005` | Cerrar sesión | *"Cierra mi sesión"* | Operación | Medio | Sí | ☐ |

<details>
<summary>Detalles técnicos — Módulo 1</summary>

- **`NAV-001` (Navegar a sección):** Pantallas: todas (`/`, `/devices`, `/summary`, `/contracts`, `/payments`, `/reports`, `/company-invoices`, `/invoices`, `/commands`, `/alerts`, `/settings`, `/users`, `/companies`). Parámetros: `path`. Permisos: según rol en `AdminSidebar.jsx`. Referencias: `client/src/App.jsx:51-67`, `client/src/components/AdminSidebar.jsx:37-233`, `client/src/components/MobileBottomNav.jsx`. Estado: **Implementada**.
- **`NAV-002` (Cambiar empresa activa):** Parámetros: `targetCompanyId`. Permisos: usuario con `accessibleCompanies.length > 1`. Justificación riesgo medio: cambia el contexto multi-tenant de todas las consultas y acciones siguientes. Referencias: `client/src/context/AuthContext.jsx:84-117`, `client/src/services/api.js:36`, `POST /api/v1/auth/switch-company` (`server/routes/auth.js:47`). Estado: **Implementada**.
- **`NAV-003` (Cambiar idioma):** Parámetros: `lang` (`es` / `en`). Permisos: cualquiera. Referencias: `client/src/components/LanguageSelector.jsx`. Estado: **Implementada**.
- **`NAV-004` (Iniciar sesión admin):** Parámetros: `email`, `password`, `rememberMe`. Permisos: público. Riesgo alto por manejo de credenciales. Referencias: `client/src/pages/AdminLogin.jsx:18`, `POST /api/v1/auth/login` (`server/routes/auth.js:17`). Estado: **Implementada**.
- **`NAV-005` (Cerrar sesión):** Sin parámetros. Referencias: `client/src/context/AuthContext.jsx:120-132`, `client/src/components/AdminSidebar.jsx:17-20`. Estado: **Implementada**.

</details>

---

### Módulo 2: Dashboard y KPIs

| ID | Acción disponible | Ejemplo de comando de voz | Tipo | Riesgo | ¿Requiere confirmación? | Aprobación |
|---|---|---|---|---|---|---|
| `DASH-001` | Consultar estadísticas y KPIs del mes | *"Dame el resumen financiero de este mes"* | Consulta | Bajo | No | ☐ |
| `DASH-002` | Cambiar mes/año del Dashboard | *"Muéstrame el dashboard de octubre"* | Filtro | Bajo | No | ☐ |
| `DASH-003` | Consultar resumen de salud eléctrica de flota | *"¿Cuántas motos tienen falla de batería o alternador?"* | Consulta | Bajo | No | ☐ |

<details>
<summary>Detalles técnicos — Módulo 2</summary>

- **`DASH-001`:** Pantalla: `/`. Parámetros: `month`, `year` (opcionales). Permisos: autenticado (`admin`, `manager`, `viewer`). Referencias: `client/src/pages/AdminDashboard.jsx:6,20-48`, `client/src/services/api.js:51`, `GET /api/v1/dashboard/stats` (`server/routes/dashboardRouter.js:11`). Estado: **Implementada**.
- **`DASH-002`:** Pantalla: `/`. Parámetros: `month` (1-12), `year`. Permisos: autenticado. Referencias: `client/src/pages/AdminDashboard.jsx:47-48`, `client/src/components/MonthYearSelector.jsx`. Estado: **Implementada**.
- **`DASH-003`:** Pantalla: `/`. Calcula resumen de alternador y batería a partir de telemetría de dispositivos. Permisos: autenticado. Referencias: `client/src/pages/AdminDashboard.jsx:29-39`, `GET /api/v1/devices` (`server/routes/devicesRoutes.js:15`). Estado: **Implementada**.

</details>

---

### Módulo 3: Flota y Dispositivos GPS

| ID | Acción disponible | Ejemplo de comando de voz | Tipo | Riesgo | ¿Requiere confirmación? | Aprobación |
|---|---|---|---|---|---|---|
| `DEV-001` | Listar todos los vehículos de la flota | *"Muéstrame todas las motos"* | Consulta | Bajo | No | ☐ |
| `DEV-002` | Buscar una moto por placa o conductor | *"Busca la moto PMQ44I"* | Filtro | Bajo | No | ☐ |
| `DEV-003` | Filtrar flota por estado operativo/eléctrico | *"Filtra las motos desconectadas"* | Filtro | Bajo | No | ☐ |
| `DEV-004` | Ordenar flota por tiempo de desconexión | *"Ordena las motos por tiempo sin señal"* | Filtro | Bajo | No | ☐ |
| `DEV-005` | Generar enlace de pago para compartir | *"Genera el link de pago de la moto DPW18I"* | Operación | Bajo | No | ☐ |
| `DEV-006` | Editar datos de un vehículo | *"Cambia el número de SIM de la moto PMQ44I"* | Formulario | Medio | Sí | ☐ |
| `DEV-007` | Sincronizar dispositivos desde plataforma GPS | *"Sincroniza los dispositivos con Traccar"* | Operación | Medio | Sí | ☐ |
| `DEV-008` | Apagar o reactivar motor de un vehículo | *"Apaga el motor de la moto NHW47I"* | Operación | Alto | Sí | ☐ |
| `DEV-009` | Crear dispositivo manualmente (solo backend) | *"Registra un dispositivo nuevo"* | Formulario | Medio | Sí | ☐ |
| `DEV-010` | Eliminar dispositivo (solo backend) | *"Elimina el dispositivo 86068177"* | Operación | Alto | Sí | ☐ |

<details>
<summary>Detalles técnicos — Módulo 3</summary>

- **`DEV-001`:** Pantalla: `/devices`. Permisos: autenticado. Referencias: `client/src/pages/DeviceSelector.jsx:7`, `GET /api/v1/devices` (`server/routes/devicesRoutes.js:15`), `server/services/deviceServices.js:415`. Estado: **Implementada**.
- **`DEV-002`:** Pantalla: `/devices`. Parámetros: `searchQuery`. Referencias: `client/src/pages/DeviceSelector.jsx:36`. Estado: **Implementada**.
- **`DEV-003`:** Pantalla: `/devices`. Parámetros: `filter` (`all`, `active`, `available`, `off`, `on`, `offline`, `battery_issue`, `alt_issue`). Referencias: `client/src/pages/DeviceSelector.jsx:37`. Estado: **Implementada**.
- **`DEV-004`:** Pantalla: `/devices`. Parámetros: `sortBy` (`default`, `offline`). Referencias: `client/src/pages/DeviceSelector.jsx:38`. Estado: **Implementada**.
- **`DEV-005`:** Pantalla: `/devices`. Abre `ShareDeviceModal` con URL `/p/:plate`. Parámetros: `device`. Referencias: `client/src/pages/DeviceSelector.jsx:110`, `client/src/components/modals/ShareDeviceModal.jsx`. Estado: **Implementada**.
- **`DEV-006`:** Pantalla: `/devices`. Parámetros: `deviceId`, campos (`name`, `imei`, `simCardNumber`, `nequiNumber`, `gpsId`, etc.). Permisos: `admin`/`manager`. Referencias: `client/src/pages/DeviceSelector.jsx:146-160`, `client/src/components/modals/DeviceFormModal.jsx`, `PUT /api/v1/devices/:deviceId` (`server/routes/devicesRoutes.js:46`). Estado: **Implementada**.
- **`DEV-007`:** Pantalla: `/settings` (y disponible vía API). Sincroniza dispositivos desde Traccar/MegaRastreo, propaga `gpsId` a contratos activos/facturas impagas y refresca `deviceStateCache`. Permisos: `admin`/`manager`. Referencias: `client/src/services/api.js:58`, `POST /api/v1/devices/sync` (`server/routes/devicesRoutes.js:27`), `server/services/deviceServices.js:323`. Estado: **Implementada**.
- **`DEV-008`:** Pantallas: `/devices` y `/summary`. Parámetros: `deviceId`, `command` (`engineStop` / `engineResume`). Permisos: `role !== 'viewer'`. **Riesgo alto:** inmoviliza un vehículo físico en circulación. Referencias: `client/src/pages/DeviceSelector.jsx:176`, `POST /api/v1/devices/:id/engine` (`server/routes/devicesRoutes.js:52`). Estado: **Implementada**.
- **`DEV-009`:** Solo backend. `POST /api/v1/devices` (`server/routes/devicesRoutes.js:21`). Estado: **Parcialmente implementada** (sin formulario en UI).
- **`DEV-010`:** Solo backend. `DELETE /api/v1/devices/:deviceId` (`server/routes/devicesRoutes.js:58`). Estado: **Parcialmente implementada** (sin botón en UI).

</details>

---

### Módulo 4: Contratos y Documentación Digital

| ID | Acción disponible | Ejemplo de comando de voz | Tipo | Riesgo | ¿Requiere confirmación? | Aprobación |
|---|---|---|---|---|---|---|
| `CTR-001` | Listar todos los contratos | *"Muéstrame todos los contratos"* | Consulta | Bajo | No | ☐ |
| `CTR-002` | Buscar contratos por placa, cliente o cédula | *"Busca el contrato de DPW18I"* | Filtro | Bajo | No | ☐ |
| `CTR-003` | Filtrar contratos por estado | *"Muéstrame solo los contratos activos"* | Filtro | Bajo | No | ☐ |
| `CTR-004` | Previsualizar contrato digital | *"Abre la vista previa del contrato de NHW47I"* | Consulta | Bajo | No | ☐ |
| `CTR-005` | Descargar contrato en Word (DOCX) o PDF | *"Descarga el contrato de DPW18I en PDF"* | Operación | Bajo | No | ☐ |
| `CTR-006` | Extraer datos de documentos con OCR | *"Escanea la cédula y tarjeta de propiedad"* | Operación | Medio | Sí | ☐ |
| `CTR-007` | Crear un contrato nuevo | *"Crea un contrato para la moto XYZ123"* | Formulario | Medio | Sí | ☐ |
| `CTR-008` | Editar un contrato existente | *"Cambia la frecuencia de pago de NHW47I a semanal"* | Formulario | Medio | Sí | ☐ |
| `CTR-009` | Completar o cancelar un contrato activo | *"Cancela el contrato CIDPW18I6W"* | Operación | Alto | Sí | ☐ |
| `CTR-010` | Consultar contratos próximos a vencer (solo backend) | *"¿Qué contratos vencen en los próximos 30 días?"* | Consulta | Bajo | No | ☐ |

<details>
<summary>Detalles técnicos — Módulo 4</summary>

- **`CTR-001` a `CTR-003`:** Pantalla: `/contracts`. Parámetros: `searchQuery`, `filter` (`all`, `active`, `completed`, `cancelled`). Permisos: `role !== 'viewer'`. Referencias: `client/src/pages/Contracts.jsx:26-31`, `GET /api/v1/contracts/all` (`server/routes/contracts.js:21`). Estado: **Implementada**.
- **`CTR-004`:** Pantalla: `/contracts`. Referencias: `client/src/components/modals/ContractDocPreviewModal.jsx`. Estado: **Implementada**.
- **`CTR-005`:** Pantalla: `/contracts`. Parámetros: `contractId`. Referencias: `client/src/services/api.js:91-116`, `GET /api/v1/contracts/:contractId/document` y `GET /api/v1/contracts/:contractId/pdf` (`server/routes/contracts.js:45,51`). Estado: **Implementada**.
- **`CTR-006`:** Pantalla: `/contracts` (`ContractEditor`). Parámetros: `imageBase64`, `documentType` (`tarjetaPropiedad`, `cedula`, `soat`). Consume OCR/IA externa. Referencias: `client/src/components/ContractEditor.jsx:12`, `POST /api/v1/contracts/extract-document` (`server/routes/contracts.js:33`). Estado: **Implementada**.
- **`CTR-007`:** Pantalla: `/contracts` (`ContractEditor`). Parámetros: `deviceId`, datos del cliente, codeudor, `dailyRate`, `contractDays`, `paymentFrequency`, `freeDayPolicy`, `fixedFreeDayOfWeek`, `initialFee`, `vehicleInfo`, `attachments`. Puede generar factura/pago de cuota inicial. Referencias: `client/src/pages/Contracts.jsx:4`, `POST /api/v1/contracts/create` (`server/routes/contracts.js:27`). Estado: **Implementada**.
- **`CTR-008`:** Pantalla: `/contracts` (`ContractEditor`). Parámetros: `contractId` + campos editados. Referencias: `PUT /api/v1/contracts/:contractId/update` (`server/routes/contracts.js:81`). Estado: **Implementada**.
- **`CTR-009`:** Pantalla: `/contracts`. Parámetros: `contractId`, `status` (`COMPLETED` / `CANCELLED`). **Riesgo alto:** desvincula contrato activo del vehículo y detiene facturación. Referencias: `client/src/pages/Contracts.jsx:899-911`, `PUT /api/v1/contracts/:contractId/status` (`server/routes/contracts.js:75`). Estado: **Implementada**.
- **`CTR-010`:** Solo backend. Parámetros: `daysThreshold`. `GET /api/v1/contracts/expiring/:daysThreshold` (`server/routes/contracts.js:39`). También existen `GET /api/v1/contracts/:deviceId/stats` y `GET /api/v1/contracts/:deviceId/all`. Estado: **Parcialmente implementada** (sin UI).

</details>

---

### Módulo 5: Resumen de Pagos (Matriz Mensual)

| ID | Acción disponible | Ejemplo de comando de voz | Tipo | Riesgo | ¿Requiere confirmación? | Aprobación |
|---|---|---|---|---|---|---|
| `SUM-001` | Consultar matriz mensual de pagos por moto y día | *"Abre el resumen de pagos de noviembre"* | Consulta | Bajo | No | ☐ |
| `SUM-002` | Buscar placa y filtrar por estado de mora/corte | *"Filtra las motos en deuda en el resumen"* | Filtro | Bajo | No | ☐ |
| `SUM-003` | Cambiar entre vista Matriz y vista Tarjetas | *"Cambia a vista de tarjetas"* | Navegación | Bajo | No | ☐ |
| `SUM-004` | Exportar pagos del mes a CSV | *"Descarga el Excel de pagos de este mes"* | Operación | Bajo | No | ☐ |
| `SUM-005` | Crear factura de un día desde una celda vacía | *"Crea la factura de hoy para DPW18I"* | Formulario | Medio | Sí | ☐ |
| `SUM-006` | Ejecutar corte masivo de motor a todos los morosos | *"Corta el motor a todos los morosos"* | Operación | Alto | Sí | ☐ |

<details>
<summary>Detalles técnicos — Módulo 5</summary>

- **`SUM-001`:** Pantalla: `/summary`. Parámetros: `month`, `year`. Permisos: autenticado. Referencias: `client/src/pages/PaymentSummary.jsx:5,94-95`, `GET /api/v1/payments/allPayments` (`server/routes/paymentsRoutes.js:29`), `GET /api/v1/invoices/status-report` (`server/routes/invoicesRoutes.js:21`). Estado: **Implementada**.
- **`SUM-002`:** Pantalla: `/summary`. Parámetros: `searchQuery`, `statusFilter` (`all`, `debt`, `ok`, `cutoff`). Referencias: `client/src/pages/PaymentSummary.jsx:44-45`. Estado: **Implementada**.
- **`SUM-003`:** Pantalla: `/summary`. Parámetros: `desktopView` (`matrix` / `cards`). Referencias: `client/src/pages/PaymentSummary.jsx:43,83`. Estado: **Implementada**.
- **`SUM-004`:** Pantalla: `/summary` y `/payments`. Parámetros: `month`, `year`, `companyId`. Referencias: `client/src/services/api.js:200`, `GET /api/v1/payments/export` (`server/routes/paymentsRoutes.js:36`). Estado: **Implementada**.
- **`SUM-005`:** Pantalla: `/summary`. Abre `CreateDayInvoiceModal`. Parámetros: `deviceIdName`, `date`. Referencias: `client/src/pages/PaymentSummary.jsx:50-52`, `client/src/components/modals/CreateDayInvoiceModal.jsx`, `POST /api/v1/invoices/create` (`server/routes/invoicesRoutes.js:30`). Estado: **Implementada**.
- **`SUM-006`:** Pantalla: `/summary`. **Riesgo alto:** envía comando `engineStop` en lote a múltiples vehículos en mora simultáneamente. Permisos: `role !== 'viewer'`. Referencias: `client/src/pages/PaymentSummary.jsx:223-226`, `POST /api/v1/devices/cutoff-debtors` (`server/routes/devicesRoutes.js:40`). Estado: **Implementada**.

</details>

---

### Módulo 6: Pagos y Transacciones

| ID | Acción disponible | Ejemplo de comando de voz | Tipo | Riesgo | ¿Requiere confirmación? | Aprobación |
|---|---|---|---|---|---|---|
| `PAY-001` | Listar historial de pagos paginado por mes | *"Muéstrame los pagos de noviembre"* | Consulta | Bajo | No | ☐ |
| `PAY-002` | Buscar pagos por placa o referencia | *"Busca los pagos de NGI06I"* | Filtro | Bajo | No | ☐ |
| `PAY-003` | Filtrar pagos por estado | *"Muéstrame los pagos pendientes"* | Filtro | Bajo | No | ☐ |
| `PAY-004` | Ordenar pagos por fecha, monto o placa | *"Ordena los pagos por monto"* | Filtro | Bajo | No | ☐ |
| `PAY-005` | Exportar pagos filtrados a CSV | *"Exporta los pagos de octubre a CSV"* | Operación | Bajo | No | ☐ |
| `PAY-006` | Consultar estado en tiempo real de un pago (SSE) | *"Revisa cómo va la transacción 1362970-..."* | Consulta | Bajo | No | ☐ |
| `PAY-007` | Registrar ajuste o pago manual sobre factura | *"Registra un ajuste de taller para DRJ22I"* | Operación | Alto | Sí | ☐ |

<details>
<summary>Detalles técnicos — Módulo 6</summary>

- **`PAY-001` a `PAY-004`:** Pantalla: `/payments`. Parámetros: `page`, `month`, `year`, `searchQuery`, `filter` (`all`, `completed`, `pending`, `failed`), `sortBy` (`date`, `amount`, `device`). Permisos: autenticado. Referencias: `client/src/pages/Payments.jsx:125-135`, `GET /api/v1/payments/all` (`server/routes/paymentsRoutes.js:26`). Estado: **Implementada**.
- **`PAY-005`:** Pantalla: `/payments`. Referencias: `client/src/services/api.js:200`, `GET /api/v1/payments/export` (`server/routes/paymentsRoutes.js:36`). Estado: **Implementada**.
- **`PAY-006`:** Backend + portal de pagos. `GET /api/v1/payments/status` y `GET /api/v1/payments/stream/:reference` (`server/routes/paymentsRoutes.js:7,9`). Estado: **Implementada**.
- **`PAY-007`:** Pantallas: `/invoices` y `/summary` (`InvoiceAdjustmentModal`). Parámetros: `invoiceId`, `adjustmentType` (`FREE`, `ACCIDENT_TRANSIT`, `INCAPACITY`, `WORKSHOP`, `INCUMPLIMIENTO`, etc.), `amount`, `adjustmentReference`, `note`. **Riesgo alto:** altera cartera, contabilidad de pagos, progreso del contrato y puede disparar reactivación automática del motor GPS. Permisos: `role !== 'viewer'`. Referencias: `client/src/components/modals/InvoiceAdjustmentModal.jsx:175`, `POST /api/v1/payments/admin/manual` (`server/routes/paymentsRoutes.js:39`), `server/services/paymentService.js:271`. Estado: **Implementada**.

</details>

---

### Módulo 7: Facturación Diaria (Facturas)

| ID | Acción disponible | Ejemplo de comando de voz | Tipo | Riesgo | ¿Requiere confirmación? | Aprobación |
|---|---|---|---|---|---|---|
| `INV-001` | Listar facturas del mes con métricas | *"Abre las facturas de noviembre"* | Consulta | Bajo | No | ☐ |
| `INV-002` | Buscar facturas por placa, contrato o referencia | *"Busca las facturas de DPW18I"* | Filtro | Bajo | No | ☐ |
| `INV-003` | Filtrar facturas por estado contable | *"Muéstrame solo las facturas en deuda"* | Filtro | Bajo | No | ☐ |
| `INV-004` | Consultar facturas impagas de una placa | *"¿Qué días debe la moto NHW47I?"* | Consulta | Bajo | No | ☐ |
| `INV-005` | Consultar reporte de estado de cartera por moto | *"¿Qué motos están en mora hoy?"* | Consulta | Bajo | No | ☐ |
| `INV-006` | Exportar facturas del mes a CSV | *"Descarga las facturas de este mes en CSV"* | Operación | Bajo | No | ☐ |
| `INV-007` | Crear una factura diaria manualmente | *"Genera la factura del 21 de noviembre para PMQ44I"* | Formulario | Medio | Sí | ☐ |

<details>
<summary>Detalles técnicos — Módulo 7</summary>

- **`INV-001` a `INV-003`:** Pantalla: `/invoices`. Parámetros: `page`, `limit`, `month`, `year`, `search`, `status`. Permisos: `role !== 'viewer'`. Referencias: `client/src/pages/Invoices.jsx:201-226`, `GET /api/v1/invoices/all` y `GET /api/v1/invoices/stats` (`server/routes/invoicesRoutes.js:15,37`). Estado: **Implementada**.
- **`INV-004`:** Parámetros: `deviceId`. `GET /api/v1/invoices/:deviceId/unpaid` (`server/routes/invoicesRoutes.js:52` — sin `verifyToken`). Estado: **Implementada**.
- **`INV-005`:** `GET /api/v1/invoices/status-report` (`server/routes/invoicesRoutes.js:21`). Estado: **Implementada**.
- **`INV-006`:** Pantalla: `/invoices`. Parámetros: `month`, `year`. Referencias: `client/src/services/api.js:124`, `GET /api/v1/invoices/export` (`server/routes/invoicesRoutes.js:40`). Estado: **Implementada**.
- **`INV-007`:** Pantallas: `/summary` (`CreateDayInvoiceModal`). Parámetros: `deviceIdName`, `date`. Referencias: `POST /api/v1/invoices/create` (`server/routes/invoicesRoutes.js:30`). Estado: **Implementada**.

</details>

---

### Módulo 8: Reportes y Conciliación Bancaria

| ID | Acción disponible | Ejemplo de comando de voz | Tipo | Riesgo | ¿Requiere confirmación? | Aprobación |
|---|---|---|---|---|---|---|
| `REP-001` | Consultar reporte diario de conciliación | *"Muéstrame la conciliación de noviembre"* | Consulta | Bajo | No | ☐ |
| `REP-002` | Filtrar conciliación por empresa o estado | *"Filtra los días pendientes de conciliar"* | Filtro | Bajo | No | ☐ |
| `REP-003` | Seleccionar fechas para sumar total a transferir | *"Suma los días del 15 al 20 para transferencia"* | Consulta | Bajo | No | ☐ |
| `REP-004` | Copiar total seleccionado al portapapeles | *"Copia el total seleccionado"* | Operación | Bajo | No | ☐ |
| `REP-005` | Marcar o desmarcar un día como conciliado | *"Marca el 19 de noviembre como conciliado con ref TX123"* | Operación | Alto | Sí | ☐ |

<details>
<summary>Detalles técnicos — Módulo 8</summary>

- **`REP-001` a `REP-004`:** Pantalla: `/reports`. Parámetros: `month`, `year`, `companyId`, `statusFilter` (`all`, `payments`, `bancolombia`, `reconciled`, `pending`, `selected`), `searchQuery`, `selectedDates`. Permisos: `role !== 'viewer'`. Referencias: `client/src/pages/Reports.jsx:4,18-31,173-187`, `GET /api/v1/payments/reconciliation` (`server/routes/paymentsRoutes.js:32`). Estado: **Implementada**.
- **`REP-005`:** Pantalla: `/reports`. Parámetros: `date`, `reconciled`, `transactionId`, `companyId`. **Riesgo alto:** altera el estado contable de conciliación bancaria con Wompi/Bancolombia. Referencias: `client/src/pages/Reports.jsx:90-100`, `POST /api/v1/payments/reconciliation/toggle` (`server/routes/paymentsRoutes.js:33`). Estado: **Implementada**.

</details>

---

### Módulo 9: Facturación B2B a Empresas

| ID | Acción disponible | Ejemplo de comando de voz | Tipo | Riesgo | ¿Requiere confirmación? | Aprobación |
|---|---|---|---|---|---|---|
| `BIL-001` | Listar facturas emitidas a empresas | *"Muéstrame las facturas de empresas"* | Consulta | Bajo | No | ☐ |
| `BIL-002` | Filtrar y ordenar facturas de empresas | *"Ordena las facturas de empresas por monto"* | Filtro | Bajo | No | ☐ |
| `BIL-003` | Previsualizar / imprimir factura de empresa | *"Abre la factura de For Everyone Group para imprimir"* | Consulta | Bajo | No | ☐ |
| `BIL-004` | Generar nueva factura mensual de empresa | *"Genera la factura de noviembre para Pocketbike"* | Operación | Alto | Sí | ☐ |

<details>
<summary>Detalles técnicos — Módulo 9</summary>

- **`BIL-001` a `BIL-003`:** Pantalla: `/company-invoices`. Parámetros: `companyId`, `filter` (`all`, `completed`, `pending`), `searchQuery`, `sortBy` (`date`, `amount`, `company`). Permisos: `admin` (`role !== 'viewer' && isAdmin()`). Referencias: `client/src/pages/CompanyInvoices.jsx:4,17-36`, `client/src/components/CompanyInvoiceTemplate.jsx`, `GET /api/v1/company-invoices` (`server/routes/companyBillingRoutes.js:8`). Estado: **Implementada**.
- **`BIL-004`:** Pantalla: `/company-invoices`. Parámetros: `companyId`, `month`, `year`. **Riesgo alto:** genera cobro oficial B2B calculado sobre transacciones y comisiones. Referencias: `client/src/pages/CompanyInvoices.jsx:62`, `POST /api/v1/company-invoices/generate` (`server/routes/companyBillingRoutes.js:11`). Estado: **Implementada**.

</details>

---

### Módulo 10: Historial y Envío de Comandos GPS

| ID | Acción disponible | Ejemplo de comando de voz | Tipo | Riesgo | ¿Requiere confirmación? | Aprobación |
|---|---|---|---|---|---|---|
| `CMD-001` | Consultar historial y estadísticas de comandos GPS | *"Muéstrame los comandos enviados hoy"* | Consulta | Bajo | No | ☐ |
| `CMD-002` | Filtrar comandos por placa, tipo o mes | *"Filtra solo los comandos de apagado de noviembre"* | Filtro | Bajo | No | ☐ |
| `CMD-003` | Enviar comando GPS manual (`STOP`, `RESUME`, `CUSTOM`) | *"Envía comando de reactivación a la moto DPW18I"* | Operación | Alto | Sí | ☐ |
| `CMD-004` | Consultar estado de conexiones en tiempo real (SSE) | *"¿Cuántos clientes están conectados al stream?"* | Consulta | Bajo | No | ☐ |

<details>
<summary>Detalles técnicos — Módulo 10</summary>

- **`CMD-001` y `CMD-002`:** Pantalla: `/commands` (alias `/historial-comandos`). Parámetros: `month`, `year`, `searchQuery`, `filter`, `page`. Permisos: `role !== 'viewer'`. Referencias: `client/src/pages/CommandHistory.jsx:24-40`, `GET /api/v1/commands` y `GET /api/v1/commands/stats` (`server/routes/commandsRoutes.js:11,17`). Estado: **Implementada**.
- **`CMD-003`:** Pantalla: `/commands` (`SendCommandModal`). Parámetros: `deviceId`/`deviceIdName`, `commandType`, `customCommand`, `reason`. **Riesgo alto:** envía órdenes directas al hardware GPS del vehículo (corte de combustible/corriente o comandos crudos). Referencias: `client/src/components/modals/SendCommandModal.jsx`, `POST /api/v1/commands/send` (`server/routes/commandsRoutes.js:23`). Estado: **Implementada**.
- **`CMD-004`:** Solo backend. `GET /api/v1/sse/status` (`server/routes/sse.js:25`). Estado: **Parcialmente implementada**.

</details>

---

### Módulo 11: Centro de Alertas de Telemetría

| ID | Acción disponible | Ejemplo de comando de voz | Tipo | Riesgo | ¿Requiere confirmación? | Aprobación |
|---|---|---|---|---|---|---|
| `ALT-001` | Consultar alertas de telemetría y estadísticas | *"¿Qué alertas de corte de batería hay hoy?"* | Consulta | Bajo | No | ☐ |
| `ALT-002` | Filtrar alertas por placa, tipo, estado o mes | *"Filtra las alertas de movimiento no autorizado"* | Filtro | Bajo | No | ☐ |
| `ALT-003` | Pausar o reanudar stream en vivo de alertas | *"Pausa las alertas en tiempo real"* | Operación | Bajo | No | ☐ |
| `ALT-004` | Marcar alerta como revisada o resuelta | *"Marca esta alerta de PMQ44I como resuelta"* | Operación | Medio | Sí | ☐ |

<details>
<summary>Detalles técnicos — Módulo 11</summary>

- **`ALT-001` a `ALT-003`:** Pantalla: `/alerts` (alias `/alertas`). Parámetros: `month`, `year`, `searchQuery`, `filter` (tipo de alerta), `statusFilter`, `page`, `grouped=true`, `streamMode`. Permisos: `role !== 'viewer'`. Referencias: `client/src/pages/Alerts.jsx:109-165`, `GET /api/v1/alerts` y `GET /api/v1/alerts/stats` (`server/routes/alertsRoutes.js:11,17`). Estado: **Implementada**.
- **`ALT-004`:** Pantalla: `/alerts`. Parámetros: `alertId`, `status` (`ACKNOWLEDGED` / `RESOLVED`), `notes`. Referencias: `client/src/services/api.js:48`, `PATCH /api/v1/alerts/:id/status` (`server/routes/alertsRoutes.js:23`). Estado: **Implementada**.

</details>

---

### Módulo 12: Configuración de Empresa e Integraciones

| ID | Acción disponible | Ejemplo de comando de voz | Tipo | Riesgo | ¿Requiere confirmación? | Aprobación |
|---|---|---|---|---|---|---|
| `SET-001` | Consultar configuración actual de la empresa | *"¿Cuál es nuestra hora de corte actual?"* | Consulta | Bajo | No | ☐ |
| `SET-002` | Actualizar branding, políticas de contrato y horarios | *"Cambia la tarifa diaria por defecto a 35 mil"* | Formulario | Medio | Sí | ☐ |
| `SET-003` | Actualizar credenciales GPS (Traccar/MegaRastreo) o Wompi | *"Actualiza las llaves de Wompi"* | Formulario | Alto | Sí | ☐ |
| `SET-004` | Probar conexión con servidor Traccar | *"Prueba la conexión con Traccar"* | Operación | Bajo | No | ☐ |
| `SET-005` | Consultar y modificar notificaciones de Traccar | *"Activa la notificación de corte de energía en Traccar"* | Operación | Medio | Sí | ☐ |

<details>
<summary>Detalles técnicos — Módulo 12</summary>

- **`SET-001`:** Pantalla: `/settings`. Permisos: `role !== 'viewer'`. Referencias: `client/src/pages/Settings.jsx:11`, `GET /api/v1/companies/settings` (`server/routes/companiesRoutes.js:16`). Estado: **Implementada**.
- **`SET-002`:** Pantalla: `/settings`. Secciones: branding (nombre, logo, colores), `contractDefaults` (tarifa diaria, días, política día libre, gastos fijos, parámetros financieros), `cutOffTime`, `curfew`. Referencias: `PUT /api/v1/companies/settings` (`server/routes/companiesRoutes.js:17`). Estado: **Implementada**.
- **`SET-003`:** Pantalla: `/settings`. **Riesgo alto:** modifica `wompiConfig` (publicKey, privateKey, integritySecret, eventsSecret, paymentMethod) y `gpsConfig` (host, usuario, contraseña). Un error detiene cobros o control GPS de toda la empresa. Referencias: `PUT /api/v1/companies/settings` (`server/routes/companiesRoutes.js:17`). Estado: **Implementada**.
- **`SET-004`:** Pantalla: `/settings`. Referencias: `POST /api/v1/companies/validate-traccar` (`server/routes/companiesRoutes.js:15`). Estado: **Implementada**.
- **`SET-005`:** Pantalla: `/settings`. Parámetros: `companyId`, canales/tipos de notificación Traccar. Referencias: `GET/PUT /api/v1/companies/:id/traccar-notifications` (`server/routes/companiesRoutes.js:18-19`). Estado: **Implementada**.

</details>

---

### Módulo 13: Usuarios, Empresas y Plataforma SuperAdmin

| ID | Acción disponible | Ejemplo de comando de voz | Tipo | Riesgo | ¿Requiere confirmación? | Aprobación |
|---|---|---|---|---|---|---|
| `ADM-001` | Listar y buscar usuarios del sistema | *"Muéstrame los usuarios administradores"* | Consulta | Bajo | No | ☐ |
| `ADM-002` | Crear o editar usuario y sus roles/permisos | *"Crea un usuario viewer para Ana"* | Formulario | Alto | Sí | ☐ |
| `ADM-003` | Eliminar usuario | *"Elimina al usuario Carlos"* | Operación | Alto | Sí | ☐ |
| `ADM-004` | Listar empresas registradas | *"Muéstrame todas las empresas"* | Consulta | Bajo | No | ☐ |
| `ADM-005` | Crear o editar empresa (comisiones, método Wompi, facturación) | *"Crea una empresa nueva llamada MotoRenta"* | Formulario | Alto | Sí | ☐ |
| `ADM-006` | Asignar vehículos a una empresa | *"Asigna estas 5 motos a la empresa Pocketbike"* | Operación | Alto | Sí | ☐ |
| `ADM-007` | Configurar tipos de ajuste y estados de pago globales | *"Muestra el tipo de ajuste Oficina"* | Formulario | Medio | Sí | ☐ |
| `ADM-008` | Gestionar rutinas programadas globales (Cron / SystemJobs) | *"Edita el horario del cron de corte diario"* | Operación | Alto | Sí | ☐ |
| `ADM-009` | Gestionar o restablecer plantillas OCR globales | *"Restablece las plantillas OCR por defecto"* | Operación | Medio | Sí | ☐ |

<details>
<summary>Detalles técnicos — Módulo 13</summary>

- **`ADM-001` a `ADM-003`:** Pantalla: `/users`. Permisos: `role !== 'viewer'` (creación/edición/borrado sensible). Referencias: `client/src/pages/Users.jsx:3,58-99`, `GET/POST/PUT/DELETE /api/v1/users` (`server/routes/usersRoutes.js:10-13`). Estado: **Implementada**.
- **`ADM-004` a `ADM-006`:** Pantalla: `/companies`. Permisos: `user.isSuperAdmin === true`. Referencias: `client/src/pages/Companies.jsx:5,88-156`, `client/src/components/modals/CompanyDevicesModal.jsx`, `GET/POST/PUT /api/v1/companies` (`server/routes/companiesRoutes.js:14,21,22`), `POST /api/v1/devices/assign-to-company` (`server/routes/devicesRoutes.js:28`). Estado: **Implementada**.
- **`ADM-007`:** Pantalla: `/companies` (tab Tipos de Ajuste). Referencias: `client/src/components/modals/AdjustmentTypesModal.jsx`, `GET/PUT /api/v1/settings/adjustment-types`, `GET/PUT /api/v1/settings/payment-status` (`server/routes/settingsRoutes.js:8-17`). Estado: **Implementada**.
- **`ADM-008`:** Pantalla: `/companies` (tab Rutinas Globales). **Riesgo alto:** controla crons de generación diaria de facturas, cortes de motor programados, toque de queda y verificación de pagos. **Hallazgo de seguridad:** `server/routes/systemJobsRoutes.js` no aplica middleware de autenticación en la ruta. Referencias: `client/src/components/SystemJobs.jsx`, `GET/POST/PUT/DELETE /api/v1/system-jobs` (`server/routes/systemJobsRoutes.js:11-14`), `GET /api/v1/cron/available-jobs` (`server/routes/cronRoutes.js:11`). Estado: **Implementada**.
- **`ADM-009`:** Pantalla: `/companies` (tab Plantillas OCR). Referencias: `client/src/components/OcrTemplatesManager.jsx`, `GET/PUT /api/v1/settings/ocr-templates`, `POST /api/v1/settings/ocr-templates/reset` (`server/routes/settingsRoutes.js:20-26`). Estado: **Implementada**.

</details>

---

### Módulo 14: Portal de Pagos del Conductor (`upay-pay`, `/p/:plate`)

| ID | Acción disponible | Ejemplo de comando de voz | Tipo | Riesgo | ¿Requiere confirmación? | Aprobación |
|---|---|---|---|---|---|---|
| `PRT-001` | Autenticar conductor por PIN de vehículo | *"Ingresar PIN de la moto DPW18I"* | Operación | Medio | Sí | ☐ |
| `PRT-002` | Consultar estado de deuda e historial del conductor | *"¿Cuánto debo hoy en mi moto?"* | Consulta | Bajo | No | ☐ |
| `PRT-003` | Iniciar cobro real por Wompi (Nequi Push / Bancolombia QR) | *"Quiero pagar mi cuota de hoy por Nequi"* | Operación | Alto | Sí | ☐ |
| `PRT-004` | Solicitar día libre o préstamo de día | *"Quiero usar un día libre hoy"* | Operación | Alto | Sí | ☐ |

<details>
<summary>Detalles técnicos — Módulo 14</summary>

- **`PRT-001`:** Portal `/p/:plate`. Parámetros: `deviceId`, `pin`. Referencias: `server/entrypoints/payUserServer.js:87`, `POST /api/v1/auth/pin-login` (`server/routes/auth.js:23`). También existen endpoints de gestión de PIN en `server/routes/deviceAccess.js:10-22` (sin middleware de auth en ruta). Estado: **Implementada**.
- **`PRT-002`:** Portal `/p/:plate`. Referencias: `GET /api/v1/payments/status` (`server/routes/paymentsRoutes.js:7`), `GET /api/v1/invoices/history` (`server/routes/invoicesRoutes.js:23`), `GET /api/v1/devices/status` (`server/routes/devicesRoutes.js:34`). Estado: **Implementada**.
- **`PRT-003`:** Portal `/p/:plate`. **Riesgo alto (financiero real):** crea transacción real en Wompi (`NEQUI_PUSH` o `BANCOLOMBIA_QR`) y tras aprobación (`upay-webhook`, `POST /api/v1/webhooks/wompi`) marca facturas como pagadas y reactiva motor GPS. Referencias: `POST /api/v1/payments/request` (`server/routes/paymentsRoutes.js:8`), `server/services/paymentService.js:418`. Estado: **Implementada**.
- **`PRT-004`:** Portal `/p/:plate`. **Riesgo alto:** consume cupo mensual de día libre o genera préstamo y puede reactivar motor GPS. Referencias: `POST /api/v1/payments/use-free-day`, `POST /api/v1/payments/request-loan` (`server/routes/paymentsRoutes.js:10-11`). Estado: **Implementada**.

</details>

---

## 4. Acciones propuestas (útiles para UPay AI, aún NO implementadas)

Las siguientes acciones **no existen todavía** en el código, pero serían de alto valor en fases posteriores:

| ID | Acción propuesta | Ejemplo de comando de voz | Riesgo estimado | Estado |
|---|---|---|---|---|
| `PROP-001` | Resumen diario hablado ("Briefing matutino") | *"Dame el reporte de la mañana: recaudo, morosos y alertas"* | Bajo | Propuesta |
| `PROP-002` | Consultar estado real de un pago directo en Wompi | *"Verifica en Wompi si el pago de IFX20I ya pasó"* | Bajo | Propuesta |
| `PROP-003` | Enviar recordatorio de cobro por WhatsApp al conductor | *"Envía recordatorio de pago por WhatsApp a DPW18I"* | Medio | Propuesta |
| `PROP-004` | Detectar inconsistencias de `gpsId` o pagos pendientes bloqueados | *"Revisa si hay motos con pagos pendientes o GPS desincronizados"* | Bajo | Propuesta |
| `PROP-005` | Comparar recaudo entre dos meses o semanas | *"Compara el recaudo de octubre contra noviembre"* | Bajo | Propuesta |
| `PROP-006` | Consultar ubicación en mapa / último recorrido de una moto | *"¿Dónde está ubicada la moto PMQ44I?"* | Bajo | Propuesta |

---

## 5. Clasificación por Nivel de Seguridad (Propuesta para revisión)

> **Nota:** Esta clasificación es una recomendación preliminar. Ninguna acción está autorizada todavía.

### Grupo A — Acciones que podrían ejecutarse automáticamente (49 acciones)
*Solo lectura, navegación, filtros, ordenamientos y consultas de bajo riesgo, siempre respetando el rol/empresa del usuario autenticado:*

- **Navegación (3):** `NAV-001`, `NAV-003`, `SUM-003`
- **Dashboard (3):** `DASH-001`, `DASH-002`, `DASH-003`
- **Flota (5):** `DEV-001`, `DEV-002`, `DEV-003`, `DEV-004`, `DEV-005`
- **Contratos (6):** `CTR-001`, `CTR-002`, `CTR-003`, `CTR-004`, `CTR-005`, `CTR-010`
- **Resumen / Pagos (9):** `SUM-001`, `SUM-002`, `SUM-004`, `PAY-001`, `PAY-002`, `PAY-003`, `PAY-004`, `PAY-005`, `PAY-006`
- **Facturas (6):** `INV-001`, `INV-002`, `INV-003`, `INV-004`, `INV-005`, `INV-006`
- **Reportes / Facturación B2B (7):** `REP-001`, `REP-002`, `REP-003`, `REP-004`, `BIL-001`, `BIL-002`, `BIL-003`
- **Comandos / Alertas / Config / Admin / Portal (10):** `CMD-001`, `CMD-002`, `CMD-004`, `ALT-001`, `ALT-002`, `ALT-003`, `SET-001`, `SET-004`, `ADM-001`, `ADM-004`, `PRT-002` *(11 acciones en este bloque → total exacto: 49 acciones)*

### Grupo B — Acciones que requieren confirmación explícita (16 acciones)
*Modifican configuración no crítica, crean/editan registros operativos, consumen OCR o cambian contexto de sesión:*
- `NAV-002`, `NAV-005`, `DEV-006`, `DEV-007`, `DEV-009`, `CTR-006`, `CTR-007`, `CTR-008`, `SUM-005`, `INV-007`, `ALT-004`, `SET-002`, `SET-005`, `ADM-007`, `ADM-009`, `PRT-001`.

### Grupo C — Acciones críticas o restringidas (18 acciones)
*Operaciones financieras reales, conciliación contable, control físico de motor GPS (individual o masivo), credenciales de pasarelas/GPS, roles/usuarios, empresas, crons globales o borrados irreversibles:*
- `NAV-004`, `DEV-008`, `DEV-010`, `CTR-009`, `SUM-006`, `PAY-007`, `REP-005`, `BIL-004`, `CMD-003`, `SET-003`, `ADM-002`, `ADM-003`, `ADM-005`, `ADM-006`, `ADM-008`, `PRT-003`, `PRT-004` *(y escritura directa sobre PINs en `/api/v1/device-access`)*.

---

## 6. Funcionalidades con comportamiento o seguridad pendiente de clarificación

1. **Rutas sin middleware de autenticación en backend:** `systemJobsRoutes.js`, `deviceAccess.js`, `cronRoutes.js`, `GET /invoices/:deviceId/unpaid`, `POST /payments/create` y `GET /sse/status` deben protegerse con autenticación y validación de rol antes de permitir que un asistente las invoque.
2. **Validación de roles en backend vs frontend:** Varias restricciones del rol `viewer` están aplicadas en la UI (`AdminSidebar.jsx`, `DeviceSelector.jsx`), pero varios endpoints solo ejecutan `verifyToken`/`authenticate` sin verificar explícitamente `role !== 'viewer'`. Para UPay AI es indispensable validar el rol en el backend.
3. **Endpoints huérfanos en `api.js`:** `createPaymentIntent`, `createBatchPaymentIntent`, `verifyTransaction` y `verifyDevicePin` no corresponden a rutas activas actuales y deben descartarse o alinearse antes de construir herramientas para IA.
