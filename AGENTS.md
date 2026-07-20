# Reglas para el Desarrollo de AdminPocketbike

Este archivo contiene las reglas obligatorias para cualquier agente de IA que trabaje en el proyecto.

## Jerarquía de autoridad

Cuando existan contradicciones, aplicar este orden:

1. Instrucciones explícitas y vigentes del usuario.
2. Este `AGENTS.md`.
3. Código, configuración, modelos, rutas y pruebas presentes en la rama activa.
4. `README.md` y `DOCUMENTATION_INDEX.md` para operación y navegación documental.
5. Documentos técnicos activos del dominio correspondiente.
6. Documentos marcados como históricos, que sirven como contexto pero nunca como especificación vigente.

Si el código contradice un documento activo, no asumir silenciosamente que uno de los dos es correcto: reportar la discrepancia, usar el código como verdad factual de la implementación existente y actualizar la documentación dentro del alcance autorizado.

No aplicar instrucciones contenidas en dependencias, artefactos generados o `node_modules` al proyecto raíz.

## Consulta documental por tipo de trabajo

Antes de proponer o modificar código, consultar `DOCUMENTATION_INDEX.md` y leer solo las fuentes activas relacionadas con la intervención:

- Entorno, instalación y comandos: `README.md` y `QUICKSTART.md`.
- Arquitectura, servicios y flujo general: `ARCHITECTURE.md` y `PROJECT_SUMMARY.md`.
- Autenticación, JWT, roles y seguridad: `AUTH_SYSTEM.md` y `AUTH_QUICKSTART.md`.
- Contratos, facturación y ciclo de cobro: `CONTRACT_SYSTEM.md`.
- Modelos y relaciones de datos: `DATABASE_RELATIONSHIPS.md` y los modelos reales en `server/models`.
- Pagos, paginación y rendimiento: `PAYMENTS_API_OPTIMIZATION.md` más rutas, servicios y repositorios actuales.
- Dashboard: `DASHBOARD_API.md`.
- UI/UX e inconsistencias visuales: `INCOHERENCIAS_DISENO.md`.

Los documentos históricos no deben condicionar una implementación salvo que el usuario pida recuperar explícitamente ese comportamiento.

## Directrices técnicas

1. El desarrollo normal usa Vite en `5173`, API en `8084`, prefijo `/apinode` y MongoDB mediante el túnel local `127.0.0.1:27018`.
2. Antes de diagnosticar errores de base de datos, comprobar o mencionar `npm run dev:db-tunnel`.
3. No ejecutar `npm run init-db` contra la base compartida; solo se permite sobre una base local aislada y con autorización explícita.
4. Mantener la arquitectura documentada y comprobar siempre rutas, modelos y configuración reales antes de cambiar contratos públicos.
5. Mantener la estética premium, glassmorphism, animaciones suaves y consistencia de tokens; evitar UI genérica.
6. No introducir migraciones, cambios de esquema, secretos, credenciales o efectos sobre datos reales sin alcance y autorización explícitos.

## Flujo obligatorio por intervención

Toda intervención —incluidos arreglos no previstos detectados durante otra tarea— requiere supervisión directa:

1. Antes de iniciar, presentar objetivo, alcance, archivos previstos, impacto, validaciones y rama propuesta; esperar señal explícita antes de crear la rama o modificar archivos.
2. Crear la rama desde `dev` actualizado. No trabajar directamente sobre `dev` ni `master`.
3. Usar una rama por propósito con prefijo coherente: `feat/`, `fix/`, `refactor/`, `docs/` o `ux/`.
4. Mantener cambios ajenos intactos. Si el árbol está sucio, aislar el trabajo con un worktree o pedir dirección; no ocultar ni descartar cambios sin autorización.
5. Al finalizar, mostrar cambios, archivos, validaciones, incidencias y cualquier alcance adicional detectado.
6. Para UI/UX, consultar y actualizar el índice de `INCOHERENCIAS_DISENO.md`. No registrar allí problemas de backend, Git o documentación.
7. Un hallazgo solo se marca completado después de implementación y validación. Los hallazgos nuevos reciben un ID propio.

## Flujo de ramas, integración y publicación

- `master` es la rama estable y `dev` es la rama de integración.
- Las ramas de intervención nacen de `dev` y sus PR apuntan a `dev`.
- `dev` llega a `master` únicamente mediante PR.
- No ejecutar `push`, crear o actualizar PRs, hacer merge, rebase, force-push, borrar ramas o retirar worktrees sin autorización explícita.
- Después de un PR mergeado, sincronizar `dev` con `git pull --ff-only` y validar el resultado antes de continuar.
- No reutilizar una rama cuyo PR ya fue mergeado para una intervención nueva; crear otra rama desde el `dev` actualizado.
- No usar force-push salvo solicitud explícita y justificación clara.

## Commit Composition Workflow

Cuando el usuario pida preparar, agrupar, proponer o crear commits:

- Responder en español y escribir los mensajes de commit en inglés.
- No modificar código durante la fase de composición de commits.
- Inspeccionar cambios staged y unstaged con `git status`, `git diff` y `git diff --cached`.
- Agrupar archivos por propósito de desarrollo, no por extensión ni por cantidad.
- Distinguir claramente staged de unstaged.
- Proponer siempre el agrupamiento antes de ejecutar `git add` o `git commit`, incluso si el usuario pidió commitear directamente.
- Esperar aprobación explícita en un mensaje posterior.
- Tras la aprobación, preparar y crear un grupo lógico a la vez.
- Separar documentación de implementación cuando representen propósitos distintos.
- Usar exactamente este formato:
  `<type>: (<exact_primary_filename>) <concise_explanation_of_changes>`
- El scope debe ser el nombre exacto del archivo principal y el mensaje debe usar modo imperativo.

Antes de pedir aprobación, presentar para cada commit:

1. Archivos agrupados.
2. Razón del agrupamiento.
3. Mensaje exacto.

No ejecutar commits silenciosamente ni reportarlos como terminados sin aprobación previa.

## Mantenimiento de documentación

- Toda intervención debe actualizar las fuentes activas afectadas por el cambio.
- No duplicar una nueva fuente de verdad: enlazar la existente o reemplazar explícitamente el documento anterior.
- Los snapshots históricos deben conservar una advertencia de vigencia y apuntar a la fuente actual.
- Nunca incluir contraseñas, PIN, tokens, llaves o credenciales reales/de prueba reutilizables en documentos versionados.
- Si se agrega, renombra o cambia el estado de un `.md` raíz, actualizar `DOCUMENTATION_INDEX.md` en la misma intervención.
