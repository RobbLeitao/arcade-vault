# SPEC 11 — Quinto juego real: RANARIA (cruce de carretera y río)

> **Estado:** Aprobado
> **Depende de:** SPEC 05, SPEC 06, SPEC 07, SPEC 09, SPEC 10
> **Fecha:** 2026-11-03
> **Objetivo:** Crear un motor TypeScript de cruce de carretera y río registrado como `ranaria`, jugable en `/jugar/ranaria` con el HUD, la pausa, el mando táctil y el modal de la plataforma, y con ranking real en Supabase, sobre el contrato y el registro de motores de la SPEC 07.

---

## Por qué existe esta spec

Sustituye a `specs/game-jam/frogger/01-frogger-core.md`. Aquella spec define bien el juego (cuadrícula, zonas, carriles, tortugas, bocas, puntuación), pero se escribió para otra arquitectura. Pedía un componente React con su propio bucle, una play-page propia, `user_id: null` sin RLS e inserción directa en `scores`. Ninguna de esas piezas existe ni encaja en Arcade Vault. Esta spec conserva las mecánicas de aquella y las lleva al contrato de motores: motor en `lib/games/ranaria/`, entrada en `ENGINES`, `GamePlayer` y `submitScore`.

No hay código de referencia en `references/started-games/`. Las mecánicas se **definen aquí**, y esta spec es su única fuente de verdad. Parten de la spec del game jam y de las respuestas del autor en la fase de preguntas.

`ranaria` ya existe en el catálogo como juego simulado (`playable = false`, `cover-rana`, color verde, ARCADE, `sort_order` 7, `max_score = 1000000`). Se reutiliza la fila con un `update`: cambian `playable` y `long`. No se usa el id `frogger` ni el título FROGGER, ni el color `lime`, que no existe en `GameColor`.

---

## Alcance

**Dentro:**

- Motor en `lib/games/ranaria/` (`entities.ts` y `engine.ts`) con `createRanaria(canvas, callbacks, options?)` que cumple el contrato `GameEngine`.
- **Tablero:** canvas lógico 640×560, cuadrícula de 16 columnas × 14 filas de 40 px. Zonas por fila (0 = arriba):
  - Fila 0: metas. Cinco bocas de 2 columnas (columnas 1–2, 4–5, 7–8, 10–11 y 13–14) separadas por seto (columnas 0, 3, 6, 9, 12 y 15).
  - Filas 1–6: río, 6 carriles de troncos y tortugas.
  - Fila 7: mediana segura.
  - Filas 8–12: carretera, 5 carriles de coches y camiones.
  - Fila 13: base de salida, segura.
- **Rana:** empieza en la fila 13, columna 7. Salta exactamente 1 celda en 4 direcciones con una animación de 120 ms. Un salto por pulsación: mantener la tecla no encadena saltos. Una dirección pulsada durante un salto queda en un búfer de 1, y gana la última. No puede saltar fuera de los bordes laterales.
- **Carretera:** coches (1 celda) y camiones (2–3 celdas), con velocidad y sentido fijos por carril. Se mueven en bucle continuo y reaparecen por el lado opuesto. Tocar uno es letal.
- **Río:** troncos (2–4 celdas) y grupos de tortugas (2–3), con velocidad y sentido fijos por carril. La rana solo sobrevive en el río si está sobre un tronco o sobre tortugas a flote, y se desplaza con ellos. Cada grupo de tortugas tiene su propio ciclo: 3 s a flote y 1,5 s sumergido. Sumergido no sirve de apoyo.
- **Muertes:**
  - (a) vehículo;
  - (b) agua;
  - (c) tortuga que se sumerge bajo la rana;
  - (d) el tronco o la tortuga la saca por un borde lateral del río;
  - (e) se agota el tiempo;
  - (f) salta a un seto o a una boca ya ocupada.
- **Temporizador por rana:** `max(8, 16 − nivel)` segundos (15 s en el nivel 1, mínimo 8 s desde el nivel 8). Se reinicia al ocupar una boca, al morir y al empezar ronda.
- **Vidas:** 3. Cada muerte resta una y la rana vuelve a la salida. Con 0 vidas termina la partida.
- **Ronda y nivel:** al llenar las 5 bocas se completa la ronda. Las bocas se vacían, el nivel sube 1 y los carriles se reconstruyen con las velocidades del nuevo nivel (×1,15 por nivel).
- **Puntuación:**
  - +10 por cada fila nueva alcanzada hacia arriba por la rana actual;
  - +50 al ocupar una boca;
  - +10 por cada segundo entero restante al ocupar una boca;
  - +200 al completar la ronda.
