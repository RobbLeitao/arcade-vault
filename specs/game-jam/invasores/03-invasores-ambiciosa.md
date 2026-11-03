# SPEC JAM — INVASORES · Variante C: Ambiciosa

> **Estado:** Borrador
> **Depende de:** SPEC 05, SPEC 06, SPEC 07, SPEC 08, SPEC 09
> **Fecha:** 2026-11-02
> **Tema:** INVASORES
> **Objetivo:** Crear un motor TypeScript de tirador fijo registrado como `invasores`, en el que esporas alienígenas caen en columnas y cristalizan el suelo al aterrizar, con 8 niveles diseñados a mano, selector de nivel, portadoras que sueltan power-ups, efectos de sonido precargados y stats extra en el HUD, jugable en `/jugar/invasores` con ranking real en Supabase.

---

## Por qué existe esta spec

INVASORES es un tirador fijo original: una colonia de **esporas** alienígenas cae en vertical sobre una superficie lunar dividida en 16 columnas, y el jugador mueve un cañón de luz por el raíl inferior y dispara hacia arriba. El tema «invasores» se traduce en la mecánica, no solo en la estética: **una espora que toca el suelo no termina la partida, lo conquista**. Esa columna se convierte en un **cristal** y pasa a ser terreno invadido: el cañón la cruza al 35 % de su velocidad y no puede disparar mientras está encima. Cada espora que dejas pasar te quita territorio útil y deja esa columna sin defensa. Si los cristales llegan a 8, la invasión ha triunfado. Si una espora cae sobre el cañón, pierdes una vida. Al limpiar un nivel, cada columna que siga libre suma puntos.

El diseño evita a propósito las reglas icónicas del género comercial: no hay formación en rejilla que marcha de lado a lado y baja, ni búnkeres destructibles, ni nave misteriosa, ni disparos enemigos. Los enemigos caen en columnas independientes según un guion por nivel, y la amenaza es el terreno que se pierde.

`invasores` ya existe en el catálogo como juego simulado. Según el seed de `supabase/migrations/20261030120000_games_and_scores.sql` tiene `playable = false`, `cover-invaders`, categoría SHOOTER, color `green`, `sort_order` 5 y `max_score = 1000000`, y ninguna migración posterior lo cambia. Se reutiliza la fila con un `update`. Es el segundo SHOOTER jugable tras ROCAS (`references/implemented-games.md`), pero el juego es otro: ROCAS es una nave con rotación, inercia y disparo en 360°, y aquí el cañón se mueve en un único eje y dispara en una sola dirección. Es también el candidato mejor puntuado de `game-planner` (`.claude/agent-memory/game-planner/suggestions.md`, 26/30, `recomendado`).

**Esta variante (C, Ambiciosa)** parte de los 8 niveles diseñados y del selector de nivel de la variante B, y añade tres cosas dentro del contrato:

- **Portadoras:** un cuarto tipo de enemigo que, al destruirlo, suelta un power-up que cae. Hay dos: **Doble cañón** (8 s disparando en pareja) y **Purga** (disuelve el último cristal formado). Las portadoras, como el resto de enemigos, vienen colocadas a mano en los guiones.
- **Sonido:** siete efectos WAV propios, generados por un script del repositorio, en `public/games/invasores/` y precargados antes de arrancar, como el atlas de SERPENTINA.
- **Stats extra en el HUD** con `onStats`: `Cristales` (`n/8`) siempre y `Doble` (cuenta atrás) mientras esté activo.

Las otras dos variantes son `01-invasores-esencial.md` (10 oleadas por fórmula, sin selector, bonus ni sonido) y `02-invasores-niveles.md` (estos 8 niveles sin portadoras, sin sonido y sin stats extra).

---

## Alcance

**Dentro:**

- Motor en `lib/games/invasores/` (`levels.ts`, `entities.ts`, `sounds.ts` y `engine.ts`) con `createInvasores(canvas, callbacks)`, que cumple el contrato `GameEngine` con `goToLevel`.
- **Superficie:** canvas lógico 800×600, dividido en 16 columnas de 50 px (`col = floor(x / 50)`). Suelo en `y = 560`. Guías de columna tenues.
- **Cañón:** 36×20 px, apoyado en el suelo (de `y = 540` a `y = 560`). Al cargar cada nivel se coloca en el centro de la columna `startCol` del nivel. Se mueve en horizontal a 320 px/s, limitado a `x ∈ [18, 782]`. Si su centro está sobre una columna con cristal, se mueve a 112 px/s (×0,35) y no puede disparar.
- **Disparo:** proyectil de 4×14 px que sale del cañón (`y = 526`) y sube a 600 px/s, con 0,2 s de recarga. Mantener `Espacio` dispara en automático. Sin Doble cañón: un proyectil desde el centro y máximo 2 en pantalla. Con Doble cañón: una pareja desde `x − 12` y `x + 12` y máximo 4 en pantalla. Cada proyectil impacta como mucho en un enemigo.
- **Enemigos:** caen en vertical por el centro de su columna, sin moverse de lado, y aparecen en `y = −r`. La velocidad base se multiplica por la `speed` del nivel:

  | Tipo                | Carácter | Radio | Velocidad base | Impactos | Puntos | Color                         |
  | ------------------- | -------- | ----- | -------------- | -------- | ------ | ----------------------------- |
  | `espora`            | `e`      | 14 px | 60 px/s        | 1        | 10     | `--green`                     |
  | `coraza`            | `c`      | 18 px | 40 px/s        | 2        | 30     | `--magenta`                   |
  | `aguja`             | `a`      | 10 px | 130 px/s       | 1        | 20     | `--yellow`                    |
  | `portadora` (doble) | `D`      | 14 px | 50 px/s        | 1        | 15     | `--ink` con anillo `--yellow` |
  | `portadora` (purga) | `P`      | 14 px | 50 px/s        | 1        | 15     | `--ink` con anillo `--green`  |

  La `coraza` pierde su anillo exterior con el primer impacto y solo puntúa al destruirse.

