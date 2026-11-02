# Juegos con skins

Referencia de qué juegos tienen ya sus skins. La mantiene el agente `skin-designer`, que trabaja **un solo juego por invocación** y **solo el juego que indique el usuario** (`@skin-designer <id>`). Nunca aplica skins al resto.

## Skins obligatorios

| id        | Etiqueta | Rol           | Dirección visual                                                  |
| --------- | -------- | ------------- | ----------------------------------------------------------------- |
| `clasico` | CLÁSICO  | Por defecto   | Arcade plano: colores saturados de recreativa, sin glow.          |
| `neon`    | NEÓN     | Look original | Paleta actual (variables CSS de `app/globals.css`) con glow.      |
| `retro`   | RETRO    | CRT / fósforo | Paleta limitada, scanlines suaves, glow mínimo de fósforo.        |

Los tres deben verse bien en modo oscuro: fondo del canvas ≤ `--bg-3`, elementos ≥ 3:1 y texto ≥ 4.5:1 de contraste.

Leyenda: ✅ cumple · ⚠ existe pero falla algún criterio · ❌ no existe.

## Sistema base de skins

Creado (2026-11-02, con ROCAS). Archivos: `lib/games/skins.ts` (`SkinId`, `SKIN_IDS`, `DEFAULT_SKIN = "clasico"`, `SKIN_LABELS`, `loadSkin`/`saveSkin` con `av:skin:<gameId>`), `lib/games/contract.ts` (`CreateGameOptions { skin? }` y `GameEngine.setSkin?`), `lib/games/registry.ts` (`skins?: true`), `components/game-canvas.tsx` (prop `skin`, `setSkin` en caliente sin recrear el motor) y `components/game-player.tsx` (selector SKIN en el panel de pausa, solo con `entry.skins`), con estilo `.btn.skin-btn` en `app/globals.css` (mismo aspecto que `.level-btn`). Los juegos sin `skins` no muestran selector y conservan su look neón.

## Estado por juego

| Juego         | id              | Carpeta                     | CLÁSICO | NEÓN | RETRO | Contraste mín. | Fecha | Notas                                        |
| ------------- | --------------- | --------------------------- | ------- | ---- | ----- | -------------- | ----- | -------------------------------------------- |
| ROCAS         | `rocas`         | `lib/games/asteroids/`      | ✅      | ✅   | ✅    | 5.48:1 (texto «3x» NEÓN); elementos ≥ 3.31:1 (rocas RETRO en esquina con viñeta) | 2026-11-02 | CLÁSICO: vectores blancos/azules sin glow sobre `#000`. RETRO: fósforo verde, scanlines 0.1 y viñeta 0.3. A revisar: fósforo verde (no ámbar) y power-up RETRO en verde-lima. |
| CAÍDA         | `caida`         | `lib/games/caida/`          | ❌      | ❌   | ❌    | —              | —     | Solo el look neón original, sin skins.       |
| BLOQUE BUSTER | `bloque-buster` | `lib/games/bloque-buster/`  | ❌      | ❌   | ❌    | —              | —     | Solo el look neón original, sin skins.       |
| SERPENTINA    | `serpentina`    | `lib/games/serpentina/`     | ❌      | ❌   | ❌    | —              | —     | Solo el look neón original; sprite de frutas. |

## Historial

| Fecha      | Juego | Cambio                                   |
| ---------- | ----- | ---------------------------------------- |
| 2026-11-02 | —     | Creación de la referencia (estado inicial). |
| 2026-11-02 | ROCAS | Sistema base de skins creado y skins CLÁSICO, NEÓN y RETRO aplicados a `rocas`. |
