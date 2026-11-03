# SPEC JAM — INVASORES · Variante B: Niveles

> **Estado:** Borrador
> **Depende de:** SPEC 05, SPEC 06, SPEC 07, SPEC 08
> **Fecha:** 2026-11-02
> **Tema:** INVASORES
> **Objetivo:** Crear un motor TypeScript de tirador fijo registrado como `invasores`, en el que esporas alienígenas caen en columnas y cristalizan el suelo al aterrizar, con 8 niveles diseñados a mano y selector de nivel en la pausa, jugable en `/jugar/invasores` con el HUD, la pausa y el modal de la plataforma y ranking real en Supabase.

---

## Por qué existe esta spec

INVASORES es un tirador fijo original: una colonia de **esporas** alienígenas cae en vertical sobre una superficie lunar dividida en 16 columnas, y el jugador mueve un cañón de luz por el raíl inferior y dispara hacia arriba. El tema «invasores» se traduce en la mecánica, no solo en la estética: **una espora que toca el suelo no termina la partida, lo conquista**. Esa columna se convierte en un **cristal** y pasa a ser terreno invadido: el cañón la cruza al 35 % de su velocidad y no puede disparar mientras está encima. Cada espora que dejas pasar te quita territorio útil y deja esa columna sin defensa. Si los cristales llegan a 8, la invasión ha triunfado. Si una espora cae sobre el cañón, pierdes una vida. Al limpiar un nivel, cada columna que siga libre suma puntos: defender la superficie también puntúa.

El diseño evita a propósito las reglas icónicas del género comercial: no hay formación en rejilla que marcha de lado a lado y baja, ni búnkeres destructibles, ni nave misteriosa, ni disparos enemigos. Los enemigos caen en columnas independientes según un guion por nivel, y la amenaza es el terreno que se pierde.

`invasores` ya existe en el catálogo como juego simulado. Según el seed de `supabase/migrations/20261030120000_games_and_scores.sql` tiene `playable = false`, `cover-invaders`, categoría SHOOTER, color `green`, `sort_order` 5 y `max_score = 1000000`, y ninguna migración posterior lo cambia. Se reutiliza la fila con un `update`. Es el segundo SHOOTER jugable tras ROCAS (`references/implemented-games.md`), pero el juego es otro: ROCAS es una nave con rotación, inercia y disparo en 360°, y aquí el cañón se mueve en un único eje y dispara en una sola dirección. Es también el candidato mejor puntuado de `game-planner` (`.claude/agent-memory/game-planner/suggestions.md`, 26/30, `recomendado`).

**Esta variante (B, Niveles)** añade al núcleo **8 niveles diseñados uno a uno** en `lib/games/invasores/levels.ts`. Cada nivel tiene nombre, guion de filas, velocidad, ritmo y cristales iniciales que reducen el terreno útil desde el principio. También tiene un bonus de superficie al limpiar cada nivel y el selector de nivel de la pausa (`levels: 8` en el registro y `goToLevel` en el motor, como BLOQUE BUSTER). No tiene sonido ni assets. Las otras dos variantes son `01-invasores-esencial.md` (10 oleadas por fórmula, sin selector ni bonus) y `03-invasores-ambiciosa.md` (estos 8 niveles, además de sonido, portadoras con power-ups y stats extra en el HUD).

---

## Alcance

**Dentro:**

- Motor en `lib/games/invasores/` (`levels.ts`, `entities.ts` y `engine.ts`) con `createInvasores(canvas, callbacks)`, que cumple el contrato `GameEngine` con `goToLevel`.
- **Superficie:** canvas lógico 800×600, dividido en 16 columnas de 50 px (`col = floor(x / 50)`). Suelo en `y = 560`. Guías de columna tenues.
- **Cañón:** 36×20 px, apoyado en el suelo (de `y = 540` a `y = 560`). Al cargar cada nivel se coloca en el centro de la columna `startCol` del nivel. Se mueve en horizontal a 320 px/s, limitado a `x ∈ [18, 782]`. Si su centro está sobre una columna con cristal, se mueve a 112 px/s (×0,35) y no puede disparar.
- **Disparo:** proyectil de 4×14 px que sale del centro del cañón (`y = 526`) y sube a 600 px/s. Máximo 2 en pantalla y 0,2 s de recarga. Mantener `Espacio` dispara en automático. Cada proyectil impacta como mucho en un enemigo.
- **Enemigos:** caen en vertical por el centro de su columna, sin moverse de lado, y aparecen en `y = −r`. La velocidad base se multiplica por la `speed` del nivel:

  | Tipo     | Carácter | Radio | Velocidad base | Impactos | Puntos | Color       |
  | -------- | -------- | ----- | -------------- | -------- | ------ | ----------- |
  | `espora` | `e`      | 14 px | 60 px/s        | 1        | 10     | `--green`   |
  | `coraza` | `c`      | 18 px | 40 px/s        | 2        | 30     | `--magenta` |
  | `aguja`  | `a`      | 10 px | 130 px/s       | 1        | 20     | `--yellow`  |

  La `coraza` pierde su anillo exterior con el primer impacto y solo puntúa al destruirse.

