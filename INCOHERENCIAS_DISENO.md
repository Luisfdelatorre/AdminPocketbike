# 🔍 Incoherencias de Diseño en AdminPocketbike

Este documento recopila las inconsistencias visuales, de maquetación y de estructuración de hojas de estilo (CSS) encontradas en el proyecto. Su objetivo es servir como hoja de ruta para unificar el sistema de diseño y corregir problemas de interfaz (UI/UX).

Estado: especificación incremental activa. Revisada el 2026-07-20.

El **Índice de Avances y Control de Mejoras** es la fuente vigente del estado. Las secciones descriptivas inferiores conservan el diagnóstico original y pueden mencionar valores anteriores ya corregidos; sirven como contexto y no sustituyen la inspección del código actual. Los hallazgos de documentación, backend, seguridad o Git se registran en sus fuentes correspondientes, no en este backlog visual.

---

## 📋 Índice de Avances y Control de Mejoras

Este índice detalla el estado de resolución de cada uno de los hallazgos descritos en este documento. **Cualquier agente debe consultar esta tabla y actualizarla a medida que se implementen mejoras bajo la supervisión directa del usuario:**

| ID | Hallazgo / Mejora | Estado | Notas |
|:---:|---|:---:|---|
| **1** | Conflictos de Capas (Z-Index) y Modales Tapados | ✅ Completado | Los overlays de los modales administrativos usan `z-index: 1300`, por encima de sidebar, header y navegación móvil. |
| **2** | Redundancia de Estilos en Modales (`.modal-content` vs `.modal-card`) | ✅ Completado | Overlay, animación y comportamiento responsive se centralizaron en `index.css`; cada contexto conserva su máximo de escritorio y usa pantalla completa en móvil. |
| **3** | Unificación en Diseño de Tarjetas (Cards) | ✅ Completado | Las tarjetas administrativas comparten borde `#E5E7EB`, radio `0.75rem`, padding `1rem` y sombra base; los formatos compactos de móvil se mantienen como excepción responsive. |
| **4** | Variables CSS para Colores de Marca (Teal `#03C9D7`) | ✅ Completado | Los tonos teal, sus gradientes y transparencias se centralizaron como variables globales y reemplazaron las referencias directas del cliente. |
| **4.1** | Navegación y Bloqueo de Scroll en Modal de Contratos | ✅ Completado | El modal bloquea el documento, crea una entrada de historial al abrirse y el botón Atrás lo cierra con transición de navegación móvil. |
| **4.2** | Estructura Header–Contenido–Footer en Modal de Contratos | ✅ Completado | El formulario es el único contenido desplazable; el footer de acciones es su hermano y las opciones responsive ya no generan desbordamiento horizontal. |
| **4.3** | Icono de Cierre del Modal de Contratos | ✅ Completado | El botón de cierre usa el componente `X` de Lucide, consistente con el sistema de iconos existente. |
| **4.4** | Tamaño Compacto de Acciones en Modal de Contratos | ✅ Completado | Las acciones del footer usan proporciones compactas; en móvil conservan un área táctil mínima de `44px`. |
| **5** | Estandarización de Botones (`.btn-primary` redundante) | 🧪 En validación | Los botones de acción administrativos comparten una base global: primario teal, secundario neutro y peligro rojo; las excepciones son sólo de tamaño o distribución. |
| **6** | Fallo en Área de Respeto (Safe Area sin fallback) | ✅ Completado | El FAB de contratos usa `env(safe-area-inset-bottom, 0px)` y conserva un offset válido sin safe area. |
| **7** | Reestructuración DOM: Layout Flex Column en Móvil | 🧪 En validación | El shell móvil ya usa Header–Content–Footer en flujo vertical, safe areas centralizadas y scroll interno en `.admin-content`; build y arranque local correctos, pendiente aprobación visual del usuario. |
| **7.1** | Vistas Por Moto y Matriz en Resumen de Pagos | 🧪 En validación | Desktop permite alternar mediante un control segmentado entre tarjetas por moto y una matriz comparativa con scroll vertical de página, desplazamiento horizontal propio y encabezado de días sticky. |
| **7.2** | Altura Natural del Header Móvil | 🧪 En validación | El header móvil es sticky y usa altura natural como hijo flex, por lo que reserva el espacio real de títulos y acciones sin padding compensatorio en las páginas. |
| **7.3** | Botón de Apagado de Morosos y Modal en Resumen de Pagos | ✅ Completado | Botón de acción en PageHeader (desktop y móvil) con clases CSS puras (.auto-cutoff-btn, .bulk-cutoff-modal), contador de morosos, pseudo-clases :hover/:disabled y modal de confirmación unificado con tokens globales. |
| **7.4** | Estandarización de Selectores de Fecha Separados (PaymentSummary y Dashboard) | 🧪 En validación | Reemplazo del contenedor agrupado .summary-date-card por selectores individuales independientes (.date-select-standard) tanto en móvil como en escritorio de Resumen de Pagos y Dashboard. |
| **8** | Rediseño Visual iOS de AdminDashboard | 🧪 En validación | Maquetación con filtros superiores compactos, grid de 2 tarjetas primarias, 3 tarjetas secundarias compactas con resaltado naranja en pendientes y tabla de pagos recientes con badges estilo pill en verde y gris. |
| **9** | Rediseño Visual iOS de DeviceSelector | 🧪 En validación | Stats bar visible en móvil (3 columnas), filtros tipo pill con `#0070eb` activo, búsqueda iOS (`#f3f3f4`), tabla con banda de encabezado y filas iOS, badges de estado sistema (verde/rojo/gris), motor con colores de sistema. |
| **10** | Unificación de Badges de Estado (Facturas y Pagos) | 🧪 En validación | Badges unificados con StatusBadge y StatusConfigContext; consumo reactivo y en memoria O(1) de los tokens de Settings en Facturas, Pagos, Dashboard y Facturas de Empresa. |
| **11** | Rediseño Visual del Modal de Nuevo Contrato | 🧪 En validación | Header con indicador de estado, banner de IA con degradado y 3 botones de escaneo OCR distribuidos en 3 columnas iguales (`repeat(3, 1fr)`: Tarjeta Propiedad, Cédula/PPT y SOAT con badge OCR), tarjetas de sección con icono de 36px, campos `rounded-xl` con foco índigo, footer 1/3–2/3 con blur y tipografía Plus Jakarta Sans. Estilos aislados en `ContractModalRestyle.css` bajo `.modal-surface--contract`; pendiente aprobación visual del usuario. |
| **12** | Unificación de Headerbar en Contratos con PageHeader | 🧪 En validación | Migración de la cabecera manual en Contratos hacia el componente estándar PageHeader, homologando el Topbar móvil (Filtro + Refresh con tokens teal) y la cabecera de escritorio con botón de nuevo contrato y actualización. |
| **13** | Unificación Global de Cabeceras y Breadcrumbs en Línea con PageHeader | 🧪 En validación | Estandarización de cabeceras en todas las páginas bajo PageHeader, navegación mediante Breadcrumbs en línea compactos (Estilo 2), mini-paginación móvil y eliminación total de código legado portalElement. |
| **14** | Rediseño Nativo iOS del Modal de Compartir Link de Pago (ShareDeviceModal) | 🧪 En validación | Vista inmersiva edge-to-edge montada en portal, código QR vectorial, feedback interactivo de copiado y hoja de compartir nativa iOS (Share Sheet). |
| **15** | Estandarización de Modales Inmersivos Full-Screen / Studio (ShareDeviceModal y ContractDocPreviewModal) | 🧪 En validación | Overlay unificado con blur en desktop y studio container centrado, full-screen edge-to-edge en móvil, hook useAdminScrollLock, cierre por backdrop y Escape, y cabecera en una sola línea. |
| **16** | Estandarización y Desduplicación de Buscador `.search-ios` y Filtros | ✅ Completado | Consolidación canónica en `index.css`, eliminación de ~160 líneas CSS redundantes en `DeviceSelector.css` y `PaymentSummary.css`, y preservación limpia de overrides contextuales responsive. |
| **17** | Estandarización de Buscadores, Filter Pills, StatCards y Notificaciones Toast con Swipe-Up | ✅ Completado | Migración integral de Contratos y Pagos a SearchAndFilterBar y StatCard estándar, layout responsive con contenedor flex, y rediseño de notificaciones toast iOS en cápsula glassmorphic interactiva con gesto swipe-up para descarte. |
| **18** | Arquitectura Desacoplada y Modular de Cabeceras (`PageHeader.Desktop` / `PageHeader.Mobile` y `useIsMobile`) | ✅ Completado | Desacoplamiento limpio de la lógica y maquetación de cabeceras de escritorio y móvil en toda la aplicación (11 páginas), eliminando renderizado redundante, hacks de CSS media queries y unificando props con `renderHeader = isMobile ? mobileHeader : desktopHeader`. |
| **19** | Badges Flotantes (Globo iOS) en Pills de Filtro (`SearchAndFilterBar`) | ✅ Completado | Adición de badges tipo globo en la esquina superior derecha de cada pill para identificar conteos en tiempo real (Todos, Con Deuda, Al Día, Apagados) con adaptación cromática e inversión de contraste al estar activo. |
| **20** | Visibilidad Permanente de Filtros y Estadísticas en Versión Desktop | ✅ Completado | En pantallas de escritorio (`min-width: 769px`), los contenedores `.expandable-metrics-container`, tarjetas de métricas (`StatCard`s) y barras de filtros/búsqueda se mantienen siempre visibles y expandidos mediante `@media (min-width: 769px)` en `index.css` y `!isMobile || showFilters` en React (`DeviceSelector`, `Contracts`, `AdminDashboard`, `PaymentSummary`), reservando el colapso al botón móvil. |
| **21** | Iconografía Telemétrica en Tarjetas del Centro de Alertas | ✅ Completado | Sustitución de etiquetas de texto plano en las tarjetas de alerta por iconografía telemétrica compacta (`MotorIcon`, `KeyRound`, `Gauge`, `Activity`, `BatteryFull/Medium/Low`, `ZapOff`) con micro-cápsulas y tooltips descriptivos. |
| **22** | Consola Desktop Split (Feed 65% + Inspector Telemétrico 35%) en Centro de Alertas | 🧪 En validación | Maquetación responsive para pantallas de escritorio ($\ge 1200\text{px}$) con workspace de doble columna: feed interactivo de incidentes con selección activa, mapa de rastreo GPS en vivo con HUD, ficha de conductor/contrato, comandos IoT inmediatos de corte/reanudación y bitácora de despacho rápido. |
| **23** | Unificación de Colores, Tokens y Estandarización de Clases en Settings | ✅ Completado | Consolidación integral de la interfaz de Configuración bajo los tokens globales (--brand-teal, --brand-teal-dark, --card-border, --card-radius); eliminación de 50+ inline styles con colores fijos y reducción de ~1,200 líneas CSS redundantes. |
| **24** | Estandarización de Cabecera, Filtros y Stats en Alertas (`Alerts.jsx`) | 🧪 En validación | Migración de la cabecera desktop a `PageHeader.Desktop` con `MonthYearSelector` y botón SSE, cabecera móvil con `datePicker`, tarjeta consolidada `.mobile-metrics-card` en móvil, cuadrícula de 4 `StatCard` (`.devices-stats-ios.payments-stats-grid`) en escritorio, y filtros unificados en `.mobile-filter-section` y `SearchAndFilterBar`. |
| **25** | Estandarización de Cabecera, Filtros y Stats en Comandos (`CommandHistory.jsx`) | 🧪 En validación | Adición de breadcrumbs en `PageHeader.Desktop`, `datePicker` en `PageHeader.Mobile`, tarjeta reutilizable `MobileMetricsCard` en móvil, cuadrícula de 3 `StatCard` (`.devices-stats-ios`) en escritorio arriba de los filtros, y filtros unificados en `.mobile-filter-section` y `SearchAndFilterBar`. |
| **26** | Panel Flotante del Asistente de Voz (demo) (`VoiceAssistantPanel.jsx`) | 🧪 En validación | FAB teal y panel glassmorphism con tokens globales (`--brand-teal*`, `--card-border`), estados de UI (`idle`, `listening`, `thinking`, `speaking`, `error`), botón de micrófono con pulso activo, burbuja de transcripción parcial y banner de permisos/errores; capa `z-index: 1200` (sobre header/nav móvil, bajo modales `1300`); en móvil el FAB va a la izquierda sobre la navegación inferior para no chocar con `.app-fab`; respeta `prefers-reduced-motion`. Pendiente aprobación visual. |

