# UPay AI — Checklist de Aprobación de Acciones

> **Instrucciones de uso:** Marca **una sola casilla** por cada acción según la política que desees aplicar al futuro asistente de voz de UPay, y agrega cualquier condición u observación en la última columna.  
> **Estado inicial:** Todas las casillas están sin seleccionar. Ninguna acción está autorizada todavía.

**Referencia detallada:** ver [UPAY_AI_ACTIONS_REVIEW.md](./UPAY_AI_ACTIONS_REVIEW.md).

---

## Módulo 1: Navegación, Sesión y Contexto de Empresa

| ID | Acción | Aprobar automático | Solo con confirmación | No permitir | Revisar luego | Observaciones |
|---|---|---|---|---|---|---|
| `NAV-001` | Navegar a una sección del panel | ☐ | ☐ | ☐ | ☐ | |
| `NAV-002` | Cambiar de empresa activa | ☐ | ☐ | ☐ | ☐ | |
| `NAV-003` | Cambiar idioma de la interfaz | ☐ | ☐ | ☐ | ☐ | |
| `NAV-004` | Iniciar sesión de administrador | ☐ | ☐ | ☐ | ☐ | |
| `NAV-005` | Cerrar sesión | ☐ | ☐ | ☐ | ☐ | |

---

## Módulo 2: Dashboard y KPIs

| ID | Acción | Aprobar automático | Solo con confirmación | No permitir | Revisar luego | Observaciones |
|---|---|---|---|---|---|---|
| `DASH-001` | Consultar estadísticas y KPIs del mes | ☐ | ☐ | ☐ | ☐ | |
| `DASH-002` | Cambiar mes/año del Dashboard | ☐ | ☐ | ☐ | ☐ | |
| `DASH-003` | Consultar resumen de salud eléctrica de flota | ☐ | ☐ | ☐ | ☐ | |

---

## Módulo 3: Flota y Dispositivos GPS

| ID | Acción | Aprobar automático | Solo con confirmación | No permitir | Revisar luego | Observaciones |
|---|---|---|---|---|---|---|
| `DEV-001` | Listar todos los vehículos de la flota | ☐ | ☐ | ☐ | ☐ | |
| `DEV-002` | Buscar una moto por placa o conductor | ☐ | ☐ | ☐ | ☐ | |
| `DEV-003` | Filtrar flota por estado operativo/eléctrico | ☐ | ☐ | ☐ | ☐ | |
| `DEV-004` | Ordenar flota por tiempo de desconexión | ☐ | ☐ | ☐ | ☐ | |
| `DEV-005` | Generar enlace de pago para compartir | ☐ | ☐ | ☐ | ☐ | |
| `DEV-006` | Editar datos de un vehículo | ☐ | ☐ | ☐ | ☐ | |
| `DEV-007` | Sincronizar dispositivos desde plataforma GPS | ☐ | ☐ | ☐ | ☐ | |
| `DEV-008` | Apagar o reactivar motor de un vehículo | ☐ | ☐ | ☐ | ☐ | |
| `DEV-009` | Crear dispositivo manualmente (solo backend) | ☐ | ☐ | ☐ | ☐ | |
| `DEV-010` | Eliminar dispositivo (solo backend) | ☐ | ☐ | ☐ | ☐ | |

---

## Módulo 4: Contratos y Documentación Digital

| ID | Acción | Aprobar automático | Solo con confirmación | No permitir | Revisar luego | Observaciones |
|---|---|---|---|---|---|---|
| `CTR-001` | Listar todos los contratos | ☐ | ☐ | ☐ | ☐ | |
| `CTR-002` | Buscar contratos por placa, cliente o cédula | ☐ | ☐ | ☐ | ☐ | |
| `CTR-003` | Filtrar contratos por estado | ☐ | ☐ | ☐ | ☐ | |
| `CTR-004` | Previsualizar contrato digital | ☐ | ☐ | ☐ | ☐ | |
| `CTR-005` | Descargar contrato en Word (DOCX) o PDF | ☐ | ☐ | ☐ | ☐ | |
| `CTR-006` | Extraer datos de documentos con OCR | ☐ | ☐ | ☐ | ☐ | |
| `CTR-007` | Crear un contrato nuevo | ☐ | ☐ | ☐ | ☐ | |
| `CTR-008` | Editar un contrato existente | ☐ | ☐ | ☐ | ☐ | |
| `CTR-009` | Completar o cancelar un contrato activo | ☐ | ☐ | ☐ | ☐ | |
| `CTR-010` | Consultar contratos próximos a vencer (solo backend) | ☐ | ☐ | ☐ | ☐ | |

---

## Módulo 5: Resumen de Pagos (Matriz Mensual)