- **Guion de nivel:** cada nivel es una lista de filas de 16 caracteres (`.` vacío, `e`, `c`, `a`). La fila `i` aparece completa a los `1,0 + i × rowInterval` s de cargar el nivel, con un enemigo en cada columna marcada. Todos los enemigos del guion aparecen siempre, haya o no cristal en su columna.
- **Cristales iniciales:** cada nivel empieza con los cristales de su campo `crystals`. Cuentan para el límite de 8 y el guion nunca coloca enemigos en esas columnas.
- **Contacto con el cañón:** si la caja del enemigo toca el rectángulo del cañón, el enemigo desaparece sin dar puntos, se pierde una vida y el cañón queda invulnerable 1,0 s (parpadea). Un contacto durante la invulnerabilidad elimina al enemigo sin coste.
- **Aterrizaje y cristales:** si el enemigo llega al suelo (`y + r ≥ 560`) sin tocar el cañón, su columna se cristaliza. Si la columna ya tenía cristal, el enemigo se absorbe sin efecto. Con 8 cristales (iniciales incluidos) la partida termina.
- **Fin de nivel:** cuando ya han aparecido todas las filas y no queda ningún enemigo vivo. Suma el **bonus de superficie**: 10 puntos por cada columna sin cristal. Tras limpiar los niveles 1 a 7 hay un respiro de 2,0 s y se carga el siguiente, con sus cristales iniciales (los del nivel anterior desaparecen). Al limpiar el nivel 8, y tras sumar su bonus, la partida termina.
- **Los 8 niveles** (datos completos en Modelo de datos):

  | Nivel | Nombre          | Velocidad | Ritmo  | Cristales iniciales | Esporas | Corazas | Agujas | Puntos | Bonus máx. | Total |
  | ----- | --------------- | --------- | ------ | ------------------- | ------- | ------- | ------ | ------ | ---------- | ----- |
  | 1     | PRIMER CONTACTO | ×1,00     | 1,6 s  | —                   | 15      | 0       | 0      | 150    | 160        | 310   |
  | 2     | CORAZAS         | ×1,05     | 1,5 s  | —                   | 14      | 7       | 0      | 350    | 160        | 510   |
  | 3     | AGUJAS          | ×1,10     | 1,4 s  | 0, 15               | 9       | 4       | 9      | 390    | 140        | 530   |
  | 4     | GRIETA          | ×1,15     | 1,35 s | 7, 8                | 12      | 8       | 10     | 560    | 140        | 700   |
  | 5     | LLUVIA          | ×1,20     | 0,9 s  | —                   | 38      | 2       | 4      | 520    | 160        | 680   |
  | 6     | ESCALERA        | ×1,25     | 1,1 s  | 3, 12               | 12      | 6       | 7      | 440    | 140        | 580   |
  | 7     | MURALLA         | ×1,30     | 1,3 s  | 0, 1, 14, 15        | 10      | 18      | 10     | 840    | 120        | 960   |
  | 8     | COLMENA         | ×1,40     | 1,0 s  | 5, 10               | 18      | 14      | 18     | 960    | 140        | 1.100 |

- **Selector de nivel en la pausa:** ya existe en `components/game-player.tsx` desde la SPEC 08 y se activa con `levels: 8` en el registro. Elegir un nivel llama a `goToLevel(n)`, que empieza **una partida nueva desde ese nivel**: puntuación 0, 3 vidas y los cristales iniciales del nivel `n`.
- **Fin de partida:** sin vidas, con 8 cristales, al limpiar el nivel 8 o al llamar a `end()`. Todos llaman a `onGameOver(score)`.
- **HUD de la plataforma:** Puntuación, Vidas (3) y Nivel (de `onLevel`). Sin stats extra: `onStats([])`.
- **Controles:** `←` `→` y `A` `D` mueven el cañón mientras se mantienen pulsadas. `Espacio` dispara. `P` y `Escape` llaman a `onPauseKey`. Se bloquean con `preventDefault` solo `ArrowLeft`, `ArrowRight` y `Space`, con la partida activa y el foco fuera de `input`/`textarea`.
- **Dibujo:** neón con las variables del tema y `shadowBlur` moderado (entre 6 y 12). El cañón va en `--cyan`, los proyectiles en `--ink` y los enemigos en los colores de la tabla. Los cristales son tres esquirlas en `--green` (relleno al 35 %, trazo pleno) de 50×40 px sobre el suelo. Los cristales iniciales se distinguen por un trazo más oscuro (`--green` al 60 %). Un campo de 60 estrellas estáticas en `--ink` muy tenue se genera al crear el motor.
- **Entrada en el registro:** `ENGINES["invasores"]` con canvas 800×600 y `levels: 8`.
- **Migración** `supabase/migrations/20261102120000_invasores_playable.sql`: `update` de la fila `invasores` con `playable = true`, `max_score = 5370`, `short` y `long` nuevos.
- Sin tocar `app/globals.css` ni `components/`: la portada `cover-invaders` ya existe y el selector de nivel y sus estilos (`.level-picker`) ya están.

**Fuera de alcance (para futuras specs):**

- Sonido, música, power-ups, enemigos portadores y stats extra en el HUD (variante C).
- Disparos enemigos, movimiento lateral de los enemigos y jefes.
- Combos y multiplicadores.
- Editor de niveles, niveles aleatorios o más de 8 niveles.
- Conservar la puntuación al saltar de nivel desde la pausa.
- Controles táctiles, gamepad y ratón.
- Pausa automática al perder el foco, ajuste a `devicePixelRatio` y pantalla completa.
- Anti-trampas, rate limit y Realtime (siguen fuera, como en la SPEC 06).
- Portar los otros tres juegos simulados.
- Tests automatizados (no hay runner configurado).

---

## Modelo de datos

