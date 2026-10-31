# SPEC 07 — Segundo juego real: CAÍDA (Tetris)

> **Estado:** Implementado
> **Depende de:** SPEC 05, SPEC 06
> **Fecha:** 2026-10-31
> **Objetivo:** Portar el Tetris de `references/started-games/03-tetris` a un motor TypeScript registrado como `caida`, jugable en `/jugar/caida` con el HUD, la pausa y el modal de la plataforma y con ranking real en Supabase, extrayendo antes de ROCAS el contrato y el registro de motores que reutilizarán los siguientes juegos.

---

## Por qué existe esta spec

La SPEC 05 portó ROCAS y dejó el patrón (motor TS desacoplado de React, comunicado por callbacks), pero lo cableó a mano: `components/game-player.tsx` decide con `isRocas`, usa `components/asteroids-canvas.tsx` y tiene un stat `3x` específico. La SPEC 06 creó `games` y `scores`, y `caida` ya existe en el catálogo como juego simulado (`playable = false`). Un segundo `if (game.id === "caida")` repetiría la deuda en cada juego, así que esta spec hace primero el refactor: `lib/games/contract.ts`, `lib/games/registry.ts` y un canvas genérico. Después porta Tetris, el primer juego que usa ese contrato desde el principio. Los otros seis juegos simulados siguen igual.

El código de Tetris (`game.js`, 332 líneas, canvas del tablero 300×600) difiere del README en tres puntos. Se resuelven a favor del código y se documentan en Decisiones: tiene **8 piezas** (la 8.ª es una «tuerca» 3×3 con hueco, `N`) y no 7; la caída solo suma puntos con soft drop y hard drop; y el tema claro/oscuro del original no tiene sentido dentro del CRT de la plataforma.

---

## Alcance

**Dentro:**

- **Refactor del contrato** (primeros pasos): crear `lib/games/contract.ts`, `lib/games/registry.ts` y `components/game-canvas.tsx`; migrar ROCAS al contrato; quitar `isRocas` y el stat `3x` fijo de `components/game-player.tsx`; borrar `components/asteroids-canvas.tsx`. ROCAS se comporta igual que antes.
- Motor en `lib/games/caida/` (`entities.ts` y `engine.ts`) con `createCaida(canvas, callbacks)`, portado de `game.js` sin cambiar las mecánicas: tablero 10×20 con celdas de 30 px; 8 piezas (I, O, T, S, Z, J, L y la tuerca N) elegidas al azar de forma uniforme; rotación horaria con _wall kicks_ `[0, -1, 1, -2, 2]`; soft drop (+1 punto por fila) y hard drop (+2 puntos por celda); pieza fantasma al 20 % de opacidad; vista previa de la pieza siguiente; limpieza de líneas con puntos `[0, 100, 300, 500, 800] × nivel`; nivel `floor(líneas / 10) + 1` y caída cada `max(100, 1000 − (nivel − 1) × 90)` ms; fin de partida cuando la pieza nueva colisiona al aparecer.
- Entrada `ENGINES["caida"]` en el registro, con canvas lógico 420×600.
- Vista previa de la pieza siguiente dibujada **dentro del canvas**, en un panel de 120 px a la derecha del tablero (tablero 300×600 + panel 120×600).
- HUD de la plataforma: Puntuación, Nivel (de `onLevel`) y el stat extra **Líneas**. Sin vidas: `onLives(null)` y el HUD oculta Vidas.
- Controles: `←` `→` mover, `↑` o `X` rotar, `↓` bajar, `Espacio` caída instantánea y `P` pausar/reanudar. Se bloquean con `preventDefault` solo las flechas y `Espacio`, con la partida activa y el foco fuera de `input`/`textarea`.
- Estilo neón del tema: colores de las piezas desde las variables CSS cuando existen (ver Modelo de datos), cuadrícula tenue y brillo moderado con `shadowBlur`.
- Migración `supabase/migrations/20261031120000_caida_playable.sql`: `update` de la fila `caida` con `playable = true` y `long` corregido.
- Orden del catálogo: `fetchGames` en `lib/games-data.ts` ordena por `playable` descendente y luego por `sort_order`, de modo que los juegos reales (con motor y ranking) salen antes que los simulados en Biblioteca, Home y Salón de la Fama. Añadido durante la implementación, a petición expresa; ver Decisiones.
- Reglas CSS nuevas al final de `app/globals.css` solo si hacen falta; el refactor de ROCAS solo renombra `.asteroids-canvas` a `.game-canvas` y generaliza `.crt.crt-fit` (ver paso 2).

