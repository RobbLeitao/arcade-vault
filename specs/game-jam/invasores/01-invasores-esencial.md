# SPEC JAM — INVASORES · Variante A: Esencial

> **Estado:** Borrador
> **Depende de:** SPEC 05, SPEC 06, SPEC 07
> **Fecha:** 2026-11-02
> **Tema:** INVASORES
> **Objetivo:** Crear un motor TypeScript de tirador fijo registrado como `invasores`, en el que esporas alienígenas caen en columnas y cristalizan el suelo al aterrizar, jugable en `/jugar/invasores` con 10 oleadas progresivas, el HUD, la pausa y el modal de la plataforma y ranking real en Supabase.

---

## Por qué existe esta spec

INVASORES es un tirador fijo original: una colonia de **esporas** alienígenas cae en vertical sobre una superficie lunar dividida en 16 columnas, y el jugador mueve un cañón de luz por el raíl inferior y dispara hacia arriba. El tema «invasores» se traduce en la mecánica, no solo en la estética: **una espora que toca el suelo no termina la partida, lo conquista**. Esa columna se convierte en un **cristal** y pasa a ser terreno invadido: el cañón la cruza al 35 % de su velocidad y no puede disparar mientras está encima. Cada espora que dejas pasar te quita territorio útil y deja esa columna sin defensa. Si los cristales llegan a 8 (media superficie), la invasión ha triunfado. Si una espora cae sobre el cañón, pierdes una vida. Cada aterrizaje obliga a elegir entre derribar la espora o apartarse.

El diseño evita a propósito las reglas icónicas del género comercial: no hay formación en rejilla que marcha de lado a lado y baja, ni búnkeres destructibles, ni nave misteriosa, ni disparos enemigos. Los enemigos caen en columnas independientes, cada tipo a su velocidad, y la amenaza es el terreno que se pierde.

`invasores` ya existe en el catálogo como juego simulado. Según el seed de `supabase/migrations/20261030120000_games_and_scores.sql` tiene `playable = false`, `cover-invaders`, categoría SHOOTER, color `green`, `sort_order` 5 y `max_score = 1000000`, y ninguna migración posterior lo cambia. Se reutiliza la fila con un `update`. Es el segundo SHOOTER jugable tras ROCAS (`references/implemented-games.md`), pero el juego es otro: ROCAS es una nave con rotación, inercia y disparo en 360°, y aquí el cañón se mueve en un único eje y dispara en una sola dirección. Es también el candidato mejor puntuado de `game-planner` (`.claude/agent-memory/game-planner/suggestions.md`, 26/30, estado `recomendado`), que lo eligió por las mismas razones: tirador fijo, controles mínimos y puntuación acotable por oleadas.

**Esta variante (A, Esencial)** es el núcleo jugable mínimo: 10 oleadas generadas por fórmula con dificultad progresiva, tres tipos de espora, sin selector de nivel, sin assets y sin sonido. Las otras dos variantes del mismo juego son `02-invasores-niveles.md` (8 niveles diseñados a mano, con cristales iniciales y selector de nivel en la pausa) y `03-invasores-ambiciosa.md` (los 8 niveles, además de sonido, portadoras con power-ups y stats extra en el HUD).

---

## Alcance

**Dentro:**

- Motor en `lib/games/invasores/` (`entities.ts` y `engine.ts`) con `createInvasores(canvas, callbacks)`, que cumple el contrato `GameEngine` sin `goToLevel`.
- **Superficie:** canvas lógico 800×600, dividido en 16 columnas de 50 px (`col = floor(x / 50)`). Suelo en `y = 560`. Guías de columna tenues para que se lean los carriles.
- **Cañón:** 36×20 px, apoyado en el suelo (de `y = 540` a `y = 560`) y centrado al empezar en `x = 400`. Se mueve en horizontal a 320 px/s, limitado a `x ∈ [18, 782]`. Si su centro está sobre una columna con cristal, se mueve a 112 px/s (×0,35) y no puede disparar.
- **Disparo:** proyectil de 4×14 px que sale del centro del cañón (`y = 526`) y sube a 600 px/s. Máximo 2 en pantalla y 0,2 s de recarga. Mantener `Espacio` dispara en automático respetando ambos límites. Cada proyectil impacta como mucho en un enemigo y desaparece al salir por arriba.
- **Enemigos:** caen en vertical por el centro de su columna (`x = col × 50 + 25`), sin moverse de lado, y aparecen en `y = −r`:

  | Tipo     | Radio | Velocidad base | Impactos | Puntos | Color       |
  | -------- | ----- | -------------- | -------- | ------ | ----------- |
  | `espora` | 14 px | 60 px/s        | 1        | 10     | `--green`   |
  | `coraza` | 18 px | 40 px/s        | 2        | 30     | `--magenta` |
  | `aguja`  | 10 px | 130 px/s       | 1        | 20     | `--yellow`  |

  La `coraza` pierde su anillo exterior con el primer impacto y solo puntúa al destruirse.

