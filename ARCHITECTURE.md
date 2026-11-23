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

### Asistente de voz (demo)

`AdminLayout` monta `VoiceAssistantProvider` (`client/src/context/VoiceAssistantContext.jsx`) y el panel Bottom Sheet `client/src/components/voiceAssistant/VoiceAssistantPanel.jsx`. La lógica vive en `client/src/services/voiceAssistant/` y `server/services/aiAssistantService.js`:

- `capabilities.js`: catálogo canónico compartido entre cliente y servidor con las 6 herramientas de solo lectura (`navigate`, `applyFilter`, `search`, `clearFilters`, `openDetail`, `showHelp`, todas con `risk: "read"`), módulos, permisos por rol, enums de filtros, placeholders `{{...}}` y serialización determinista (`serializeCatalogForPrompt`) para Prompt Caching.
- `schemaValidator.js`: validación determinista (`.safeParse()`) de planes de hasta 3 acciones, parámetros y peticiones entrantes.
- `screenBridge.js` y `client/src/hooks/useAssistantScreenBridge.js`: puente reactivo que conecta el estado real de las pantallas (`Payments`, `DeviceSelector`, `Contracts`, `PaymentSummary`, `Invoices`, `Alerts`, `CommandHistory`, `AdminDashboard`) con el asistente para aplicar filtros, búsquedas, abrir vistas previas de solo lectura y exponer métricas sin crear un estado duplicado.
- `matcher.js`: matcher determinista local (`MATCH | NO_MATCH | AMBIGUOUS`) con soporte bilingüe (`es-CO` / `en-US`) y guarda contra preguntas o negaciones que contengan palabras comando (p. ej. *"Why can't I open contracts?"*).
- `dispatcher.js`: ejecutor asíncrono secuencial que valida el plan, navega con React Router, espera las señales de montaje y carga de datos (`waitForScreenMount`, `waitForScreenDataReady`), se detiene ante cualquier fallo y resuelve placeholders al finalizar.
- `resolvers.js`: resolución local segura de placeholders `{{...}}` en texto plano (sin `eval`, sin HTML y distinguiendo conteos/totales cargados en página frente a totales globales del mes).
- `tts.js`: síntesis de voz (`window.speechSynthesis`) con selector de voz/acento, modos de tono (`Normal`, `Ejecutiva`, `Suave`, `Grave`), filtros de privacidad de voz (`speakAmounts: OFF/ON`, `speakCustomerNames: OFF/ON`, desactivados por defecto) y compatibilidad con Firefox/iOS.
- `client/src/hooks/useSpeechRecognition.js`: hook sobre Web Speech API (`es-CO` / `en-US`) con transcripción parcial en vivo, deduplicación de frases finales, bloqueo de eco durante TTS y fallback al campo de texto.

Endpoints:
- `POST /api/v1/ai/chat` (y `/apinode/ai/chat`): interpreta intenciones con OpenAI Responses API (`server/services/aiAssistantService.js`) usando **Prompt Caching** (prefijo estable $\ge 1024$ tokens con hash SHA-256 `catalog_hash` + sufijo dinámico con `applicationContext` y memoria efímera de los últimos 5 turnos) o el planificador contextual determinista cuando `OPENAI_API_KEY` no está configurada. Nunca recibe registros de base de datos, montos financieros ni PII. Protegido con `verifyToken` (accesible para todos los roles autenticados incluido `viewer`), rate-limit por usuario, tope diario de tokens (`AI_DAILY_TOKEN_CAP`) y flag `AI_DEMO_ENABLED`.
- `GET /api/v1/ai/diagnostics`: métricas operativas seguras de Prompt Caching en desarrollo (`catalog_hash`, `catalog_token_estimate`, `input_tokens`, `cached_tokens`, `cache_hit_ratio`, `average_latency_ms`).
- `GET/POST /api/v1/assistant/query`: endpoint demo estático de respaldo (`server/services/assistantDemoService.js` y `client/src/services/voiceAssistant/demoData.js`).

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