- **Fin de partida:** al perder la última vida o al llamar a `end()`. Ambos llaman a `onGameOver(score)`.
- **HUD de la plataforma:** Puntuación, Vidas, Nivel y dos stats, `TIEMPO` (segundos con un decimal) y `BOCAS` (`n/5`). Nada de HUD dibujado en el canvas.
- **Controles:** `←` `↑` `→` `↓` y `W` `A` `S` `D`, leídos por `e.code`. `P` y `Escape` llaman a `onPauseKey`. `preventDefault` solo en las teclas de dirección, con la partida activa y el foco fuera de `input`/`textarea`.
- **Mando táctil (SPEC 10):** `touch` en `ENGINES` con cruceta de 4 botones y sin `repeat`: cada toque es un salto.
- **Dibujo** con primitivas canvas, sin imágenes: fondos por zona, coches con ruedas, camiones con cabina, troncos con vetas, tortugas con caparazón (contorno tenue al sumergirse), rana con ojos y patas extendidas durante el salto, bocas con borde y silueta de rana al ocuparse. Colores en un objeto `Palette` leído del tema (aspecto NEÓN).
- **Entrada en el registro:** `ENGINES["ranaria"]` con canvas 640×560, `touch` y sin `levels`.
- **Migración** `supabase/migrations/20261103120000_ranaria_playable.sql`: `update` de la fila `ranaria` con `playable = true` y `long` corregido.

**Fuera de alcance (para futuras specs):**

- Skins CLÁSICO, NEÓN y RETRO (`skins.ts`, `setSkin`, `skins: true`). Los aplica el agente `skin-designer` justo después de esta spec, dentro de `/spec-impl-game`.
- Revisión móvil más allá de declarar `touch`: la hace `mobile-porter` dentro de `/spec-impl-game`.
- Sprites y assets externos, sonido y música.
- Animaciones de muerte (explosión, partículas, salpicadura).
- Mosca bonus en las bocas, cocodrilos, serpientes en la mediana, rana hembra a rescatar, aviso de las tortugas antes de sumergirse.
- Selector de nivel en la pausa.
- Barra de tiempo dibujada en el canvas.
- Gamepad, swipe sobre el canvas, pausa automática al perder el foco, `devicePixelRatio` y pantalla completa.
- Anti-trampas, rate limit, Realtime y subida de las puntuaciones de `localStorage`.
- Portar los otros juegos simulados (`gloton`, `invasores`, `duelo-pixel`).
- Tests automatizados (no hay runner configurado).

---

## Modelo de datos

```ts
// lib/games/ranaria/entities.ts
export const CELL = 40;
export const COLS = 16;
export const ROWS = 14;
export const W = COLS * CELL; // 640
export const H = ROWS * CELL; // 560

export const ROW_GOALS = 0;
export const ROW_RIVER_TOP = 1;
export const ROW_RIVER_BOT = 6;
export const ROW_SAFE_MID = 7;
export const ROW_ROAD_TOP = 8;
export const ROW_ROAD_BOT = 12;
export const ROW_START = 13;
export const START_COL = 7;

export const GOAL_COLS = [1, 4, 7, 10, 13]; // primera columna de cada boca (ancho 2)
export const START_LIVES = 3;
export const HOP_MS = 120;
export const LANE_SPAN = 20; // COLS + 4: longitud del circuito de cada carril, en celdas
export const LEVEL_SPEEDUP = 1.15; // multiplicador por nivel, compuesto
export const MAX_SPEED_LEVEL = 10; // a partir de aquí la velocidad deja de subir
export const TURTLE_UP_S = 3;
export const TURTLE_DOWN_S = 1.5;
export const HITBOX_MARGIN = 0.2; // celdas recortadas por cada lado de la rana en carretera

export const POINTS_STEP = 10;
export const POINTS_GOAL = 50;
export const POINTS_PER_SECOND_LEFT = 10;
export const POINTS_ROUND = 200;

export type Direction = "up" | "down" | "left" | "right";
export type EntityType = "car" | "truck" | "log" | "turtle";

export interface Entity {
  col: number; // borde izquierdo, en celdas (fraccionario)
  width: number; // celdas
  type: EntityType;
  variant: number; // 0..2: color de coche; sin uso en el resto
  diveT?: number; // solo tortugas: segundos dentro del ciclo de 4,5 s
  submerged?: boolean; // solo tortugas
}

export interface Lane {
  row: number;
  speed: number; // celdas/s, ya escalada por nivel
  dir: 1 | -1; // 1 = hacia la derecha
  entities: Entity[];
}

export interface Frog {
  col: number; // fraccionario en el río, entero fuera de él
  row: number;
  animating: boolean;
  animT: number; // ms dentro del salto
  fromCol: number;
  fromRow: number;
  targetCol: number;
  targetRow: number;
  facing: Direction;
}

export interface Palette {
  road: string; // --bg
  water: string; // --cyan muy oscurecido
  safe: string; // --green oscurecido
  hedge: string; // --green oscurecido
  goal: string; // --bg-3
  goalBorder: string; // --gold
  cars: [string, string, string]; // --magenta, --yellow, --cyan
  truck: string; // --silver
  log: string; // --bronze
  turtle: string; // --green
  frog: string; // --green
  eye: string; // --ink
  glow: number; // multiplicador de shadowBlur (NEÓN = 1)
}

export function timeLimit(level: number): number; // max(8, 16 - level)
export function speedFactor(level: number): number; // LEVEL_SPEEDUP ** (min(level, MAX_SPEED_LEVEL) - 1)
export function buildLanes(level: number): Lane[];
```