**Fuera de alcance (para futuras specs):**

- Controles táctiles o gamepad.
- Sonido y música.
- Interruptor de tema claro/oscuro del original (`tetris-theme` en `localStorage`).
- Pausa automática al perder el foco, ajuste a `devicePixelRatio` y pantalla completa.
- Mecánicas nuevas: pieza _hold_, bolsa de 7 piezas, rotación SRS, _lock delay_, puntos por T-spin o combos, ver más de una pieza siguiente.
- Guardar partidas a medias o reanudar tras recargar.
- Anti-trampas, rate limit y Realtime (siguen fuera, como en la SPEC 06).
- Portar los otros seis juegos del catálogo.
- Tests automatizados (no hay runner configurado).

---

## Modelo de datos

```ts
// lib/games/contract.ts (nuevo; generaliza AsteroidsCallbacks y AsteroidsEngine)
import type { GameColor } from "@/lib/games";

export interface HudStat {
  key: string; // estable, para el key de React
  label: string; // "Triple", "Líneas"
  value: string; // ya formateado: "3x 4.2s", "12"
  color?: GameColor; // color del tema; por defecto --cyan
}

export interface GameCallbacks {
  onScore: (score: number) => void; // solo cuando cambia
  onLives: (lives: number | null) => void; // null = sin vidas
  onLevel: (level: number) => void; // solo cuando cambia
  onStats: (stats: HudStat[]) => void; // [] = ninguno; solo cuando cambian
  onGameOver: (finalScore: number) => void; // fin natural o llamada a end()
  onPauseKey?: () => void; // el jugador pulsó la tecla de pausa del juego
}

export interface GameEngine {
  pause: () => void;
  resume: () => void;
  restart: () => void; // reinicia y vuelve a emitir score, lives, level y stats
  end: () => void; // termina la partida en curso y llama a onGameOver
  destroy: () => void; // cancela el bucle y quita los listeners
}

export type CreateGame = (
  canvas: HTMLCanvasElement,
  callbacks: GameCallbacks,
) => GameEngine;
```

```ts
// lib/games/registry.ts (nuevo)
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
  caida: {
    width: 420,
    height: 600,
    load: () => import("./caida/engine").then((m) => m.createCaida),
  },
};
```

```ts
// lib/games/caida/entities.ts
export const COLS = 10;
export const ROWS = 20;
export const BLOCK = 30;
export const BOARD_W = COLS * BLOCK; // 300
export const W = 420; // BOARD_W + panel lateral de 120 px
export const H = ROWS * BLOCK; // 600
export const LINE_SCORES = [0, 100, 300, 500, 800];
export const KICKS = [0, -1, 1, -2, 2];

// Índice 1..8 = I, O, T, S, Z, J, L, N (tuerca). PIECES igual que game.js.
export const PIECES: (number[][] | null)[];

export interface Piece {
  type: number; // 1..8
  shape: number[][]; // matriz cuadrada; las celdas guardan el índice de color
  x: number; // columna de la esquina superior izquierda
  y: number; // fila; 0 al aparecer
}

export interface Palette {
  colors: (string | null)[]; // índice 0 = null; 1..8 = color de cada pieza
  grid: string; // línea de la cuadrícula
  label: string; // texto "SIGUIENTE"
}
```

```ts
// lib/games/caida/engine.ts
export function createCaida(
  canvas: HTMLCanvasElement,
  callbacks: GameCallbacks,
): GameEngine;
```

Convenciones:

