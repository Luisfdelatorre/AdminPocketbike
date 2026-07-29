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
| **8** | Rediseño Visual iOS de AdminDashboard | 🧪 En validación | Maquetación con filtros superiores compactos, grid de 2 tarjetas primarias, 3 tarjetas secundarias compactas con resaltado naranja en pendientes y tabla de pagos recientes con badges estilo pill en verde y gris. |
| **9** | Rediseño Visual iOS de DeviceSelector | 🧪 En validación | Stats bar visible en móvil (3 columnas), filtros tipo pill con `#0070eb` activo, búsqueda iOS (`#f3f3f4`), tabla con banda de encabezado y filas iOS, badges de estado sistema (verde/rojo/gris), motor con colores de sistema. |

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

#### Implementación de la intervención 7.2

El header móvil mantiene el scroll interno de `.admin-content` y el footer sin cambios. Ahora usa `position: sticky` y `flex: 0 0 auto` con una altura mínima que incluye la safe area superior, en lugar de una altura y un `flex-basis` rígidos. Si el título o las acciones necesitan más espacio, el header crece y reserva esa altura en el shell sin requerir padding por página.

#### Beneficios de la corrección:
1. **Eliminación de código redundante:** Se eliminan los parches de `padding-top: 60px` y `padding-bottom: 75px` repetidos de forma manual en múltiples páginas CSS.
2. **Consistencia Visual:** El cabecero y la barra inferior de navegación móvil estarán perfectamente delimitados y nunca taparán dinámicamente ningún elemento interactivo de las vistas (como botones de guardado, filtros o formularios).
3. **Mantenibilidad:** El uso de áreas de respeto (`safe-area-inset-bottom` / `top`) se puede centralizar en las zonas de cabecera y pie de página móviles, facilitando el soporte de teléfonos con pantallas curvas o con notches.