Carriles del nivel 1. La velocidad en celdas/s equivale a los px/frame a 60 fps de la spec del game jam: 1,5 px/frame = 2,25 celdas/s.

| Fila | Zona      | Sentido | Velocidad | Entidades              | Posiciones iniciales (`col`) |
| ---- | --------- | ------- | --------- | ---------------------- | ---------------------------- |
| 1    | río       | →       | 1,5       | 3 troncos de 4         | 0, 7, 14                     |
| 2    | río       | →       | 4,5       | 4 troncos de 2         | 0, 5, 10, 15                 |
| 3    | río       | ←       | 2,25      | 4 grupos de 2 tortugas | 0, 5, 10, 15                 |
| 4    | río       | →       | 3         | 2 troncos de 4         | 0, 10                        |
| 5    | río       | →       | 1,5       | 3 troncos de 3         | 0, 7, 14                     |
| 6    | río       | ←       | 2,25      | 3 grupos de 3 tortugas | 0, 7, 14                     |
| 8    | carretera | ←       | 2,25      | 2 camiones de 3        | 0, 10                        |
| 9    | carretera | →       | 3,75      | 3 camiones de 2        | 0, 7, 14                     |
| 10   | carretera | ←       | 6         | 2 coches               | 0, 10                        |
| 11   | carretera | →       | 3         | 3 coches               | 1, 8, 15                     |
| 12   | carretera | ←       | 2,25      | 3 coches               | 0, 7, 14                     |

```ts
// lib/games/ranaria/engine.ts
export function createRanaria(
  canvas: HTMLCanvasElement,
  callbacks: GameCallbacks,
  options?: CreateGameOptions, // se acepta y se ignora hasta que skin-designer añada setSkin
): GameEngine; // sin goToLevel
```

```ts
// lib/games/registry.ts (se añade una entrada)
ranaria: {
  width: 640,
  height: 560,
  touch: {
    // Cruceta: un toque = un salto; sin autorrepetición.
    move: [
      btn("ArrowUp", "↑", "Saltar hacia arriba"),
      btn("ArrowLeft", "←", "Saltar a la izquierda"),
      btn("ArrowRight", "→", "Saltar a la derecha"),
      btn("ArrowDown", "↓", "Saltar hacia abajo"),
    ],
    moveShape: "cross",
    actions: [],
  },
  load: () => import("./ranaria/engine").then((m) => m.createRanaria),
},
```

Convenciones:

- Coordenadas por celda `(col, row)` con origen arriba a la izquierda. Se dibuja en `col * CELL`, `row * CELL`. Las entidades y la rana en el río tienen `col` fraccionario.
- **Movimiento de carriles:** `entity.col += lane.speed * lane.dir * dt`, con `dt` en segundos. Con `dir = 1`, si `col >= COLS`, entonces `col -= LANE_SPAN`. Con `dir = -1`, si `col + width <= 0`, entonces `col += LANE_SPAN`. Un mismo `LANE_SPAN` por carril conserva los huecos entre entidades para siempre.
- **Velocidad por nivel:** `buildLanes(level)` multiplica la velocidad de la tabla por `speedFactor(level)`. En el nivel 10 es ×3,52 y desde ahí ya no sube.
- **Tortugas:** `diveT` avanza con `dt` y da la vuelta cada 4,5 s. `submerged = diveT >= TURTLE_UP_S`. El grupo `i` de cada carril empieza con `diveT = i * 1.5`, para que nunca se sumerjan todos a la vez.
- **Salto:** si la rana no está saltando y hay dirección en el búfer, se calcula el destino (`col ± 1` o `row ± 1`). Si el destino queda fuera de `0 ≤ col ≤ COLS − 1` o de `0 ≤ row ≤ ROWS − 1`, el salto se descarta. Durante los 120 ms la rana se dibuja interpolada entre origen y destino, no deriva y no colisiona. Al aterrizar, si la fila destino no es de río, `col = Math.round(col)`.
- **Resolución al aterrizar y en cada fotograma sin salto:**
  - Fila 0: la celda es `Math.round(col)`. Si cae dentro de una boca libre, la ocupa (+50 y +10 por segundo entero restante) y la rana vuelve a la salida con el tiempo reiniciado. Si cae en seto o en una boca ocupada, muere.
  - Río: `getSupport` busca en el carril de la fila una entidad con `col + 0.5` dentro de `[entity.col, entity.col + width)`. Una tortuga sumergida no cuenta. Sin apoyo, muere. Con apoyo, la rana se desplaza como la entidad, y si `col < 0` o `col > COLS − 1`, muere.
  - Carretera: muere si el tramo `[col + HITBOX_MARGIN, col + 1 − HITBOX_MARGIN]` se solapa con `[entity.col, entity.col + width)` de algún vehículo de su fila. También se comprueba en cada fotograma, porque los coches la alcanzan aunque esté quieta.
