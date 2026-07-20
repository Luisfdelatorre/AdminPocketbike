# Inicio rápido de desarrollo

Estado: guía activa. Revisada el 2026-07-20.

## 1. Preparar el repositorio

```bash
npm ci
```

Usa Node.js `>= 20.18.1`. Las credenciales y variables privadas deben obtenerse por el canal seguro del proyecto; no se copian desde documentos ni se agregan a Git.

## 2. Iniciar el entorno completo

```bash
npm run dev:all
```

Abre `http://localhost:5173`. El comando conserva en la misma terminal el túnel MongoDB, la API en `8084` y Vite en `5173`; `Ctrl+C` detiene los tres procesos.

Si necesitas controlar cada proceso:

```bash
npm run dev:db-tunnel
npm run dev:api
npm run dev
```

Ejecuta cada comando en una terminal distinta. La conexión esperada por el servidor es `mongodb://127.0.0.1:27018/payments-wompi-pocketbike`.

## 3. Comprobar disponibilidad

```bash
curl http://localhost:8084/apinode/health
```

Desde el frontend, las solicitudes deben usar rutas relativas bajo `/apinode`; Vite las envía a `8084`.

## 4. Autenticación local

Para crear un administrador usa el flujo interactivo:

```bash
npm run create-admin
```

No hay credenciales predeterminadas documentadas. El acceso administrativo está en `http://localhost:5173/#/admin/login`.

## 5. Validar cambios

```bash
npm test
npm run build
```

Para reglas de ramas, autorización y commits, consulta [AGENTS.md](AGENTS.md). Para navegación documental, consulta [DOCUMENTATION_INDEX.md](DOCUMENTATION_INDEX.md).

## Diagnóstico rápido

- Error de MongoDB: verifica que el túnel escuche en `127.0.0.1:27018`.
- `5173` ocupado: detén el proceso anterior; `dev:all` usa `--strictPort` para evitar abrir otra instancia silenciosamente.
- Error `401`: confirma que la solicitud lleve `Authorization: Bearer <token>` y que el token no haya vencido.
- Error de proxy: comprueba primero `http://localhost:8084/apinode/health`.

No ejecutes scripts de inicialización, restauración o migración sobre la base compartida sin revisar su alcance y obtener autorización explícita.