---


## 1. Conflictos de Capas (Z-Index) y Modales Tapados 🚨 [CRÍTICO]

Existe un conflicto de superposición entre los componentes principales de navegación (Sidebar, Mobile Header) y las pantallas emergentes (Modales) de la administración.

### El Problema
* El menú lateral (`.admin-sidebar`) tenía un `z-index: 1200` en [AdminSidebar.css](client/src/components/AdminSidebar.css).
* La cabecera móvil (`.mobile-header`) tenía un `z-index: 1100` en [AdminSidebar.css](client/src/components/AdminSidebar.css).
* El overlay de la sidebar móvil (`.sidebar-overlay`) tenía un `z-index: 1150` en [AdminSidebar.css](client/src/components/AdminSidebar.css).
* El diagnóstico encontró overlays de modales con `z-index: 1000` en [DeviceSelector.css](client/src/pages/DeviceSelector.css), [Contracts.css](client/src/pages/Contracts.css) e [Invoices.css](client/src/pages/Invoices.css).

### Consecuencia
Cuando se abre un modal en la administración (por ejemplo, al configurar un PIN o editar un dispositivo):
1. **La cabecera móvil y la barra lateral se renderizan por encima del fondo oscuro del modal.**
2. El usuario puede ver y hacer clic en los botones de navegación de la barra lateral mientras el modal está abierto, rompiendo el flujo de interacción restrictivo.
3. El overlay oscuro del modal no cubre la parte superior de la pantalla en dispositivos móviles.

### Solución propuesta
Elevar el `z-index` de los modales en la administración para que estén por encima de la barra lateral:
```css
.modal-overlay {
    z-index: 1300; /* Debe ser superior a 1200 */
}
```

---

## 2. Duplicidad y Variaciones de Estilos en Modales 🎭

Cada página del proyecto redefine de forma independiente las clases y animaciones de los modales en su propio archivo CSS, generando inconsistencias en colores, espaciados y animaciones:

* **Nombres de Clases Inconsistentes:**
  * En [DeviceSelector.css](client/src/pages/DeviceSelector.css) y [Contracts.css](client/src/pages/Contracts.css) se usa `.modal-content`.
  * En [Invoices.css](client/src/pages/Invoices.css) se usa `.modal-card`.
* **Fondo de Overlay y Efectos Difuminados:**
  * En `DeviceSelector.css` y `Contracts.css`: `background: rgba(0, 0, 0, 0.5)` sin difuminado.
  * En `Invoices.css`: `background: rgba(15, 23, 42, 0.55)` (azul grisáceo) con `backdrop-filter: blur(3px)`.
* **Bordes Redondeados (Border Radius) y Ancho Máximo:**
  * En `DeviceSelector.css`: `border-radius: 0.75rem` (12px) y `max-width: 600px`.
  * En `Contracts.css`: `border-radius: 0.75rem` (12px) y `max-width: 700px`.
  * En `Invoices.css`: `border-radius: 1rem` (16px) y `max-width: 420px`.
  * En `Users.css`: `border-radius: 0.75rem` (12px) y `max-width: 500px`.