- **Contacto con el cañón:** si la caja del enemigo (`x ± r`, `y ± r`) toca el rectángulo del cañón, el enemigo desaparece sin dar puntos, se pierde una vida y el cañón queda invulnerable 1,0 s (parpadea). Un contacto durante la invulnerabilidad elimina al enemigo sin coste.
- **Aterrizaje y cristales:** si el enemigo llega al suelo (`y + r ≥ 560`) sin tocar el cañón, su columna se cristaliza. Si la columna ya tenía cristal, el enemigo se absorbe sin efecto. Con 8 cristales la partida termina.
- **Oleadas:** 10 oleadas. La oleada `w` tiene `6 + 2w` esporas, `floor(w / 2)` corazas y `max(0, w − 3)` agujas, barajadas al azar. Aparece un enemigo cada `max(0,5; 1,3 − 0,08 × (w − 1))` s en una columna aleatoria sin cristal y distinta de la anterior. Las velocidades se multiplican por `1 + 0,06 × (w − 1)` (×1,00 en la oleada 1 y ×1,54 en la 10). La primera aparición de cada oleada llega 1,0 s después de empezarla.
- **Fin de oleada:** cuando ya han aparecido todos sus enemigos y no queda ninguno vivo. Se disuelve el cristal más antiguo (si hay alguno) y, tras un respiro de 2,0 s, empieza la oleada siguiente. Al limpiar la oleada 10 la partida termina.
- **Fin de partida:** sin vidas, con 8 cristales, al limpiar la oleada 10 o al llamar a `end()`. Todos llaman a `onGameOver(score)`.
- **HUD de la plataforma:** Puntuación, Vidas (3) y Nivel (la oleada, de `onLevel`). Sin stats extra: `onStats([])`.
- **Controles:** `←` `→` y `A` `D` mueven el cañón mientras se mantienen pulsadas. `Espacio` dispara. `P` y `Escape` llaman a `onPauseKey`. Se bloquean con `preventDefault` solo `ArrowLeft`, `ArrowRight` y `Space`, con la partida activa y el foco fuera de `input`/`textarea`.
- **Dibujo:** neón con las variables del tema y `shadowBlur` moderado (entre 6 y 12). El cañón va en `--cyan` y los proyectiles en `--ink`. Las esporas, corazas y agujas usan los colores de la tabla. Los cristales son tres esquirlas en `--green` (relleno al 35 % y trazo pleno) de 50×40 px sobre el suelo. Un campo de 60 estrellas estáticas en `--ink` muy tenue se genera al crear el motor.
- **Entrada en el registro:** `ENGINES["invasores"]` con canvas 800×600, sin `levels`.
- **Migración** `supabase/migrations/20261102120000_invasores_playable.sql`: `update` de la fila `invasores` con `playable = true`, `max_score = 3010`, `short` y `long` nuevos.
- Sin tocar `app/globals.css`: la portada `cover-invaders` ya existe (filas de puntos verdes y magenta sobre un cañón cian) y el canvas usa las reglas existentes.

**Fuera de alcance (para futuras specs):**

- Niveles diseñados a mano, cristales iniciales y selector de nivel en la pausa (variante B).
- Sonido, música, power-ups, enemigos portadores y stats extra en el HUD (variante C).
- Disparos enemigos, movimiento lateral de los enemigos y jefes.
- Bonus por superficie intacta, combos y multiplicadores.
- Controles táctiles, gamepad y ratón.
- Pausa automática al perder el foco, ajuste a `devicePixelRatio` y pantalla completa.
- Anti-trampas, rate limit y Realtime (siguen fuera, como en la SPEC 06).
- Portar los otros tres juegos simulados.
- Tests automatizados (no hay runner configurado).

---

## Modelo de datos

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
export const CANNON_START_X = 400;
export const CANNON_SPEED = 320; // px/s
export const CRYSTAL_SLOW = 0.35; // multiplicador sobre una columna con cristal
export const INVULN_TIME = 1.0; // s