- **Puntos por avance:** la rana actual guarda `bestRow` (empieza en 13). Al aterrizar en una fila menor que `bestRow`, suma 10 y actualiza `bestRow`. `bestRow` vuelve a 13 cada vez que sale una rana nueva (tras boca o muerte).
- **Muerte:** resta una vida y llama a `onLives(lives)`. Si quedan vidas, la rana vuelve a `(START_COL, ROW_START)`, se reinicia el temporizador y se vacía el búfer. Si no quedan, la partida termina y se llama a `onGameOver(score)`, después de `onLives(0)`.
- **Ronda completa:** al ocupar la quinta boca se suman además los 200, se vacían las bocas, el nivel sube, se llama a `onLevel(level)` y se reconstruyen los carriles.
- **Bucle:** `requestAnimationFrame`, con `dt` acotado a 0,05 s y `lastTime` reiniciado en `resume`. En pausa no hay lógica. El último fotograma queda pintado y no corre el tiempo.
- **Mapeo a callbacks:**
  - `onScore` al cambiar;
  - `onLives(3)`, `onLevel(1)` y `onStats` al crear y en `restart`;
  - `onLives` en cada muerte y `onLevel` en cada ronda nueva;
  - `onStats` cuando cambia `TIEMPO` (a pasos de 0,1 s) o `BOCAS`;
  - `onGameOver(score)` al perder la última vida o con `end()`.
- **Stats:** `{ key: "time", label: "Tiempo", value: "12.3", color }` y `{ key: "goals", label: "Bocas", value: "2/5", color: "cyan" }`. El color de `TIEMPO` es `green` por encima del 50 % del límite, `yellow` hasta el 25 % y `magenta` por debajo.
- **Paleta:** se lee una vez al crear el motor con `getComputedStyle(document.documentElement)`, con valores por defecto iguales a los del tema. Dibujo neón con `shadowBlur` moderado escalado por `palette.glow`. Los efectos son campos de la paleta, nunca `if` por skin, para que `skin-designer` pueda añadir CLÁSICO y RETRO sin tocar la lógica.
- Sin estado global de módulo. Todo (carriles, rana, bocas, búfer, vidas, nivel, puntuación, temporizador) vive en la clausura de `createRanaria`.
- **Teclado** en `window`, quitado en `destroy`. Se ignoran los `keydown` con `e.repeat`. `P` y `Escape` no pausan por sí mismos: llaman a `callbacks.onPauseKey?.()`. Con la partida terminada el motor ignora todas las teclas y no llama a `preventDefault`. En pausa, las direcciones no entran en el búfer.
- El motor no guarda puntuaciones: solo llama a `onGameOver(finalScore)`.

---

## Plan de implementación

**Antes de empezar:**

- Leer en `node_modules/next/dist/docs/` la guía de componentes cliente (`"use client"`) y la de Cache Components, como exige `AGENTS.md`.
- Leer `components/game-player.tsx`, `components/game-canvas.tsx`, `components/touch-controls.tsx`, `lib/games/contract.ts`, `lib/games/registry.ts`, `lib/games/touch.ts` y `lib/games/serpentina/engine.ts`, que es el motor de cuadrícula de referencia.
- Invocar `/frontend-design` para el acabado visual del tablero y de las entidades, como indica `CLAUDE.md`.
- Antes y después de la migración, ejecutar `list_tables` y `get_advisors` de seguridad del MCP de Supabase.