- Constantes de `game.js` conservadas tal cual: `COLS = 10`, `ROWS = 20`, `BLOCK = 30`, `LINE_SCORES`, `KICKS`, intervalo inicial 1000 ms, mínimo 100 ms y bajada de 90 ms por nivel, `PIECES` con las 8 matrices.
- Coordenadas con origen arriba a la izquierda; el tablero ocupa `x ∈ [0, 300)` del canvas y el panel de la pieza siguiente `x ∈ [300, 420)`.
- La pieza aparece en `x = floor(COLS / 2) − floor(ancho / 2)` e `y = 0`, como el original (la pieza I queda con su fila vacía arriba).
- Mapeo a callbacks: `onScore` al cambiar la puntuación (soft drop, hard drop, limpieza de líneas); `onLevel` al cambiar el nivel; `onStats([{ key: "lines", label: "Líneas", value: String(líneas) }])` al cambiar las líneas; `onLives(null)` una vez al crear y en `restart`; `onGameOver(score)` cuando la pieza nueva colisiona al aparecer o cuando se llama a `end()`.
- Paleta: `I` → `--cyan`, `O` → `--yellow`, `T` → `--magenta`, `S` → `--green` (leídas una vez con `getComputedStyle(document.documentElement)` y valores por defecto iguales a los del tema); `Z` `#ff6b6b`, `J` `#7aa2ff`, `L` `#ff9f1c` y `N` `#9a9ab0` fijos, porque el tema solo tiene cuatro colores y hacen falta ocho distinguibles. El ajuste fino se hace en el paso de acabado visual.
- Bucle con `requestAnimationFrame`. El original acumulaba el `dt` sin límite; aquí se acota a 50 ms y se reinicia `lastTime` en `resume` (regla del contrato). Es la única desviación de la lógica de tiempo.
- Sin estado global de módulo: el tablero, la pieza actual, la siguiente, la puntuación, las líneas, el nivel y el temporizador viven en la clausura de `createCaida`.
- Teclado en `window`, quitado en `destroy`. `P` llama a `callbacks.onPauseKey?.()` y no pausa por sí mismo: `GamePlayer` es la única fuente del estado de pausa y llama a `pause`/`resume`. Con la partida terminada el motor ignora todas las teclas, `P` incluida.
- Sin HUD ni overlay dibujados: se eliminan los textos `SCORE`/`LINES`/`LEVEL`, el panel de controles, `PAUSA` y `GAME OVER`. Lo único que el motor dibuja fuera del tablero es la pieza siguiente con su etiqueta `SIGUIENTE`.
- El motor no guarda puntuaciones: solo llama a `onGameOver(finalScore)`.

---

## Plan de implementación

Antes de empezar, leer en `node_modules/next/dist/docs/` la guía de componentes cliente (`"use client"`) y la de Cache Components, como exige `AGENTS.md`. Leer `components/game-player.tsx`, `components/asteroids-canvas.tsx`, `lib/games/asteroids/engine.ts`, `app/jugar/[id]/page.tsx` y las reglas `.crt`, `.crt-screen`, `.crt-fit`, `.hud-stat` y `.asteroids-canvas` de `app/globals.css`. Invocar `/frontend-design` para el acabado visual del canvas, como indica `CLAUDE.md`. Antes y después de la migración, ejecutar `list_tables` y `get_advisors` de seguridad del MCP de Supabase.