```ts
// lib/games/invasores/levels.ts
export type EnemyChar = "e" | "c" | "a"; // espora, coraza, aguja; "." = vacío

export interface LevelDef {
  name: string;
  speed: number; // multiplicador de la velocidad base de los enemigos
  rowInterval: number; // s entre filas
  crystals: number[]; // columnas con cristal inicial
  startCol: number; // columna inicial del cañón (sin cristal)
  rows: string[]; // 16 caracteres por fila, de la primera en aparecer a la última
}

export const LEVELS: LevelDef[] = [
  {
    name: "PRIMER CONTACTO",
    speed: 1.0,
    rowInterval: 1.6,
    crystals: [],
    startCol: 7,
    rows: [
      "......e.........",
      "..........e.....",
      "...e............",
      "............e...",
      ".......e........",
      "..e..........e..",
      ".....e....e.....",
      "e..............e",
      "....e......e....",
      ".......ee.......",
    ],
  },
  {
    name: "CORAZAS",
    speed: 1.05,
    rowInterval: 1.5,
    crystals: [],
    startCol: 7,
    rows: [
      "....e......e....",
      ".......c........",
      "..e..........e..",
      "...........c....",
      "...c............",
      ".e....e..e....e.",
      "......c..c......",
      "..e..e....e..e..",
      "c..............c",
      ".....e....e.....",
    ],
  },
  {
    name: "AGUJAS",
    speed: 1.1,
    rowInterval: 1.4,
    crystals: [0, 15],
    startCol: 7,
    rows: [
      "......a.........",
      "...e.......e....",
      "..........a.....",
      ".c......c.......",
      "....a......a....",
      "..e..e..e..e..e.",
      ".....c....c.....",
      "...a...a...a....",
      ".e............e.",
      "......aa........",
    ],
  },
  {
    name: "GRIETA",
    speed: 1.15,
    rowInterval: 1.35,
    crystals: [7, 8],
    startCol: 5,
    rows: [
      "..e..........e..",
      "....a......a....",
      ".c............c.",
      "......e..e......",
      "..a..........a..",
      "e.....c..c.....e",
      "...e..a..a..e...",
      ".c...e....e...c.",
      "....c......c....",
      "..a...e..e...a..",
      "a..............a",
    ],
  },
  {
    name: "LLUVIA",
    speed: 1.2,
    rowInterval: 0.9,
    crystals: [],
    startCol: 7,
    rows: [
      "e...e...e...e...",
      "..e...e...e...e.",
      ".e...e...e...e..",
      "...e...e...e...e",
      "a.......a.......",
      "e...e...e...e...",
      "..e...e...e...e.",
      ".......a.......a",
      ".e...e...e...e..",
      "...e...e...e...e",
      "..c.........c...",
      "e..e..e..e..e..e",
    ],
  },
  {
    name: "ESCALERA",
    speed: 1.25,
    rowInterval: 1.1,
    crystals: [3, 12],
    startCol: 7,
    rows: [
      "e...............",
      ".e..............",
      "..e.............",
      "....a...........",
      ".....e..........",
      "......c.........",
      ".......e........",
      "........e.......",
      ".........c......",
      "..........e.....",
      "...........a....",
      ".............e..",
      "..............e.",
      "...............e",
      "..............a.",
      "........c..c....",
      ".a..c......c..a.",
      "e......aa......e",
    ],
  },
  {
    name: "MURALLA",
    speed: 1.3,
    rowInterval: 1.3,
    crystals: [0, 1, 14, 15],
    startCol: 7,
    rows: [
      "..c..c..c..c....",
      "....e......e....",
      "...c...cc...c...",
      "..a..........a..",
      ".....e.ee.e.....",
      "..c.c......c.c..",
      "......a..a......",
      "...e..c..c..e...",
      "..a.a.....a.a...",
      "....cc....cc....",
      "..e....aa....e..",
    ],
  },
  {
    name: "COLMENA",
    speed: 1.4,
    rowInterval: 1.0,
    crystals: [5, 10],
    startCol: 7,
    rows: [
      "..e..........e..",
      "....a......a....",
      ".c..e..cc..e..c.",
      "...a........a...",
      "e.e....ee....e.e",
      "......a..a......",
      "..c.c......c.c..",
      ".a...........a..",
      "...e..e..e..e...",
      "c......aa......c",
      "..e.a..cc..a.e..",
      "......e..e......",
      ".a.c........c.a.",
      "...aa......aa...",
    ],
  },
];
```