1. Crear `lib/games/ranaria/entities.ts` con las constantes, los tipos, `timeLimit`, `speedFactor`, `buildLanes` (tabla del nivel 1) y las funciones de dibujo con firma `(ctx, …, palette)`: `drawBoard` (zonas, setos y bocas), `drawLane` (coche, camión, tronco, tortuga a flote y sumergida) y `drawFrog` (en reposo y saltando).
   Verificación: `npm run lint` y `npm run build` pasan. `timeLimit(1) = 15`, `timeLimit(8) = 8` y `timeLimit(12) = 8`. `buildLanes(1)` devuelve 11 carriles con al menos 2 entidades cada uno (comprobado leyendo el código).
2. Crear `lib/games/ranaria/engine.ts` con `createRanaria`: estado en clausura, paleta del tema, bucle con `dt` acotado, movimiento y envoltura de carriles, ciclo de tortugas y dibujo de cada fotograma. Teclado, `pause`, `resume`, `restart`, `end` y `destroy`. Todavía sin rana jugable: la rana se dibuja quieta en la salida.
   Verificación: compila y `npm run lint` pasa.
3. Añadir la rana: búfer de dirección, salto de 120 ms con límites laterales, deriva sobre troncos y tortugas, colisiones de carretera, agua y bordes, bocas, temporizador por rana, vidas, puntos por avance, ronda y nivel, y todos los callbacks solo al cambiar.
   Verificación: compila y `npm run lint` pasa.
4. Añadir `ranaria` a `ENGINES` en `lib/games/registry.ts` (640×560, cruceta táctil, sin `levels`).
   Verificación: `/jugar/ranaria` muestra el motor real en lugar de `.game-arena`, se puede jugar una partida completa y la pausa con `P` funciona. Mientras `playable` siga en `false`, la partida se guarda solo en `localStorage`.
5. Crear `supabase/migrations/20261103120000_ranaria_playable.sql` y aplicarla (MCP `apply_migration` o CLI):

   ```sql
   update public.games
   set playable = true,
       long = 'Guía a tu rana por cinco carriles de coches y camiones y por un río de troncos y tortugas que se sumergen. Salta celda a celda con las flechas o WASD y llena las cinco bocas del otro lado antes de que se agote el tiempo de cada rana: cada ronda completada acelera el tráfico y acorta el reloj. Tienes 3 vidas.'
   where id = 'ranaria';
   ```

   Ejecutar `get_advisors` de seguridad.
   Verificación: `select playable, max_score from games where id = 'ranaria'` devuelve `true` y `1000000`. `/juegos/ranaria` ya no muestra `PRÓXIMAMENTE`, y una partida con sesión crea una fila en `scores`.

6. Acabado visual: brillo de las entidades, legibilidad de las tortugas sumergidas, ruedas y cabinas, ojos y patas de la rana, y revisión a 1280 px y 390 px.
   Verificación: capturas de `/jugar/ranaria` en ambos anchos en `.playwright-screenshots/` y sin scroll horizontal.

---

## Criterios de aceptación