export const SHOT_W = 4;
export const SHOT_H = 14;
export const SHOT_SPEED = 600; // px/s
export const MAX_SHOTS = 2;
export const FIRE_COOLDOWN = 0.2; // s

export const START_LIVES = 3;
export const CRYSTAL_LIMIT = 8;
export const CRYSTAL_H = 40;

export const WAVES = 10;
export const FIRST_SPAWN_DELAY = 1.0; // s desde el inicio de la oleada
export const BREATHER = 2.0; // s entre oleadas
export const STAR_COUNT = 60;

export type EnemyKind = "espora" | "coraza" | "aguja";

export interface EnemySpec {
  r: number; // radio, px
  speed: number; // px/s base
  hp: number; // impactos para destruirlo
  points: number;
}

export const ENEMIES: Record<EnemyKind, EnemySpec> = {
  espora: { r: 14, speed: 60, hp: 1, points: 10 },
  coraza: { r: 18, speed: 40, hp: 2, points: 30 },
  aguja: { r: 10, speed: 130, hp: 1, points: 20 },
};

export interface Enemy {
  kind: EnemyKind;
  col: number; // 0..COLS-1, fija
  x: number; // centro: col * COL_W + COL_W / 2
  y: number; // centro
  vy: number; // px/s, ya multiplicada por waveSpeed
  hp: number;
}

export interface Shot {
  x: number; // centro
  y: number; // borde superior
  prevY: number; // borde superior en el fotograma anterior (colisión barrida)
}

export interface Cannon {
  x: number; // centro
  invuln: number; // s restantes
}