```ts
// lib/games/invasores/entities.ts
export const W = 800;
export const H = 600;
export const COLS = 16;
export const COL_W = 50; // W / COLS
export const GROUND_Y = 560;

export const CANNON_W = 36;
export const CANNON_H = 20;
export const CANNON_Y = GROUND_Y - CANNON_H; // 540, borde superior
export const CANNON_SPEED = 320; // px/s
export const CRYSTAL_SLOW = 0.35;
export const INVULN_TIME = 1.0; // s

export const SHOT_W = 4;
export const SHOT_H = 14;
export const SHOT_SPEED = 600; // px/s
export const MAX_SHOTS = 2;
export const FIRE_COOLDOWN = 0.2; // s

export const START_LIVES = 3;
export const CRYSTAL_LIMIT = 8; // incluidos los iniciales
export const CRYSTAL_H = 40;
export const SURFACE_BONUS = 10; // por columna sin cristal al limpiar un nivel

export const FIRST_ROW_DELAY = 1.0; // s desde la carga del nivel
export const BREATHER = 2.0; // s entre niveles
export const STAR_COUNT = 60;

export type EnemyKind = "espora" | "coraza" | "aguja";

export interface EnemySpec {
  r: number;
  speed: number; // px/s base
  hp: number;
  points: number;
}

export const ENEMIES: Record<EnemyKind, EnemySpec> = {
  espora: { r: 14, speed: 60, hp: 1, points: 10 },
  coraza: { r: 18, speed: 40, hp: 2, points: 30 },
  aguja: { r: 10, speed: 130, hp: 1, points: 20 },
};

export const CHAR_TO_KIND: Record<EnemyChar, EnemyKind> = {
  e: "espora",
  c: "coraza",
  a: "aguja",
};

export interface Enemy {
  kind: EnemyKind;
  col: number;
  x: number; // col * COL_W + COL_W / 2
  y: number;
  vy: number; // ENEMIES[kind].speed * level.speed
  hp: number;
}

export interface Shot {
  x: number;
  y: number; // borde superior
  prevY: number;
}

export interface Crystal {
  col: number;
  initial: boolean; // viene del nivel; solo cambia el dibujo
}

export interface Cannon {
  x: number;
  invuln: number; // s restantes
}

export interface Palette {
  cannon: string; // --cyan
  shot: string; // --ink
  espora: string; // --green
  coraza: string; // --magenta
  aguja: string; // --yellow
  crystal: string; // --green
  ground: string; // --ink con baja opacidad
}

export function columnOf(x: number): number; // clamp(floor(x / COL_W), 0, COLS - 1)
export function levelMaxScore(level: LevelDef): number; // puntos del guion + SURFACE_BONUS * (COLS - crystals.length)

// Dibujo: drawStars, drawGround, drawCrystal, drawEnemy, drawShot, drawCannon(ctx, ..., palette)
```

```ts
// lib/games/invasores/engine.ts
export function createInvasores(
  canvas: HTMLCanvasElement,
  callbacks: GameCallbacks,
): GameEngine; // con goToLevel
```

```ts
// lib/games/registry.ts (se añade una entrada)
invasores: {
  width: 800,
  height: 600,
  levels: 8,
  load: () => import("./invasores/engine").then((m) => m.createInvasores),
},
```

Convenciones:

- Coordenadas en píxeles lógicos con origen arriba a la izquierda. Velocidades en px/s y tiempos en segundos.
- **Bucle:** `requestAnimationFrame` con `dt` en segundos acotado a 0,05. `lastTime` se reinicia en `resume`. Movimiento continuo, sin paso lógico fijo.
- **Orden de cada fotograma:** (1) temporizadores (recarga, invulnerabilidad, reloj del nivel, respiro); (2) aparición de las filas cuyo tiempo ha llegado; (3) movimiento del cañón; (4) disparo; (5) movimiento de proyectiles y enemigos; (6) impactos; (7) contactos con el cañón y aterrizajes; (8) fin de nivel y de partida; (9) dibujo.
- **Carga de nivel (`loadLevel(n)`):** vacía enemigos y proyectiles, pone los cristales iniciales de `LEVELS[n − 1]`, coloca el cañón en `startCol × 50 + 25`, quita la invulnerabilidad, pone a cero el reloj del nivel y el índice de la siguiente fila, y llama a `onLevel(n)`.
- **Reloj del nivel:** la fila `i` aparece cuando el reloj supera `FIRST_ROW_DELAY + i × rowInterval`. Si en un fotograma vencen varias filas, aparecen todas.
- **Cañón y disparo:** como en el núcleo. `vx = ±CANNON_SPEED`, por `CRYSTAL_SLOW` si `columnOf(x)` tiene cristal. Se dispara con `Espacio` pulsado, recarga a 0, menos de 2 proyectiles y la columna del centro sin cristal.
- **Impacto barrido:** el proyectil ocupa el rectángulo `x ± 2` entre `y` y `prevY + SHOT_H`. Impacta si cruza la caja del enemigo (`x ± r`, `y ± r`). Entre varias, gana la de mayor `y`.
- **Contacto con el cañón:** caja del enemigo contra el rectángulo `x ± 18`, `540..560`. Se comprueba antes que el aterrizaje.
- **Bonus de superficie:** al limpiar un nivel, `+10 × (16 − cristales)`, con los cristales que haya en ese momento (iniciales incluidos). Se suma de una vez y emite un solo `onScore`.
- **`goToLevel(n)`:** ignora valores fuera de 1..8 y llamadas con la partida terminada. Dentro de rango empieza una partida nueva desde el nivel `n`: puntuación 0, 3 vidas, teclas vaciadas y `loadLevel(n)`. Emite `onScore(0)` y `onLives(3)` si cambian. La plataforma reanuda la partida tras llamarlo.
- **Mapeo a callbacks:** `onScore(score)` al destruir un enemigo, al sumar el bonus, en `restart` y en `goToLevel`; `onLives(n)` al crear, en `restart`, en `goToLevel` y al perder una vida; `onLevel(n)` en cada `loadLevel`; `onStats([])` una vez al crear y en `restart`; `onGameOver(score)` al quedarse sin vidas, al formarse el 8.º cristal, tras el bonus del nivel 8 o con `end()`. Cada callback solo se llama si el valor cambia.
- **`max_score` = 5.370.** Una partida legítima solo suma de dos fuentes: enemigos destruidos (cada uno puntúa una vez) y un bonus por nivel limpiado. La puntuación máxima se da al empezar en el nivel 1 y limpiar los 8 sin formar ningún cristal: Σ (puntos del guion + 10 × (16 − cristales iniciales)) = 310 + 510 + 530 + 700 + 680 + 580 + 960 + 1.100 = **5.370** (4.210 de enemigos y 1.160 de bonus). Saltar de nivel pone la puntuación a 0, así que no se puede repetir un nivel para acumular. Todas las puntuaciones son múltiplos de 10.
- **Paleta:** se lee una vez al crear el motor con `getComputedStyle(document.documentElement)` (`--cyan`, `--magenta`, `--yellow`, `--green`, `--ink`), con valores por defecto iguales a los del tema.
- **Estado en clausura:** cañón, proyectiles, enemigos, cristales, nivel, reloj, índice de fila, fase (`"playing" | "breather"`), temporizadores, puntuación, vidas, teclas pulsadas y estrellas viven en la clausura de `createInvasores`. `LEVELS` es una constante de solo lectura. No hay estado de módulo mutable.
- **Teclado en `window`**, quitado en `destroy`. Las teclas pulsadas se guardan en un `Set` que se vacía en `restart`, `goToLevel` y `destroy`. `P` y `Escape` (sin `e.repeat`) llaman a `callbacks.onPauseKey?.()`. Con la partida terminada el motor ignora todas las teclas y no llama a `preventDefault`.
- Sin HUD ni overlays en el canvas: ni puntuación, ni nombre del nivel, ni bonus, ni «GAME OVER». El nombre del nivel queda en `levels.ts` para el acabado visual de una spec futura.
- El motor no guarda puntuaciones: solo llama a `onGameOver(finalScore)`.

