# Inicio rápido de autenticación

Estado: guía activa. Revisada el 2026-07-20.

## Preparación

Inicia el entorno y crea un administrador mediante el comando interactivo:

```bash
npm run dev:all
npm run create-admin
```

Ejecuta el segundo comando en otra terminal. No copies credenciales a este documento ni al repositorio.

## Login administrativo

Interfaz: `http://localhost:5173/#/admin/login`.

Solicitud directa:

```bash
curl -X POST http://localhost:8084/apinode/auth/login \
  -H 'Content-Type: application/json' \
  -d '{"email":"USUARIO_AUTORIZADO","password":"CONTRASENA_SEGURA"}'
```

Usa el token devuelto en rutas protegidas:

```bash
curl http://localhost:8084/apinode/auth/me \
  -H 'Authorization: Bearer TOKEN'
```

## Login de dispositivo

El contrato debe estar activo y tener un PIN configurado. El endpoint montado en el backend es:

```bash
curl -X POST http://localhost:8084/apinode/auth/pin-login \
  -H 'Content-Type: application/json' \
  -d '{"deviceIdName":"DISPOSITIVO","pin":"PIN"}'
```

Advertencia: la integración frontend de este flujo presenta actualmente una diferencia de endpoint, payload y respuesta frente al backend. Consulta [AUTH_SYSTEM.md](AUTH_SYSTEM.md) antes de probarla desde la pantalla y no interpretes un fallo del cliente como prueba de que el PIN o el contrato son inválidos.

## Cambio de compañía

```bash
curl -X POST http://localhost:8084/apinode/auth/switch-company \
  -H 'Content-Type: application/json' \
  -H 'Authorization: Bearer TOKEN' \
  -d '{"targetCompanyId":"COMPANY_OBJECT_ID"}'
```

La respuesta entrega un token nuevo. El cliente debe reemplazar el token anterior para que las solicitudes siguientes usen el nuevo alcance.

## Diagnóstico

- `400`: faltan campos requeridos.
- `401`: credenciales, PIN o token inválidos o vencidos.
- `403`: rol, permiso o compañía no autorizados.
- Dispositivo sin acceso: confirma que existe un contrato `ACTIVE` para `deviceIdName`.

No desactives middleware ni agregues credenciales fijas para sortear errores locales. Verifica primero la ruta, la forma del payload y el alcance del token.
