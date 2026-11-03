# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project

Arcade Vault: a retro arcade platform to play browser games and compete for the highest score. UI copy, specs, comments and commit context are in Spanish. Backend is Supabase (auth + Postgres with RLS); contact email goes through Resend.

Spec-driven workflow: every feature has a spec in `specs/NN-slug.md` (01–09 implemented: visual MVP, home/about, contact email, Supabase + auth, ROCAS, leaderboard + `games` table, CAÍDA, BLOQUE BUSTER, SERPENTINA). `/spec` writes a spec, `/spec-impl` implements it on a branch `spec-NN-slug` (auto-created, see `specs/.spec-config.yml`) and sets the spec's `Estado` to `Implementado`.

Commands: `npm run dev`, `npm run build`, `npm run lint`. There is no test suite; verify in the browser (Playwright MCP is available).

## Next.js version caveat

This is Next.js 16.4.3 with React 19.3 — APIs differ from older training data. Per `AGENTS.md`, read the relevant guide in `node_modules/next/dist/docs/` (`01-app`, `02-pages`, `03-architecture`, `04-community`) before writing Next.js code, and heed deprecation notices. Notably, middleware is `proxy.ts` (not `middleware.ts`).

## Skills

Usa siempre /frontend-design para diseñar la interfaz de usuario.
Para añadir un juego a la plataforma (portado desde `references/started-games/` o nuevo) con su leaderboard, usa `/nuevo-juego`: genera la spec en `specs/` y luego se implementa con `/spec-impl`.

- `.claude/skills/spec` y `spec-impl`: de `Klerith/fernando-skills` (registrados en `skills-lock.json`; copia en `.agents/skills/`). Reinstalar con `npx skills@latest add Klerith/fernando-skills`.
- `.claude/skills/spec-impl-game`: skill propio. `/spec-impl-game <NN>` sigue las fases 1–4 de `spec-impl` (lee su `SKILL.md`) y al terminar lanza en secuencia, nunca en paralelo, `skin-designer <id>` y después `mobile-porter`. Solo para specs de juegos.
- `.claude/skills/nuevo-juego`: skill propio. `contract.md` (contrato del motor y registro) y `checklist.md` (criterios, plantillas SQL) son la referencia para cualquier juego nuevo.

## Agents

