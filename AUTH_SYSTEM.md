# Sistema de autenticación y autorización

Estado: documento activo. Revisado el 2026-07-20.

## Mecanismos vigentes

La aplicación usa JWT con dos contextos principales:

- usuario administrativo: identidad, rol, permisos, compañía activa y acceso multiempresa;
- dispositivo: identificadores de dispositivo, contrato activo y compañía.

Las contraseñas de `User` y el `devicePin` de `Contract` se almacenan con bcrypt. `DeviceAccess` ofrece además accesos por PIN con expiración y límite de usos.

## Flujo administrativo

1. `POST /apinode/auth/login` recibe `email` y `password`.
2. El servicio verifica el usuario local activo y compara el hash.
3. Se emite un JWT y se devuelven usuario y compañías accesibles.
4. `AuthProvider` guarda sesión en `localStorage` o `sessionStorage`.
5. El interceptor Axios agrega `Authorization: Bearer <token>`.
6. `AdminLayout` redirige a `/#/admin/login` cuando no hay sesión.

`POST /apinode/auth/switch-company` valida el acceso y emite un token nuevo con la compañía seleccionada.

## Flujo de dispositivo

El backend vigente expone `POST /apinode/auth/pin-login` con:

```json
{
  "deviceIdName": "IDENTIFICADOR_DEL_DISPOSITIVO",
  "pin": "PIN_SUMINISTRADO_DE_FORMA_SEGURA"
}
```

Busca el contrato activo, compara su PIN y emite un token de dispositivo. No se deben incluir PIN reales en ejemplos, fixtures compartidos o logs.

## Endpoints de autenticación

- `POST /apinode/auth/register`: requiere JWT y administrador.
- `POST /apinode/auth/login`: público.
- `POST /apinode/auth/pin-login`: público; valida contrato y PIN.
- `POST /apinode/auth/create-device-pin`: requiere JWT y administrador.
- `GET /apinode/auth/me`: requiere JWT.
- `POST /apinode/auth/verify-token`: recibe el token en el cuerpo.
- `POST /apinode/auth/switch-company`: requiere JWT.

## Roles y permisos

Los roles persistidos son `admin`, `manager` y `viewer`. El middleware impide mutaciones del rol `viewer`, salvo excepciones explícitas. `requireAdmin` y `requirePermission` agregan controles más estrictos cuando una ruta los aplica.

No debe asumirse que todas las rutas administrativas están protegidas de la misma forma. Actualmente conviven `authenticate` y `verifyToken`; cada router debe auditarse al modificar autorización.

## Inconsistencias vigentes que requieren intervención separada

- El cliente de `verifyDevicePin` apunta a `/auth/device-pin`, mientras el servidor monta `/auth/pin-login`.
- El contexto frontend envía nombres de campos y espera una forma de respuesta diferentes a las implementadas por el controlador de dispositivo.
- El tipo del token administrativo se genera como `user`, pero algunos controles antiguos comparan con `admin`.
- Conviven dos middlewares JWT con estructuras de compatibilidad distintas.
- Hay rutas de otros dominios sin un patrón de protección uniforme.

Estas observaciones son hallazgos, no correcciones realizadas. Deben resolverse bajo una intervención autorizada, con pruebas de login, persistencia, expiración, cambio de compañía y acceso por dispositivo.

## Reglas de seguridad

- No registrar tokens, contraseñas, PIN ni secretos.
- No usar valores predeterminados inseguros en producción.
- Rotar cualquier secreto que haya sido incorporado al historial o al código.
- Validar compañía además de autenticación en consultas multiempresa.
- Invalidar la sesión local cuando el servidor rechace el token de forma definitiva.
- No documentar credenciales de prueba reutilizables.

Para ejecutar el flujo local sin credenciales predefinidas consulta [AUTH_QUICKSTART.md](AUTH_QUICKSTART.md).
