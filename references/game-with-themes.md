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

Pendiente. Se crea al aplicar skins al primer juego: `lib/games/skins.ts`, `setSkin` en `lib/games/contract.ts`, flag `skins: true` en `lib/games/registry.ts` y selector en el menú de pausa (`components/game-player.tsx`).

## Estado por juego

| Juego         | id              | Carpeta                     | CLÁSICO | NEÓN | RETRO | Contraste mín. | Fecha | Notas                                        |
| ------------- | --------------- | --------------------------- | ------- | ---- | ----- | -------------- | ----- | -------------------------------------------- |
| ROCAS         | `rocas`         | `lib/games/asteroids/`      | ❌      | ❌   | ❌    | —              | —     | Solo el look neón original, sin skins.       |
| CAÍDA         | `caida`         | `lib/games/caida/`          | ❌      | ❌   | ❌    | —              | —     | Solo el look neón original, sin skins.       |
| BLOQUE BUSTER | `bloque-buster` | `lib/games/bloque-buster/`  | ❌      | ❌   | ❌    | —              | —     | Solo el look neón original, sin skins.       |
| SERPENTINA    | `serpentina`    | `lib/games/serpentina/`     | ❌      | ❌   | ❌    | —              | —     | Solo el look neón original; sprite de frutas. |

## Historial

| Fecha      | Juego | Cambio                                   |
| ---------- | ----- | ---------------------------------------- |
| 2026-11-02 | —     | Creación de la referencia (estado inicial). |