---

## Plan de implementación

Antes de empezar, leer en `node_modules/next/dist/docs/` la guía de componentes cliente (`"use client"`) y la de Cache Components, como exige `AGENTS.md`. Leer `components/game-player.tsx` (overlay de pausa y `.level-picker`), `components/game-canvas.tsx` (`goToLevel` en el `GameHandle`), `lib/games/contract.ts`, `lib/games/registry.ts`, `lib/games/bloque-buster/engine.ts` (motor de referencia con `goToLevel`) y las reglas `.crt`, `.crt-screen`, `.crt-fit`, `.hud-stat` y `.level-picker` de `app/globals.css`. Invocar `/frontend-design` para el acabado visual del cañón, las esporas y los cristales, como indica `CLAUDE.md`. Antes y después de la migración, ejecutar `list_tables` y `get_advisors` de seguridad del MCP de Supabase.

1. Crear `lib/games/invasores/levels.ts` con `EnemyChar`, `LevelDef` y los 8 niveles tal como aparecen en esta spec. Verificación: `npm run lint` y `npm run build` pasan. Todas las filas tienen 16 caracteres, ningún enemigo cae en una columna de `crystals`, ningún `startCol` tiene cristal y los recuentos coinciden con la tabla de Alcance (15, 21, 22, 30, 44, 25, 38 y 50 enemigos).
2. Crear `lib/games/invasores/entities.ts` con las constantes, los tipos, `ENEMIES`, `CHAR_TO_KIND`, `columnOf`, `levelMaxScore` y las funciones de dibujo. Verificación: compila. La suma de `levelMaxScore` de los 8 niveles es 5.370.
3. Crear `lib/games/invasores/engine.ts` con `createInvasores`: estado en clausura, teclado, bucle con `dt` acotado, `loadLevel`, reloj y aparición de filas, cañón con ralentización sobre cristal, disparo, caída, impacto barrido, corazas, contacto e invulnerabilidad, cristales, bonus de superficie, paso de nivel con respiro, fin por vidas, por cristales y por victoria, `pause`, `resume`, `restart`, `end`, `goToLevel` y `destroy`, con callbacks solo al cambiar. Verificación: compila y `npm run lint` pasa.
4. Añadir `invasores` a `ENGINES` en `lib/games/registry.ts` (800×600, `levels: 8`). Verificación: `/jugar/invasores` muestra el motor real en lugar de `.game-arena`, se puede jugar, la pausa muestra `SALTAR AL NIVEL` con 8 botones y saltar al 4 carga GRIETA con los cristales 7 y 8. Mientras `playable` siga en `false`, la partida se guarda solo en `localStorage`.
5. Crear `supabase/migrations/20261102120000_invasores_playable.sql` y aplicarla (MCP `apply_migration` o CLI):

   ```sql
   update public.games
   set playable = true,
       max_score = 5370,
       short = 'Derriba las esporas antes de que cristalicen tu suelo.',
       long = 'Esporas alienígenas caen en columnas sobre la superficie a lo largo de ocho niveles, cada uno con su guion y su terreno ya invadido. Mueve tu cañón con las flechas o A/D y dispara con Espacio: espora 10 puntos, aguja 20 y coraza, que aguanta dos impactos, 30. La que toca el suelo lo cristaliza: tu cañón cruza ese tramo despacio y no puede disparar sobre él. Al limpiar un nivel, cada columna libre suma 10. Desde la pausa puedes empezar en cualquier nivel.'
   where id = 'invasores';
   ```

   Ejecutar `get_advisors` de seguridad. Verificación: `select playable, max_score from games where id = 'invasores'` devuelve `true` y `5370`, `/juegos/invasores` ya no muestra `PRÓXIMAMENTE` y una partida con sesión crea una fila en `scores`.

