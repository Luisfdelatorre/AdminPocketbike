# Reglas para el Desarrollo de AdminPocketbike (Payments-Wompi)

Este archivo define las directrices y fuentes de verdad que todos los agentes de IA deben seguir al trabajar en este proyecto.

## 📚 Fuentes de Conocimiento del Proyecto
Antes de realizar cualquier modificación, diseño o propuesta de código, debes leer, entender y adherirte a los siguientes archivos según corresponda:

* **Arquitectura y Flujo General**: [ARCHITECTURE.md](ARCHITECTURE.md) (Estructura del servidor, flujo de caja, estado de dispositivos).
* **Lógica del Negocio de Contratos**: [CONTRACT_SYSTEM.md](CONTRACT_SYSTEM.md) (Generación automática de contratos, abonos, estados y penalidades).
* **Esquemas y Relaciones de Base de Datos**: [DATABASE_RELATIONSHIPS.md](DATABASE_RELATIONSHIPS.md) (Modelos de Mongoose, relaciones de uno a uno entre Invoices y Payments, etc.).
* **Autenticación y Seguridad**: [AUTH_SYSTEM.md](AUTH_SYSTEM.md) (Flujo de login, tokens JWT, middleware y roles de usuario).
* **Instalación y Configuración del Entorno**: [README.md](README.md) (Variables de entorno, dependencias y comandos).
* **Resumen Técnico General**: [PROJECT_SUMMARY.md](PROJECT_SUMMARY.md) (Detalles de los módulos completados e integraciones como Wompi).

## 🛠️ Directrices de Desarrollo
1. **Verificación de Base de Datos**: El servidor se conecta a `127.0.0.1:27018`. Asegúrate de que el túnel de base de datos (`npm run dev:db-tunnel`) esté activo o sea mencionado si hay problemas de conexión.
2. **Diseño Visual**: Mantener la estética premium actual: diseño moderno con Glassmorphism, animaciones suaves y paleta de colores coherente y pulida. Evitar estilos básicos o genéricos.
3. **Consistencia**: Respeta siempre las decisiones arquitectónicas ya tomadas y documentadas en los archivos MD anteriores.
4. **Corrección de Inconsistencias de Diseño**: Resolveremos las inconsistencias listadas en [INCOHERENCIAS_DISENO.md](INCOHERENCIAS_DISENO.md) de forma gradual y bajo la supervisión directa del usuario. Antes de realizar modificaciones, los agentes deben consultar y actualizar el índice de avances dentro del mismo documento.

## Commit Composition Workflow

When the user asks to prepare, group, propose, or create commits, always inspect the current Git working tree and group files logically by development purpose before executing any Git commit.

For commit-composition tasks:

- Respond to the user in Spanish, but write commit messages in English.
- Do not modify source code.
- Git inspection operations are allowed, including `git status`, `git diff`, and `git diff --cached`.
- Inspect both staged and unstaged changes unless the user explicitly says to use only staged changes.
- Always propose the commit grouping first, even if the user asks to create commits immediately.
- Never run `git add` or `git commit` until the user explicitly approves the proposed grouping in a follow-up message.
- After approval, stage only the files for one logical group at a time and create separate commits per group.
- If both staged and unstaged changes exist, clearly distinguish them before proposing the grouping.
- Group changes logically before committing.
- Use this exact commit message format:
  `<type>: (<exact_primary_filename>) <concise_explanation_of_changes>`
- The scope inside parentheses must be the exact primary filename.
- Use imperative mood in commit messages.
- Before asking for approval, present:
  1. the grouped files for each proposed commit,
  2. the rationale for each group,
  3. the exact commit message for each commit.

- Do not execute commits silently and do not report completed commits unless the user had explicitly approved them in a previous message.