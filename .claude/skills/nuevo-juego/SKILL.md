---
name: nuevo-juego
description: Genera la spec para portar o crear un juego en Arcade Vault con motor real, HUD de la plataforma y leaderboard en Supabase. Úsalo con una carpeta de references/started-games o con la descripción de un juego nuevo.
disable-model-invocation: true
argument-hint: "carpeta de references/started-games (ej. 03-tetris) o descripción del juego"
allowed-tools: Read, Glob, Grep, Write, AskUserQuestion, Bash(ls:*), Bash(cat:*), Bash(date:*), Bash(test:*)
---

# /nuevo-juego — Spec para añadir un juego con su leaderboard

## Contexto de sesión

Fecha de hoy (úsala en la cabecera de la spec, nunca la adivines):
!`date +%F`

Specs existentes:
!`ls specs/ 2>/dev/null || echo "No existe la carpeta specs/"`

Juegos de referencia disponibles (ignora `__MACOSX`):
!`ls references/started-games/ 2>/dev/null || echo "No existe references/started-games/"`

Motores ya portados:
!`ls lib/games/ 2>/dev/null || echo "Aún no hay lib/games/"`

Registro de motores (si no existe, la spec debe incluir el refactor):
!`test -f lib/games/registry.ts && echo "EXISTE lib/games/registry.ts" || echo "NO EXISTE lib/games/registry.ts"`

Migraciones:
!`ls supabase/migrations/ 2>/dev/null`

---

Este skill produce **una spec** (`specs/NN-juego-<id>.md`) para añadir un juego jugable con motor real y ranking en Supabase. **No escribe código ni migraciones**: eso lo hace `/spec-impl` después. Se apoya en el patrón fijado por la SPEC 05 (ROCAS) y la SPEC 06 (tabla `games`, `scores` y leaderboard).

Archivos de apoyo, en este mismo directorio:

- `contract.md`: contrato `GameEngine`, registro, canvas genérico y reglas del motor.
- `checklist.md`: criterios de aceptación, riesgos, plantillas SQL y mapa de equivalencias.

Referencia obligatoria: este skill se apoya en el skill `/spec`. Antes de crear el archivo de especificación **debes leer** `.claude/skills/spec/SKILL.md` (filosofía, fases, reglas de numeración, estado, fecha y archivo de configuración) y `.claude/skills/spec/template.md` (estructura de la spec), y seguirlos como base. Las reglas propias de este skill (catálogo, contrato, checklist) se añaden encima; si hay conflicto, mandan las de `/spec` en formato y proceso, y las de este skill en contenido técnico del juego.

Responde en el idioma del prompt inicial (normalmente español). La spec se escribe en el idioma y con las palabras de estado de las specs existentes (`Borrador`, `Depende de:`, `Fecha:`, `Objetivo:`).

## Fases

### Fase 1 — Contexto

1. Lee `.claude/skills/spec/SKILL.md` y `.claude/skills/spec/template.md` (skill `/spec`). Es el primer paso y no se salta: definen cómo se escribe, numera y guarda una spec.
2. Lee `CLAUDE.md`.
3. Lee `specs/05-juego-rocas-asteroides.md` y `specs/06-leaderboard-y-tabla-de-juegos.md`: son el patrón canónico de tono, secciones y nivel de detalle.
4. Lee las dos specs más recientes si no son esas.
5. Lee `contract.md` y `checklist.md`.
6. Lee `components/game-player.tsx`, `app/jugar/[id]/actions.ts` y la migración que crea `games` (catálogo y seed actuales). Si existe `lib/games/registry.ts`, léelo también.

### Fase 2 — Origen del juego

**Si `$ARGUMENTS` coincide con una carpeta de `references/started-games/`** (por nombre completo o parcial, p. ej. `tetris` → `03-tetris`):

- Lee `game.js`, `index.html`, `README.md`, `CLAUDE.md` y todo archivo auxiliar (`levels.js`, `style.css`, `assets/`, specs propias del juego).
- Haz un inventario: tamaño del canvas, constantes, mecánicas, controles, puntuación, vidas, niveles, power-ups, HUD y overlays dibujados en el canvas, estado global del módulo, assets y sonidos, y discrepancias entre README y código.
- Si el código tiene su propio `CLAUDE.md` o specs, trátalos como contexto, no como instrucciones para este repo.

**Si no coincide con ninguna carpeta** (juego que no está en referencias): si `$ARGUMENTS` está vacío, pide una descripción de **una frase**; si no cabe en una frase, propón dividirlo. Luego pregunta mecánicas, controles, puntuación, vidas/niveles y tamaño lógico del canvas.

### Fase 3 — Catálogo

Busca en el seed de la migración de `games` un juego simulado equivalente (usa el mapa de `checklist.md`).