1. Crear `lib/games/contract.ts` y `lib/games/registry.ts` (solo con `rocas`). Adaptar `lib/games/asteroids/engine.ts` al contrato: `AsteroidsCallbacks` pasa a ser `GameCallbacks`; `onLives(n)` sigue igual; `onPowerUp` se sustituye por `onStats` (con `3x` en magenta mientras queda tiempo, paso de 0.1 s, y `[]` cuando no hay power-up); `createAsteroids` devuelve un `GameEngine`. Verificación: `npm run lint` pasa y `tsc` solo falla (si falla) en `asteroids-canvas.tsx`, que se retira en el paso siguiente.
2. Crear `components/game-canvas.tsx` (`"use client"`) con las reglas del contrato: recibe `gameId` y los callbacks, expone `{ pause, resume, restart, end }` por `ref`, mantiene `callbacksRef` en un efecto previo al del motor, carga el motor con `entry.load()` y una bandera `cancelled`, y lo destruye al desmontar. El `<canvas width height className="game-canvas">` va absoluto dentro de `.crt-screen`, así que la proporción se fija en `.crt-screen` (paso siguiente). En `app/globals.css` renombrar `.asteroids-canvas` a `.game-canvas` y generalizar `.crt.crt-fit` para que su `max-width` use `var(--game-aspect, 1.3333)` en lugar de `4 / 3`. Verificación: compila.
3. Migrar `components/game-player.tsx` al registro: `const entry = ENGINES[game.id]`; sin `isRocas`; estado de HUD `score`, `lives: number | null`, `engineLevel` y `stats: HudStat[]`; Vidas oculta si `lives === null`; `stats` pintados con `.hud-stat`; `.crt-screen` recibe `style={{ aspectRatio: \`${width} / ${height}\` }}`y`.crt-fit`recibe`--game-aspect`; `onPauseKey`alterna el estado`paused`. Sin motor, la simulación actual queda intacta. Borrar `components/asteroids-canvas.tsx`. Verificación: `/jugar/rocas`se ve y juega igual que antes (HUD,`3x`, pausa, fin, ranking) y `/jugar/serpentina`conserva`.game-arena`.
4. Crear `lib/games/caida/entities.ts` con las constantes, `PIECES`, las utilidades (`createBoard`, `collide`, `rotateCW`) y el dibujo de bloque con `draw(ctx, palette)`. Verificación: `npm run lint` y `npm run build` pasan.
5. Crear `lib/games/caida/engine.ts` con `createCaida`: estado en clausura, bucle con `dt` acotado, entrada de teclado, `tryRotate` con _wall kicks_, `softDrop`, `hardDrop`, `lockPiece`, `clearLines`, `spawn`, pieza fantasma, panel de la pieza siguiente, `pause`, `resume`, `restart`, `end`, `destroy` y los callbacks solo al cambiar. Verificación: compila y `npm run lint` pasa.
6. Añadir `caida` a `ENGINES` (420×600). Verificación: `/jugar/caida` muestra el motor real en lugar de `.game-arena` y se puede jugar; mientras `playable` siga en `false`, la partida se guarda solo en `localStorage`.
7. Crear `supabase/migrations/20261031120000_caida_playable.sql` y aplicarla (MCP `apply_migration` o CLI):

   ```sql
   update public.games
   set playable = true,
       long = 'Ocho piezas geométricas, incluida una tuerca con hueco, descienden por un pozo de 10×20. Muévelas, rótalas y suéltalas de golpe para completar líneas; una pieza fantasma marca dónde aterrizarán y verás la siguiente. Cada 10 líneas subes de nivel y la caída se acelera.'
   where id = 'caida';
   ```

   Ejecutar `get_advisors` de seguridad. Verificación: `select playable from games where id = 'caida'` devuelve `true`, `/juegos/caida` ya no muestra `PRÓXIMAMENTE` y una partida con sesión crea una fila en `scores`.

8. Acabado visual: brillo del neón, colores de las piezas, cuadrícula, panel de la pieza siguiente y revisión a 1280 px y 390 px (el canvas es vertical 7:10). Verificación: capturas de `/jugar/caida` en ambos anchos en `.playwright-screenshots/` y sin scroll horizontal.

---

## Criterios de aceptación