- **Power-ups:** al destruir una portadora aparece un power-up de 20×20 px en su posición, que cae a 120 px/s. Se recoge si su caja toca el cañón y desaparece si llega al suelo. Cada uno se recoge una vez y no da puntos.
  - **Doble cañón** (rombo `--yellow` con «2»): activa el disparo en pareja durante 8,0 s. Recoger otro reinicia el contador a 8,0 s.
  - **Purga** (rombo `--green` con una cruz): disuelve al momento el último cristal **formado en el nivel**. Los cristales iniciales no se disuelven. Sin cristales formados no hace nada.
- **Guion de nivel:** cada nivel es una lista de filas de 16 caracteres (`.` vacío, `e`, `c`, `a`, `D`, `P`). La fila `i` aparece completa a los `1,0 + i × rowInterval` s de cargar el nivel. Todos los enemigos del guion aparecen siempre.
- **Cristales iniciales:** cada nivel empieza con los cristales de su campo `crystals`. Cuentan para el límite de 8 y el guion nunca coloca enemigos en esas columnas.
- **Contacto con el cañón:** si la caja del enemigo toca el rectángulo del cañón, el enemigo desaparece sin dar puntos, se pierde una vida y el cañón queda invulnerable 1,0 s (parpadea). Un contacto durante la invulnerabilidad elimina al enemigo sin coste.
- **Aterrizaje y cristales:** si el enemigo (portadoras incluidas) llega al suelo (`y + r ≥ 560`) sin tocar el cañón, su columna se cristaliza. Si ya tenía cristal, se absorbe sin efecto. Con 8 cristales (iniciales incluidos) la partida termina.
- **Fin de nivel:** cuando ya han aparecido todas las filas y no queda ningún enemigo vivo (los power-ups que caen no cuentan). Suma el **bonus de superficie**: 10 puntos por cada columna sin cristal. Tras limpiar los niveles 1 a 7 hay un respiro de 2,0 s y se carga el siguiente con sus cristales iniciales. Al limpiar el nivel 8, y tras sumar su bonus, la partida termina.
- **Los 8 niveles** (datos completos en Modelo de datos):

  | Nivel | Nombre          | Velocidad | Ritmo  | Cristales iniciales | Esporas | Corazas | Agujas | Portadoras (D/P) | Puntos | Bonus máx. | Total |
  | ----- | --------------- | --------- | ------ | ------------------- | ------- | ------- | ------ | ---------------- | ------ | ---------- | ----- |
  | 1     | PRIMER CONTACTO | ×1,00     | 1,6 s  | —                   | 15      | 0       | 0      | 0 / 0            | 150    | 160        | 310   |
  | 2     | CORAZAS         | ×1,05     | 1,5 s  | —                   | 13      | 7       | 0      | 1 / 0            | 355    | 160        | 515   |
  | 3     | AGUJAS          | ×1,10     | 1,4 s  | 0, 15               | 8       | 4       | 9      | 0 / 1            | 395    | 140        | 535   |
  | 4     | GRIETA          | ×1,15     | 1,35 s | 7, 8                | 11      | 8       | 10     | 1 / 0            | 565    | 140        | 705   |
  | 5     | LLUVIA          | ×1,20     | 0,9 s  | —                   | 36      | 2       | 4      | 1 / 1            | 530    | 160        | 690   |
  | 6     | ESCALERA        | ×1,25     | 1,1 s  | 3, 12               | 11      | 6       | 7      | 0 / 1            | 445    | 140        | 585   |
  | 7     | MURALLA         | ×1,30     | 1,3 s  | 0, 1, 14, 15        | 9       | 18      | 10     | 1 / 0            | 845    | 120        | 965   |
  | 8     | COLMENA         | ×1,40     | 1,0 s  | 5, 10               | 16      | 14      | 18     | 1 / 1            | 970    | 140        | 1.110 |

- **Selector de nivel en la pausa:** ya existe en `components/game-player.tsx` desde la SPEC 08 y se activa con `levels: 8`. Elegir un nivel llama a `goToLevel(n)`, que empieza **una partida nueva desde ese nivel**: puntuación 0, 3 vidas, sin Doble cañón y con los cristales iniciales del nivel `n`.
- **Fin de partida:** sin vidas, con 8 cristales, al limpiar el nivel 8 o al llamar a `end()`. Todos llaman a `onGameOver(score)`.
- **HUD de la plataforma:** Puntuación, Vidas (3), Nivel (de `onLevel`) y los stats de `onStats`: `Cristales` con valor `n/8` en verde, siempre, y `Doble` con la cuenta atrás (`7.9s`) en amarillo, solo mientras esté activo.
- **Sonido:** siete efectos WAV en `public/games/invasores/`, generados por `scripts/generate-invasores-sounds.mjs` (Node, sin dependencias, PCM 16 bits mono a 22.050 Hz) y precargados en el `load` del registro:

  | Archivo           | Cuándo suena                           | Síntesis                                                      | Duración |
  | ----------------- | -------------------------------------- | ------------------------------------------------------------- | -------- |
  | `disparo.wav`     | al disparar (uno por disparo o pareja) | onda cuadrada de 880 a 440 Hz                                 | 80 ms    |
  | `impacto.wav`     | primer impacto a una coraza            | onda cuadrada de 220 Hz                                       | 60 ms    |
  | `destruccion.wav` | al destruir un enemigo                 | ruido blanco con caída exponencial                            | 180 ms   |
  | `cristal.wav`     | al formarse un cristal                 | onda triangular de 330 a 110 Hz                               | 300 ms   |
  | `aplastado.wav`   | al perder una vida                     | diente de sierra de 150 a 50 Hz mezclado con ruido            | 450 ms   |
  | `nivel.wav`       | al sumar el bonus de un nivel          | arpegio de onda cuadrada 523, 659 y 784 Hz (120 ms cada nota) | 360 ms   |
  | `poder.wav`       | al recoger un power-up                 | onda senoidal de 440 a 1.320 Hz                               | 200 ms   |

  Todos con envolvente de ataque de 5 ms y caída lineal hasta 0, amplitud máxima del 60 %. Unos 72 KB en total. Licencia: obra propia del repositorio, generada por el script, sin material de terceros.