* **Animaciones Redundantes:**
  * Cada hoja de estilo define sus propias `@keyframes fadeIn` o `slideUp`, repitiendo código de animación CSS que podría ser global.

---

## 3. Inconsistencias en el Diseño de Tarjetas (Cards) 🎴

Las tarjetas utilizadas para mostrar información (dispositivos, contratos, estadísticas) no siguen un patrón visual unificado en cuanto a bordes y relleno (padding):

* **Variaciones de Borde:**
  * `.stat-card` (Dashboard): **Sin bordes**, solo sombra suave (`box-shadow: 0 1px 3px rgba(0,0,0,0.1)`).
  * `.contract-card` (Contratos): Sombra suave + **borde muy claro** (`border: 1px solid #F3F4F6`).
  * `.device-card` (Dispositivos): Sombra suave + **borde más oscuro** (`border: 1px solid #E5E7EB`).
* **Variaciones de Relleno (Padding):**
  * Las tarjetas de contratos y estadísticas usan `padding: 1rem` (16px).
  * Las tarjetas de dispositivos usan `padding: 1.25rem` (20px).

---

## 4. Hardcoding de Colores de Marca y Hojas de Estilo Aisladas 🎨

* **Color Primario Teal (`#03C9D7` y `#0394A3`):**
  * En el diagnóstico original, el color turquesa/teal estaba escrito manualmente en reglas de [AdminDashboard.css](client/src/pages/AdminDashboard.css), [Contracts.css](client/src/pages/Contracts.css) y [DeviceSelector.css](client/src/pages/DeviceSelector.css).
  * Si en el futuro se desea cambiar el color de la marca, se deben editar múltiples archivos de forma manual.
* **Inconsistencias en Colores de Estado:**
  * Los estados de pago (aprobado, pendiente, rechazado) usan combinaciones de color ligeramente distintas entre los badges de las tablas y el texto informativo de los listados móviles.

---

## 5. Duplicidad en Hojas de Estilo de Botones 🔘

El botón principal de la administración (`.btn-primary`) se define repetidamente con las mismas propiedades en múltiples archivos CSS en lugar de heredar de una clase global:

* El diagnóstico localizó definiciones equivalentes en [Contracts.css](client/src/pages/Contracts.css) y [DeviceSelector.css](client/src/pages/DeviceSelector.css):
```css
.btn-primary {
    background: #03C9D7;
    color: white;
    border: none;
    padding: 0.75rem 1.5rem;
    border-radius: 0.5rem;
    font-weight: 600;
    cursor: pointer;
    display: flex;
    align-items: center;
    gap: 0.5rem;
    transition: all 0.2s;
}
.btn-primary:hover {
    background: #0394A3;
    transform: translateY(-1px);
    box-shadow: 0 4px 12px rgba(3, 201, 215, 0.3);
}
```

#### Implementación de la intervención 5

La base de botones administrativos vive en `index.css`: `btn-primary` usa el teal de marca, `btn-secondary` conserva acciones auxiliares en neutro y `btn-danger` identifica acciones destructivas. Los botones primarios no añaden sombra. Se retiraron las definiciones de página que cambiaban color, espaciado o peso de forma global; los contextos que requieren acciones compactas sólo ajustan tamaño y distribución.

Las acciones de refrescar y exportar ya no se presentan como primarias, mientras que generar facturas conserva el primario teal. El botón de eliminación usa `btn-danger` en lugar de sobrescribir un primario mediante estilos inline.

---

## 6. Recomendaciones de Limpieza e Refactorización 🛠️

Para solucionar estas incoherencias y mejorar la mantenibilidad del proyecto, se sugiere:

1. **Unificar Variables en `:root`:**
   Mover los colores hexadecimales teal (`#03C9D7` y `#0394A3`) a variables en `:root` en [main.css](client/css/main.css) o [index.css](client/src/index.css), por ejemplo:
   ```css
   :root {
       --brand-teal: #03C9D7;
       --brand-teal-dark: #0394A3;
       --brand-teal-light: #EFF6FF;
   }
   ```
2. **Crear Componentes CSS Globales:**
   Extraer los estilos del modal y del botón primario a clases globales en `index.css`. Las páginas individuales solo deberían ajustar el tamaño del modal o aplicar estilos de distribución interna.
3. **Estandarizar las Tarjetas (Cards):**
   Elegir una regla visual única para las tarjetas (por ejemplo: `border-radius: 0.75rem`, `padding: 1rem`, `border: 1px solid #E5E7EB` para una UI limpia y consistente).

---

## 7. Estructura de Layout Móvil y Área de Respeto (Safe Area) 📱

### A. Fallo en el Área de Respeto (Safe Area Inset)
En [Contracts.css](client/src/pages/Contracts.css) se intentó usar el área de respeto para ubicar el botón flotante (FAB) en dispositivos móviles:
```css
bottom: calc(3rem + env(safe-area-inset-bottom));
```
#### El Problema
En navegadores móviles o de escritorio que no se encuentran en un contenedor nativo (como PWA o Cordova) o en dispositivos sin "notch"/indicador de inicio, `env(safe-area-inset-bottom)` no está definido por el navegador.

Al usarse dentro de un `calc()` sin un valor por defecto, **toda la regla CSS se invalida** en varios navegadores, provocando que el FAB u otros elementos floten de forma incorrecta o pierdan su posición.

#### Solución
Agregar siempre un valor fallback explícito dentro de la función `env()` para garantizar compatibilidad:
```css
bottom: calc(3rem + env(safe-area-inset-bottom, 0px));
```

---

### B. Estructura del DOM: Header/Footer Móviles Fixed vs. Flex Vertical

En el diagnóstico original, el layout móvil de [AdminLayout.css](client/src/components/AdminLayout.css) mantenía una estructura flex horizontal propia de escritorio (`flex-direction: row` por defecto), donde la barra de navegación lateral y el contenido principal se alineaban a los lados.

Para adaptarlo a móvil:
1. La cabecera móvil (`.mobile-header`) y la barra de navegación inferior (`.mobile-bottom-nav`) se configuran con `position: fixed`.
2. Esto obliga a realizar **parches manuales de padding** en cada página independiente para evitar que el contenido sea tapado por estos elementos flotantes. Por ejemplo:
   * En [PaymentSummary.css](client/src/pages/PaymentSummary.css) se observó un parche de `padding: 60px 4px 4px 4px;` en móvil.
   * En [Reports.css](client/src/pages/Reports.css) se observó `padding: 60px 12px 12px 12px;` en móvil.
   * En [Contracts.css](client/src/pages/Contracts.css) se ocultaba el header de la página (`.page-header { display: none !important; }`) para evitar la superposición.
   * En [DeviceSelector.css](client/src/pages/DeviceSelector.css) no se especificaba padding superior, por lo que los títulos podían quedar tapados por la cabecera en algunos viewports.

---

### C. Análisis de Impacto: Pasar de Layout Fixed a Flex Column en Móviles

Si reestructuramos el DOM para móviles usando una jerarquía Flex limpia:

```
┌──────────────────────────────────────────────┐  ▲
│  HEADER (Flex child / Relative)              │  │ 60px + safe area superior
├──────────────────────────────────────────────┤  ▼
│                                              │  ▲
│  CONTENT (Flex: 1 | Overflow-Y: Auto)        │  │ Alto dinámico con scroll independiente
│                                              │  │ (No afecta al header ni al footer)
│                                              │  ▼
├──────────────────────────────────────────────┤  ▲
│  FOOTER / NAV (Flex child / Relative)         │  │ 60px + safe area inferior
└──────────────────────────────────────────────┘  ▼
```

