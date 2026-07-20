# Índice y Vigencia de la Documentación

Este índice indica cómo aporta cada archivo Markdown de la raíz al desarrollo. La clasificación evita que snapshots antiguos se interpreten como especificaciones actuales.

## Estados

- **Normativo**: reglas obligatorias para agentes y flujo de trabajo.
- **Activo**: fuente vigente que debe mantenerse sincronizada con el código.
- **Especializado**: fuente vigente solo para su dominio.
- **Histórico**: antecedente útil; no autoriza ni define comportamiento actual.

## Catálogo

| Documento | Estado | Uso durante el desarrollo |
|---|---|---|
| `AGENTS.md` | Normativo | Autorizaciones, ramas, commits, integración y precedencia documental. |
| `DOCUMENTATION_INDEX.md` | Normativo | Selección de fuentes y vigencia de cada documento raíz. |
| `README.md` | Activo | Instalación, entorno, comandos, puertos, prefijo API y operación local. |
| `QUICKSTART.md` | Activo | Arranque seguro y comprobaciones mínimas para desarrollo. |
| `ARCHITECTURE.md` | Activo | Componentes actuales, límites del sistema y flujo general. |
| `PROJECT_SUMMARY.md` | Activo | Resumen técnico vigente y mapa funcional. |
| `AUTH_SYSTEM.md` | Activo | Arquitectura de autenticación, sesiones y protección existente. |
| `AUTH_QUICKSTART.md` | Especializado | Pruebas locales de autenticación sin credenciales embebidas. |
| `CONTRACT_SYSTEM.md` | Activo | Ciclo y reglas actuales de contratos. |
| `DATABASE_RELATIONSHIPS.md` | Activo | Relaciones realmente implementadas entre modelos. |
| `DASHBOARD_API.md` | Especializado | Contrato actual del dashboard administrativo. |
| `PAYMENTS_API_OPTIMIZATION.md` | Especializado | Paginación y acceso eficiente al historial de pagos. |
| `VIEW_CONTRACTS.md` | Especializado | Acceso y validación de contratos en UI/API. |
| `INCOHERENCIAS_DISENO.md` | Especializado | Backlog y estado de intervenciones UI/UX supervisadas. |
| `AUTH_COMPLETE.md` | Histórico | Snapshot de una fase previa de autenticación. |
| `BATCH_PAYMENTS.md` | Histórico | Propuesta antigua de pagos batch; el endpoint descrito no está montado. |
| `IMPLEMENTATION_COMPLETE.md` | Histórico | Snapshot de la implementación inicial de referencias de pago. |
| `INVOICE_MODEL_UPDATE.md` | Histórico | Propuesta anterior de `contractId` en Invoice, no presente en el modelo actual. |
| `PAYMENT_REFERENCE.md` | Histórico | Diseño inicial de referencias; hoy existen referencias distintas según el tipo de pago. |

## Reglas de contraste

1. Para hechos sobre la implementación existente, prevalecen los archivos de código y configuración de la rama activa.
2. Una discrepancia entre código y documento activo debe reportarse y corregirse; no debe resolverse mediante suposición silenciosa.
3. Los documentos históricos solo explican decisiones pasadas. Sus ejemplos de rutas, modelos, puertos y estados pueden estar obsoletos.
4. `README.md` es la fuente operativa principal: Vite `5173`, API de desarrollo `8084`, prefijo `/apinode` y túnel MongoDB `27018`.
5. Los cambios de esquema requieren inspeccionar `server/models`, relaciones de repositorios y datos existentes; ningún ejemplo Markdown constituye una migración aprobada.

## Hallazgos del inventario 2026-07-20

- Se retiraron credenciales embebidas de los documentos de autenticación.
- Se corrigieron referencias antiguas a `localhost:3000` y `/api` en las guías activas.
- Se clasificaron como históricos los documentos que describen endpoints o campos ausentes.
- La documentación de dominio se redujo a contratos verificables contra el código actual.