- **Controles:** `←` `→` y `A` `D` mueven el cañón mientras se mantienen pulsadas. `Espacio` dispara. `P` y `Escape` llaman a `onPauseKey`. Se bloquean con `preventDefault` solo `ArrowLeft`, `ArrowRight` y `Space`, con la partida activa y el foco fuera de `input`/`textarea`.
- **Dibujo:** neón con las variables del tema y `shadowBlur` moderado (entre 6 y 12). El cañón va en `--cyan` (con dos cañoncitos visibles con Doble activo), los proyectiles en `--ink`, los enemigos y power-ups en los colores de las tablas. Los cristales son tres esquirlas en `--green` (relleno al 35 %, trazo pleno) de 50×40 px; los iniciales llevan el trazo al 60 %. La Purga hace un destello verde de 200 ms en la columna disuelta. Un campo de 60 estrellas estáticas se genera al crear el motor.
- **Entrada en el registro:** `ENGINES["invasores"]` con canvas 800×600, `levels: 8` y un `load` que espera a `loadInvasoresSounds()`.
- **Migración** `supabase/migrations/20261102120000_invasores_playable.sql`: `update` de la fila `invasores` con `playable = true`, `max_score = 5415`, `short` y `long` nuevos.
- Sin tocar `app/globals.css` ni `components/`: la portada `cover-invaders`, el selector de nivel y el render de `stats` ya existen.

**Fuera de alcance (para futuras specs):**

- Silenciar o regular el volumen, y música.
- Más power-ups (escudo, vida extra, ralentizar), combos y multiplicadores.
- Disparos enemigos, movimiento lateral de los enemigos y jefes.
- Nombre del nivel visible, editor de niveles, niveles aleatorios y más de 8 niveles.
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
export type EnemyChar = "e" | "c" | "a" | "D" | "P"; // "." = vacío

export interface LevelDef {
  name: string;
  speed: number; // multiplicador de la velocidad base de los enemigos
  rowInterval: number; // s entre filas
  crystals: number[]; // columnas con cristal inicial
  startCol: number; // columna inicial del cañón (sin cristal)
  rows: string[]; // 16 caracteres por fila
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
      ".D....e..e....e.",
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
      ".e............P.",
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
      "......D..e......",
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
      ".e...e...P...e..",
      "...e...e...e...e",
      "a.......a.......",
      "e...e...e...e...",
      "..e...e...e...e.",
      ".......a.......a",
      ".e...D...e...e..",
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
      "..........P.....",
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
      ".....e.ee.D.....",
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
      "P.e....ee....e.e",
      "......a..a......",
      "..c.c......c.c..",
      ".a...........a..",
      "...e..D..e..e...",
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
export const COL_W = 50;
export const GROUND_Y = 560;

export const CANNON_W = 36;
export const CANNON_H = 20;
export const CANNON_Y = GROUND_Y - CANNON_H; // 540
export const CANNON_SPEED = 320; // px/s
export const CRYSTAL_SLOW = 0.35;
export const INVULN_TIME = 1.0; // s

export const SHOT_W = 4;
export const SHOT_H = 14;
export const SHOT_SPEED = 600; // px/s
export const MAX_SHOTS = 2;
export const MAX_SHOTS_DOUBLE = 4;
export const DOUBLE_OFFSET = 12; // px a cada lado del centro
export const FIRE_COOLDOWN = 0.2; // s

export const START_LIVES = 3;
export const CRYSTAL_LIMIT = 8; // incluidos los iniciales
export const CRYSTAL_H = 40;
export const SURFACE_BONUS = 10; // por columna sin cristal al limpiar un nivel

export const POWERUP_SIZE = 20;
export const POWERUP_SPEED = 120; // px/s
export const DOUBLE_TIME = 8.0; // s
export const PURGE_FLASH = 0.2; // s

export const FIRST_ROW_DELAY = 1.0; // s
export const BREATHER = 2.0; // s
export const STAR_COUNT = 60;

export type EnemyKind = "espora" | "coraza" | "aguja" | "portadora";
export type PowerUpKind = "doble" | "purga";

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
  portadora: { r: 14, speed: 50, hp: 1, points: 15 },
};

export interface Enemy {
  kind: EnemyKind;
  carries: PowerUpKind | null; // solo portadoras: "D" → "doble", "P" → "purga"
  col: number;
  x: number; // col * COL_W + COL_W / 2
  y: number;
  vy: number; // ENEMIES[kind].speed * level.speed
  hp: number;
}

export interface PowerUp {
  kind: PowerUpKind;
  x: number; // centro
  y: number; // centro
}

export interface Shot {
  x: number;
  y: number; // borde superior
  prevY: number;
}

export interface Crystal {
  col: number;
  initial: boolean; // los iniciales no los disuelve la Purga
}

export interface Cannon {
  x: number;
  invuln: number; // s restantes
  double: number; // s restantes de Doble cañón; 0 = inactivo
}

export interface Palette {
  cannon: string; // --cyan
  shot: string; // --ink
  espora: string; // --green
  coraza: string; // --magenta
  aguja: string; // --yellow
  carrier: string; // --ink
  doble: string; // --yellow
  purga: string; // --green
  crystal: string; // --green
  ground: string; // --ink con baja opacidad
}

export function columnOf(x: number): number; // clamp(floor(x / COL_W), 0, COLS - 1)
export function parseChar(ch: EnemyChar): {
  kind: EnemyKind;
  carries: PowerUpKind | null;
};
export function levelMaxScore(level: LevelDef): number; // puntos del guion + SURFACE_BONUS * (COLS - crystals.length)

// Dibujo: drawStars, drawGround, drawCrystal, drawEnemy, drawPowerUp, drawShot, drawCannon, drawPurgeFlash(ctx, ..., palette)
```

```ts
// lib/games/invasores/sounds.ts
export type SoundName =
  | "disparo"
  | "impacto"
  | "destruccion"
  | "cristal"
  | "aplastado"
  | "nivel"
  | "poder";

export const SOUND_VOLUME = 0.35;

// Precarga /games/invasores/<nombre>.wav en un caché de módulo de solo lectura.
// Espera canplaythrough, error o 2.000 ms por archivo, en paralelo. Nunca rechaza.
export function loadInvasoresSounds(): Promise<void>;

