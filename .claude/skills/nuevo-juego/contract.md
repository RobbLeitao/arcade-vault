# Contrato de motor de juego

Generaliza lo que la SPEC 05 hizo para ROCAS (`lib/games/asteroids/engine.ts`, `components/asteroids-canvas.tsx`) y lo que `components/game-player.tsx` cablea con `isRocas`. La primera spec generada por `/nuevo-juego` lo implementa si `lib/games/registry.ts` no existe; las siguientes solo lo usan.

## Tipos

```ts
// lib/games/contract.ts
import type { GameColor } from "@/lib/games";

export interface HudStat {
  key: string; // estable, para el key de React
  label: string; // "Triple", "Líneas"
  value: string; // ya formateado: "3x 4.2s", "12"
  color?: GameColor; // color del tema; por defecto --cyan
}

export interface GameCallbacks {
  onScore: (score: number) => void; // solo cuando cambia
  onLives: (lives: number | null) => void; // null = el juego no tiene vidas
  onLevel: (level: number) => void; // solo cuando cambia
  onStats: (stats: HudStat[]) => void; // stats extra; [] = ninguno; solo cuando cambian
  onGameOver: (finalScore: number) => void; // fin natural o llamada a end()
}

export interface GameEngine {
  pause: () => void;
  resume: () => void;
  restart: () => void; // reinicia y vuelve a emitir score, lives, level y stats iniciales
  end: () => void; // termina la partida en curso y llama a onGameOver
  destroy: () => void; // cancela el bucle y quita los listeners
}

export type CreateGame = (
  canvas: HTMLCanvasElement,
  callbacks: GameCallbacks,
) => GameEngine;
```

## Registro

```ts
// lib/games/registry.ts
export interface EngineEntry {
  width: number; // resolución lógica del canvas
  height: number;
  load: () => Promise<CreateGame>; // import() dinámico: un chunk por motor
}

export const ENGINES: Record<string, EngineEntry> = {
  rocas: {
    width: 800,
    height: 600,
    load: () => import("./asteroids/engine").then((m) => m.createAsteroids),
  },
};
```

- La clave es `games.id`.
- `ENGINES[game.id]` decide si `GamePlayer` usa motor real o la simulación. Es la única fuente en el código; no se añaden `if (game.id === "...")`.
- Coherencia con la BD: `games.playable = true` ⇔ entrada en `ENGINES`. Se cambian en la misma spec.

## Canvas genérico

`components/game-canvas.tsx` (`"use client"`) sustituye a `asteroids-canvas.tsx`:

- Recibe `gameId` y los cinco callbacks, y expone `{ pause, resume, restart, end }` por `ref` (React 19: `ref` como prop, `useImperativeHandle`).
- Mismo patrón que el canvas de ROCAS: `callbacksRef` actualizado en un efecto declarado **antes** del efecto del motor, para que el motor encuentre callbacks vigentes al emitir al crearse.
- El efecto del motor hace `entry.load()`, crea el motor y lo destruye al desmontar. Con StrictMode o desmontaje antes de que termine el `import()`, usa una bandera `cancelled` para no crear un motor huérfano.
- `<canvas width={entry.width} height={entry.height} className="game-canvas">`; la clase CSS fija ancho 100 % y `aspect-ratio` por `style={{ aspectRatio: `${width} / ${height}` }}`. Si hace falta, se renombra `.asteroids-canvas` a `.game-canvas` conservando la regla existente.

## GamePlayer

- `const entry = ENGINES[game.id]`; `const hasEngine = entry !== undefined`.
- Estado de HUD: `score`, `lives: number | null`, `engineLevel`, `stats: HudStat[]`.
- El HUD oculta Vidas si `lives === null`, y pinta `stats` con `.hud-stat` genérico.
- Sin motor: simulación actual sin cambios (`.game-arena`, `setInterval`).
- Guardado, `ranked`, `submitScore`, aviso de invitado y modal: sin cambios.

## Reglas del motor (de la SPEC 05)

1. Sin estado global de módulo: todo vive en la clausura de `createX`. Se pueden crear y destruir instancias sin residuos (StrictMode, navegación entre juegos).
2. Bucle con `requestAnimationFrame`, `dt` acotado a 0.05 s y `lastTime` reiniciado en `resume`.
3. Paleta leída una vez al crear el motor con `getComputedStyle(document.documentElement)` (`--cyan`, `--magenta`, `--yellow`, `--green`, `--ink`) y con valores por defecto iguales a los del tema. Dibujo neón con `shadowBlur` moderado.
4. Sin HUD ni overlay de fin dibujados en el canvas: puntuación, vidas, nivel y fin los muestra la plataforma. Se eliminan también "pulsa para empezar" y reinicios con tecla.
5. Teclado en `window`, quitado en `destroy`. `preventDefault` solo con la partida activa y con el foco fuera de `input`/`textarea`. Con la partida terminada el motor ignora las teclas para no interferir con el modal.
6. Callbacks solo cuando el valor cambia; valores continuos (cuenta atrás) a pasos de 0.1 s como máximo.
7. Conservar constantes y mecánicas del original salvo decisión explícita en la spec.
8. Sonido y assets, solo si la spec los incluye (`public/games/<id>/`, precargados antes de empezar); por defecto quedan fuera de alcance.
9. El motor no guarda puntuaciones: solo llama a `onGameOver(finalScore)`. El guardado es de `GamePlayer` + `submitScore` (SPEC 06).