6. Acabado visual: brillo del cañón, de las esporas y de los cristales (iniciales y formados), parpadeo de invulnerabilidad, guías de columna, estrellas, selector de nivel con 8 botones y revisión a 1280 px y 390 px. Verificación: capturas de `/jugar/invasores` en ambos anchos, en juego y en pausa con el selector, en `.playwright-screenshots/` (`invasores-1280.png`, `invasores-390.png`, `invasores-pausa-390.png`) y sin scroll horizontal.

---

## Criterios de aceptación

- [ ] `npm run lint` y `npm run build` terminan sin errores ni warnings de Cache Components o hidratación.
- [ ] `select playable, max_score from games where id = 'invasores'` devuelve `true` y `5370`, y `ENGINES["invasores"]` existe con `levels: 8`.
- [ ] `/jugar/invasores` muestra un `<canvas>` con la partida lista y no muestra `.game-arena`.
- [ ] Los demás juegos no jugables (por ejemplo `/jugar/gloton`) conservan simulación y `.game-arena`.
- [ ] ROCAS, CAÍDA, BLOQUE BUSTER y SERPENTINA se comportan igual que antes (controles, pausa, HUD, ranking). La pausa de BLOQUE BUSTER sigue mostrando 5 niveles.
- [ ] `components/game-player.tsx` no contiene `game.id === "..."` y no se modifica en esta spec.
- [ ] Al empezar no hay cristales, el cañón está en la columna 7 y la primera espora aparece en la columna 6 en torno a 1 s después.
- [ ] `←` `→` y `A` `D` mueven el cañón mientras se mantienen pulsadas, sin salir del canvas, y la página no hace scroll al pulsarlas.
- [ ] `Espacio` dispara. Mantenido, dispara en automático con no más de 2 proyectiles en pantalla a la vez.
- [ ] Destruir una espora suma exactamente 10 puntos y una aguja 20. Una coraza pierde su anillo con el primer impacto, no suma nada y suma 30 al segundo.
- [ ] Un proyectil no destruye dos enemigos y ningún enemigo lo atraviesa sin ser impactado (se comprueba con las agujas del nivel 8).
- [ ] Una espora que llega al suelo sin tocar el cañón deja un cristal verde en su columna y no resta vida.
- [ ] Con el centro del cañón sobre un cristal, el cañón se mueve visiblemente más despacio y `Espacio` no dispara.
- [ ] Un enemigo que cae sobre un cristal ya existente desaparece sin crear otro.
- [ ] Un enemigo que toca el cañón resta una vida, no deja cristal y el cañón parpadea 1 s sin perder más vidas.
- [ ] El HUD muestra Puntuación, Vidas y Nivel `01` al empezar, y no muestra stats extra.
- [ ] Al limpiar el nivel 1 sin cristales la puntuación sube exactamente 160 de una vez (bonus de superficie). Con 2 cristales sube 140.
- [ ] Tras el bonus hay un respiro de unos 2 s y el Nivel pasa a `02`. Los cristales del nivel anterior desaparecen.
- [ ] El nivel 3 empieza con cristales en las columnas 0 y 15, el 4 en la 7 y la 8 (con el cañón en la 5), el 6 en la 3 y la 12, el 7 en la 0, 1, 14 y 15, y el 8 en la 5 y la 10.
- [ ] Los niveles 1 a 8 tienen 15, 21, 22, 30, 44, 25, 38 y 50 enemigos.
- [ ] Con 8 cristales, contando los iniciales, se abre el modal «FIN DEL JUEGO» con la puntuación final (en el nivel 7 bastan 4 cristales nuevos).
- [ ] Al perder la tercera vida se abre el mismo modal. No se dibuja ningún «GAME OVER» en el canvas.
- [ ] Al limpiar el nivel 8 se suma su bonus y se abre el mismo modal (máximo 5.370 en una partida desde el nivel 1). No se dibuja ningún mensaje de victoria.
- [ ] En pausa aparece `SALTAR AL NIVEL` con 8 botones y el del nivel actual resaltado. Pulsar el 4 carga GRIETA (cristales en 7 y 8, HUD `04`), pone la puntuación a 0 y las vidas a 3, y reanuda la partida.
- [ ] Ningún botón del selector aparece en la pausa de ROCAS, CAÍDA ni SERPENTINA.
- [ ] `P` y `Escape` pausan y reanudan a través del estado de la plataforma: el botón pasa de `PAUSA` a `REANUDAR`, aparece «EN PAUSA» y una segunda pulsación reanuda sin que los enemigos salten de golpe.
- [ ] Pulsar `P` o `Escape` con la partida terminada (modal abierto) no hace nada.
- [ ] `PAUSA` congela cañón, proyectiles, enemigos y el reloj del nivel: tras reanudar, las filas siguen apareciendo al ritmo del nivel.
- [ ] Tras pulsar `PAUSA` y `REANUDAR` con el ratón, `Espacio` dispara y no vuelve a activar el botón, y las flechas no hacen scroll.
- [ ] `FIN` durante la partida abre el modal con la puntuación actual y detiene el juego.
- [ ] «JUGAR DE NUEVO» empieza en el nivel `01` con puntuación 0, 3 vidas y sin cristales, sin duplicar el bucle (la velocidad no cambia tras reiniciar varias veces).
- [ ] Escribir las iniciales en el modal (incluidas `A`, `D` y la barra espaciadora) no mueve ni acciona el juego.
- [ ] Con sesión iniciada, «GUARDAR PUNTUACIÓN» crea una fila en `scores` con `game_id = 'invasores'`, el `user_id` del usuario y la puntuación final mostrada.
- [ ] Insertar por encima de `max_score` falla: la política de inserción rechaza una puntuación de 5.380 en `invasores`.
- [ ] Esa marca aparece en `/salon-de-la-fama` (pestaña INVASORES) y en el panel de `/juegos/invasores` sin vaciar la caché a mano, y `Partidas` sube en 1.
- [ ] Sin sesión, el modal conserva el campo de iniciales, guarda en `localStorage["av_scores"]` y muestra `INICIA SESIÓN PARA ENTRAR AL RANKING`. No se crea fila en `scores`.
- [ ] Al pulsar `SALIR` o navegar a otra ruta se cancela el bucle y se quitan los listeners: las flechas y `Espacio` recuperan su comportamiento normal y no hay errores en consola.
- [ ] Con React StrictMode en desarrollo hay un único bucle activo (un solo cañón, velocidad normal).
- [ ] El cañón, los enemigos y los cristales usan `--cyan`, `--green`, `--magenta`, `--yellow` e `--ink` del tema, y el dibujo tiene brillo neón.
- [ ] El canvas conserva la proporción 4:3 a 1280 px y a 390 px. A 390 px `/jugar/invasores` no tiene scroll horizontal y el selector de 8 botones no desborda.
- [ ] `/juegos/invasores` ya no muestra `PRÓXIMAMENTE`. La descripción menciona los ocho niveles, los cristales, el bonus por columna libre y el salto de nivel desde la pausa, y ya no menciona «filas alienígenas» ni «formación».
- [ ] `get_advisors` de seguridad no reporta avisos nuevos tras la migración.
- [ ] La consola del navegador no muestra errores ni warnings en `/jugar/invasores` durante una partida completa.
- [ ] Las demás pantallas (Home, Acerca de, Biblioteca, detalle, Salón, acceso) se ven y funcionan igual que antes.