#### ¿Cómo afectaría a la versión de escritorio si lo corregimos?
**Impacto nulo o positivo si se segmenta correctamente mediante Media Queries:**
* En **escritorio (`min-width: 769px`)**, `.mobile-header` y `.mobile-bottom-nav` tienen `display: none`. Si mantenemos el contenedor padre `.admin-layout` como `flex-direction: row`, la barra lateral y el contenido principal seguirán maquetándose de forma horizontal sin verse afectados.
* En **móvil (`max-width: 768px`)**, aplicamos `flex-direction: column` al contenedor `.admin-layout`, limitando la altura total a `100vh` y configurando el scroll únicamente dentro de `.admin-content`.

#### Código de Reestructuración Sugerido en `AdminLayout.css`:

```css
/* Escritorio: Sin cambios en el comportamiento horizontal */
.admin-layout {
    display: flex;
    min-height: 100vh;
    flex-direction: row;
}

.admin-content {
    flex: 1;
    min-height: 100vh;
}

/* Móvil: Cambia a flujo vertical ordenado */
@media (max-width: 768px) {
    .admin-layout {
        flex-direction: column;
        height: 100vh;  /* fallback */
        height: 100dvh;
        overflow: hidden; /* Evita scroll en el body completo */
    }

    .admin-content {
        flex: 1;
        min-height: 0;
        overflow-y: auto; /* El scroll ahora ocurre dentro del contenedor de contenido */
        overflow-x: hidden;
    }

    .mobile-header {
        position: relative; /* Ya no flota encima del contenido */
        height: calc(60px + env(safe-area-inset-top, 0px));
        flex: 0 0 calc(60px + env(safe-area-inset-top, 0px));
    }

    .mobile-bottom-nav {
        position: relative; /* Ya no flota encima del contenido */
        height: calc(60px + env(safe-area-inset-bottom, 0px));
        flex: 0 0 calc(60px + env(safe-area-inset-bottom, 0px));
    }
}
```

#### Implementación de la intervención 7

La implementación mueve la cabecera móvil desde `AdminSidebar` hacia `AdminLayout`, por lo que cabecera, contenido y navegación inferior participan directamente en el shell vertical. El identificador `mobile-header-actions` se conserva para no cambiar los portales de acciones existentes.

Como `.admin-content` pasa a ser el propietario del scroll móvil, también se adaptaron los comportamientos dependientes de desplazamiento en Contratos, Pagos, Facturas y Facturación de empresas. Los bloqueos existentes de los modales de Contratos y Dispositivos ahora inmovilizan tanto el documento como el contenedor administrativo y restauran sus estilos al cerrar.

Se eliminaron las compensaciones superiores de Contratos, Pagos, Facturas, Facturación de empresas, `PaymentSummary`, `Reports` y `Settings`, además del padding inferior global que reservaba espacio para la navegación `fixed`. En Equipos se retiró el header móvil vacío y sus reglas antiguas para pantallas menores de `370px`; las acciones permanecen en el portal del header principal. El margen superior del filtro expandido quedó limitado al Dashboard para que no se filtre hacia Contratos u otros listados. `PaymentSummary` usa ahora la altura disponible del contenido en lugar de forzar otro viewport completo, mantiene su filtro visible con `sticky` durante el scroll móvil y usa `bike-summary`, `bike-summary-day` y `empty-day` en sus vistas móvil y web. La vista por moto conserva días registrados y vacíos hasta la fecha actual, pero oculta los vacíos posteriores a hoy; cualquier día futuro con datos permanece visible. Los períodos pasados abarcan el mes completo, el período actual llega como mínimo hasta hoy y los períodos futuros sólo se extienden hasta días registrados. La matriz conserva todas las celdas de ese rango para mantener las columnas alineadas y solo marca `empty-day` cuando una fecha posterior a hoy no tiene datos. El día actual del período vigente se resalta en la vista por moto.

#### Implementación de la intervención 7.1

El resumen de pagos reutiliza `BikePaymentSummary` en móvil y escritorio para evitar mantener dos representaciones por moto. En escritorio, un control segmentado con iconos permite alternar entre `Por moto` y `Matriz`; la primera es la opción inicial y la selección queda guardada localmente sin producir otra consulta a la API. Cada moto conserva su desplazamiento horizontal independiente, mantiene visibles los vacíos hasta hoy y filtra únicamente vacíos futuros.

La matriz continúa ofreciendo comparación transversal y totales por día. En escritorio, el documento conserva el desplazamiento vertical, la matriz limita su propio desplazamiento al eje horizontal y una copia visual del encabezado se mantiene sticky debajo de los controles; sus columnas se sincronizan con la tabla y los encabezados semánticos permanecen disponibles para tecnologías asistivas. Cuando el Summary header queda adherido, elimina temporalmente su radio para no revelar la tabla detrás de las esquinas curvas. Las columnas de dispositivo y deuda continúan fijas a la izquierda. En móvil no se muestra el selector y el breakpoint de React coincide con la media query de `768px`.

#### Implementación de la intervención 7.3

Se integró en `PaymentSummary` el botón de apagado masivo manual de vehículos morosos con el ícono universal de corte `PowerOff`, renderizado tanto en las acciones de escritorio como en la barra de herramientas del encabezado móvil (`MobileHeaderAction`). Al ser accionado, muestra un modal de confirmación con el conteo de motos morosas en tiempo real antes de ejecutar el endpoint de corte `cutoffDebtors`.

#### Implementación de la intervención 7.4

Se eliminó la dispersión y la inconsistencia del contenedor agrupado con divisor interno (`.summary-date-card`) en favor de controles independientes separados (`.date-select-standard` y `.date-selectors-group`) en todo el sistema:
* **En escritorio**: los selectores de fecha se ubican de manera estándar en `PageHeader` usando `desktopLeadingActions` (contiguos a `[↻ Actualizar]`) tanto en `PaymentSummary` como en `AdminDashboard`, compartiendo la misma altura de 38px, bordes `#cbd5e1` y radio de 6px que `Reports.jsx`.
* **En móvil**: se reemplazó la tarjeta blanca con divisor interno (`has-border`) por selectores independientes (`.date-select-standard`) organizados en `.date-selectors-group.mobile-date-selectors` (`flex: 1` para distribución limpia), eliminando anidamientos visuales innecesarios tanto en la cabecera sticky de `PaymentSummary` como en la fila de controles desplegable de `AdminDashboard`.
* **Centralización global**: las clases `.date-selectors-group`, `.mobile-date-selectors` y `.date-select-standard` quedaron centralizadas en `client/src/index.css`.

#### Beneficios de la corrección:
1. **Eliminación de código redundante:** Se eliminan los parches de `padding-top: 60px` y `padding-bottom: 75px` repetidos de forma manual en múltiples páginas CSS.
2. **Consistencia Visual:** El cabecero y la barra inferior de navegación móvil estarán perfectamente delimitados y nunca taparán dinámicamente ningún elemento interactivo de las vistas (como botones de guardado, filtros o formularios).
3. **Mantenibilidad:** El uso de áreas de respeto (`safe-area-inset-bottom` / `top`) se puede centralizar en las zonas de cabecera y pie de página móviles, facilitando el soporte de teléfonos con pantallas curvas o con notches.

---

## 12. Unificación de Headerbar en Contratos con PageHeader

### El Problema
La página de Contratos (`Contracts.jsx`) mantenía una cabecera construida de forma manual y aislada anterior a la estandarización del componente `PageHeader`:
* En móvil, utilizaba un `createPortal` manual hacia `#mobile-header-actions` inyectando un ícono no estandarizado (`ListFilter`) con clases de Tailwind sueltas (`p-2 rounded-full text-gray-500`), sin botón de refrescar ni tokenización compartida.
* En escritorio, utilizaba un bloque HTML manual (`.page-header !hidden md:!flex`) con un emoji hardcodeado (`📋 Contratos`) y un subtítulo vacío, en lugar del formato estándar usado en `DeviceSelector`, `Dashboard`, `Users` y `Companies`.

