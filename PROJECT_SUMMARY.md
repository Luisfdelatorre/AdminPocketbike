# Resumen técnico de AdminPocketbike

Estado: resumen activo. Revisado el 2026-07-20.

## Propósito

AdminPocketbike centraliza la administración de compañías, usuarios, dispositivos, contratos, facturas diarias y pagos. Integra el cobro con Wompi y la activación o control de dispositivos mediante proveedores GPS.

## Arquitectura actual

- Frontend administrativo: React 19, React Router y Vite.
- Página de pago: entrada independiente dentro del cliente y ruta pública `/p`.
- Backend: Express con capas de rutas, controladores, servicios y repositorios.
- Persistencia: MongoDB mediante Mongoose.
- Desarrollo: Vite `5173`, API `8084`, MongoDB por túnel `127.0.0.1:27018`.
- API: prefijo común `/apinode`.

## Módulos vigentes

- Autenticación JWT para administración y acceso por dispositivo.
- Gestión multiempresa y cambio de compañía activa.
- Dispositivos y sincronización con proveedores GPS.
- Contratos, reglas de cobro, días libres, frecuencia y excepciones operativas.
- Facturación diaria, ajustes, conciliación y exportaciones.
- Pagos, Wompi, webhooks y eventos SSE.
- Dashboard agregado por compañía y periodo.

## Fuentes de verdad

El código, las configuraciones y los modelos tienen prioridad frente a descripciones históricas. Usa:

- [AGENTS.md](AGENTS.md) para el proceso obligatorio.
- [DOCUMENTATION_INDEX.md](DOCUMENTATION_INDEX.md) para decidir qué documentos consultar.
- [ARCHITECTURE.md](ARCHITECTURE.md) para capas y flujos.
- [DATABASE_RELATIONSHIPS.md](DATABASE_RELATIONSHIPS.md) para relaciones persistidas.

## Riesgos y deuda técnica observada

La auditoría documental encontró aspectos que deben tratarse como intervenciones de código independientes:

- existen rutas declaradas más de una vez o clientes que apuntan a endpoints distintos de los montados en el servidor;
- algunos archivos de configuración contienen secretos o valores sensibles embebidos;
- conviven dos middlewares JWT con contratos parcialmente diferentes;
- algunos comentarios internos aún muestran el prefijo anterior `/api`;
- ciertos campos de modelos aparecen duplicados o tienen semántica heredada.

Este documento no certifica esos puntos como corregidos. Cualquier arreglo requiere resumen previo, autorización, rama propia y validación conforme a [AGENTS.md](AGENTS.md).

## Estado del plan visual

Las mejoras visuales se administran como especificaciones incrementales en [INCOHERENCIAS_DISENO.md](INCOHERENCIAS_DISENO.md). Su índice es la referencia para saber qué intervención ya fue completada y cuál sigue pendiente.
