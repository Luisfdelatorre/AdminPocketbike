# Vista de contratos

Estado: referencia especializada activa. Revisada el 2026-07-20.

## Ubicación

- Estructura y comportamiento: `client/src/pages/Contracts.jsx`.
- Estilos: `client/src/pages/Contracts.css`.
- Servicios consumidos: `client/src/services/api.js`.

La ruta del panel es `/#/contracts` dentro de `AdminLayout`.

## Responsabilidades

La pantalla carga contratos, dispositivos disponibles y valores predeterminados de compañía. Permite buscar, filtrar, crear, editar y cambiar estados.

El modal de contrato se representa mediante portal y se controla con el parámetro `?modal=contract`. Esa entrada en el historial permite que el botón Atrás cierre el modal como una navegación.

## Estructura del modal (Modal Acordeón con Escáner OCR)

En `Contracts.jsx`, la composición del modal de creación y edición es:

```text
modal-overlay
└─ modal-content.modal-surface--contract
   ├─ .modal-header.contract-modal-header
   │  ├─ .contract-modal-title-wrap (punto de estado, título "Nuevo Contrato" / "Editar Contrato")
   │  └─ button.modal-close (✕)
   ├─ form#contract-form.contract-form
   │  ├─ .contract-ocr-buttons (Tarjeta Propiedad, Cédula / PPT, SOAT PDF/Foto)
   │  ├─ .ocr-scanning-card (animación de escáner láser mientras procesa IA)
   │  ├─ .ocr-magic-card (tarjeta de datos extraídos con IA)
   │  └─ .contract-accordion
   │     ├─ card: DISPOSITIVO Y ACCESO (dispositivo/placa, fecha inicio, PIN, subpágina Datos de Tarjeta & SOAT)
   │     ├─ card: DATOS DEL CLIENTE (documento CC/PPT, nombre, teléfono, correo, dirección y codeudor solidario)
   │     ├─ card: PRESTAMO (tarifa diaria, días, cuota inicial y desglose financiero actuarial E.A. 29%)
   │     └─ card: CONFIGURACIÓN AVANZADA & NOTAS (días libres, corte, exenciones de telemetría y notas)
   └─ .form-actions.contract-modal-actions
      ├─ button.btn-secondary (Cancelar)
      └─ button.btn-primary[form="contract-form"] (Crear Contrato / Actualizar Contrato)
```

`form-actions` es hermano del formulario, no hijo, manteniendo el botón principal con `form="contract-form"`. El visor e impresión inmersiva del contrato generado se maneja a través del componente especializado `ContractDocPreviewModal` y la exportación oficial Word `.docx` mediante `contractDocumentService`.

En móvil el modal ocupa la pantalla disponible; en escritorio conserva límites máximos definidos por CSS. El cuerpo de la página queda bloqueado mientras el modal está montado y la salida mantiene una transición breve antes de desmontarlo.

## Carga y rendimiento

Al montar o cambiar el filtro se solicitan contratos, dispositivos y configuración. Antes de alterar este orden:

- comprueba si las lecturas pueden ejecutarse en paralelo sin dependencias;
- evita duplicar peticiones al abrir el modal;
- conserva valores predeterminados ya obtenidos de compañía;
- mide cualquier cambio que pretenda optimizar carga.

## Reglas de mantenimiento

- Mantener foco visible, etiquetas, cierre por controles accesibles y comportamiento del botón Atrás.
- Mantener el footer fuera del scroll del formulario.
- Evitar scroll horizontal interno; revisar anchos, grids y `min-width`.
- Mantener bloqueo y restauración del scroll global incluso durante la transición de salida.
- Verificar escritorio y móvil antes de cerrar la intervención.

El progreso visual se registra en [INCOHERENCIAS_DISENO.md](INCOHERENCIAS_DISENO.md).