- [x] `npm run lint` y `npm run build` terminan sin errores ni warnings de Cache Components o hidratación.
- [x] `select playable from games where id = 'caida'` devuelve `true`, y `ENGINES["caida"]` existe.
- [x] `/jugar/caida` muestra un `<canvas>` con la partida lista y no muestra `.game-arena`.
- [x] Los demás juegos no jugables (por ejemplo `/jugar/serpentina`) conservan simulación y `.game-arena`.
- [x] ROCAS se comporta igual que antes (controles, pausa, HUD con `3x`, fin, ranking) y los criterios de la SPEC 05 siguen cumpliéndose.
- [x] `components/game-player.tsx` no contiene `isRocas` ni `game.id === "..."`, y `components/asteroids-canvas.tsx` ya no existe.
- [x] El tablero es de 10×20 y aparece una pieza arriba y la siguiente en el panel `SIGUIENTE` a la derecha.
- [x] Salen las 8 piezas, incluida la tuerca 3×3 con hueco central (`N`), con colores distintos.
- [x] `←` y `→` mueven la pieza una columna y no la sacan del tablero ni la meten en bloques fijados.
- [x] `↑` y `X` rotan en sentido horario; pegada a una pared, la rotación se desplaza por _wall kick_ si cabe y se descarta si no.
- [x] `↓` baja una fila y suma 1 punto; `Espacio` deja caer la pieza al instante, suma 2 puntos por celda recorrida y fija la pieza.
- [x] La pieza fantasma se dibuja al 20 % de opacidad en la posición de aterrizaje y coincide con donde cae la pieza con `Espacio`.
- [x] Limpiar 1, 2, 3 y 4 líneas a la vez suma 100, 300, 500 y 800 puntos multiplicados por el nivel, y el HUD muestra el nuevo total.
- [x] El stat `Líneas` del HUD cuenta las líneas limpiadas y el nivel pasa de `01` a `02` al llegar a 10 líneas.
- [x] La pieza baja sola cada 1000 ms en el nivel 1 y el intervalo se acorta 90 ms por nivel hasta un mínimo de 100 ms.
- [x] El HUD no muestra Vidas.
- [x] La tecla `P` pausa y reanuda a través del estado de la plataforma: el botón pasa de `PAUSA` a `REANUDAR`, aparece "EN PAUSA" y una segunda pulsación reanuda sin saltos.
- [x] Pulsar `P` con la partida terminada (modal abierto) no hace nada.
- [x] La partida termina cuando la pieza nueva colisiona al aparecer y se abre el modal "FIN DEL JUEGO" con la puntuación final; no hay "GAME OVER" dibujado en el canvas.
- [x] `PAUSA` congela el juego y muestra "EN PAUSA"; `REANUDAR` continúa sin que la pieza salte varias filas de golpe.
- [x] Tras pulsar `PAUSA` y `REANUDAR` con el ratón, `Espacio` deja caer la pieza y no vuelve a activar el botón.
- [x] `FIN` durante la partida abre el mismo modal con la puntuación actual y detiene el juego.
- [x] "JUGAR DE NUEVO" empieza con tablero vacío, puntuación 0, nivel `01`, `Líneas` 0 y la caída a velocidad de nivel 1, sin duplicar el bucle tras reiniciar varias veces.
- [x] Escribir las iniciales en el modal (incluida la barra espaciadora) no mueve ni suelta ninguna pieza.
- [x] Con sesión iniciada, "GUARDAR PUNTUACIÓN" crea una fila en `scores` con `game_id = 'caida'`, el `user_id` del usuario y la puntuación final mostrada.
- [x] Esa marca aparece en `/salon-de-la-fama` (pestaña CAÍDA) y en el panel de `/juegos/caida` sin vaciar la caché a mano, y `Partidas` sube en 1.
- [x] Sin sesión, el modal conserva el campo de iniciales, guarda en `localStorage["av_scores"]` y muestra `INICIA SESIÓN PARA ENTRAR AL RANKING`; no se crea fila en `scores`.
- [x] Las flechas y `Espacio` no hacen scroll de la página durante la partida.
- [x] Al pulsar `SALIR` o navegar a otra ruta se cancela el bucle y se quitan los listeners: las teclas recuperan su comportamiento normal y no hay errores en consola.
- [x] Con React StrictMode en desarrollo hay un único bucle activo (una sola pieza cayendo, velocidad normal).
- [x] Los colores `I`, `O`, `T` y `S` del canvas salen de `--cyan`, `--yellow`, `--magenta` y `--green`, y el dibujo tiene brillo neón.
- [x] El canvas conserva la proporción 7:10 a 1280 px y a 390 px, y a 390 px `/jugar/caida` no tiene scroll horizontal.
- [x] A 1280 px de ancho y 800 px de alto el marco CRT de `/jugar/caida` cabe entero en la ventana sin scroll vertical dentro del reproductor.
- [x] `/juegos/caida` ya no muestra `PRÓXIMAMENTE` y la descripción menciona la tuerca, la pieza fantasma y la subida de nivel cada 10 líneas.
- [x] `get_advisors` de seguridad no reporta avisos nuevos tras la migración.
- [x] La consola del navegador no muestra errores ni warnings en `/jugar/caida` durante una partida completa. Nota: el motor no genera errores; persiste el aviso de Next sobre `params` fuera de `<Suspense>` en `/jugar/[id]` y `/juegos/[id]` (SPEC 06), que queda para otra spec.
- [x] Las demás pantallas (Home, Acerca de, Biblioteca, detalle, Salón, acceso) se ven y funcionan igual que antes, salvo el orden del catálogo del criterio siguiente.
- [x] La Biblioteca lista primero los juegos con `playable = true` (`caida`, `rocas`) y después los simulados, cada grupo en su `sort_order`.