// Clona el audio precargado y lo reproduce con play().catch(() => {}). Sin audio cargado, no hace nada.
export function playSound(name: SoundName): void;
```

```ts
// lib/games/invasores/engine.ts
export { loadInvasoresSounds } from "./sounds";
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
  load: async () => {
    const m = await import("./invasores/engine");
    await m.loadInvasoresSounds();
    return m.createInvasores;
  },
},
```

Convenciones:

- Coordenadas en píxeles lógicos con origen arriba a la izquierda. Velocidades en px/s y tiempos en segundos.
- **Bucle:** `requestAnimationFrame` con `dt` en segundos acotado a 0,05. `lastTime` se reinicia en `resume`. Movimiento continuo, sin paso lógico fijo.
- **Orden de cada fotograma:** (1) temporizadores (recarga, invulnerabilidad, Doble cañón, destello, reloj del nivel, respiro); (2) aparición de filas; (3) movimiento del cañón; (4) disparo; (5) movimiento de proyectiles, enemigos y power-ups; (6) impactos; (7) contactos con el cañón, aterrizajes y recogida de power-ups; (8) fin de nivel y de partida; (9) dibujo.
- **Carga de nivel (`loadLevel(n)`):** vacía enemigos, proyectiles y power-ups, quita el Doble cañón y el destello, pone los cristales iniciales de `LEVELS[n − 1]` con `initial: true`, coloca el cañón en `startCol × 50 + 25`, quita la invulnerabilidad, pone a cero el reloj y el índice de fila, y llama a `onLevel(n)` y `onStats`.
- **Disparo:** con `Espacio` pulsado, recarga a 0 y la columna del centro sin cristal. Sin Doble: si hay menos de 2 proyectiles, uno en `x`. Con Doble: si hay como mucho 2, una pareja en `x ± 12`. Suena `disparo` una vez por disparo.
- **Impacto barrido:** el proyectil ocupa el rectángulo `x ± 2` entre `y` y `prevY + SHOT_H`. Impacta si cruza la caja del enemigo (`x ± r`, `y ± r`). Entre varias, gana la de mayor `y`.
- **Contacto con el cañón:** caja del enemigo contra el rectángulo `x ± 18`, `540..560`, antes que el aterrizaje. Los power-ups usan su caja de 20×20 contra el mismo rectángulo, también con el cañón invulnerable.
- **Purga:** busca el último elemento de `crystals` con `initial: false`, lo quita y lanza el destello en su columna. Si el cañón estaba sobre esa columna, recupera al momento velocidad y disparo.
- **Bonus de superficie:** al limpiar un nivel, `+10 × (16 − cristales)`, con los cristales que haya en ese momento. Se suma de una vez, emite un solo `onScore` y suena `nivel`.
- **`goToLevel(n)`:** ignora valores fuera de 1..8 y llamadas con la partida terminada. Dentro de rango empieza una partida nueva desde el nivel `n`: puntuación 0, 3 vidas, teclas vaciadas y `loadLevel(n)`. La plataforma reanuda la partida tras llamarlo.
- **Stats:** `[{ key: "cristales", label: "Cristales", value: "<n>/8", color: "green" }]` y, con Doble activo, además `{ key: "doble", label: "Doble", value: "<s.s>s", color: "yellow" }` (`(Math.ceil(double * 10) / 10).toFixed(1)`). `onStats` solo se emite si cambia el número de cristales, si aparece o desaparece Doble o si su valor cambia de décima: como mucho 10 veces por segundo.
- **Mapeo a callbacks:** `onScore(score)` al destruir un enemigo, al sumar el bonus, en `restart` y en `goToLevel`; `onLives(n)` al crear, en `restart`, en `goToLevel` y al perder una vida; `onLevel(n)` en cada `loadLevel`; `onStats(stats)` al crear, en `restart`, en `loadLevel` y con los cambios descritos; `onGameOver(score)` al quedarse sin vidas, al formarse el 8.º cristal, tras el bonus del nivel 8 o con `end()`. Cada callback solo se llama si el valor cambia.
- **`max_score` = 5.415.** Una partida legítima solo suma por enemigos destruidos (cada uno puntúa una vez) y por el bonus de cada nivel limpiado. Los power-ups no dan puntos. La Purga no puede quitar cristales iniciales, así que el bonus de un nivel nunca supera `10 × (16 − cristales iniciales)`. El máximo se da al empezar en el nivel 1 y limpiar los 8 sin cristales formados: Σ (puntos del guion + bonus máximo) = 310 + 515 + 535 + 705 + 690 + 585 + 965 + 1.110 = **5.415** (4.255 de enemigos, de ellos 135 de las 9 portadoras, y 1.160 de bonus). Saltar de nivel pone la puntuación a 0. Todas las puntuaciones son múltiplos de 5.
- **Paleta:** se lee una vez al crear el motor con `getComputedStyle(document.documentElement)` (`--cyan`, `--magenta`, `--yellow`, `--green`, `--ink`), con valores por defecto iguales a los del tema.
- **Estado en clausura:** cañón, proyectiles, enemigos, power-ups, cristales, nivel, reloj, índice de fila, fase (`"playing" | "breather"`), temporizadores, destello, puntuación, vidas, último valor de stats emitido, teclas pulsadas y estrellas viven en la clausura de `createInvasores`. El único estado de módulo es el caché de audio de solo lectura de `sounds.ts`, seguro entre instancias.
- **Sonido:** solo suena por eventos del bucle, así que no suena nada con la partida en pausa o terminada. Cada reproducción clona el `HTMLAudioElement` precargado con `volume = 0.35` y llama a `play().catch(() => {})`, para tolerar el bloqueo de autoplay. Si un archivo no cargó, `playSound` no hace nada y el juego sigue.
- **Teclado en `window`**, quitado en `destroy`. Las teclas pulsadas se guardan en un `Set` que se vacía en `restart`, `goToLevel` y `destroy`. `P` y `Escape` (sin `e.repeat`) llaman a `callbacks.onPauseKey?.()`. Con la partida terminada el motor ignora todas las teclas y no llama a `preventDefault`.
- Sin HUD ni overlays en el canvas: ni puntuación, ni nombre del nivel, ni bonus, ni «GAME OVER». El estado del Doble y los cristales se ve en los stats de la plataforma.
- El motor no guarda puntuaciones: solo llama a `onGameOver(finalScore)`.

---

## Plan de implementación

Antes de empezar, leer en `node_modules/next/dist/docs/` la guía de componentes cliente (`"use client"`), la de Cache Components y la de archivos estáticos en `public/`, como exige `AGENTS.md`. Leer `components/game-player.tsx` (stats, overlay de pausa y `.level-picker`), `components/game-canvas.tsx`, `lib/games/contract.ts`, `lib/games/registry.ts`, `lib/games/bloque-buster/engine.ts` (`goToLevel` y reproducción con `cloneNode`), `lib/games/serpentina/engine.ts` (precarga en el `load` del registro) y las reglas `.crt`, `.crt-screen`, `.crt-fit`, `.hud-stat` y `.level-picker` de `app/globals.css`. Invocar `/frontend-design` para el acabado visual del cañón, las esporas, los cristales y los power-ups, como indica `CLAUDE.md`. Antes y después de la migración, ejecutar `list_tables` y `get_advisors` de seguridad del MCP de Supabase.

1. Crear `scripts/generate-invasores-sounds.mjs` (Node ESM sin dependencias: sintetiza las siete ondas de la tabla de Alcance, aplica la envolvente y escribe WAV PCM de 16 bits mono a 22.050 Hz en `public/games/invasores/`, con un comentario de cabecera que declara la licencia propia) y ejecutarlo con `node scripts/generate-invasores-sounds.mjs`. Verificación: existen los siete `.wav`, suman menos de 80 KB, `/games/invasores/disparo.wav` responde 200 y cada archivo suena como describe la tabla al abrirlo en el navegador.
2. Crear `lib/games/invasores/levels.ts` con `EnemyChar`, `LevelDef` y los 8 niveles tal como aparecen en esta spec. Verificación: `npm run lint` y `npm run build` pasan. Todas las filas tienen 16 caracteres, ningún enemigo cae en una columna de `crystals`, ningún `startCol` tiene cristal y los recuentos coinciden con la tabla de Alcance (15, 21, 22, 30, 44, 25, 38 y 50 enemigos, con 5 `D` y 4 `P`).
3. Crear `lib/games/invasores/entities.ts` con las constantes, los tipos, `ENEMIES`, `columnOf`, `parseChar`, `levelMaxScore` y las funciones de dibujo. Verificación: compila. La suma de `levelMaxScore` de los 8 niveles es 5.415.
4. Crear `lib/games/invasores/engine.ts` con `createInvasores` sin portadoras ni sonido: `D` y `P` se tratan de momento como portadoras sin power-up. Incluye estado en clausura, teclado, bucle con `dt` acotado, `loadLevel`, aparición de filas, cañón con ralentización, disparo simple, caída, impacto barrido, corazas, contacto e invulnerabilidad, cristales, bonus, paso de nivel, fin por vidas, por cristales y por victoria, `pause`, `resume`, `restart`, `end`, `goToLevel`, `destroy` y `onStats` con `Cristales`. Verificación: compila y `npm run lint` pasa.
5. Añadir al motor los power-ups: suelta al destruir una portadora, caída, recogida, Doble cañón con disparo en pareja y cuenta atrás, Purga con destello, y el stat `Doble`. Verificación: compila y `npm run lint` pasa.
6. Crear `lib/games/invasores/sounds.ts` con `loadInvasoresSounds` y `playSound`, reexportar `loadInvasoresSounds` desde `engine.ts` y llamar a `playSound` en los siete eventos. Verificación: compila y `npm run lint` pasa.
7. Añadir `invasores` a `ENGINES` en `lib/games/registry.ts` (800×600, `levels: 8`, `load` con `loadInvasoresSounds`). Verificación: `/jugar/invasores` muestra el motor real en lugar de `.game-arena`, se puede jugar con sonido, el HUD muestra `Cristales 0/8`, la portadora del nivel 2 suelta el Doble cañón y la pausa muestra 8 niveles. Mientras `playable` siga en `false`, la partida se guarda solo en `localStorage`.
8. Crear `supabase/migrations/20261102120000_invasores_playable.sql` y aplicarla (MCP `apply_migration` o CLI):

   ```sql
   update public.games
   set playable = true,
       max_score = 5415,
       short = 'Derriba las esporas antes de que cristalicen tu suelo.',
       long = 'Esporas alienígenas caen en columnas sobre la superficie a lo largo de ocho niveles, cada uno con su guion y su terreno ya invadido. Mueve tu cañón con las flechas o A/D y dispara con Espacio: espora 10 puntos, portadora 15, aguja 20 y coraza, que aguanta dos impactos, 30. La que toca el suelo lo cristaliza: tu cañón cruza ese tramo despacio y no puede disparar sobre él. Las portadoras sueltan el Doble cañón o una Purga que disuelve el último cristal. Al limpiar un nivel, cada columna libre suma 10. Desde la pausa puedes empezar en cualquier nivel.'
   where id = 'invasores';
   ```

   Ejecutar `get_advisors` de seguridad. Verificación: `select playable, max_score from games where id = 'invasores'` devuelve `true` y `5415`, `/juegos/invasores` ya no muestra `PRÓXIMAMENTE` y una partida con sesión crea una fila en `scores`.

9. Acabado visual: brillo del cañón (simple y doble), de las esporas, los cristales y los power-ups, destello de la Purga, parpadeo de invulnerabilidad, guías de columna, estrellas, stats del HUD, selector de nivel y revisión a 1280 px y 390 px. Verificación: capturas de `/jugar/invasores` en ambos anchos, en juego con Doble activo y en pausa con el selector, en `.playwright-screenshots/` (`invasores-1280.png`, `invasores-390.png`, `invasores-pausa-390.png`) y sin scroll horizontal.

---

## Criterios de aceptación

- [ ] `npm run lint` y `npm run build` terminan sin errores ni warnings de Cache Components o hidratación.
- [ ] `select playable, max_score from games where id = 'invasores'` devuelve `true` y `5415`, y `ENGINES["invasores"]` existe con `levels: 8`.
- [ ] `/jugar/invasores` muestra un `<canvas>` con la partida lista y no muestra `.game-arena`.
- [ ] Los demás juegos no jugables (por ejemplo `/jugar/gloton`) conservan simulación y `.game-arena`.
- [ ] ROCAS, CAÍDA, BLOQUE BUSTER y SERPENTINA se comportan igual que antes (controles, pausa, HUD, ranking).
- [ ] `components/game-player.tsx` no contiene `game.id === "..."` y no se modifica en esta spec.
- [ ] Al empezar no hay cristales, el cañón está en la columna 7 y la primera espora aparece en la columna 6 en torno a 1 s después.
- [ ] `←` `→` y `A` `D` mueven el cañón mientras se mantienen pulsadas, sin salir del canvas, y la página no hace scroll al pulsarlas.
- [ ] `Espacio` dispara. Mantenido, dispara en automático con no más de 2 proyectiles en pantalla a la vez (4 con Doble cañón).
- [ ] Destruir una espora suma exactamente 10 puntos, una portadora 15 y una aguja 20. Una coraza pierde su anillo con el primer impacto, no suma nada y suma 30 al segundo.
- [ ] Un proyectil no destruye dos enemigos y ningún enemigo lo atraviesa sin ser impactado (se comprueba con las agujas del nivel 8).
- [ ] Una espora que llega al suelo sin tocar el cañón deja un cristal verde en su columna, no resta vida y el stat `Cristales` sube de `0/8` a `1/8`.
- [ ] Con el centro del cañón sobre un cristal, el cañón se mueve visiblemente más despacio y `Espacio` no dispara.
- [ ] Un enemigo que toca el cañón resta una vida, no deja cristal y el cañón parpadea 1 s sin perder más vidas.
- [ ] Destruir la portadora `D` del nivel 2 suelta un rombo amarillo. Al recogerlo, el cañón dispara en pareja, aparece el stat `Doble` con `8.0s` en amarillo, que baja de décima en décima, y a los 8 s desaparece.
- [ ] Recoger un segundo Doble cañón con el primero activo reinicia la cuenta a `8.0s`.
- [ ] Recoger una Purga (nivel 3) con cristales formados disuelve el último con un destello verde y `Cristales` baja en 1. Los cristales iniciales de las columnas 0 y 15 no se disuelven.
- [ ] Un power-up que llega al suelo sin recogerse desaparece sin efecto. Recogerlo no suma puntos.
- [ ] Una portadora que llega al suelo forma un cristal como cualquier enemigo.
- [ ] El HUD muestra Puntuación, Vidas, Nivel `01` y `Cristales 0/8` al empezar, y no muestra `Doble`.
- [ ] Al limpiar el nivel 1 sin cristales la puntuación sube exactamente 160 de una vez y suena `nivel`. Con 2 cristales sube 140.
- [ ] Tras el bonus hay un respiro de unos 2 s y el Nivel pasa a `02`. Los cristales del nivel anterior desaparecen, `Cristales` vuelve a los iniciales del nuevo nivel y el Doble se apaga.
- [ ] El nivel 3 empieza con `Cristales 2/8` (columnas 0 y 15), el 4 con las columnas 7 y 8 (cañón en la 5), el 6 con la 3 y la 12, el 7 con `4/8` (0, 1, 14 y 15) y el 8 con la 5 y la 10.
- [ ] Los niveles 1 a 8 tienen 15, 21, 22, 30, 44, 25, 38 y 50 enemigos, con portadoras `D` en los niveles 2, 4, 5, 7 y 8 y `P` en los niveles 3, 5, 6 y 8.
- [ ] Con 8 cristales, contando los iniciales, se abre el modal «FIN DEL JUEGO» con la puntuación final.
- [ ] Al perder la tercera vida se abre el mismo modal. No se dibuja ningún «GAME OVER» en el canvas.
- [ ] Al limpiar el nivel 8 se suma su bonus y se abre el mismo modal (máximo 5.415 en una partida desde el nivel 1). No se dibuja ningún mensaje de victoria.
- [ ] En pausa aparece `SALTAR AL NIVEL` con 8 botones y el actual resaltado. Pulsar el 4 carga GRIETA (cristales en 7 y 8, HUD `04`), pone la puntuación a 0, las vidas a 3, apaga el Doble y reanuda la partida.
- [ ] `P` y `Escape` pausan y reanudan a través del estado de la plataforma: el botón pasa de `PAUSA` a `REANUDAR`, aparece «EN PAUSA» y una segunda pulsación reanuda sin saltos.
- [ ] Pulsar `P` o `Escape` con la partida terminada (modal abierto) no hace nada.
- [ ] `PAUSA` congela cañón, proyectiles, enemigos, power-ups, el reloj del nivel y la cuenta atrás del Doble: el stat `Doble` no baja durante la pausa.
- [ ] Tras pulsar `PAUSA` y `REANUDAR` con el ratón, `Espacio` dispara y no vuelve a activar el botón, y las flechas no hacen scroll.
- [ ] `FIN` durante la partida abre el modal con la puntuación actual y detiene el juego.
- [ ] «JUGAR DE NUEVO» empieza en el nivel `01` con puntuación 0, 3 vidas, `Cristales 0/8` y sin Doble, sin duplicar el bucle (la velocidad no cambia tras reiniciar varias veces).
- [ ] Escribir las iniciales en el modal (incluidas `A`, `D` y la barra espaciadora) no mueve ni acciona el juego.
- [ ] Suenan `disparo`, `impacto`, `destruccion`, `cristal`, `aplastado`, `nivel` y `poder` en sus eventos. No suena nada con la partida en pausa ni terminada.
- [ ] Las siete URLs `/games/invasores/<nombre>.wav` responden 200 y los archivos suman menos de 80 KB.
- [ ] Si se bloquean los `.wav` en la red del navegador, el juego carga y se juega sin sonido y sin errores en consola.
- [ ] Con sesión iniciada, «GUARDAR PUNTUACIÓN» crea una fila en `scores` con `game_id = 'invasores'`, el `user_id` del usuario y la puntuación final mostrada.
- [ ] Insertar por encima de `max_score` falla: la política de inserción rechaza una puntuación de 5.420 en `invasores`.
- [ ] Esa marca aparece en `/salon-de-la-fama` (pestaña INVASORES) y en el panel de `/juegos/invasores` sin vaciar la caché a mano, y `Partidas` sube en 1.
- [ ] Sin sesión, el modal conserva el campo de iniciales, guarda en `localStorage["av_scores"]` y muestra `INICIA SESIÓN PARA ENTRAR AL RANKING`. No se crea fila en `scores`.
- [ ] Al pulsar `SALIR` o navegar a otra ruta se cancela el bucle y se quitan los listeners: las flechas y `Espacio` recuperan su comportamiento normal, no sigue sonando nada y no hay errores en consola.
- [ ] Con React StrictMode en desarrollo hay un único bucle activo (un solo cañón, un solo sonido por disparo).
- [ ] El cañón, los enemigos, los cristales y los power-ups usan `--cyan`, `--green`, `--magenta`, `--yellow` e `--ink` del tema, y el dibujo tiene brillo neón.
- [ ] El canvas conserva la proporción 4:3 a 1280 px y a 390 px. A 390 px `/jugar/invasores` no tiene scroll horizontal y ni los stats del HUD ni el selector de 8 botones desbordan.
- [ ] `/juegos/invasores` ya no muestra `PRÓXIMAMENTE`. La descripción menciona los ocho niveles, los cristales, las portadoras con Doble cañón y Purga, el bonus por columna libre y el salto de nivel, y ya no menciona «filas alienígenas» ni «formación».
- [ ] `get_advisors` de seguridad no reporta avisos nuevos tras la migración.
- [ ] La consola del navegador no muestra errores ni warnings en `/jugar/invasores` durante una partida completa.
- [ ] Las demás pantallas (Home, Acerca de, Biblioteca, detalle, Salón, acceso) se ven y funcionan igual que antes.

---

## Decisiones

- **Sí:** reutilizar la fila `invasores` del catálogo (`update`, no `insert`). Ya tiene id, portada `cover-invaders`, categoría SHOOTER y color verde.
- **Sí:** conservar el título INVASORES. Es una palabra genérica en español y coincide con la fila del catálogo. La identidad propia sale de las esporas, los cristales y el terreno invadido. (decisión del agente, a revisar)
- **Sí:** cambiar `short` además de `long`, porque los textos actuales describen «filas alienígenas» en formación. (decisión del agente, a revisar)
- **Sí:** el giro de diseño: el enemigo que aterriza cristaliza su columna en lugar de terminar la partida. **No:** fin inmediato al tocar el suelo.
- **Sí:** el cristal ralentiza el cañón (×0,35) y le impide disparar, pero no lo bloquea. **No:** cristales que bloquean el paso; causarían una derrota en cascada. (decisión del agente, a revisar)
- **Sí:** 8 cristales terminan la partida, iniciales incluidos. (decisión del agente, a revisar)
- **Sí:** los mismos 8 niveles que la variante B, con 9 esporas cambiadas por portadoras. Los guiones siguen siendo legibles y comparables, y las portadoras van en momentos de presión (LLUVIA y COLMENA tienen dos). (decisión del agente, a revisar)
- **Sí:** dos power-ups, Doble cañón y Purga. El Doble refuerza el disparo sin cambiar los controles, y la Purga conecta con la mecánica central (recuperar terreno). **No:** escudo, vida extra o ralentizar el tiempo: más estados que probar sin reforzar el tema. (decisión del agente, a revisar)
- **Sí:** los power-ups no dan puntos y la Purga no disuelve cristales iniciales. Así el tope sigue siendo la suma de enemigos y bonus máximos. **No:** que la Purga quite cristales iniciales: el bonus de un nivel podría superar su máximo y `max_score` dejaría de ser exacto.
- **Sí:** las portadoras puntúan 15. Recompensan un objetivo prioritario sin desequilibrar el total: 135 de 5.415 puntos.
- **Sí:** `max_score = 5415`, la suma exacta de enemigos (4.255) y bonus máximos (1.160) de los 8 niveles. **No:** 1.000.000.
- **Sí:** `goToLevel(n)` empieza una partida nueva desde el nivel `n`, con puntuación 0, 3 vidas y sin Doble. (decisión del agente, a revisar) **No:** conservar la puntuación al saltar, como BLOQUE BUSTER: repetir un nivel sumaría sus puntos varias veces y superaría el tope.
- **Sí:** sonido propio, generado por un script del repositorio y guardado como WAV en `public/games/invasores/`. El origen y la licencia quedan claros (obra propia), no hay dependencias y el script permite regenerarlos. (decisión del agente, a revisar) **No:** sonidos de bancos externos (licencia y peso por revisar) ni síntesis en tiempo real con WebAudio (otro patrón de motor, distinto del de BLOQUE BUSTER).
- **Sí:** WAV en lugar de MP3. El script escribe PCM sin codificador, y siete efectos cortos pesan unos 72 KB en total.
- **Sí:** precargar los sonidos en el `load` del registro, como el atlas de SERPENTINA, con un límite de 2.000 ms por archivo y sin rechazar nunca. Un sonido que no carga no debe bloquear la partida.
- **Sí:** volumen fijo de 0,35 y un sonido por disparo o pareja. **No:** mute ni control de volumen; la plataforma no gestiona audio y eso va en otra spec.
- **Sí:** stats `Cristales` (siempre) y `Doble` (solo activo) con `onStats`. Muestran dos estados que el canvas no comunica con texto. El `Doble` se emite a pasos de 0,1 s, como pide el contrato.
- **Sí:** sin disparos enemigos, búnkeres, nave misteriosa ni formación que marcha.
- **Sí:** el nombre del nivel no se dibuja en el canvas, porque el contrato prohíbe overlays de texto.
- **Sí:** autodisparo con `Espacio`, colisión barrida e invulnerabilidad de 1 s.
- **Sí:** canvas 800×600 (4:3), como ROCAS, BLOQUE BUSTER y SERPENTINA.
- **Sí:** `P` y `Escape` vía `onPauseKey`, teclado en `window` y `preventDefault` solo en `ArrowLeft`, `ArrowRight` y `Space` con la partida activa.
- **Sí:** no modificar `components/`, `lib/games/contract.ts` ni `app/globals.css`. El contrato ya tiene `goToLevel`, `levels` y `onStats`.
- **Sí:** los textos de la UI siguen en español.

---

## Riesgos

| Riesgo                                                                           | Mitigación                                                                                                                                                               |
| -------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| El diseño se percibe como un clon del tirador fijo comercial                     | Sin formación en rejilla, búnkeres, nave misteriosa ni disparo enemigo. Enemigos en columnas, suelo que se cristaliza, portadoras y Purga ligadas al terreno.            |
| Un error al copiar los guiones descuadra `max_score`                             | El paso 2 verifica longitudes, columnas, recuentos y portadoras. El paso 3 comprueba que la suma da 5.415.                                                               |
| Un power-up altera el tope (puntos extra o bonus inflado)                        | Los power-ups no suman puntos y la Purga no toca cristales iniciales. El Doble solo cambia cuántos proyectiles hay, no cuánto vale cada enemigo.                         |
| El selector de nivel permite acumular puntos repitiendo niveles                  | `goToLevel` pone la puntuación a 0. La RLS impone `max_score` igualmente.                                                                                                |
| El Doble cañón hace triviales los niveles                                        | Dura 8 s, no se acumula (solo reinicia) y solo hay 5 en toda la partida. `DOUBLE_TIME` se ajusta en el paso 9 sin tocar `max_score`.                                     |
| Los WAV generados suenan estridentes o se saturan con el autodisparo             | Amplitud máxima del 60 %, volumen 0,35 y un sonido por disparo o pareja (5 por segundo como mucho). Se ajustan en el script y se regeneran.                              |
| Autoplay bloqueado por el navegador                                              | `play().catch(() => {})` evita errores en consola. El primer sonido llega tras pulsar teclas, y si se bloquea el juego sigue sin sonido.                                 |
| Un `.wav` no carga y la carga del juego se queda colgada                         | `loadInvasoresSounds` espera como mucho 2.000 ms por archivo y nunca rechaza. `playSound` ignora los que faltan. Un criterio lo comprueba bloqueando los `.wav`.         |
| Clones de audio acumulados con autodisparo prolongado                            | Cada clon dura entre 60 y 450 ms y se descarta al terminar. Como mucho hay unos 10 vivos a la vez.                                                                       |
| El script de sonidos rompe el lint o el build                                    | Es ESM puro sin dependencias, fuera de `app/` y `lib/`. El hook de formato le pasa Prettier y ESLint como a cualquier archivo, y el paso 1 lo ejecuta y verifica.        |
| Re-renders de React por la cuenta atrás del Doble                                | `onStats` solo al cambiar de décima o de número de cristales, como mucho 10 veces por segundo.                                                                           |
| Un proyectil atraviesa una aguja rápida con un `dt` grande                       | Colisión barrida entre `prevY` y `y`, y `dt` acotado a 50 ms.                                                                                                            |
| LLUVIA o COLMENA resultan injugables                                             | `rowInterval` y `speed` por nivel en `levels.ts`, ajustables en el paso 9 sin cambiar guiones ni `max_score`.                                                            |
| Dos enemigos caen a la vez sobre el cañón y quitan dos vidas                     | Invulnerabilidad de 1 s tras el primer contacto.                                                                                                                         |
| StrictMode monta el efecto dos veces y deja dos bucles o dos juegos de listeners | `destroy` cancela `requestAnimationFrame` y quita los listeners. El único estado de módulo es el caché de audio de solo lectura. Carga dinámica con bandera `cancelled`. |
| Tras `PAUSA` con el ratón, `Espacio` vuelve a activar el botón                   | `preventDefault` en `Space` con la partida activa. Si no basta, quitar el foco del botón tras el clic.                                                                   |
| Las flechas o `Espacio` hacen scroll en la página                                | `preventDefault` solo con la partida activa y el foco fuera de campos de texto.                                                                                          |
| El motor atrapa teclas y rompe el campo de iniciales del modal                   | Con la partida terminada el motor ignora todas las teclas y no llama a `preventDefault`.                                                                                 |
| Una tecla queda «pegada» tras saltar de nivel o soltarla durante la pausa        | El `Set` de teclas se vacía en `restart`, `goToLevel` y `destroy`, y `keyup` sigue escuchando mientras el motor existe.                                                  |
| Los stats o el selector desbordan a 390 px                                       | El HUD ya usa `flexWrap` y `.level-picker-list` usa `flex-wrap` desde la SPEC 08. Un criterio lo comprueba.                                                              |
| `dt` grande al reanudar tras pausa o cambio de pestaña                           | `dt` acotado a 0,05 s y `lastTime` reiniciado en `resume`.                                                                                                               |
| `shadowBlur` en 50 enemigos más power-ups penaliza el rendimiento                | `shadowBlur` entre 6 y 12, y las estrellas sin brillo. Se ajusta en el paso 9 sin tocar mecánicas.                                                                       |
| Sin controles táctiles el juego no es jugable en móvil                           | Aceptado: solo se garantiza que no haya scroll horizontal. Táctil va en otra spec.                                                                                       |
| Juego `playable = true` sin motor real contamina el ranking                      | La migración y la entrada en `ENGINES` van en la misma spec, y la migración se aplica después de comprobar el motor (paso 8).                                            |
| Tras aplicar la migración, el catálogo cacheado sigue con `playable = false`     | La caché de `getGames()` caduca con su `cacheLife`. En desarrollo se reinicia `npm run dev`. Si persiste, invalidar la etiqueta `games`.                                 |
| Cliente falsificado envía una puntuación alta dentro del tope                    | Aceptado (SPEC 06). Con `max_score = 5415` el margen es pequeño. Anti-trampas serio queda para otra spec.                                                                |

---

## Lo que **no** está en esta spec

- Mute, volumen y música.
- Más power-ups, combos y multiplicadores.
- Disparos enemigos, movimiento lateral, jefes, búnkeres y formaciones.
- Nombre del nivel visible, editor de niveles, niveles aleatorios y más de 8 niveles.
- Conservar la puntuación al saltar de nivel.
- Controles táctiles, gamepad y ratón.
- Pausa automática al perder el foco, `devicePixelRatio` y pantalla completa.
- Anti-trampas, rate limit, Realtime y subida de las puntuaciones de `localStorage`.
- Los otros tres juegos simulados.
- Tests automatizados.

Cada uno, si llega, va en su propia spec.