---

## Decisiones

- **Sí:** reutilizar la fila `invasores` del catálogo (`update`, no `insert`). Ya tiene id, portada `cover-invaders`, categoría SHOOTER y color verde.
- **Sí:** conservar el título INVASORES. Es una palabra genérica en español y coincide con la fila del catálogo. La identidad propia sale de las esporas, los cristales y el terreno invadido. (decisión del agente, a revisar)
- **Sí:** cambiar `short` además de `long`, porque los textos actuales describen «filas alienígenas» en formación. (decisión del agente, a revisar)
- **Sí:** el giro de diseño: el enemigo que aterriza cristaliza su columna en lugar de terminar la partida. **No:** fin inmediato al tocar el suelo.
- **Sí:** el cristal ralentiza el cañón (×0,35) y le impide disparar, pero no lo bloquea. **No:** cristales que bloquean el paso; encerrarían al cañón y causarían una derrota en cascada. (decisión del agente, a revisar)
- **Sí:** 8 cristales terminan la partida, iniciales incluidos. Así los cristales iniciales son dificultad real: MURALLA empieza con 4 y solo admite 3 errores más. (decisión del agente, a revisar)
- **Sí:** cada nivel empieza con sus cristales iniciales y olvida los del anterior. Cada nivel es una pieza diseñada que no depende de cómo terminó el anterior, y el selector puede cargar cualquiera. **No:** arrastrar cristales entre niveles, como la disolución por oleada de la variante A.
- **Sí:** guion por filas de 16 caracteres en `levels.ts`. Es legible, se revisa a ojo y los recuentos se comprueban contando caracteres. **No:** generación aleatoria; impediría diseñar cada nivel y no da recuentos fijos.
- **Sí:** el guion nunca coloca enemigos en columnas con cristal inicial. Todo enemigo nace donde el cañón puede dispararle, así que el máximo es alcanzable en teoría.
- **Sí:** bonus de superficie de 10 puntos por columna libre al limpiar un nivel. Premia defender el terreno, que es el tema del juego, y está acotado (máximo 160 por nivel). (decisión del agente, a revisar)
- **Sí:** `max_score = 5370`, la suma exacta de enemigos (4.210) y bonus máximos (1.160) de los 8 niveles. **No:** 1.000.000.
- **Sí:** `goToLevel(n)` empieza una partida nueva desde el nivel `n`, con puntuación 0 y 3 vidas. Mantiene el selector que ofrece la plataforma y hace imposible superar el tope. (decisión del agente, a revisar) **No:** conservar la puntuación al saltar, como BLOQUE BUSTER: repetir un nivel sumaría sus puntos varias veces y una partida podría superar 5.370. **No:** puntuar la mejor marca de cada nivel; también es acotada, pero el HUD dejaría de subir al repetir un nivel y confundiría.
- **Sí:** tres tipos de enemigo con los valores de partida de la tabla. Se afinan en el paso 6 sin tocar `max_score`, que solo depende de los guiones y los puntos. (decisión del agente, a revisar)
- **Sí:** sin disparos enemigos, búnkeres, nave misteriosa ni formación que marcha. Son las reglas icónicas del género comercial y el diseño no las necesita.
- **Sí:** el nombre del nivel no se dibuja en el canvas. El contrato prohíbe overlays de texto en el canvas, y el HUD de la plataforma no tiene un campo para el nombre. Mostrarlo iría en otra spec que amplíe el contrato.
- **Sí:** autodisparo con `Espacio` (2 proyectiles, 0,2 s), colisión barrida e invulnerabilidad de 1 s. Mismas razones que en el núcleo: controles mínimos, sin atravesar enemigos y sin perder dos vidas a la vez.
- **Sí:** canvas 800×600 (4:3), como ROCAS, BLOQUE BUSTER y SERPENTINA.
- **Sí:** sin sonido ni assets. Es el alcance de la variante B.
- **Sí:** `P` y `Escape` vía `onPauseKey`, teclado en `window` y `preventDefault` solo en `ArrowLeft`, `ArrowRight` y `Space` con la partida activa.
- **Sí:** no modificar `components/`, `lib/games/contract.ts` ni `app/globals.css`. `goToLevel`, `levels` y el selector ya existen desde la SPEC 08.
- **Sí:** los textos de la UI siguen en español.