---

## Decisiones

- **Sí:** reutilizar la fila `caida` del catálogo (`update`, no `insert`). Ya tiene id, portada `cover-tetro`, categoría y color; `playable` y `long` son lo único que cambia.
- **Sí:** corregir `long` para que describa lo que el juego hace de verdad (8 piezas con la tuerca, fantasma, siguiente pieza, nivel cada 10 líneas). El texto anterior no mencionaba nada de esto.
- **Sí:** extraer el contrato y el registro antes de portar Tetris, en la misma spec. Sin ellos habría un segundo `if` por juego; con ellos, portar el siguiente es motor + entrada en `ENGINES` + migración.
- **No:** dejar el refactor para otra spec. El registro no tiene sentido sin un segundo motor que lo use, y separarlos dejaría `isRocas` conviviendo con `isCaida`.
- **Sí:** el contrato añade `onPauseKey` opcional para la tecla `P`. La plataforma sigue siendo la única dueña del estado de pausa; el motor solo avisa. Se descartó que el motor pause por sí mismo porque el botón `PAUSA` y "EN PAUSA" se desincronizarían.
- **Sí:** conservar las 8 piezas, incluida la tuerca `N`, aunque el README diga 7. Manda el código y la tuerca es el rasgo distintivo de esta versión.
- **Sí:** selección de pieza uniforme al azar, como el original. **No:** bolsa de 7 ni SRS; son mecánicas nuevas.
- **Sí:** la pieza siguiente se dibuja dentro del canvas (420×600, panel de 120 px). Evita ampliar el contrato con un segundo canvas o un stat gráfico y mantiene el HUD de texto como único cuadro de mandos.
- **No:** dibujar `SCORE`, `LINES`, `LEVEL`, los controles ni `PAUSA`/`GAME OVER` en el canvas. Los muestra la plataforma, como en ROCAS; la etiqueta `SIGUIENTE` es parte de la vista previa, no del HUD.
- **Sí:** `Líneas` como stat extra y `onLives(null)`. Tetris no tiene vidas y el HUD no debe mostrar `—` en su lugar.
- **Sí:** el nivel sale de `onLevel`, calculado como en el original, y no de la puntuación como en la simulación.
- **Sí:** conservar `P` para pausar, además del botón de la plataforma. Es una tecla del original y el coste es un callback opcional.
- **Sí:** `preventDefault` solo en flechas y `Espacio` con la partida activa; `X` y `P` no lo necesitan.
- **Sí:** paleta del tema para `I`, `O`, `T`, `S` y cuatro colores fijos para `Z`, `J`, `L` y `N`. Ocho piezas necesitan ocho colores distinguibles y el tema solo tiene cuatro.
- **No:** conservar los colores pastel del original ni el interruptor de tema claro/oscuro: desentonan con el CRT neón de la plataforma.
- **Sí:** `dt` acotado a 50 ms. Es la única desviación de la lógica de tiempo del original, necesaria para no soltar varias filas de golpe al volver de una pausa o de otra pestaña.
- **Sí:** el soft drop y el hard drop suman puntos como en el original; la caída por gravedad no suma.
- **Sí:** `max_score` se queda en 1.000.000, valor de la SPEC 06. Una partida larga de Tetris queda muy por debajo; se ajusta con una migración si hay datos reales que lo justifiquen.
- **Sí:** sin sonido ni assets. No hay `public/games/caida/`.
- **Sí:** los textos de la UI siguen en español.
- **Sí:** ordenar el catálogo con los juegos jugables primero, en `fetchGames` (`.order("playable", { ascending: false })` antes de `.order("sort_order")`). Se añadió fuera del plan original, a petición del autor, para que la Biblioteca muestre los juegos reales antes que los simulados. Un único origen del orden evita ordenar en cada pantalla. Efecto colateral aceptado: la Home (`slice(0, 6)`) y las pestañas del Salón de la Fama siguen el mismo orden. Sin migración: es una consulta.