| ID | Acción | Aprobar automático | Solo con confirmación | No permitir | Revisar luego | Observaciones |
|---|---|---|---|---|---|---|
| `SUM-001` | Consultar matriz mensual de pagos por moto y día | ☐ | ☐ | ☐ | ☐ | |
| `SUM-002` | Buscar placa y filtrar por estado de mora/corte | ☐ | ☐ | ☐ | ☐ | |
| `SUM-003` | Cambiar entre vista Matriz y vista Tarjetas | ☐ | ☐ | ☐ | ☐ | |
| `SUM-004` | Exportar pagos del mes a CSV | ☐ | ☐ | ☐ | ☐ | |
| `SUM-005` | Crear factura de un día desde una celda vacía | ☐ | ☐ | ☐ | ☐ | |
| `SUM-006` | Ejecutar corte masivo de motor a todos los morosos | ☐ | ☐ | ☐ | ☐ | |

---

## Módulo 6: Pagos y Transacciones

| ID | Acción | Aprobar automático | Solo con confirmación | No permitir | Revisar luego | Observaciones |
|---|---|---|---|---|---|---|
| `PAY-001` | Listar historial de pagos paginado por mes | ☐ | ☐ | ☐ | ☐ | |
| `PAY-002` | Buscar pagos por placa o referencia | ☐ | ☐ | ☐ | ☐ | |
| `PAY-003` | Filtrar pagos por estado | ☐ | ☐ | ☐ | ☐ | |
| `PAY-004` | Ordenar pagos por fecha, monto o placa | ☐ | ☐ | ☐ | ☐ | |
| `PAY-005` | Exportar pagos filtrados a CSV | ☐ | ☐ | ☐ | ☐ | |
| `PAY-006` | Consultar estado en tiempo real de un pago (SSE) | ☐ | ☐ | ☐ | ☐ | |
| `PAY-007` | Registrar ajuste o pago manual sobre factura | ☐ | ☐ | ☐ | ☐ | |

---

## Módulo 7: Facturación Diaria (Facturas)

| ID | Acción | Aprobar automático | Solo con confirmación | No permitir | Revisar luego | Observaciones |
|---|---|---|---|---|---|---|
| `INV-001` | Listar facturas del mes con métricas | ☐ | ☐ | ☐ | ☐ | |
| `INV-002` | Buscar facturas por placa, contrato o referencia | ☐ | ☐ | ☐ | ☐ | |
| `INV-003` | Filtrar facturas por estado contable | ☐ | ☐ | ☐ | ☐ | |
| `INV-004` | Consultar facturas impagas de una placa | ☐ | ☐ | ☐ | ☐ | |
| `INV-005` | Consultar reporte de estado de cartera por moto | ☐ | ☐ | ☐ | ☐ | |
| `INV-006` | Exportar facturas del mes a CSV | ☐ | ☐ | ☐ | ☐ | |
| `INV-007` | Crear una factura diaria manualmente | ☐ | ☐ | ☐ | ☐ | |

---

## Módulo 8: Reportes y Conciliación Bancaria

| ID | Acción | Aprobar automático | Solo con confirmación | No permitir | Revisar luego | Observaciones |
|---|---|---|---|---|---|---|
| `REP-001` | Consultar reporte diario de conciliación | ☐ | ☐ | ☐ | ☐ | |
| `REP-002` | Filtrar conciliación por empresa o estado | ☐ | ☐ | ☐ | ☐ | |
| `REP-003` | Seleccionar fechas para sumar total a transferir | ☐ | ☐ | ☐ | ☐ | |
| `REP-004` | Copiar total seleccionado al portapapeles | ☐ | ☐ | ☐ | ☐ | |
| `REP-005` | Marcar o desmarcar un día como conciliado | ☐ | ☐ | ☐ | ☐ | |

---

## Módulo 9: Facturación B2B a Empresas

| ID | Acción | Aprobar automático | Solo con confirmación | No permitir | Revisar luego | Observaciones |
|---|---|---|---|---|---|---|
| `BIL-001` | Listar facturas emitidas a empresas | ☐ | ☐ | ☐ | ☐ | |
| `BIL-002` | Filtrar y ordenar facturas de empresas | ☐ | ☐ | ☐ | ☐ | |
| `BIL-003` | Previsualizar / imprimir factura de empresa | ☐ | ☐ | ☐ | ☐ | |
| `BIL-004` | Generar nueva factura mensual de empresa | ☐ | ☐ | ☐ | ☐ | |

---

## Módulo 10: Historial y Envío de Comandos GPS

| ID | Acción | Aprobar automático | Solo con confirmación | No permitir | Revisar luego | Observaciones |
|---|---|---|---|---|---|---|
| `CMD-001` | Consultar historial y estadísticas de comandos GPS | ☐ | ☐ | ☐ | ☐ | |
| `CMD-002` | Filtrar comandos por placa, tipo o mes | ☐ | ☐ | ☐ | ☐ | |
| `CMD-003` | Enviar comando GPS manual (`STOP`, `RESUME`, `CUSTOM`) | ☐ | ☐ | ☐ | ☐ | |
| `CMD-004` | Consultar estado de conexiones en tiempo real (SSE) | ☐ | ☐ | ☐ | ☐ | |

