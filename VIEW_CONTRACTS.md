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

## Estructura del modal

En `Contracts.jsx`, la composición vigente es:

```text
modal-overlay
└─ modal-content
   ├─ modal-header
   ├─ form#contract-form.contract-form
   └─ form-actions
```

`form-actions` es hermano del formulario, no hijo. El botón principal conserva asociación semántica mediante `form="contract-form"`. Esto permite un layout Header–Contenido–Footer sin que las acciones formen parte del área desplazable.

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
