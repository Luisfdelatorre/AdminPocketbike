# Snapshot histórico: autenticación inicial

Estado: histórico y no normativo. Archivado en la auditoría del 2026-07-20.

Este archivo registraba el cierre de una fase anterior del sistema de autenticación. Sus porcentajes de avance, endpoints, puertos, ejemplos y credenciales ya no describen de forma fiable la aplicación actual.

## Valor histórico

La fase introdujo conceptos que permanecen en el proyecto:

- usuarios con contraseña hasheada;
- JWT para administración y dispositivos;
- roles y permisos;
- PIN asociado a acceso de dispositivo;
- middleware de autenticación y autorización.

La implementación evolucionó después hacia multiempresa, contratos como fuente de PIN, dos variantes de middleware y un frontend React integrado.

## No usar como guía operativa

- No contiene credenciales válidas ni debe volver a contenerlas.
- No garantiza que sus rutas o payloads estén montados.
- No certifica cobertura de seguridad ni estado de producción.

Fuentes vigentes:

- [AUTH_SYSTEM.md](AUTH_SYSTEM.md)
- [AUTH_QUICKSTART.md](AUTH_QUICKSTART.md)
- `server/routes/auth.js`
- `server/services/authService.js`
- `client/src/context/AuthContext.jsx`