- [ ] `npm run lint` y `npm run build` terminan sin errores ni warnings de Cache Components o hidratación.
- [ ] `select playable, max_score from games where id = 'ranaria'` devuelve `true` y `1000000`, y `ENGINES["ranaria"]` existe con `touch` y sin `levels`.
- [ ] `/jugar/ranaria` muestra un `<canvas>` de 640×560 con la partida lista y no muestra `.game-arena`.
- [ ] Los demás juegos no jugables (por ejemplo `/jugar/gloton`) conservan simulación y `.game-arena`.
- [ ] ROCAS, CAÍDA, BLOQUE BUSTER y SERPENTINA se comportan igual que antes (controles, pausa, HUD, ranking, mando táctil).
- [ ] `components/game-player.tsx` no contiene `game.id === "..."` y no se modifica en esta spec.
- [ ] El canvas muestra diferenciadas la base de salida, la carretera, la mediana, el río y la fila de metas con 5 bocas y setos.
- [ ] Al empezar, la rana está en la fila 13, columna 7.
- [ ] Cada pulsación de `←` `↑` `→` `↓` o `W` `A` `S` `D` mueve la rana exactamente una celda con una animación visible de 120 ms. La página no hace scroll.
- [ ] Mantener pulsada una dirección produce un solo salto.
- [ ] En las columnas 0 y 15, saltar hacia fuera no hace nada.
- [ ] Coches y camiones recorren sus carriles en su sentido y reaparecen por el lado opuesto con los mismos huecos.
- [ ] Troncos y tortugas recorren sus carriles, y la rana se desplaza con ellos al estar encima.
- [ ] Cada grupo de tortugas pasa 3 s a flote y 1,5 s sumergido, y no todos los grupos de un carril se sumergen a la vez.
- [ ] La rana muere al tocar un vehículo, también si está quieta y el vehículo la alcanza.
- [ ] La rana muere al saltar al agua sin tronco ni tortugas a flote debajo.
- [ ] La rana muere cuando el grupo de tortugas que la sostiene se sumerge.
- [ ] La rana muere si el tronco o las tortugas la sacan por un borde lateral.
- [ ] La rana muere al agotarse `TIEMPO`.
- [ ] La rana muere al saltar a un seto o a una boca ya ocupada.
- [ ] Al morir, Vidas baja en 1 en el HUD, la rana vuelve a la salida y `TIEMPO` se reinicia.
- [ ] Llegar a una boca libre la marca con una rana y suma 50 más 10 por cada segundo entero restante. Después, la rana vuelve a la salida con `TIEMPO` reiniciado y `BOCAS` sube en 1.
- [ ] Cada fila nueva alcanzada hacia arriba suma 10. Bajar y volver a subir a una fila ya alcanzada por la misma rana no suma.
- [ ] Al llenar las 5 bocas se suman 200, las bocas se vacían, `BOCAS` vuelve a `0/5` y el HUD pasa al nivel `02`.
- [ ] En el nivel 2 los carriles se mueven más rápido que en el nivel 1, y `TIEMPO` empieza en 14,0.
- [ ] El HUD muestra Puntuación, Vidas 3, Nivel `01`, `TIEMPO` 15,0 y `BOCAS` `0/5` al empezar. `TIEMPO` baja a pasos de 0,1 s y cambia de color (verde, amarillo, magenta).
- [ ] Perder la tercera vida abre el modal «FIN DEL JUEGO» con la puntuación final, y en el canvas no se dibuja ningún «GAME OVER» ni ningún HUD.
- [ ] `P` y `Escape` pausan y reanudan a través del estado de la plataforma: el botón pasa de `PAUSA` a `REANUDAR`, aparece «EN PAUSA» y una segunda pulsación reanuda sin saltos bruscos de los carriles.
- [ ] Durante la pausa los carriles, las tortugas y `TIEMPO` no avanzan, y las direcciones no mueven la rana al reanudar.
- [ ] Pulsar `P` o `Escape` con la partida terminada (modal abierto) no hace nada.
- [ ] Tras pulsar `PAUSA` y `REANUDAR` con el ratón, las flechas mueven la rana y no hacen scroll ni activan el botón.
- [ ] `FIN` durante la partida abre el modal con la puntuación actual y detiene el juego.
- [ ] «JUGAR DE NUEVO» empieza con nivel `01`, puntuación 0, 3 vidas y bocas vacías, sin duplicar el bucle (la velocidad no cambia tras reiniciar varias veces).
- [ ] Escribir las iniciales en el modal (incluidas `W`, `A`, `S`, `D` y las flechas) no mueve la rana.
- [ ] En un dispositivo táctil aparece la cruceta. Cada toque da exactamente un salto, y mantener el dedo no encadena saltos.
- [ ] Con sesión iniciada, «GUARDAR PUNTUACIÓN» crea una fila en `scores` con `game_id = 'ranaria'`, el `user_id` del usuario y la puntuación final mostrada.
- [ ] Esa marca aparece en `/salon-de-la-fama` (pestaña RANARIA) y en el panel de `/juegos/ranaria` sin vaciar la caché a mano, y `Partidas` sube en 1.
- [ ] Sin sesión, el modal conserva el campo de iniciales, guarda en `localStorage["av_scores"]` y muestra `INICIA SESIÓN PARA ENTRAR AL RANKING`. No se crea fila en `scores`.
- [ ] Al pulsar `SALIR` o navegar a otra ruta se cancela el bucle y se quitan los listeners: las flechas recuperan su comportamiento normal y no hay errores en consola.
- [ ] Con React StrictMode en desarrollo hay un único bucle activo (una sola rana y velocidad normal).
- [ ] Los colores del canvas salen de las variables del tema y el dibujo tiene brillo neón.
- [ ] El canvas conserva su proporción 8:7 a 1280 px y a 390 px, y a 390 px `/jugar/ranaria` no tiene scroll horizontal.
- [ ] `/juegos/ranaria` ya no muestra `PRÓXIMAMENTE` y la descripción menciona carretera, río, tortugas que se sumergen, cinco bocas, el tiempo por rana y las 3 vidas. Ya no menciona «nenúfares».
- [ ] `get_advisors` de seguridad no reporta avisos nuevos tras la migración.
- [ ] La consola del navegador no muestra errores ni warnings en `/jugar/ranaria` durante una partida completa.
- [ ] Las demás pantallas (Home, Acerca de, Biblioteca, detalle, Salón, acceso) se ven y funcionan igual que antes.

---

## Decisiones