---

## Módulo 11: Centro de Alertas de Telemetría

| ID | Acción | Aprobar automático | Solo con confirmación | No permitir | Revisar luego | Observaciones |
|---|---|---|---|---|---|---|
| `ALT-001` | Consultar alertas de telemetría y estadísticas | ☐ | ☐ | ☐ | ☐ | |
| `ALT-002` | Filtrar alertas por placa, tipo, estado o mes | ☐ | ☐ | ☐ | ☐ | |
| `ALT-003` | Pausar o reanudar stream en vivo de alertas | ☐ | ☐ | ☐ | ☐ | |
| `ALT-004` | Marcar alerta como revisada o resuelta | ☐ | ☐ | ☐ | ☐ | |

---

## Módulo 12: Configuración de Empresa e Integraciones

| ID | Acción | Aprobar automático | Solo con confirmación | No permitir | Revisar luego | Observaciones |
|---|---|---|---|---|---|---|
| `SET-001` | Consultar configuración actual de la empresa | ☐ | ☐ | ☐ | ☐ | |
| `SET-002` | Actualizar branding, políticas de contrato y horarios | ☐ | ☐ | ☐ | ☐ | |
| `SET-003` | Actualizar credenciales GPS o Wompi | ☐ | ☐ | ☐ | ☐ | |
| `SET-004` | Probar conexión con servidor Traccar | ☐ | ☐ | ☐ | ☐ | |
| `SET-005` | Consultar y modificar notificaciones de Traccar | ☐ | ☐ | ☐ | ☐ | |

---

## Módulo 13: Usuarios, Empresas y Plataforma SuperAdmin

| ID | Acción | Aprobar automático | Solo con confirmación | No permitir | Revisar luego | Observaciones |
|---|---|---|---|---|---|---|
| `ADM-001` | Listar y buscar usuarios del sistema | ☐ | ☐ | ☐ | ☐ | |
| `ADM-002` | Crear o editar usuario y sus roles/permisos | ☐ | ☐ | ☐ | ☐ | |
| `ADM-003` | Eliminar usuario | ☐ | ☐ | ☐ | ☐ | |
| `ADM-004` | Listar empresas registradas | ☐ | ☐ | ☐ | ☐ | |
| `ADM-005` | Crear o editar empresa (comisiones, Wompi, facturación) | ☐ | ☐ | ☐ | ☐ | |
| `ADM-006` | Asignar vehículos a una empresa | ☐ | ☐ | ☐ | ☐ | |
| `ADM-007` | Configurar tipos de ajuste y estados de pago globales | ☐ | ☐ | ☐ | ☐ | |
| `ADM-008` | Gestionar rutinas programadas globales (Cron / SystemJobs) | ☐ | ☐ | ☐ | ☐ | |
| `ADM-009` | Gestionar o restablecer plantillas OCR globales | ☐ | ☐ | ☐ | ☐ | |

---

## Módulo 14: Portal de Pagos del Conductor (`/p/:plate`)

| ID | Acción | Aprobar automático | Solo con confirmación | No permitir | Revisar luego | Observaciones |
|---|---|---|---|---|---|---|
| `PRT-001` | Autenticar conductor por PIN de vehículo | ☐ | ☐ | ☐ | ☐ | |
| `PRT-002` | Consultar estado de deuda e historial del conductor | ☐ | ☐ | ☐ | ☐ | |
| `PRT-003` | Iniciar cobro real por Wompi (Nequi / QR) | ☐ | ☐ | ☐ | ☐ | |
| `PRT-004` | Solicitar día libre o préstamo de día | ☐ | ☐ | ☐ | ☐ | |

---

## Acciones Propuestas (no implementadas aún)

| ID | Acción propuesta | Aprobar para fase futura | Solo con confirmación | No permitir | Revisar luego | Observaciones |
|---|---|---|---|---|---|---|
| `PROP-001` | Briefing matutino hablado (recaudo, morosos, alertas) | ☐ | ☐ | ☐ | ☐ | |
| `PROP-002` | Verificar estado real de un pago directo en Wompi | ☐ | ☐ | ☐ | ☐ | |
| `PROP-003` | Enviar recordatorio de cobro por WhatsApp | ☐ | ☐ | ☐ | ☐ | |
| `PROP-004` | Auditoría automática de `gpsId` y pagos bloqueados | ☐ | ☐ | ☐ | ☐ | |
| `PROP-005` | Comparativa de recaudo entre períodos | ☐ | ☐ | ☐ | ☐ | |
| `PROP-006` | Consultar última ubicación GPS de una moto | ☐ | ☐ | ☐ | ☐ | |