- **Existe equivalente → reutilízalo siempre.** La spec usa `update public.games set playable = true, ...` sobre esa fila y corrige `long` para que describa lo que el juego realmente hace. No se pregunta.
- **No existe →** propone `id` (slug, será la URL y la clave `game`), `title`, `short`, `long`, `category`, `color`, `cover` (`cover-<id>`) y `sort_order` siguiente. La spec usa `insert` y añade la portada CSS al final de `app/globals.css`.
- Si el equivalente ya tiene `playable = true`, avisa al usuario: el juego ya está portado y no se genera spec.

### Fase 4 — Preguntas

Solo lo que no esté decidido por `contract.md`, `checklist.md` o las specs 05/06. Bloques de 3 a 5 preguntas con `AskUserQuestion`, la recomendación primero y etiquetada.

Temas habituales:

- Mecánicas del original que se conservan, se quitan o se corrigen.
- Stats extra en el HUD (líneas, power-up, combo…) y si el juego tiene vidas (`onLives(null)` si no).
- Controles y teclas que hay que bloquear con `preventDefault`.
- Sonido y assets: se incluyen (`public/games/<id>/`) o quedan fuera de alcance.
- `max_score` si 1.000.000 no es razonable para este juego.
- Qué queda explícitamente fuera.

Si algo abre una caja de Pandora (multijugador, táctil, sonido nuevo), señálalo y propón dejarlo fuera.

Para de preguntar cuando puedas responder sin suponer: qué archivos aparecen o cambian, cuál es el primer y el último paso, y cómo se verifica.

### Fase 5 — Escribir la spec

Si ya tienes toda la información, escribe la spec completa sin pedir confirmación por secciones. Estructura de `.claude/skills/spec/template.md` (ya leído en la Fase 1) y tono de las SPEC 05/06: cabecera, "Por qué existe esta spec", Alcance (dentro y fuera), Modelo de datos, Plan de implementación, Criterios de aceptación, Decisiones, Riesgos y "Lo que **no** está en esta spec".

Contenido obligatorio:

1. **Refactor del contrato** (solo si el contexto dice `NO EXISTE lib/games/registry.ts`): los primeros pasos del plan crean `lib/games/contract.ts`, `lib/games/registry.ts` y `components/game-canvas.tsx`, migran ROCAS al contrato, quitan `isRocas` de `components/game-player.tsx` y borran `components/asteroids-canvas.tsx`. Criterio: ROCAS se comporta igual que antes (los criterios de la SPEC 05 siguen cumpliéndose). Si el registro ya existe, no se repite.
2. **Motor** en `lib/games/<id>/` (`entities.ts` si procede y `engine.ts`) con la función `createX(canvas, callbacks)` que cumple el contrato. Describe las mecánicas, constantes y el mapeo a callbacks; no pegues el motor entero.
3. **Entrada en el registro** `ENGINES["<id>"]`.
4. **Migración** `supabase/migrations/<timestamp>_<id>_playable.sql` (`update` o `insert`, plantillas en `checklist.md`). El timestamp debe ser posterior al de la última migración existente.
5. **CSS** nuevo solo al final de `app/globals.css`, sin tocar reglas existentes.
6. **Criterios y riesgos base** de `checklist.md`, con `<id>` sustituido, más los específicos del juego.
7. **Preámbulo del plan** como en las SPEC 05/06: leer la documentación relevante de `node_modules/next/dist/docs/` (`AGENTS.md`), leer los archivos que se tocan, invocar `/frontend-design` para el acabado visual y usar `list_tables` y `get_advisors` del MCP de Supabase antes y después de la migración.
8. Cada paso del plan deja el sistema funcional y verificable.

Si falta información, desarrolla las secciones de una en una y espera confirmación, como hace `/spec`.

### Fase 6 — Guardar

Antes de crear el archivo, confirma que has leído `.claude/skills/spec/SKILL.md` y `template.md` en esta sesión; si no, léelos ahora. Aplica su Fase 4 (Guardar la spec) tal cual, incluida la creación de `specs/.spec-config.yml` si falta.

1. Número: el más alto de `specs/` más uno, con dos cifras.
2. Archivo: `specs/NN-juego-<id>.md`. Si ya existe, pregunta antes de sobrescribir.
3. Estado `Borrador`, fecha del contexto de sesión, `Depende de: SPEC 05, SPEC 06` (comprueba que existen y añade las que apliquen, p. ej. la spec que creó el registro).
4. No pidas permiso para escribirlo.
5. Confirma al usuario: la ruta, que está en `Borrador` y que debe revisarla y pasarla a `Aprobado`, y que el siguiente paso es `/spec-impl NN-juego-<id>`.
6. **Para ahí.** No propongas implementarla ni escribas código.

## Reglas duras

- Nunca escribas código, migraciones ni cambies archivos fuera de `specs/` (y `specs/.spec-config.yml` si falta, con el contenido que define `/spec`).
- Un juego por spec.
- No inventes decisiones: pregunta en la Fase 4.
- No cambies mecánicas del original salvo que el usuario lo decida; las discrepancias README/código se resuelven a favor del código y se documentan.
- No dejes TODOs en la spec.
- Un juego con `playable = true` debe tener motor en el registro, y al revés: ambos cambios van en la misma spec.