---

## Riesgos

| Riesgo                                                                                        | Mitigación                                                                                                                                                                       |
| --------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| El refactor rompe ROCAS                                                                       | El paso 3 verifica ROCAS completa (controles, pausa, `3x`, fin, ranking) antes de empezar Tetris; cada paso deja el sistema funcionando.                                         |
| El canvas vertical 7:10 no cabe en el marco CRT pensado para 4:3 y obliga a hacer scroll      | `.crt-screen` toma el `aspect-ratio` del registro y `.crt-fit` calcula `max-width` con `--game-aspect`; un criterio comprueba que el marco cabe a 1280×800 y a 390 px.           |
| La tecla `P` se desincroniza con el botón `PAUSA`                                             | El motor solo avisa con `onPauseKey`; el estado de pausa vive en `GamePlayer` y `pause`/`resume` se derivan de él.                                                               |
| Mantener `Espacio` pulsado suelta varias piezas seguidas (el original no filtraba `e.repeat`) | Se conserva el comportamiento del original; si resulta incómodo en las pruebas, se ignora `e.repeat` para `Espacio` en el paso 8 sin tocar las demás mecánicas.                  |
| Tras `PAUSA` con el ratón, `Espacio` vuelve a activar el botón                                | `preventDefault` en `Espacio` con la partida activa; si no basta, quitar el foco del botón tras el clic. Un criterio lo comprueba.                                               |
| Las flechas y `Espacio` hacen scroll en la página                                             | `preventDefault` solo con la partida activa y el foco fuera de campos de texto.                                                                                                  |
| El motor atrapa teclas y rompe el campo de iniciales del modal                                | Con la partida terminada el motor ignora todas las teclas y no llama a `preventDefault`. Un criterio lo comprueba.                                                               |
| Tras aplicar la migración, el catálogo cacheado sigue con `playable = false`                  | La caché de `getGames()` caduca con su `cacheLife`; en desarrollo se reinicia `npm run dev`. Si persiste, invalidar la etiqueta `games`. El criterio se comprueba tras recargar. |
| Dos instancias del bucle por StrictMode                                                       | `destroy` cancela `requestAnimationFrame` y quita los listeners; sin estado global; carga dinámica con bandera `cancelled`.                                                      |
| `shadowBlur` en un tablero con hasta 200 bloques penaliza el rendimiento                      | Brillo moderado, aplicado por bloque con valor bajo; se ajusta en el paso 8 sin tocar mecánicas.                                                                                 |
| Sin controles táctiles el juego no es jugable en móvil                                        | Aceptado: solo se garantiza que no haya scroll horizontal. Táctil va en otra spec.                                                                                               |
| Cliente falsificado envía una puntuación alta dentro del tope                                 | Aceptado (SPEC 06). Anti-trampas serio queda para otra spec.                                                                                                                     |

---

## Lo que **no** está en esta spec

- Controles táctiles o gamepad.
- Sonido y música.
- Tema claro/oscuro del original.
- Pieza _hold_, bolsa de 7, SRS, _lock delay_, T-spins, combos y más de una pieza siguiente.
- Pausa automática al perder el foco, `devicePixelRatio` y pantalla completa.
- Anti-trampas, rate limit, Realtime y subida de las puntuaciones de `localStorage`.
- Arkanoid (`04-arkanoid`) y el resto de juegos simulados.
- Tests automatizados.

Cada uno, si llega, va en su propia spec.
