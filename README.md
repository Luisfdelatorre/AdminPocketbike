# AdminPocketbike / Payments-Wompi

Estado: documentación operativa activa. Revisada el 2026-07-20.

Aplicación para administrar dispositivos, contratos, facturas y pagos de Pocketbike. El panel administrativo está construido con React y Vite; la API usa Express y MongoDB; la página pública de pago se sirve también desde el mismo proyecto.

## Requisitos

- Node.js `>= 20.18.1`.
- npm.
- Acceso a MongoDB. En desarrollo compartido se usa un túnel local en `127.0.0.1:27018`.
- Variables y credenciales de los servicios externos suministradas por el responsable del entorno. No deben documentarse ni incorporarse al repositorio.

## Puesta en marcha

```bash
npm ci
npm run dev:all
```

`dev:all` inicia:

- el túnel hacia la base compartida;
- la API en `http://localhost:8084`;
- Vite en `http://localhost:5173`.

La API se consume con el prefijo `/apinode`; Vite redirige ese prefijo a la API. La ruta pública de pago usa `/p` y la navegación del cliente usa hash routing.

Si el túnel ya está activo en otra terminal, se pueden iniciar por separado:

```bash
npm run dev:api
npm run dev
```

No ejecutes `npm run init-db` contra la base compartida sin autorización explícita: es una operación de inicialización, no un requisito normal para desarrollar.

## Comandos principales

```bash
npm run dev             # Vite en 5173
npm run dev:api         # API en 8084
npm run dev:db-tunnel   # Túnel MongoDB en 27018
npm run dev:all         # Túnel + API + frontend
npm test                # Pruebas con node:test
npm run build           # Compilación de producción en dist/
npm run preview         # Vista previa de la compilación en 4173
npm run create-admin    # Creación interactiva de administrador
```

## Estructura

```text
client/                 React, Vite y página pública de pago
server/                 API, dominio, persistencia e integraciones
scripts/                Operación, mantenimiento y migraciones puntuales
tests/                  Pruebas automatizadas
dist/                   Resultado de compilación; no es fuente
```

Consulta [DOCUMENTATION_INDEX.md](DOCUMENTATION_INDEX.md) para saber qué documento aplica a cada intervención y cuál material es únicamente histórico. Las reglas obligatorias de trabajo están en [AGENTS.md](AGENTS.md).

## Verificación mínima

Antes de entregar código:

```bash
npm test
npm run build
```

La validación debe ajustarse al riesgo del cambio. Para problemas de conexión, verifica primero el túnel a `127.0.0.1:27018` y después la API.