### Solución Implementada
* Se migró `Contracts.jsx` para consumir el componente estándar `PageHeader`:
  * Título dinámico mediante `t('contracts.title')`.
  * Recarga reactiva homologada mediante `onRefresh={handleRefresh}` y `loading={loading}`:
    * En **escritorio**: renderiza automáticamente el botón estándar `.btn-secondary` (`[↻ Actualizar]`) en la esquina superior derecha del encabezado, alineado con `DeviceSelector`, `PaymentSummary` y `Payments`.
    * En **móvil**: inyecta automáticamente el botón de recarga con ícono `RefreshCw` en el Topbar móvil a través de `MobileHeaderAction`.
  * Barra de filtros (`.contracts-filters`) enfocada exclusivamente en los botones de estado (`Todos`, `Activos`, `Completados`, `Cancelados`) y en el buscador, con tamaño y alineación vertical estandarizados (`38px`).
  * Integración con el filtro móvil mediante `onFilterToggle` y `showFilters` para el toggle en el Topbar.
  * Acción de creación de nuevo contrato unificada en el botón de acción flotante (FAB) tanto en escritorio (`bottom: 2rem; right: 2rem;`) como en móvil (`bottom: 5.25rem; right: 1.25rem;`), con animaciones hover/active y unificación con la paleta principal.
  * Eliminación del estado obsoleto `portalElement` y de referencias DOM directas a `#mobile-header-actions`.

---

## 13. Unificación Global de Cabeceras y Breadcrumbs en Línea con PageHeader

### El Problema
Existía dispersión en las cabeceras de la aplicación:
* Cuatro páginas críticas (`Payments.jsx`, `Invoices.jsx`, `Reports.jsx` y `Settings.jsx`) no utilizaban el componente `PageHeader`, implementando cabeceras HTML manuales con estilos inline, emojis hardcodeados y llamadas directas al DOM (`document.getElementById('mobile-header-actions')`).
* En móvil, estas páginas carecían de botón de recarga estandarizado con animación `spin` y usaban íconos dispares (`ListFilter` vs `Filter`).
* En las páginas que ya usaban `PageHeader`, el título era un string estático o JSX con wrappers manuales (`span`, `div`), sin contexto de navegación jerárquica y con código muerto (`portalElement` sin uso) en `AdminDashboard` y `CompanyInvoices`. Además, en páginas como Usuarios y Empresas, no existía acción móvil para crear registros desde el Topbar.

### Solución Implementada
1. **Componente Breadcrumbs y Estilo 2 (Inline Compacto):**
   * Se creó `client/src/components/Breadcrumbs.jsx` con jerarquía de navegación automática por rutas (`ROUTE_HIERARCHY`) y soporte de rutas personalizadas por props.
   * La cabecera desktop integra la ruta jerárquica con ícono de inicio (`Home`), separadores discretos (`ChevronRight`) y el título activo de la página renderizado semánticamente como `<h1>` en la misma línea.
2. **Evolución de `PageHeader.jsx`:**
   * Soporte integrado de `Breadcrumbs`, `subtitle` y `mobileLeadingActions` (para controles móviles como mini-paginadores antes del filtro/recarga).
   * Tokenización de estados activos en móvil con `var(--brand-teal)` en lugar de clases Tailwind sueltas.
3. **Migración Completa de Páginas:**
   * **`Payments.jsx`**: Migrado a `PageHeader`, mini-paginador móvil en `mobileLeadingActions`, recarga homologada y exportación CSV.
   * **`Invoices.jsx`**: Migrado a `PageHeader`, selectores `.date-select-standard`, mini-paginador móvil y recarga homologada.
   * **`Reports.jsx`**: Migrado a `PageHeader`, selectores `.date-select-standard`, eliminación de inline styles e internacionalización a español.
   * **`Settings.jsx`**: Migrado a `PageHeader`, botón de Guardar unificado en desktop (`.btn-primary`) y móvil (`.btn-mobile-header-action`).
   * **`Users.jsx`**, **`Companies.jsx`**, **`CompanyInvoices.jsx`**, **`PaymentSummary.jsx`**, **`Contracts.jsx`**, **`DeviceSelector.jsx`**, **`AdminDashboard.jsx`**: Homologados con títulos limpios, breadcrumbs contextuales (incluyendo pestañas dinámicas en Empresas), acciones móviles habilitadas y código muerto eliminado.

---

## 14. Rediseño Nativo iOS del Modal de Compartir Link de Pago (ShareDeviceModal)

### El Problema
El modal previo `ShareDeviceModal` poseía un diseño genérico y plano, desconectado de la estética táctil y móvil del resto de la aplicación: carecía de opciones para compartir a través de canales de mensajería (WhatsApp, SMS, Mail, AirDrop/Web Share), no mostraba retroalimentación táctil de pulsación, usaba elementos sin la riqueza visual del ecosistema iOS, y la función de copiado no ofrecía estado visual transicional ('¡Copiado!') dentro del botón.

### Solución Implementada
Se rediseñó completamente `ShareDeviceModal.jsx` y `ShareDeviceModal.css` adoptando una arquitectura visual completamente inmersiva:
1. **Experiencia Completamente Inmersiva (Full-Screen Edge-to-Edge)**: Desacoplada del DOM de página mediante `createPortal(..., document.body)` a `z-index: 99999`, cubriendo el 100% del viewport (`100vw` x `100dvh`), con bloqueo automático de scroll en el fondo, sin marcos ni bordes artificiales de chasis móvil que encierren la vista, presentando un diseño nativo iOS fluido que en pantallas de escritorio se centra ergonómicamente en un canvas de máxima legibilidad.
2. **Barra de Estado y Navegación iOS**: Barra superior con reloj sincronizado en tiempo real, Dynamic Island e iconos de señal, Wi-Fi y batería adaptados a `env(safe-area-inset-top)`, junto con barra de navegación con botón de retorno `‹ Dispositivos`, título central y botón superior de acción de compartir.
3. **Tarjeta de Código QR Vectorial**: Marco con esquinas de enfoque en turquesa de marca (`#00C7BE`), badge con animación pulsante 'Escanear para pagar', código QR generado dinámicamente mediante `qrcode.react`, y aviso de seguridad 'Código seguro • Válido por 24 horas'.
4. **Fila de Enlace y Copiado Interactivo**: Contenedor estilizado con URL monoespaciada truncada y botón interactivo con estado transicional (`Copiar` ➔ `¡Copiado!`), retroalimentación toast flotante tipo cápsula y tarjeta de aviso ámbar recordando el PIN de 4 dígitos.
5. **Hoja de Compartir iOS (Share Sheet) Auténtica**: Panel deslizable inferior (`slide-up` con `cubic-bezier` y backdrop con blur) con tirador superior, tarjeta de vista previa con datos del dispositivo, accesos directos a apps (AirDrop con `navigator.share`, WhatsApp con texto codificado, Mensajes SMS, Correo) y acciones agrupadas ('Copiar enlace', 'Abrir en navegador').
6. **Acción Principal 'Listo' e Indicador Home**: Botón inferior de ancho completo con color turquesa institucional (`#00C7BE`), barra home indicator táctil y adaptación a `env(safe-area-inset-bottom)`.

---

## 15. Estandarización de Modales Inmersivos Full-Screen / Studio (ShareDeviceModal y ContractDocPreviewModal)