export interface WaveComposition {
  espora: number;
  coraza: number;
  aguja: number;
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

export function waveComposition(wave: number): WaveComposition; // { espora: 6 + 2w, coraza: floor(w / 2), aguja: max(0, w - 3) }
export function waveSpeed(wave: number): number; // 1 + 0.06 * (wave - 1)
export function spawnInterval(wave: number): number; // max(0.5, 1.3 - 0.08 * (wave - 1))
export function columnOf(x: number): number; // clamp(floor(x / COL_W), 0, COLS - 1)

// Dibujo: drawStars, drawGround, drawCrystal, drawEnemy, drawShot, drawCannon(ctx, ..., palette)
```

```ts
// lib/games/invasores/engine.ts
export function createInvasores(
  canvas: HTMLCanvasElement,
  callbacks: GameCallbacks,
): GameEngine; // sin goToLevel
```

```ts
// lib/games/registry.ts (se añade una entrada)
invasores: {
  width: 800,
  height: 600,
  load: () => import("./invasores/engine").then((m) => m.createInvasores),
},
```

Convenciones:

- Coordenadas en píxeles lógicos con origen arriba a la izquierda. Velocidades en px/s y tiempos en segundos.
- **Bucle:** `requestAnimationFrame` con `dt` en segundos acotado a 0,05. `lastTime` se reinicia en `resume`. El movimiento es continuo (`posición += velocidad × dt`). No hay paso lógico fijo.
- **Orden de cada fotograma:** (1) temporizadores (recarga, invulnerabilidad, aparición, respiro); (2) aparición de enemigos; (3) movimiento del cañón; (4) disparo; (5) movimiento de proyectiles y enemigos; (6) impactos proyectil-enemigo; (7) contactos con el cañón y aterrizajes; (8) comprobación de fin de oleada y de partida; (9) dibujo.
- **Cristales:** `crystals: number[]` con las columnas en orden de formación. La más antigua es `crystals[0]`. Un `Set` paralelo responde «¿tiene cristal la columna c?» en O(1).
- **Cañón:** `vx = ±CANNON_SPEED` según las teclas, multiplicado por `CRYSTAL_SLOW` si `columnOf(cannon.x)` tiene cristal. Se puede disparar si `Espacio` está pulsado, la recarga es 0, hay menos de `MAX_SHOTS` proyectiles y la columna del centro no tiene cristal.
- **Impacto barrido:** el proyectil ocupa en el fotograma el rectángulo `x ± 2` entre `y` (arriba) y `prevY + SHOT_H` (abajo). Impacta si ese rectángulo cruza la caja del enemigo (`x ± r`, `y ± r`). Si cruza varias, gana la del enemigo con mayor `y`. Así ningún enemigo se atraviesa con `dt = 50 ms` (desplazamiento relativo máximo de ~40 px por fotograma).
- **Contacto con el cañón:** caja del enemigo contra el rectángulo `x ± 18`, `540..560`. Se comprueba antes que el aterrizaje.
- **Aparición:** al empezar la oleada `w` se crea una cola con los tipos de `waveComposition(w)` barajada con Fisher-Yates. Cada `spawnInterval(w)` se saca uno y se coloca en una columna aleatoria uniforme entre las que no tienen cristal, excluida la de la aparición anterior. Con un máximo de 7 cristales vivos siempre quedan al menos 9 columnas libres.
- Un enemigo que ya caía por una columna que se cristaliza después sigue cayendo: no se le puede disparar desde abajo (el cañón no dispara sobre cristal) y al aterrizar se absorbe.
- **Mapeo a callbacks:** `onScore(score)` al destruir un enemigo; `onLives(n)` al crear, en `restart` y al perder una vida; `onLevel(w)` al crear (1), al empezar cada oleada y en `restart`; `onStats([])` una vez al crear y en `restart`; `onGameOver(score)` al quedarse sin vidas, al formarse el 8.º cristal, al limpiar la oleada 10 o con `end()`. Cada callback solo se llama si el valor cambia.
- **`max_score` = 3.010.** Los puntos solo salen de destruir enemigos, y cada enemigo puntúa una vez. En las 10 oleadas hay `Σ(6 + 2w) = 170` esporas (1.700 puntos), `Σ floor(w / 2) = 25` corazas (750) y `Σ max(0, w − 3) = 28` agujas (560): 1.700 + 750 + 560 = **3.010**. Todas las puntuaciones son múltiplos de 10.

  | Oleada | Esporas | Corazas | Agujas | Enemigos | Puntos | Intervalo | Velocidad |
  | ------ | ------- | ------- | ------ | -------- | ------ | --------- | --------- |
  | 1      | 8       | 0       | 0      | 8        | 80     | 1,30 s    | ×1,00     |
  | 2      | 10      | 1       | 0      | 11       | 130    | 1,22 s    | ×1,06     |
  | 3      | 12      | 1       | 0      | 13       | 150    | 1,14 s    | ×1,12     |
  | 4      | 14      | 2       | 1      | 17       | 220    | 1,06 s    | ×1,18     |
  | 5      | 16      | 2       | 2      | 20       | 260    | 0,98 s    | ×1,24     |
  | 6      | 18      | 3       | 3      | 24       | 330    | 0,90 s    | ×1,30     |
  | 7      | 20      | 3       | 4      | 27       | 370    | 0,82 s    | ×1,36     |
  | 8      | 22      | 4       | 5      | 31       | 440    | 0,74 s    | ×1,42     |
  | 9      | 24      | 4       | 6      | 34       | 480    | 0,66 s    | ×1,48     |
  | 10     | 26      | 5       | 7      | 38       | 550    | 0,58 s    | ×1,54     |

- **Paleta:** se lee una vez al crear el motor con `getComputedStyle(document.documentElement)` (`--cyan`, `--magenta`, `--yellow`, `--green`, `--ink`), con valores por defecto iguales a los del tema.
- **Estado en clausura:** cañón, proyectiles, enemigos, cristales, cola de aparición, oleada, fase (`"spawning" | "breather"`), temporizadores, puntuación, vidas, teclas pulsadas y estrellas viven en la clausura de `createInvasores`. No hay estado de módulo.
- **Teclado en `window`**, quitado en `destroy`. Las teclas pulsadas se guardan en un `Set` actualizado en `keydown`/`keyup` y vaciado en `restart` y `destroy`. `P` y `Escape` (sin `e.repeat`) llaman a `callbacks.onPauseKey?.()` y no pausan por sí mismos. Con la partida terminada el motor ignora todas las teclas y no llama a `preventDefault`.
- Sin HUD ni overlays en el canvas: ni puntuación, ni «OLEADA N», ni «GAME OVER». El respiro entre oleadas se ve como un canvas sin enemigos y el Nivel del HUD cambia al empezar la siguiente.
- El motor no guarda puntuaciones: solo llama a `onGameOver(finalScore)`.

---

## Plan de implementación

Antes de empezar, leer en `node_modules/next/dist/docs/` la guía de componentes cliente (`"use client"`) y la de Cache Components, como exige `AGENTS.md`. Leer `components/game-player.tsx`, `components/game-canvas.tsx`, `lib/games/contract.ts`, `lib/games/registry.ts`, `lib/games/serpentina/engine.ts` (motor más reciente del contrato) y las reglas `.crt`, `.crt-screen`, `.crt-fit` y `.hud-stat` de `app/globals.css`. Invocar `/frontend-design` para el acabado visual del cañón, las esporas y los cristales, como indica `CLAUDE.md`. Antes y después de la migración, ejecutar `list_tables` y `get_advisors` de seguridad del MCP de Supabase.

1. Crear `lib/games/invasores/entities.ts` con las constantes, los tipos, `ENEMIES`, `waveComposition`, `waveSpeed`, `spawnInterval`, `columnOf` y las funciones de dibujo (`drawStars`, `drawGround`, `drawCrystal`, `drawEnemy`, `drawShot`, `drawCannon`). Verificación: `npm run lint` y `npm run build` pasan. Leyendo las fórmulas: `waveComposition(10)` da `{ espora: 26, coraza: 5, aguja: 7 }`, `spawnInterval(10)` da 0,58, y la suma de puntos de las 10 oleadas es 3.010.
2. Crear `lib/games/invasores/engine.ts` con `createInvasores`: estado en clausura, teclado, bucle con `dt` acotado, movimiento del cañón con ralentización sobre cristal, disparo con recarga y límite, aparición por oleadas, caída, impacto barrido, corazas de dos impactos, contacto con el cañón e invulnerabilidad, aterrizaje y cristales, disolución del cristal más antiguo entre oleadas, fin por vidas, por cristales y por victoria, `pause`, `resume`, `restart`, `end` y `destroy`, con callbacks solo al cambiar. Verificación: compila y `npm run lint` pasa.
3. Añadir `invasores` a `ENGINES` en `lib/games/registry.ts` (800×600, sin `levels`). Verificación: `/jugar/invasores` muestra el motor real en lugar de `.game-arena`, se puede jugar y la pausa con `P` funciona. Mientras `playable` siga en `false`, la partida se guarda solo en `localStorage`.
4. Crear `supabase/migrations/20261102120000_invasores_playable.sql` y aplicarla (MCP `apply_migration` o CLI):

   ```sql
   update public.games
   set playable = true,
       max_score = 3010,
       short = 'Derriba las esporas antes de que cristalicen tu suelo.',
       long = 'Esporas alienígenas caen en columnas sobre la superficie. Mueve tu cañón con las flechas o A/D y dispara con Espacio: cada espora vale 10 puntos, cada aguja 20 y cada coraza, que aguanta dos impactos, 30. La que toca el suelo lo cristaliza: tu cañón cruza ese tramo despacio y no puede disparar sobre él. Si una te cae encima pierdes una vida. Resiste 10 oleadas antes de que 8 cristales tomen la superficie.'
   where id = 'invasores';
   ```

   Ejecutar `get_advisors` de seguridad. Verificación: `select playable, max_score from games where id = 'invasores'` devuelve `true` y `3010`, `/juegos/invasores` ya no muestra `PRÓXIMAMENTE` y una partida con sesión crea una fila en `scores`.

5. Acabado visual: brillo del cañón, de las esporas y de los cristales, parpadeo de invulnerabilidad, guías de columna, estrellas y revisión a 1280 px y 390 px. Verificación: capturas de `/jugar/invasores` en ambos anchos en `.playwright-screenshots/` (`invasores-1280.png`, `invasores-390.png`) y sin scroll horizontal.

---

## Criterios de aceptación

- [ ] `npm run lint` y `npm run build` terminan sin errores ni warnings de Cache Components o hidratación.
- [ ] `select playable, max_score from games where id = 'invasores'` devuelve `true` y `3010`, y `ENGINES["invasores"]` existe sin `levels`.
- [ ] `/jugar/invasores` muestra un `<canvas>` con la partida lista y no muestra `.game-arena`.
- [ ] Los demás juegos no jugables (por ejemplo `/jugar/gloton`) conservan simulación y `.game-arena`.
- [ ] ROCAS, CAÍDA, BLOQUE BUSTER y SERPENTINA se comportan igual que antes (controles, pausa, HUD, ranking).
- [ ] `components/game-player.tsx` no contiene `game.id === "..."` y no se modifica en esta spec.
- [ ] Al empezar el cañón está centrado sobre el suelo y la primera espora aparece arriba en torno a 1 s después.
- [ ] `←` `→` y `A` `D` mueven el cañón mientras se mantienen pulsadas, sin salir del canvas, y la página no hace scroll al pulsarlas.
- [ ] `Espacio` dispara. Mantenido, dispara en automático con no más de 2 proyectiles en pantalla a la vez.
- [ ] Destruir una espora suma exactamente 10 puntos y una aguja 20. Una coraza pierde su anillo con el primer impacto, no suma nada y suma 30 al segundo.
- [ ] Un proyectil no destruye dos enemigos y ningún enemigo lo atraviesa sin ser impactado.
- [ ] Una espora que llega al suelo sin tocar el cañón deja un cristal verde en su columna y no resta vida.
- [ ] Con el centro del cañón sobre un cristal, el cañón se mueve visiblemente más despacio y `Espacio` no dispara. Al salir del cristal recupera velocidad y disparo.
- [ ] Un enemigo que cae sobre un cristal ya existente desaparece sin crear otro.
- [ ] Un enemigo que toca el cañón resta una vida (el HUD pasa de `♥ ♥ ♥` a `♥ ♥`), no deja cristal y el cañón parpadea 1 s sin perder más vidas.
- [ ] El HUD muestra Puntuación, Vidas y Nivel `01` al empezar, y no muestra stats extra.
- [ ] Al limpiar una oleada desaparece el cristal más antiguo, hay un respiro sin enemigos de unos 2 s y el Nivel pasa al siguiente (`01` → `02`), con más enemigos y más rápidos.
- [ ] La oleada 10 tiene 38 enemigos (26 esporas, 5 corazas y 7 agujas).
- [ ] Al formarse el 8.º cristal se abre el modal «FIN DEL JUEGO» con la puntuación final.
- [ ] Al perder la tercera vida se abre el mismo modal. No se dibuja ningún «GAME OVER» en el canvas.
- [ ] Al limpiar la oleada 10 se abre el mismo modal (máximo 3.010) y no se dibuja ningún mensaje de victoria.
- [ ] `P` y `Escape` pausan y reanudan a través del estado de la plataforma: el botón pasa de `PAUSA` a `REANUDAR`, aparece «EN PAUSA» y una segunda pulsación reanuda sin que los enemigos salten de golpe.
- [ ] Pulsar `P` o `Escape` con la partida terminada (modal abierto) no hace nada.
- [ ] `PAUSA` congela cañón, proyectiles y enemigos. Durante la pausa la oleada no avanza.
- [ ] La pausa no muestra selector de nivel.
- [ ] Tras pulsar `PAUSA` y `REANUDAR` con el ratón, `Espacio` dispara y no vuelve a activar el botón, y las flechas no hacen scroll.
- [ ] `FIN` durante la partida abre el modal con la puntuación actual y detiene el juego.
- [ ] «JUGAR DE NUEVO» empieza con nivel `01`, puntuación 0, 3 vidas, sin cristales y con el cañón centrado, sin duplicar el bucle (la velocidad no cambia tras reiniciar varias veces).
- [ ] Escribir las iniciales en el modal (incluidas `A`, `D` y la barra espaciadora) no mueve ni acciona el juego.
- [ ] Con sesión iniciada, «GUARDAR PUNTUACIÓN» crea una fila en `scores` con `game_id = 'invasores'`, el `user_id` del usuario y la puntuación final mostrada.
- [ ] Insertar por encima de `max_score` falla: la política de inserción rechaza una puntuación de 3.020 en `invasores`.
- [ ] Esa marca aparece en `/salon-de-la-fama` (pestaña INVASORES) y en el panel de `/juegos/invasores` sin vaciar la caché a mano, y `Partidas` sube en 1.
- [ ] Sin sesión, el modal conserva el campo de iniciales, guarda en `localStorage["av_scores"]` y muestra `INICIA SESIÓN PARA ENTRAR AL RANKING`. No se crea fila en `scores`.
- [ ] Al pulsar `SALIR` o navegar a otra ruta se cancela el bucle y se quitan los listeners: las flechas y `Espacio` recuperan su comportamiento normal y no hay errores en consola.
- [ ] Con React StrictMode en desarrollo hay un único bucle activo (un solo cañón, velocidad normal).
- [ ] El cañón, los enemigos y los cristales usan `--cyan`, `--green`, `--magenta`, `--yellow` e `--ink` del tema, y el dibujo tiene brillo neón.
- [ ] El canvas conserva la proporción 4:3 a 1280 px y a 390 px, y a 390 px `/jugar/invasores` no tiene scroll horizontal.
- [ ] `/juegos/invasores` ya no muestra `PRÓXIMAMENTE`. La descripción menciona las esporas en columnas, los cristales, las 10 oleadas y los puntos por tipo, y ya no menciona «filas alienígenas» ni «formación».
- [ ] `get_advisors` de seguridad no reporta avisos nuevos tras la migración.
- [ ] La consola del navegador no muestra errores ni warnings en `/jugar/invasores` durante una partida completa.
- [ ] Las demás pantallas (Home, Acerca de, Biblioteca, detalle, Salón, acceso) se ven y funcionan igual que antes.

---

## Decisiones

- **Sí:** reutilizar la fila `invasores` del catálogo (`update`, no `insert`). Ya tiene id, portada `cover-invaders`, categoría SHOOTER y color verde, y el tema encaja de forma directa.
- **Sí:** conservar el título INVASORES. Es una palabra genérica en español, coherente con ROCAS o CAÍDA, y coincide con la fila del catálogo. La identidad propia sale de las esporas, los cristales y el terreno invadido. (decisión del agente, a revisar)
- **Sí:** cambiar `short` además de `long`. El texto actual («Defiende el planeta de filas alienígenas») y el `long` («formación tras formación») describen una formación en rejilla que este juego no tiene. (decisión del agente, a revisar)
- **Sí:** el giro de diseño: el enemigo que aterriza cristaliza su columna en lugar de terminar la partida. Interpreta el tema como territorio perdido y da al jugador una decisión constante entre derribar o esquivar. **No:** fin inmediato al tocar el suelo, que es la regla del género comercial y deja la partida en un solo error.
- **Sí:** el cristal ralentiza el cañón (×0,35) y le impide disparar, pero no lo bloquea. **No:** cristales que bloquean el paso. Un cristal en el centro encerraría al cañón en media pantalla, y todo lo que cayera fuera aterrizaría sin remedio: derrota en cascada. (decisión del agente, a revisar)
- **Sí:** 8 cristales terminan la partida (media superficie). Da una segunda forma de perder que no depende de las vidas. (decisión del agente, a revisar)
- **Sí:** disolver el cristal más antiguo al limpiar cada oleada. Sin esa regla, 10 oleadas acumularían cristales sin vuelta atrás. Con ella, una buena oleada recupera terreno. (decisión del agente, a revisar)
- **Sí:** sin disparos enemigos. La amenaza es la caída, y un segundo tipo de proyectil acercaría el diseño al título comercial. **No:** búnkeres, nave misteriosa ni formación que marcha y baja.
- **Sí:** tres tipos de enemigo (espora, coraza y aguja) con velocidades distintas. Bastan para variar las oleadas sin añadir IA. Los valores (60, 40 y 130 px/s, 1-2 impactos, 10, 30 y 20 puntos) son de partida y se afinan en el paso 5 sin tocar `max_score`, que solo depende de los recuentos y los puntos. (decisión del agente, a revisar)
- **Sí:** 10 oleadas finitas y por fórmula, sin selector. **No:** oleadas infinitas, que obligarían a `max_score = 1000000`.
- **Sí:** `max_score = 3010`, la suma exacta de los puntos de los 223 enemigos de las 10 oleadas. **No:** 1.000.000: la RLS aceptaría puntuaciones imposibles.
- **Sí:** los puntos solo se dan al destruir. Ni el primer impacto a una coraza ni la supervivencia suman, así que el tope se calcula contando enemigos.
- **Sí:** las columnas de aparición se eligen entre las que no tienen cristal. Todo enemigo nace donde el cañón puede dispararle, así que 3.010 es alcanzable en teoría.
- **Sí:** autodisparo al mantener `Espacio`, con 2 proyectiles y 0,2 s de recarga. Con controles mínimos se evita machacar la tecla, y el límite de dos mantiene la puntería como habilidad.
- **Sí:** colisión barrida del proyectil y caja del enemigo en lugar de un círculo exacto. Es barata, no deja enemigos atravesados con `dt` de 50 ms y la diferencia no se nota a esta escala.
- **Sí:** 1 s de invulnerabilidad tras perder una vida. Evita perder dos vidas a la vez cuando dos enemigos caen juntos sobre el cañón.
- **Sí:** canvas 800×600 (4:3), como ROCAS, BLOQUE BUSTER y SERPENTINA. **No:** un canvas vertical. 16 columnas de 50 px dan carriles legibles y un cañón ágil.
- **Sí:** sin sonido ni assets. Es el alcance de la variante A y la opción por defecto del contrato.
- **Sí:** `P` y `Escape` vía `onPauseKey`. La plataforma sigue siendo la única dueña del estado de pausa.
- **Sí:** teclado en `window` y `preventDefault` solo en `ArrowLeft`, `ArrowRight` y `Space`, con la partida activa y el foco fuera de campos de texto.
- **Sí:** no modificar `components/game-player.tsx`, `components/game-canvas.tsx` ni `app/globals.css`. El contrato ya cubre este juego y la portada existe.
- **Sí:** los textos de la UI siguen en español.

---

## Riesgos

| Riesgo                                                                           | Mitigación                                                                                                                                                              |
| -------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| El diseño se percibe como un clon del tirador fijo comercial                     | No hay formación en rejilla, búnkeres, nave misteriosa ni disparo enemigo. Los enemigos caen en columnas y el aterrizaje cristaliza el suelo. Nombres y formas propios. |
| Un proyectil atraviesa una aguja rápida con un `dt` grande                       | Colisión barrida entre `prevY` y `y`, y `dt` acotado a 50 ms. Un criterio lo comprueba en la oleada 10.                                                                 |
| La regla de los cristales resulta demasiado dura o demasiado blanda              | Constantes (`CRYSTAL_SLOW`, `CRYSTAL_LIMIT`, disolución por oleada) en `entities.ts`, ajustables en el paso 5 sin tocar `max_score`.                                    |
| Las oleadas altas son injugables (38 enemigos a ×1,54)                           | Intervalo mínimo de 0,5 s y cola barajada. Se prueba la oleada 10 en el paso 5 y, si hace falta, se suavizan las fórmulas de velocidad sin cambiar los recuentos.       |
| Dos enemigos caen a la vez sobre el cañón y quitan dos vidas                     | Invulnerabilidad de 1 s tras el primer contacto. Un criterio lo comprueba.                                                                                              |
| StrictMode monta el efecto dos veces y deja dos bucles o dos juegos de listeners | `destroy` cancela `requestAnimationFrame` y quita los listeners. Sin estado global. La carga dinámica usa bandera `cancelled`.                                          |
| Tras `PAUSA` con el ratón, `Espacio` vuelve a activar el botón                   | `preventDefault` en `Space` con la partida activa. Si no basta, quitar el foco del botón tras el clic. Un criterio lo comprueba.                                        |
| Las flechas o `Espacio` hacen scroll en la página                                | `preventDefault` solo con la partida activa y el foco fuera de campos de texto.                                                                                         |
| El motor atrapa teclas y rompe el campo de iniciales del modal                   | Con la partida terminada el motor ignora todas las teclas y no llama a `preventDefault`. Un criterio lo comprueba con `A`, `D` y `Espacio`.                             |
| Una tecla queda «pegada» si se suelta durante la pausa o al terminar             | `keyup` sigue escuchando mientras el motor existe, y el `Set` de teclas se vacía en `restart` y `destroy`.                                                              |
| Re-renders de React a 60 fps por los callbacks                                   | Callbacks solo al cambiar el valor. Sin valores continuos en el HUD.                                                                                                    |
| `dt` grande al reanudar tras pausa o cambio de pestaña                           | `dt` acotado a 0,05 s y `lastTime` reiniciado en `resume`.                                                                                                              |
| `shadowBlur` en 38 enemigos y 7 cristales penaliza el rendimiento                | `shadowBlur` entre 6 y 12, y las estrellas sin brillo. Se ajusta en el paso 5 sin tocar mecánicas.                                                                      |
| Sin controles táctiles el juego no es jugable en móvil                           | Aceptado: solo se garantiza que no haya scroll horizontal. Táctil va en otra spec.                                                                                      |
| Juego `playable = true` sin motor real contamina el ranking                      | La migración y la entrada en `ENGINES` van en la misma spec, y la migración se aplica después de comprobar el motor (paso 4).                                           |
| Tras aplicar la migración, el catálogo cacheado sigue con `playable = false`     | La caché de `getGames()` caduca con su `cacheLife`. En desarrollo se reinicia `npm run dev`. Si persiste, invalidar la etiqueta `games`.                                |
| Cliente falsificado envía una puntuación alta dentro del tope                    | Aceptado (SPEC 06). Con `max_score = 3010` el margen es pequeño. Anti-trampas serio queda para otra spec.                                                               |

---

## Lo que **no** está en esta spec

- Niveles diseñados a mano, cristales iniciales y selector de nivel.
- Sonido, música, power-ups, portadoras y stats extra en el HUD.
- Disparos enemigos, movimiento lateral, jefes, búnkeres y formaciones.
- Bonus por superficie, combos y multiplicadores.
- Controles táctiles, gamepad y ratón.
- Pausa automática al perder el foco, `devicePixelRatio` y pantalla completa.
- Anti-trampas, rate limit, Realtime y subida de las puntuaciones de `localStorage`.
- Los otros tres juegos simulados.
- Tests automatizados.

Cada uno, si llega, va en su propia spec.