- `.claude/agents/game-planner.md` (Opus): planifica y decide qué juego encaja en la plataforma antes de `/nuevo-juego`. Lee el catálogo (`references/implemented-games.md`, seed de `games`, `references/started-games/`, registro de motores), puntúa 3 candidatos con una rúbrica y recomienda uno con su ficha. No escribe specs ni código.
- Tiene memoria persistente de proyecto (`memory: project`) en `.claude/agent-memory/game-planner/`: `suggestions.md` registra cada candidato sugerido con su estado (`sugerido`/`recomendado`/`elegido`/`descartado`/`implementado`) y `MEMORY.md` las preferencias del usuario. Se versiona en git; no la borres.
- Flujo para un juego nuevo: `game-planner` → `/nuevo-juego` → `/spec-impl-game` (equivale a `/spec-impl` → `skin-designer` → `mobile-porter`).
- `.claude/agents/game-jam.md` (Opus): recibe un tema, diseña un juego original que lo interprete y escribe 3 specs completas del mismo juego en `specs/game-jam/<id>/` (`01-<id>-esencial.md`, `02-<id>-niveles.md`, `03-<id>-ambiciosa.md`), con el formato de las SPEC 07–09. Decide sin preguntar y marca sus decisiones «a revisar». Memoria en `.claude/agent-memory/game-jam/` (`jams.md`); lee la de `game-planner` sin modificarla. Flujo: `game-jam <tema>` → elegir variante → copiarla a `specs/NN-juego-<id>.md` → `/spec-impl`.
- `.claude/agents/skin-designer.md` (Opus): aplica los skins CLÁSICO (por defecto, arcade plano sin glow), NEÓN (el look actual) y RETRO (CRT/fósforo) a **un solo juego por invocación, el que indique el usuario** (`@skin-designer <id>`); nunca toca otros juegos. Paletas en `lib/games/<carpeta>/skins.ts` con `PALETTES: Record<SkinId, …>`, cambio en caliente con `setSkin`, `skins: true` en `ENGINES` y selector en el menú de pausa solo para esos juegos (localStorage `av:skin:<gameId>`). Verifica contraste en modo oscuro (≥3:1 elementos, ≥4.5:1 texto) y captura cada skin con Playwright en `.playwright-screenshots/skins/`. No hace commits. Estado por juego en `references/game-with-themes.md` (único archivo de `references/` que edita); preferencias en `.claude/agent-memory/skin-designer/MEMORY.md`.
- `.claude/agents/mobile-porter.md` (Opus): revisa **todo el sitio** en el móvil (navegador y PWA instalable) en cada invocación (`@mobile-porter`, opcionalmente con una ruta a priorizar), implementa los arreglos y los verifica con Playwright en contexto móvil (`devices["iPhone 13"]`/`"Pixel 7"`, vertical y horizontal). Usa la SPEC 10 como estándar. Arreglos acotados por media query/`pointer: coarse` para no cambiar escritorio; no toca motores, skins ni Supabase. PWA: `app/manifest.ts`, iconos, `viewport` con `viewportFit: "cover"` (sin service worker). Capturas en `.playwright-screenshots/mobile/`. No hace commits. Estado en `references/mobile-status.md` (único archivo de `references/` que edita); memoria en `.claude/agent-memory/mobile-porter/MEMORY.md`.
- `.claude/agents/game-performance-booster.md` (Opus): revisa y mejora el rendimiento de **un solo juego por invocación, recibido por su id** (`@game-performance-booster <id>`). Usa la SPEC 12 (RANARIA) como estándar: detecta y corrige `shadowBlur` por frame (sprites cacheados), fondo y efectos redibujados cada frame (canvas cacheados), `dt` variable/`MAX_DT` (paso fijo 1/240), emisiones al HUD sin cambio y asignaciones por frame, sin cambiar el aspecto ni las mecánicas. Mide antes y después en producción con Playwright (3 skins, sin throttling y CPU ×4/×10). Solo toca `lib/games/<carpeta>/`; lo de fuera del motor lo informa. Capturas en `.playwright-screenshots/perf/`. No hace commits. Estado en `references/game-performance.md` (único archivo de `references/` que edita); memoria en `.claude/agent-memory/game-performance-booster/MEMORY.md`.

## Hooks

`.claude/settings.json` runs `.claude/hooks/format-file.mjs` after every Write/Edit: Prettier `--write` and, for JS/TS, `eslint --fix`. ESLint errors block the edit (exit 2) — fix them rather than bypassing. `references/`, `.next` and `node_modules` are skipped.

## Architecture

### Routes (`app/`, App Router only; `@/*` maps to repo root)

- `/` home, `/biblioteca` game library, `/juegos/[id]` game detail + top 10, `/jugar/[id]` player, `/salon-de-la-fama` hall of fame, `/acerca-de` about + contact form, `/acceso` login/signup, `/auth/callback` OAuth/email-confirm code exchange (only relative `next` redirects allowed).
- Server actions: `app/jugar/[id]/actions.ts` (`submitScore`, then `updateTag("scores")`) and `app/acerca-de/actions.ts` (`sendContact`: honeypot field `website`, in-memory IP rate limit via `lib/rate-limit.ts`, validation in `lib/contact.ts`, sends with Resend).

### Data & Supabase