- **Sí:** reutilizar la fila `ranaria` del catálogo con un `update`, como manda `/nuevo-juego` cuando existe equivalente. Ya tiene id, portada `cover-rana`, ARCADE y verde.
- **No:** id `frogger`, título FROGGER y color `lime`. El catálogo ya tiene el equivalente con nombre propio, y `lime` no existe en `GameColor`.
- **Sí:** corregir `long`. El texto anterior hablaba de «nenúfares». El nuevo describe las mecánicas reales: tortugas que se sumergen, cinco bocas, tiempo por rana y 3 vidas.
- **Sí:** `max_score` se queda en 1.000.000. El juego no tiene final (las rondas se repiten), así que no hay un máximo exacto como en SERPENTINA o BLOQUE BUSTER.
- **Sí:** motor en `lib/games/ranaria/` con el contrato `GameEngine`, `GamePlayer` y `submitScore`. **No:** el componente `FroggerGame.tsx`, la play-page `app/games/frogger/play/page.tsx`, la inserción con `user_id: null` ni el «sin RLS» de la spec del game jam. Rompían el contrato, las rutas reales (`/jugar/[id]`, `/juegos/[id]`, `/salon-de-la-fama`) y la RLS de `scores` (SPEC 06).
- **Sí:** canvas de 640×560 (16 × 14 celdas de 40 px), como fijan las constantes y las decisiones de la spec del game jam. **No:** el 480×640 que aparecía en su alcance, que contradecía sus propias constantes.
- **Sí:** metas en la fila 0, río en las filas 1–6, mediana en la 7, carretera en las 8–12 y salida en la 13, según las constantes de la spec del game jam. Las bocas van en las columnas 1–2, 4–5, 7–8, 10–11 y 13–14, con seto entre ellas, para que la fila quede simétrica.
- **Sí:** sin HUD dibujado en el canvas (regla 4 del contrato). **No:** el «doble HUD» de la spec del game jam: los demás juegos de la plataforma ya no lo usan.
- **Sí:** `TIEMPO` y `BOCAS` como stats del HUD de la plataforma, con `TIEMPO` cambiando de color, por decisión del autor. **No:** una barra de tiempo en el canvas.
- **Sí:** temporizador por rana, de 15 s, que se reinicia al ocupar una boca, al morir y al empezar ronda, por decisión del autor. Baja 1 s por nivel hasta un mínimo de 8 s. **No:** 15 s para toda la ronda: llenar 5 bocas en 15 s es casi imposible.
- **Sí:** +10 por fila nueva alcanzada por la **rana actual** (se reinicia con cada rana). Es coherente con el temporizador por rana y es la regla clásica del género. La spec del game jam decía «por primera vez en la ronda». Con esa lectura, las ranas 2 a 5 no sumarían por avanzar. **A revisar** si el autor prefiere la lectura literal.
- **Sí:** +50 por boca, +10 por segundo entero restante y +200 por ronda, como en la spec del game jam.
- **Sí:** 3 vidas, y la rana vuelve a la salida sin animación de muerte. Las animaciones quedan fuera, como en la spec del game jam.
- **Sí:** velocidades ×1,15 por nivel, compuestas, como en la spec del game jam, con tope en el nivel 10 (×3,52). Sin tope, el carril más rápido pasaría de 2 celdas por fotograma y podría atravesar a la rana sin detectar la colisión. **A revisar.**
- **Sí:** la tabla de carriles del nivel 1 convierte a celdas/s los rangos de la spec del game jam (1,5–4 px/frame en carretera y 1–3 px/frame en el río, a 60 fps). Son valores de partida y se afinan en el paso 6 sin tocar las mecánicas.
- **Sí:** circuito de `LANE_SPAN = 20` celdas por carril. **No:** reintroducir cada entidad en `-width` o en `COLS`, como decía la spec del game jam, porque con anchos distintos alteraría los huecos.
- **Sí:** tortugas con ciclo de 3 s a flote y 1,5 s sumergidas, con un desfase de 1,5 s entre grupos del mismo carril. **No:** aviso antes de sumergirse, que no estaba en la spec del game jam.
- **Sí:** movimiento discreto (un salto de 120 ms por pulsación, sin encadenar al mantener la tecla) y un búfer de 1 dirección durante el salto. **No:** movimiento continuo.
- **Sí:** en el río la rana conserva su `col` fraccionaria y se recoloca en la celda entera al salir. Las bocas se resuelven con `Math.round(col)`.
- **Sí:** margen de 0,2 celdas por lado en la colisión con vehículos, para no castigar roces de un píxel.
- **Sí:** flechas y WASD por `e.code`, por decisión del autor. `P`/`Escape` llaman a `onPauseKey`: la plataforma es la única dueña de la pausa.
- **Sí:** mando táctil en cruceta sin `repeat` (SPEC 10). La spec del game jam lo dejaba fuera, pero la regla 11 del contrato lo exige para que el juego sea jugable en móvil.
- **Sí:** primitivas canvas y una `Palette` leída del tema, sin sprites ni assets.
- **Sí:** los skins (`skins.ts`, `setSkin`, `skins: true`) los aplica `skin-designer` después de esta spec, dentro de `/spec-impl-game`, por decisión del autor. Mientras tanto el juego se ve con la paleta NEÓN y sin selector de skin. El motor acepta `options` para no tener que cambiar la firma después.
- **Sí:** sin sonido ni selector de nivel en la pausa.
- **Sí:** no modificar `components/game-player.tsx`, `components/game-canvas.tsx`, `components/touch-controls.tsx` ni `app/globals.css`. El contrato ya cubre este juego y la portada `cover-rana` existe.
- **Sí:** los textos de la UI siguen en español.