### El Problema
Existían discrepancias funcionales y visuales entre los dos componentes inmersivos de la plataforma (`ContractDocPreviewModal` en Contratos y `ShareDeviceModal` en Dispositivos):
* `ContractDocPreviewModal` carecía de listener para la tecla `Escape`, no permitía cerrar haciendo clic sobre el backdrop oscuro exterior, y no invocaba el hook oficial del sistema `useAdminScrollLock(isOpen)`, dependiendo de selectores CSS estáticos.
* `ShareDeviceModal` poseía una estructura visual no estandarizada: contenía barras de estado simuladas con reloj estático redundante frente al sistema operativo real, carecía de botón de cierre `X` en la cabecera superior derecha, no implementaba el estándar de cabecera con badge de estado y botón de retorno retroactivo (`ArrowLeft`), y en escritorio no compartía la misma experiencia de overlay con backdrop oscuro y blur (`rgba(15, 23, 42, 0.78)` + `backdrop-filter: blur(8px)`).

### Solución Implementada
Se estandarizó la arquitectura inmersiva en ambos componentes:
1. **Patrón de Overlay y Contenedor Unificado**:
   * En **Móvil (`< 768px`)**: Ambos visores ocupan el 100% de la pantalla (`100vw` × `100dvh`, sin bordes ni padding perimetral), ocultando por completo las barras de navegación (`.mobile-header`, `.mobile-bottom-nav`) mediante CSS y montaje en portal (`createPortal(..., document.body)` a `z-index: 99999`).
   * En **Escritorio (`>= 768px`)**: Ambos visores muestran un overlay con desenfoque de fondo (`rgba(15, 23, 42, 0.78)` + `backdrop-filter: blur(8px)`) y centran un contenedor tipo estudio con esquinas redondeadas (`border-radius: 1.25rem`), sombra profunda y animación de entrada fluida (`cubic-bezier(0.16, 1, 0.3, 1)`).
2. **Control de Desplazamiento y Cierre Predictible**:
   * Bloqueo de scroll global mediante el hook unificado `useAdminScrollLock(isOpen)` en ambos modales.
   * Cierre al hacer clic en el backdrop overlay (`onClick={onClose}` con `stopPropagation` en el contenedor).
   * Cierre mediante la tecla `Escape` (en `ShareDeviceModal` desciende primero la hoja de compartir si está desplegada).
3. **Cabecera Estandarizada e Inline**:
   * Botón de retorno redondeado con icono de flecha hacia la izquierda (`ArrowLeft`, 38×38px, `border-radius: 0.75rem`).
   * Distribución en una sola línea horizontal: Título principal `Link /`, placa/identificador del dispositivo en tipografía monoespaciada, y badge de estado `● ACTIVO` con dot pulsante brillante.
   * Acciones derechas consistentes: botón de utilidad (`Share2`) y botón de cerrar (`X`), ambos con formato homogéneo de 38×38px y esquinas redondeadas de 0.75rem.

---

## 16. Estandarización y Desduplicación de Buscador `.search-ios` y Filtros

### El Problema
Existía duplicidad de estilos CSS idénticos para el buscador y filtros iOS:
* Las clases base del buscador (`.search-ios`, `.search-ios-icon`, `.search-ios-input`, `.search-ios-input:focus`, `.search-ios-input::placeholder`, `.search-ios-clear`, `.search-ios-clear:hover`) y de los botones de filtro (`.filter-pills-ios`, `.filter-pill-ios`, `.filter-pill-ios:hover`, `.filter-pill-ios.active`) se encontraban declaradas de forma idéntica y simultánea en tres archivos: `client/src/index.css`, `client/src/pages/DeviceSelector.css` y `client/src/pages/PaymentSummary.css`.
* Este patrón se originó históricamente cuando cada pantalla se desarrolló de forma independiente. Tras la extracción del componente transversal `SearchAndFilterBar.jsx` y su inclusión en `index.css`, las declaraciones locales antiguas no fueron retiradas, generando deuda técnica, incremento innecesario en el bundle y potenciales inconsistencias de especificidad.

### Solución Implementada
1. **Consolidación Canónica en `client/src/index.css`**:
   * Se unificó la definición de `.devices-filter-row-ios` y `.summary-filter-row-ios` bajo una sola regla flexbox compartida.
   * Se consolidaron los estilos de `.filter-pill-ios` (con transiciones completas de color, fondo, borde y sombra) y del buscador `.search-ios`.
   * Se enriqueció la interacción del botón de limpieza `.search-ios-clear` con una transición fluida en hover (`transition: background-color 0.15s ease`).
2. **Desduplicación en Hojas de Estilos de Página**:
   * **`DeviceSelector.css`**: Se eliminaron más de 100 líneas de código CSS duplicado, preservando únicamente la regla de maquetación contextual responsive en desktop (`.search-ios { max-width: 280px; margin-left: auto; }`).
   * **`PaymentSummary.css`**: Se eliminaron más de 60 líneas de reglas duplicadas, preservando únicamente las variantes semánticas por atributo de datos (`[data-filter='debt']`, `[data-filter='ok']`, `[data-filter='cutoff']`) y el ancho máximo en desktop (`.search-ios { max-width: 260px; }`).

---

## 17. Estandarización de Buscadores, Filter Pills, StatCards y Notificaciones Toast con Swipe-Up

### El Problema
1. **Dispersión en Buscadores y Filtros**:
   * Páginas como `Contracts.jsx` y `Payments.jsx` duplicaban dos barras de búsqueda y dos grupos de filtros por vista (uno para móvil dentro del menú colapsable con clases inline dispares de Tailwind y otro en escritorio con botones `.filter-btn`), mientras que `DeviceSelector`, `Invoices` y `PaymentSummary` ya consumían el componente transversal `SearchAndFilterBar`.
   * En `index.css`, se había fijado temporalmente `max-width: 260px` de forma global en `.search-ios`, lo cual recortaba artificialmente el buscador en dispositivos móviles en lugar de cubrir el 100% del contenedor.
2. **Inconsistencia en Tarjetas de Métricas (`StatCard`)**:
   * `Contracts.jsx` y `Payments.jsx` declaraban componentes inline y marcado manual con clases CSS legacy (`.contract-stat-card`, `.payment-stat-card`), impidiendo una apariencia homogénea con la cuadrícula de métricas del sistema iOS (`.stat-card-ios`).
3. **Notificaciones Toast Antiguas y No Interactivas**:
   * El sistema `showToast` utilizaba un diseño plano oscuro sin jerarquía visual, carecía de interacción táctil moderna, y no permitía cerrar las notificaciones mediante gestos naturales, forzando al usuario a esperar el temporizador automático.

### Solución Implementada
1. **Unificación y Universalización de `SearchAndFilterBar` en toda la plataforma**:
   * Se incorporó el wrapper contenedor `.search-filter-wrapper-ios` en `SearchAndFilterBar.jsx` y `index.css`: en móvil sitúa el buscador en ancho 100% seguido de los pills horizontales, y en escritorio (`>= 768px`) despliega los pills a la izquierda y el buscador compacto (`max-width: 280px`) alineado a la derecha.
   * **Cero Quiebres de Línea en Pills**: Se configuró `.filter-pills-ios` con `flex-wrap: nowrap; overflow-x: auto;` y `.filter-pill-ios` con `flex-shrink: 0; white-space: nowrap;`, garantizando una fila horizontal continua con desplazamiento táctil suave estilo iOS sin saltos de línea indeseados.
   * **Retiro de Restricciones Rígidas de Ancho**: Se eliminó la limitación fija `max-w-[380px]` en [Contracts.jsx](client/src/pages/Contracts.jsx), [Payments.jsx](client/src/pages/Payments.jsx) e [Invoices.jsx](client/src/pages/Invoices.jsx), permitiendo que la barra y los filtros ocupen el 100% del ancho del contenedor en cualquier tamaño de pantalla.
   * Se unificaron las clases de contexto (`devices-filter-row-ios`, `summary-filter-row-ios`) bajo la regla base transversal `.filter-row-ios`, y se añadió un slot flexible para acciones complementarias (`extraActions` / `children`).