- Clients in `lib/supabase/`: `server.ts` (cookies, for actions/route handlers), `client.ts` (browser), `proxy.ts` (session refresh, used by root `proxy.ts`), `public.ts` (no session/cookies — the only one allowed inside `"use cache"`, sees what RLS allows `anon`).
- `lib/games-data.ts` reads `games` + `game_stats` view and the `leaderboard` view with `"use cache"`, `cacheLife("hours")` and tags `games`/`scores`. Cached functions throw on error; exported getters return `Loaded<T>` (`{ok:false}` on failure, `data: null` = 404).
- Schema in `supabase/migrations/`: `profiles`, `games` (catalog, `playable`, `max_score`, `sort_order`), `scores` (RLS: insert only own score, only for playable games and `score <= max_score`), views `leaderboard` and `game_stats`. Each new playable game adds a migration flipping `playable` and setting `max_score`. The Supabase MCP (`.mcp.json`) can apply migrations and run SQL.
- `lib/session.tsx`: client `SessionProvider`/`useSession` (Supabase auth user, `signOut`, local `saveScore` fallback in localStorage).
- Shared types/formatters in `lib/games.ts` (`Game`, `ScoreRow`, `GameColor`, `formatScoreDate` in Europe/Madrid for hydration-safe dates).
- Env vars: see `.env.example` (Resend + Supabase URL/publishable key).

### Game engines (`lib/games/`)

- `contract.ts` defines `CreateGame(canvas, callbacks) => GameEngine` (pause/resume/restart/end/destroy, optional `goToLevel`) and callbacks for score, lives, level, HUD stats, game over and pause key. Engines are framework-free canvas code.
- `registry.ts` (`ENGINES`) maps game id → logical canvas size, optional `levels` (level selector in pause) and a dynamic `load()` import (one chunk per engine; may preload assets, e.g. Serpentina sprites).
- Engines: `asteroids/` (id `rocas`), `caida/`, `bloque-buster/` (5 levels, sounds), `serpentina/` (sprite atlas). Each has `engine.ts` + `entities.ts`. Assets live in `public/games/<id>/`. (see `references\implemented-games.md`) when you need to check which games are implemented and how to implement new ones.
- Skins: shared base in `lib/games/skins.ts` (`SkinId` = `clasico` default / `neon` / `retro`, `loadSkin`/`saveSkin` in localStorage `av:skin:<gameId>`). An engine with skins exposes the 3 skins (CLÁSICO por defecto, NEÓN, RETRO) in `lib/games/<carpeta>/skins.ts` (`PALETTES: Record<SkinId, …>`), accepts `options.skin`, implements `setSkin` (hot swap) and declares `skins: true` in `ENGINES`, which shows the skin picker in the pause panel. Status per game: `references/game-with-themes.md`.
- `components/game-canvas.tsx` mounts any registered engine; `components/game-player.tsx` owns HUD, pause, game-over modal and score submission. Games not in `ENGINES` stay simulated.
- Original sources to port are in `references/started-games/` (reference only, not part of the build).

### Styling

- Tailwind CSS v4 via the `@tailwindcss/turbopack` loader in `next.config.ts` (no PostCSS config). `app/globals.css` holds the dark neon theme tokens (`--bg`, `--ink`, `--cyan`, `--magenta`, `--yellow`, `--green`, `--gold`…, exposed through `@theme inline`) plus most component classes (`.pixel`, `.mono`, `.av-nav`, `.hud-stat`, `.modal`…).
- Fonts in `app/layout.tsx` via `next/font/google`: Press Start 2P (pixel), JetBrains Mono, Courier Prime. Layout uses the global `LayoutProps<"/">` type (no import).

## Config notes

- `next.config.ts` enables `cacheComponents`, `partialPrefetching` and `experimental.agentFeedback`. With Cache Components, uncached/dynamic access (cookies, `searchParams`, auth) must sit inside a `<Suspense>` boundary (see `app/acceso/page.tsx`), and cached reads use `"use cache"` + tags.
- If `npm run dev` shows stale styles, delete `.next/dev/cache/turbopack`.
- Save Playwright screenshots in `.playwright-screenshots/`.
- `AGENTS.md` is re-generated by `next dev`; leave it in place.