---

## Riesgos

| Riesgo                                                                           | Mitigación                                                                                                                                                       |
| -------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| El diseño se percibe como un clon del tirador fijo comercial                     | Sin formación en rejilla, búnkeres, nave misteriosa ni disparo enemigo. Enemigos en columnas, suelo que se cristaliza y niveles con terreno ya invadido.         |
| Un error al copiar los guiones cambia los recuentos y descuadra `max_score`      | El paso 1 verifica 16 caracteres por fila, que no haya enemigos sobre cristales iniciales y los recuentos de la tabla. El paso 2 comprueba que la suma da 5.370. |
| El selector de nivel permite acumular puntos repitiendo niveles                  | `goToLevel` pone la puntuación a 0. Un criterio lo comprueba y la RLS impone `max_score` igualmente.                                                             |
| Un proyectil atraviesa una aguja rápida (nivel 8, 182 px/s) con un `dt` grande   | Colisión barrida entre `prevY` y `y`, y `dt` acotado a 50 ms.                                                                                                    |
| LLUVIA (44 enemigos a 0,9 s por fila) o COLMENA resultan injugables              | `rowInterval` y `speed` por nivel en `levels.ts`, ajustables en el paso 6 sin cambiar los guiones ni `max_score`.                                                |
| Varias filas vencen en un mismo fotograma tras un lag                            | `dt` acotado a 50 ms (menor que el ritmo mínimo de 0,9 s) y aparición de todas las filas vencidas, sin perder ninguna.                                           |
| Dos enemigos caen a la vez sobre el cañón y quitan dos vidas                     | Invulnerabilidad de 1 s tras el primer contacto.                                                                                                                 |
| StrictMode monta el efecto dos veces y deja dos bucles o dos juegos de listeners | `destroy` cancela `requestAnimationFrame` y quita los listeners. Sin estado global. La carga dinámica usa bandera `cancelled`.                                   |
| Tras `PAUSA` con el ratón, `Espacio` vuelve a activar el botón                   | `preventDefault` en `Space` con la partida activa. Si no basta, quitar el foco del botón tras el clic.                                                           |
| Las flechas o `Espacio` hacen scroll en la página                                | `preventDefault` solo con la partida activa y el foco fuera de campos de texto.                                                                                  |
| El motor atrapa teclas y rompe el campo de iniciales del modal                   | Con la partida terminada el motor ignora todas las teclas y no llama a `preventDefault`.                                                                         |
| Una tecla queda «pegada» tras saltar de nivel o soltarla durante la pausa        | El `Set` de teclas se vacía en `restart`, `goToLevel` y `destroy`, y `keyup` sigue escuchando mientras el motor existe.                                          |
| El selector de 8 botones desborda a 390 px                                       | `.level-picker-list` ya usa `flex-wrap` desde la SPEC 08. Un criterio lo comprueba.                                                                              |
| Re-renders de React a 60 fps por los callbacks                                   | Callbacks solo al cambiar el valor.                                                                                                                              |
| `dt` grande al reanudar tras pausa o cambio de pestaña                           | `dt` acotado a 0,05 s y `lastTime` reiniciado en `resume`.                                                                                                       |
| `shadowBlur` en 50 enemigos (COLMENA) penaliza el rendimiento                    | `shadowBlur` entre 6 y 12, y las estrellas sin brillo. Se ajusta en el paso 6 sin tocar mecánicas.                                                               |
| Sin controles táctiles el juego no es jugable en móvil                           | Aceptado: solo se garantiza que no haya scroll horizontal. Táctil va en otra spec.                                                                               |
| Juego `playable = true` sin motor real contamina el ranking                      | La migración y la entrada en `ENGINES` van en la misma spec, y la migración se aplica después de comprobar el motor (paso 5).                                    |
| Tras aplicar la migración, el catálogo cacheado sigue con `playable = false`     | La caché de `getGames()` caduca con su `cacheLife`. En desarrollo se reinicia `npm run dev`. Si persiste, invalidar la etiqueta `games`.                         |
| Cliente falsificado envía una puntuación alta dentro del tope                    | Aceptado (SPEC 06). Con `max_score = 5370` el margen es pequeño. Anti-trampas serio queda para otra spec.                                                        |

---

## Lo que **no** está en esta spec

- Sonido, música, power-ups, portadoras y stats extra en el HUD.
- Disparos enemigos, movimiento lateral, jefes, búnkeres y formaciones.
- Combos y multiplicadores.
- Nombre del nivel visible, editor de niveles, niveles aleatorios y más de 8 niveles.
- Conservar la puntuación al saltar de nivel.
- Controles táctiles, gamepad y ratón.
- Pausa automática al perder el foco, `devicePixelRatio` y pantalla completa.
- Anti-trampas, rate limit, Realtime y subida de las puntuaciones de `localStorage`.
- Los otros tres juegos simulados.
- Tests automatizados.

Cada uno, si llega, va en su propia spec.