2. **Evolución y Homologación de `StatCard.jsx` al Estilo Minimalista iOS**:
   * Se estandarizó la apariencia de las métricas siguiendo el diseño de [DeviceSelector.jsx](client/src/pages/DeviceSelector.jsx): tarjetas limpias y compactas con título superior en 9px mayúsculas (`uppercase-title-ios`), espaciado uniforme y cifra numérica central destacada (22px / 18px en móvil) centrada en el eje.
   * **Retiro de Cajas de Iconos en Listados Compactos**: Se eliminaron los iconos laterales voluminosos en las cuadrículas de 4 columnas de [Contracts.jsx](client/src/pages/Contracts.jsx) y [Payments.jsx](client/src/pages/Payments.jsx) que provocaban que los títulos se truncaran a una sola letra ("T...", "A...", "C...", "V...") y los números quedaran recortados.
   * **Cuadrícula Responsive Simétrica**: Se unificaron las clases `.devices-stats-ios`, `.contracts-stats-grid` y `.payments-stats-grid` en [index.css](client/src/index.css) con `repeat(4, minmax(0, 1fr))` y gap adaptable (0.3rem - 0.5rem), y cifras monetarias formateadas con `formatCompactCOP` para garantizar lectura completa y armonía visual idéntica a iOS.
3. **Rediseño Completo de Notificaciones Toast (Cápsula Full-Pill Estilo WhatsApp / iOS) con Gesto Swipe-Up y Aislamiento de Eventos**:
   * **Estética Cápsula Full-Pill (Inspirada en WhatsApp iOS)**:
     - Formato píldora continua (`border-radius: 9999px`) con ancho adaptativo al contenido (`width: fit-content; max-width: min(92vw, 440px)`), centrada ergonómicamente en la zona superior.
     - Fondo negro carbón mate (`#242426`) con sombra difusa flotante (`box-shadow: 0 10px 28px -4px rgba(0, 0, 0, 0.45)`) y borde sutil (`border: 1px solid rgba(255, 255, 255, 0.09)`), sin barras ni tiradores artificiales que recarguen la vista.
     - Fila horizontal compacta: icono vectorial de estado a la izquierda (`success`, `error`, `warning`, `info`), tipografía blanca nítida (`#ffffff`) con separador sutil entre título y mensaje, y botón interior integrado tipo pastilla (`.toast-action-btn`) con resalte cromático de marca (`#25D366` verde para confirmación, `#FF453A` para error, `#0A84FF` para info).
   * **Gesto Swipe-Up Interactivo**: Detección nativa mediante Pointer Events (`pointerdown`, `pointermove`, `pointerup`). Al deslizar hacia arriba, la píldora acompaña el movimiento del dedo/cursor en tiempo real con atenuación de opacidad. Si se supera el umbral (-20px), se expulsa suavemente hacia arriba con animación `cubic-bezier` y se desvanece del DOM.
   * **Aislamiento de Eventos y Escudo contra Ghost Clicks**:
     - Detención estricta de propagación (`e.stopPropagation()`) en todos los eventos de interacción (`pointerdown`, `pointermove`, `pointerup`, `click`, `mousedown`, `mouseup`, `touchstart`, `touchend`), evitando activación de elementos debajo.
     - Escudo temporal (`shieldGhostClicks`) con fase de captura global en `window` durante 400ms tras el descarte táctil, neutralizando clics sintéticos retardados emitidos por navegadores móviles.

---

## 18. Arquitectura Desacoplada y Modular de Cabeceras (`PageHeader.Desktop` / `PageHeader.Mobile` y `useIsMobile`)

### El Problema
1. **Acoplamiento Rígido y Props Ambiguas**:
   * El componente monolítico `PageHeader` intentaba orquestar simultáneamente el layout de escritorio (Breadcrumbs, títulos `<h1>`, subtítulos, botones a la derecha) y el comportamiento móvil (inyección de acciones al Topbar `#mobile-header-actions` mediante portales, toggles de filtro y barras colapsables).
   * Esto obligaba a pasar props duplicadas o confusas (`actions`, `desktopActions`, `mobileActions`, `mobileLeadingActions`), creando confusión sobre cuál componente controlaba qué parte del árbol DOM.
2. **Renderizado Innecesario y Parches CSS**:
   * En múltiples páginas (como `CompanyInvoices.jsx` o `Invoices.jsx`), el árbol DOM de escritorio se montaba en el DOM móvil y luego se intentaba ocultar mediante reglas CSS inline como `@media (max-width: 768px) { .page-header { display: none !important; } }`.
   * En otras páginas como `PaymentSummary.jsx` o `Reports.jsx`, los selectores de fecha se renderizaban dos veces en el JSX para satisfacer escritorio y móvil, aumentando la complejidad del estado y del marcado.

### Solución Implementada
1. **Hook Reactivo `useIsMobile(breakpoint = 768)`**:
   * Se creó `client/src/hooks/useIsMobile.js` utilizando la API estándar y de alto rendimiento `window.matchMedia('(max-width: 768px)')` con listener reactivo `change`, garantizando una detección de dispositivo sin lecturas forzadas de layout ni desbordamiento de repaints.
2. **Subcomponentes Especializados en `PageHeader.jsx`**:
   * **`PageHeader.Desktop` (`DesktopPageHeader`)**: Renderiza exclusivamente la barra horizontal de escritorio con `Breadcrumbs`, título semántico, subtítulo, botones secundarios/primarios a la derecha (`actions`) y slots complementarios (`leadingActions`).
   * **`PageHeader.Mobile` (`MobilePageHeader`)**: Gestiona la inyección limpia de acciones táctiles (`onFilterToggle`, `onRefresh`, `actions`, `leadingActions`) en el contenedor Topbar `#mobile-header-actions` mediante `createPortal`, además de permitir renderizar barras secundarias móviles personalizadas como `children`.
   * **Compatibilidad Retrospectiva**: `PageHeader` por defecto delega en ambos subcomponentes preservando compatibilidad en caso de ser necesario.
3. **Estandarización Universal en las 11 Páginas de la Aplicación**:
   * Se aplicó la filosofía estricta de separación:
     ```jsx
     const isMobile = useIsMobile();
     const desktopHeader = ( <PageHeader.Desktop ... /> );
     const mobileHeader = ( <PageHeader.Mobile ... /> );
     const renderHeader = isMobile ? mobileHeader : desktopHeader;
     ...
     return <div className="...">{renderHeader} ...</div>;
     ```
   * **Páginas Estandarizadas**:
     - `PaymentSummary.jsx`: Selectores de fecha abstraídos en función `renderDateSelectors(isMobileView)` y cabeceras desacopladas.
     - `Reports.jsx`: Selectores de fecha integrados limpiamente sin duplicidad de marcado.
     - `AdminDashboard.jsx`: Selectores de fecha y reporte descargable separados por plataforma.
     - `Invoices.jsx`: Selectores de fecha, paginador y acciones desacopladas.
     - `Payments.jsx`: Acciones de exportación, refresco y mini-paginador desacoplados.
     - `DeviceSelector.jsx`: Métricas expandibles y refresco desacoplados.
     - `Contracts.jsx`: Título, breadcrumbs y acciones de filtro desacopladas.
     - `Users.jsx`: Botón "Agregar Usuario" desacoplado entre `.btn-primary` (desktop) y `.btn-mobile-header-action` (móvil).
     - `Companies.jsx`: Acciones dinámicas de pestaña desacopladas limpiamente.
     - `CompanyInvoices.jsx`: Removido el hack CSS inline `@media (max-width: 768px)` y desacoplado de forma nativa.
     - `Settings.jsx`: Botón "Guardar" desacoplado entre barra desktop y topbar móvil.