---

## Riesgos

| Riesgo                                                                         | Mitigación                                                                                                                                                                  |
| ------------------------------------------------------------------------------ | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Los carriles de la tabla resultan imposibles o triviales                       | Velocidades y posiciones en `buildLanes`, ajustables en el paso 6 sin cambiar la lógica. Todos los carriles dejan huecos de al menos 1 celda.                               |
| En niveles altos un vehículo atraviesa a la rana entre dos fotogramas          | `dt` acotado a 0,05 s y velocidad con tope en el nivel 10: el carril más rápido avanza como mucho 1,06 celdas por fotograma, menos que el ancho de un vehículo más la rana. |
| La rana fraccionaria en el río cae «entre» dos bocas o dos celdas              | `Math.round(col)` al aterrizar fuera del río y en la fila de metas. Un criterio lo comprueba.                                                                               |
| Un grupo de tortugas se sumerge justo al aterrizar y parece una muerte injusta | Desfase entre grupos y contorno tenue al sumergirse. El aviso previo queda para otra spec.                                                                                  |
| Muertes en cadena al reaparecer si un coche pasa por la salida                 | La fila 13 es segura y no tiene vehículos.                                                                                                                                  |
| El temporizador emite `onStats` a 60 fps y provoca re-renders                  | Solo se emite cuando cambia el valor redondeado a 0,1 s o cambia `BOCAS`.                                                                                                   |
| `dt` grande al reanudar tras una pausa o un cambio de pestaña                  | `dt` acotado a 0,05 s y `lastTime` reiniciado en `resume`.                                                                                                                  |
| StrictMode monta el efecto dos veces y deja dos bucles o dos listeners         | `destroy` cancela `requestAnimationFrame` y quita los listeners. Sin estado global. La carga dinámica usa la bandera `cancelled`.                                           |
| Las teclas `W` `A` `S` `D` rompen el campo de iniciales del modal              | Con la partida terminada el motor ignora todas las teclas y no llama a `preventDefault`.                                                                                    |
| Tras `PAUSA` con el ratón, las flechas mueven el foco o hacen scroll           | `preventDefault` en las direcciones con la partida activa. Si no basta, quitar el foco del botón tras el clic.                                                              |
| Canvas 8:7 casi cuadrado: en móvil vertical deja poco sitio a la cruceta       | `.crt-fit` y `.player-stage.has-touch` ya ajustan el canvas. Lo revisa `mobile-porter` dentro de `/spec-impl-game`.                                                         |
| Sin skins, el selector de la pausa no aparece para RANARIA                     | Esperado hasta que `skin-designer` declare `skins: true`, inmediatamente después de esta spec.                                                                              |
| Tras aplicar la migración, el catálogo cacheado sigue con `playable = false`   | La caché de `getGames()` caduca con su `cacheLife`. En desarrollo se reinicia `npm run dev`, y si persiste se invalida la etiqueta `games`.                                 |
| Un cliente falsificado envía una puntuación alta dentro del tope               | Aceptado (SPEC 06). Anti-trampas serio queda para otra spec, y `max_score` se ajusta con una migración.                                                                     |

---

## Lo que **no** está en esta spec

- Skins CLÁSICO, NEÓN y RETRO, y su selector: los aplica `skin-designer` después, dentro de `/spec-impl-game`.
- Sprites, assets, sonido y música.
- Animaciones de muerte.
- Mosca bonus, cocodrilos, serpientes, rana hembra y aviso de las tortugas.
- Barra de tiempo en el canvas y selector de nivel.
- Gamepad, swipe, pausa automática al perder el foco, `devicePixelRatio` y pantalla completa.
- Anti-trampas, rate limit, Realtime y subida de las puntuaciones de `localStorage`.
- Los otros juegos simulados.
- Tests automatizados.

Cada uno, si llega, va en su propia spec.