---

## 19. Badges Flotantes (Globo iOS) en Pills de Filtro (`SearchAndFilterBar`)

### El Problema
En vistas con filtros de estado densos (como `PaymentSummary.jsx`), no existía indicación visual cuantitativa de cuántos elementos correspondían a cada categoría ("Todos", "Con deuda", "Al día", "Apagados"). Para conocer cuántas motos tenían deuda o estaban apagadas, el usuario debía activar manualmente cada filtro o recurrir a cuadrículas de tarjetas `StatCard` que consumen un área vertical significativa en pantallas móviles.

### Solución Implementada
1. **Componente Reutilizable `SearchAndFilterBar`**:
   * Se extendió el mapeo de `filterOptions` para admitir props opcionales `badge` (número o valor a mostrar) y `badgeType` (`'all'`, `'debt'`, `'ok'`, `'cutoff'`).
   * Cuando se suministra `badge`, el componente inyecta un elemento `span.filter-pill-badge` en la esquina superior derecha del botón.
2. **Estilos de Globo Flotante iOS en `index.css` y `PaymentSummary.css`**:
   * **Posicionamiento**: `position: absolute; top: -6px; right: -5px; min-width: 17px; height: 17px;` con `border-radius: 9999px` y borde blanco nítido (`1.5px solid #ffffff`).
   * **Variantes de Color**:
     - `badge-debt`: Rojo coral `#e5302e` para identificar morosos con deuda.
     - `badge-ok`: Verde esmeralda `#1b9e3e` para motos al día.
     - `badge-cutoff`: Gris carbón `#414755` para motos con corte de motor activo.
     - `badge-all`: Azul sistema `#0070eb` para el total general.
   * **Inversión Cromática de Contraste Activo**: Cuando el pill está seleccionado (`.active`), el fondo del badge pasa a blanco nítido (`#ffffff`) con texto y borde del color de la categoría, garantizando legibilidad y sofisticación visual sin saturar el botón.
   * **Espaciado y Scroll Suave**: Ajuste de `gap: 0.65rem - 0.75rem` y `padding-top: 6px - 8px` en `.filter-pills-ios` para que los globos respiren y no se corten en el contenedor deslizable.
3. **Cálculo Reactivo en `PaymentSummary.jsx`**:
   * Integración de `okCount` (motos con deuda cero) y `cutoffCount` (motos con `cutOff: true` obtenido vía `getDeviceStatus`) con `useMemo`, actualizándose reactivamente con los eventos SSE de telemetría y pagos.

---

## 21. Iconografía Telemétrica en Tarjetas del Centro de Alertas

### El Problema
Las tarjetas del feed telemétrico mostraban etiquetas de texto extensas (`Motor: BLOQUEADO`, `Switch: APAGADO`, `Velocidad: 30 km/h`, `Batería: 100%`) que generaban saturación visual, saltos de línea irregulares y desbordamiento en pantallas móviles.

### Solución Implementada
* Reemplazo de chips textuales por una cuadrícula estructurada de 4 celdas horizontales con iconografía semántica (`MotorIcon`, `KeyRound`, `Gauge`, `BatteryFull/Medium/Low/ZapOff`).
* Resaltado contextual con fondos semánticos (`highlight-rose` para corte activo, switch ON con corte, velocidad > 0 km/h y batería baja).
* Umbral de tiempo adaptativo: formato relativo (`Hace X min`) para $\le 30$ minutos y hora exacta (`11:45 a. m.`, `12 nov 03:15 p. m.`) para incidencias de más de 30 minutos.
* Unificación del botón de acción principal `.btn-incident-primary` (*"Resolver"*) con los tokens de marca (`var(--brand-teal)` y hover `var(--brand-teal-dark)`).

---

## 22. Consola Desktop Split (Feed 65% + Inspector Telemétrico 35%) en Centro de Alertas

### El Problema
En monitores de escritorio o consolas de despacho ($\ge 1200\text{px}$), el feed de alertas se estiraba en una sola columna ancha con excesivo espacio negativo y obligaba al despachador a navegar fuera de la vista para inspeccionar la ubicación en mapa, verificar los datos del conductor o disparar comandos de corte de motor.

### Solución Implementada
1. **Layout Split Responsive (`.alerts-workspace-split`)**:
   * En pantallas grandes ($\ge 1200\text{px}$), se despliega una consola de despacho de 2 columnas:
     - **Columna izquierda (65%)**: Feed interactivo de tarjetas de incidente con selección activa y filtros rápidos.
     - **Columna derecha (35%)**: Inspector telemétrico sticky (`top: 75px`).
   * En pantallas móviles ($< 1200\text{px}$), el inspector lateral se oculta limpiamente y el feed mantiene la experiencia compacta optimizada.
2. **Tarjeta de Rastreo GPS en Vivo con HUD**:
   * Integración de canvas de mapa interactivo centrado en las coordenadas del vehículo (`latitude`, `longitude`).
   * HUD flotante con dirección / referencia, chip de velocidad en tiempo real y enlace directo a Google Maps.
3. **Ficha de Despacho Rápido & Comandos IoT**:
   * Conexión con `getActiveContract` para cargar automáticamente nombre del conductor, cédula, teléfono con llamada rápida (`tel:...`) y número de contrato del vehículo seleccionado.
   * **Comandos IoT Inmediatos**: Botón de "Corte Inmediato de Motor (Relé 1)" / "Reanudar Motor" conectado directamente al endpoint `POST /commands/send` con diálogo de confirmación y feedback visual.
   * **Bitácora de Despacho**: Área de texto para registro de notas de auditoría y guardado inmediato en el historial de la alerta.
   * **Mini-Timeline de Eventos**: Registro cronológico de disparos, eventos acumulados y estado de atención del incidente.

---

## 23. Unificación de Colores, Tokens y Estandarización de Clases en Settings

### El Problema
La página de configuración (`Settings.jsx` y `Settings.css`) acumulaba divergencias de estilo derivadas de prototipos independientes:
- Presencia de paletas externas ajenas al sistema (azules Tailwind Material-3 `#006194`, `#007bb9`, `#0051d5`, `#eff4ff`, `#e5eeff` y cyans `#06b6d4`, `#0891b2`, `#ecfeff`).
- Más de 50 ocurrencias de estilos inline (`style={{ color: '#0d9488' }}`, etc.) sobrecargando el componente React.
- Redundancia y sobreespecificidad en `Settings.css` (superando 1,900 líneas con duplicaciones de tarjetas, encabezados, inputs y switches).

### Solución Implementada
1. **Adopción de Tokens Globales de AdminPocketbike**:
   * Color de marca centralizado: `var(--brand-teal, #03C9D7)`, `var(--brand-teal-dark, #0394A3)`, y `rgba(var(--brand-teal-rgb), 0.1)`.
   * Tarjetas homologadas: bordes `var(--card-border, #E5E7EB)`, radio `var(--card-radius, 0.75rem)` y sombras suaves.
   * Estados y validaciones unificados: verde esmeralda `#10B981` para estados activos/conectados y rojo `#EF4444` para desconexiones o errores.
2. **Estandarización de Controles**:
   * Pestañas superiores (`.tab-button`), botones de acción (`.btn-save`, `.btn-validate-traccar`, `.btn-sync-devices`) y switches táctiles integrados con los tokens oficiales.
   * Inputs, selects e input groups estilizados con foco en `var(--brand-teal)` y anillos de foco translúcidos.
3. **Limpieza y Desduplicación**:
   * Eliminación total de estilos inline con colores fijos en `Settings.jsx`.
   * Reorganización modular de `Settings.css` en 13 secciones limpias, reduciendo su tamaño de 1,918 líneas a ~740 líneas (~61% de reducción de código).








