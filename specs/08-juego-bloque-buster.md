# SPEC 08 — Tercer juego real: BLOQUE BUSTER (Arkanoid)

> **Estado:** Implementado
> **Depende de:** SPEC 05, SPEC 06, SPEC 07
> **Fecha:** 2026-10-31
> **Objetivo:** Portar el Arkanoid de `references/started-games/04-arkanoid` a un motor TypeScript registrado como `bloque-buster`, jugable en `/jugar/bloque-buster` con el HUD, la pausa (incluido el selector de nivel) y el modal de la plataforma y con ranking real en Supabase, sobre el contrato y el registro de motores de la SPEC 07.

---

## Por qué existe esta spec

La SPEC 07 dejó el contrato (`lib/games/contract.ts`), el registro (`lib/games/registry.ts`) y el canvas genérico (`components/game-canvas.tsx`). Portar un juego es ahora motor + entrada en `ENGINES` + migración. `bloque-buster` ya existe en el catálogo como juego simulado (`playable = false`, `cover-bricks`, `sort_order` 1) y `references/started-games/04-arkanoid` contiene un Arkanoid completo en JavaScript plano (`game.js`, 268 líneas, `levels.js`, canvas 800×600).

El Arkanoid trae tres cosas que los motores anteriores no tenían:

- **Selector de nivel en la pausa.** El original dibuja en el canvas cinco botones para saltar a cualquier nivel. Se conserva por decisión del autor. Como la pausa la dibuja la plataforma («EN PAUSA»), el selector no puede vivir en el canvas: se amplía el contrato con un `goToLevel` opcional y el registro con el número de niveles, y `GamePlayer` pinta los botones en su overlay de pausa. Solo lo usan los motores que lo declaran.
- **Sonido.** Dos efectos (`ball-bounce.mp3` y `break-sound.mp3`, ~19 KB). Se incluyen por decisión del autor; es la primera spec que añade assets a `public/games/<id>/`.
- **Una condición de victoria.** Tras limpiar el nivel 5 el original muestra «¡Completaste el juego!». La plataforma solo tiene un fin de partida, así que ganar y perder terminan igual: `onGameOver(score)`.

El código difiere del `README.md` y del `CLAUDE.md` del original en varios puntos. Se resuelven a favor del código y se documentan en Decisiones: la paleta mide 81 px (el sprite es de 162 px y se dibuja a la mitad), el nivel actual es 1-indexado, la velocidad se llama `speed` en `levels.js`, la pausa es una bandera (`isPaused`) y no un estado, y los bloques `gray` explotan con los fotogramas de `red`.

---

## Alcance

**Dentro:**

- **Ampliación del contrato:** `GameEngine.goToLevel?: (level: number) => void` en `lib/games/contract.ts`, `EngineEntry.levels?: number` en `lib/games/registry.ts` y `goToLevel` expuesto por el `ref` de `components/game-canvas.tsx`. Opcionales: ROCAS y CAÍDA no cambian.
- **Selector de nivel en la pausa:** en `components/game-player.tsx`, si `entry.levels` existe, el overlay «EN PAUSA» muestra `SALTAR AL NIVEL` y un botón por nivel (1 a `levels`), con el nivel actual resaltado. Pulsar uno llama a `goToLevel(n)` y reanuda la partida.
- Motor en `lib/games/bloque-buster/` (`levels.ts`, `entities.ts` y `engine.ts`) con `createBloqueBuster(canvas, callbacks)`, portado de `game.js` y `levels.js` sin cambiar las mecánicas: canvas lógico 800×600; paleta de 81×14 en `y = 560`, a 400 px/s; pelota de 16×16 con velocidad base `(200, −300)` multiplicada por la `speed` del nivel; rebotes en paredes y techo; rebote en la paleta (sin ángulo según el punto de impacto); rejilla de bloques de 64×24 con origen `(80, 80)`; 10 puntos por bloque; un solo bloque por fotograma y siempre se invierte `vy`; 3 vidas, al caer la pelota se pierde una y reaparece sobre la paleta; 5 niveles (parrilla 10×6 ×1.00, pirámide ×1.10, ajedrez ×1.21, filas con huecos ×1.33, marco con cruz ×1.46); la puntuación se acumula entre niveles; animación de explosión de 150 ms al romper un bloque.
- Fin de partida: sin vidas, al limpiar el nivel 5 o al llamar a `end()`. Todos llaman a `onGameOver(score)`.
- Entrada `ENGINES["bloque-buster"]` con canvas lógico 800×600 y `levels: 5`.
- Controles: `←` `→` mueven la paleta mientras se mantienen pulsadas; `P` y `Escape` pausan y reanudan a través de `onPauseKey`. Se bloquean con `preventDefault` solo las flechas, con la partida activa y el foco fuera de `input`/`textarea`. **Sin ratón** (decisión del autor).
- HUD de la plataforma: Puntuación, Vidas (3), Nivel (de `onLevel`). Sin stats extra: `onStats([])`.
- Estilo neón del tema: bloques, paleta y pelota dibujados con rectángulos y brillo moderado, sin spritesheet (decisión del autor). Cian, amarillo, magenta y verde salen de las variables CSS; rojo, rosa y gris son fijos.
- Sonido: `ball-bounce.mp3` (paredes, techo y paleta) y `break-sound.mp3` (bloque roto) copiados a `public/games/bloque-buster/`, reproducidos desde el motor.
- Migración `supabase/migrations/20261031130000_bloque_buster_playable.sql`: `update` de la fila `bloque-buster` con `playable = true`, `max_score = 2080` y `long` corregido.
- Reglas CSS nuevas solo al final de `app/globals.css`, para el selector de nivel, sin tocar reglas existentes.

**Fuera de alcance (para futuras specs):**

- Controles táctiles o gamepad, y control con el ratón.
- Spritesheet original (`spritesheet-breakout.png`) y sus fotogramas de explosión.
- Silenciar o regular el volumen del sonido, y música.
- Pantalla de victoria propia: ganar y perder terminan en el mismo modal.
- Mecánicas nuevas: ángulo de rebote según el punto de la paleta, power-ups, bloques de varios golpes, vidas extra, colisión por lados del bloque.
- Corregir las trayectorias cerradas de la pelota (ver Riesgos).
- Pausa automática al perder el foco, ajuste a `devicePixelRatio` y pantalla completa.
- Anti-trampas, rate limit y Realtime (siguen fuera, como en la SPEC 06).
- Portar los otros cinco juegos simulados.
- Tests automatizados (no hay runner configurado).

---

## Modelo de datos

```ts
// lib/games/contract.ts (se añade un miembro opcional)
export interface GameEngine {
  pause: () => void;
  resume: () => void;
  restart: () => void;
  end: () => void;
  destroy: () => void;
  goToLevel?: (level: number) => void; // salta al nivel indicado (1..levels); solo motores con niveles
}
```

```ts
// lib/games/registry.ts (se añade un campo opcional y una entrada)
export interface EngineEntry {
  width: number;
  height: number;
  levels?: number; // nº de niveles seleccionables en la pausa; ausente = sin selector
  load: () => Promise<CreateGame>;
}

// dentro de ENGINES
"bloque-buster": {
  width: 800,
  height: 600,
  levels: 5,
  load: () =>
    import("./bloque-buster/engine").then((m) => m.createBloqueBuster),
},
```

```ts
// lib/games/bloque-buster/levels.ts
export type BlockColor =
  "red" | "yellow" | "cyan" | "magenta" | "hotpink" | "green" | "gray";

export interface LevelBlock {
  col: number; // 0..9
  row: number; // 0..5
  color: BlockColor;
}

export interface Level {
  speed: number; // multiplicador de la velocidad base de la pelota
  blocks: LevelBlock[];
}

// Mismos 5 niveles que levels.js, con las mismas fórmulas.
export const LEVELS: Level[];
```

```ts
// lib/games/bloque-buster/entities.ts
export const W = 800;
export const H = 600;
export const PADDLE_SPEED = 400;
export const BLOCK_COLS = 10;
export const BLOCK_ROWS = 6;
export const BLOCK_W = 64;
export const BLOCK_H = 24;
export const BLOCKS_ORIGIN_X = (W - BLOCK_COLS * BLOCK_W) / 2; // 80
export const BLOCKS_ORIGIN_Y = 80;
export const BASE_BALL_VX = 200;
export const BASE_BALL_VY = -300;
export const EXPLOSION_DURATION = 150; // ms
export const POINTS_PER_BLOCK = 10;
export const START_LIVES = 3;

export interface Rect {
  x: number;
  y: number;
  w: number;
  h: number;
}
export interface Paddle extends Rect {} // w 81, h 14, y 560
export interface Ball extends Rect {
  vx: number;
  vy: number;
} // w 16, h 16
export interface Block extends Rect {
  color: BlockColor;
  alive: boolean;
}
export interface Explosion extends Rect {
  color: BlockColor;
  elapsed: number; // ms
}

export interface Palette {
  blocks: Record<BlockColor, string>; // cian, amarillo, magenta y verde del tema; rojo, rosa y gris fijos
  paddle: string; // --cyan
  ball: string; // --ink
}
```

```ts
// lib/games/bloque-buster/engine.ts
export function createBloqueBuster(
  canvas: HTMLCanvasElement,
  callbacks: GameCallbacks,
): GameEngine; // con goToLevel
```

Convenciones:

- Constantes de `game.js` y `levels.js` conservadas tal cual. La colisión pelota-bloque y pelota-paleta usa cajas alineadas a los ejes (`collideAABB`) y la zona de rebote de la paleta, igual que el original (`ball.y + ball.h <= paddle.y + paddle.h + 8`).
- Número de bloques por nivel: 60, 40, 30, 39 y 39, en total 208. A 10 puntos cada uno, la puntuación máxima posible es **2.080**.
- Coordenadas con origen arriba a la izquierda; la pelota y los bloques se dibujan con su caja de colisión.
- Mapeo a callbacks: `onScore` al cambiar la puntuación (al romper un bloque); `onLives(n)` al crear, en `restart` y al perder una vida; `onLevel(n)` al cargar un nivel (al crear, al pasar de nivel, en `goToLevel` y en `restart`); `onStats([])` una vez al crear y en `restart`; `onGameOver(score)` al quedarse sin vidas, al limpiar el nivel 5 o al llamar a `end()`.
- `goToLevel(n)` ignora valores fuera de 1..5 y, dentro de rango, carga el nivel `n` igual que el original (`loadLevel`: bloques nuevos, explosiones vaciadas, pelota sobre la paleta con la velocidad del nivel). Conserva puntuación y vidas, y no reposiciona la paleta. Solo actúa con la partida en curso.
- Al perder una vida la pelota reaparece sobre la paleta ya en movimiento hacia arriba y a la derecha, sin espera de lanzamiento (como `initBall`).
- Paleta: `keys.ArrowLeft` y `keys.ArrowRight` como estado de teclas pulsadas; se actualiza en `keydown`/`keyup` de `window` y se reinicia en `restart` y `destroy`.
- Bucle con `requestAnimationFrame`. El original no acotaba `dt`; aquí se acota a 50 ms y se reinicia `lastTime` en `resume` (regla del contrato).
- Sin estado global de módulo: bloques, explosiones, paleta, pelota, vidas, puntuación, nivel y sonidos viven en la clausura de `createBloqueBuster`.
- Teclado en `window` (el original usaba `document`), quitado en `destroy`. `P` y `Escape` llaman a `callbacks.onPauseKey?.()` y no pausan por sí mismos. Con la partida terminada el motor ignora todas las teclas.
- Sonido: se crean dos `HTMLAudioElement` con `preload = "auto"` al crear el motor y cada reproducción usa `cloneNode()` como el original, con `play().catch(() => {})` para tolerar el bloqueo de autoplay. Rutas `/games/bloque-buster/ball-bounce.mp3` y `/games/bloque-buster/break-sound.mp3`.
- Explosión: sin spritesheet, un destello del color del bloque que crece y se desvanece durante 150 ms, dividido en 4 pasos como los 4 fotogramas del original.
- Sin HUD ni overlays dibujados: se eliminan `Score`, `Nivel`, las bolas de vidas, `GAME OVER`, `¡Completaste el juego!` y todo el overlay de pausa del canvas, incluidos sus botones y el manejador de clic.
- El motor no guarda puntuaciones: solo llama a `onGameOver(finalScore)`.

---

## Plan de implementación

Antes de empezar, leer en `node_modules/next/dist/docs/` la guía de componentes cliente (`"use client"`), la de Cache Components y la de archivos estáticos en `public/`, como exige `AGENTS.md`. Leer `components/game-player.tsx`, `components/game-canvas.tsx`, `lib/games/contract.ts`, `lib/games/registry.ts`, `lib/games/caida/engine.ts` (motor de referencia del contrato) y las reglas `.crt`, `.crt-screen`, `.crt-fit`, `.hud-stat` y `.btn` de `app/globals.css`. Invocar `/frontend-design` para el acabado visual del canvas y del selector de nivel, como indica `CLAUDE.md`. Antes y después de la migración, ejecutar `list_tables` y `get_advisors` de seguridad del MCP de Supabase.

1. Ampliar el contrato: `goToLevel?` en `GameEngine` (`lib/games/contract.ts`), `levels?` en `EngineEntry` (`lib/games/registry.ts`) y `goToLevel` en el `GameHandle` de `components/game-canvas.tsx` (delega en el motor si existe). Verificación: `npm run lint` y `npm run build` pasan; ROCAS y CAÍDA se juegan igual.
2. Selector de nivel en `components/game-player.tsx`: dentro del overlay de pausa, si `entry?.levels`, renderizar `SALTAR AL NIVEL` y un botón por nivel con el actual resaltado (`engineLevel`); cada botón llama a `engineRef.current?.goToLevel?.(n)` y `setPaused(false)`. Añadir las reglas CSS necesarias al final de `app/globals.css`. Verificación: `/jugar/rocas` y `/jugar/caida` muestran la pausa exactamente como antes (sin selector). El selector se verifica en el paso 6, cuando exista un motor con `levels`.
3. Crear `lib/games/bloque-buster/levels.ts` (los 5 niveles, mismas fórmulas que `levels.js`) y `lib/games/bloque-buster/entities.ts` (constantes, tipos, `collideAABB` y las funciones de dibujo de bloque, paleta, pelota y explosión con `draw(ctx, palette)`). Verificación: `npm run lint` y `npm run build` pasan; los niveles suman 60, 40, 30, 39 y 39 bloques.
4. Crear `lib/games/bloque-buster/engine.ts` con `createBloqueBuster` sin sonido todavía: estado en clausura, bucle con `dt` acotado, teclado, `loadLevel`, `initBall`, rebotes, colisión con bloques, explosiones, vidas, victoria, `pause`, `resume`, `restart`, `end`, `goToLevel`, `destroy` y los callbacks solo al cambiar. Verificación: compila y `npm run lint` pasa.
5. Copiar `ball-bounce.mp3` y `break-sound.mp3` de `references/started-games/04-arkanoid/assets/sounds/` a `public/games/bloque-buster/` y añadir su reproducción al motor (paredes, techo y paleta con rebote; bloque roto con rotura). Verificación: compila y `npm run lint` pasa; las dos URLs responden 200.
6. Añadir `bloque-buster` a `ENGINES` (800×600, `levels: 5`). Verificación: `/jugar/bloque-buster` muestra el motor real en lugar de `.game-arena`, se puede jugar, la pausa muestra el selector de nivel y saltar de nivel funciona; mientras `playable` siga en `false`, la partida se guarda solo en `localStorage`.
7. Crear `supabase/migrations/20261031130000_bloque_buster_playable.sql` y aplicarla (MCP `apply_migration` o CLI):

   ```sql
   update public.games
   set playable = true,
       max_score = 2080,
       long = 'Mueve la paleta con las flechas y rebota la pelota para pulverizar cinco muros de bloques de neón: parrilla, pirámide, tablero de ajedrez, filas con huecos y un marco con cruz. Cada bloque suma 10 puntos, tienes 3 vidas y la pelota gana un 10 % de velocidad en cada nivel. Desde la pausa puedes saltar a cualquier nivel.'
   where id = 'bloque-buster';
   ```

   Ejecutar `get_advisors` de seguridad. Verificación: `select playable, max_score from games where id = 'bloque-buster'` devuelve `true` y `2080`, `/juegos/bloque-buster` ya no muestra `PRÓXIMAMENTE` y una partida con sesión crea una fila en `scores`.

8. Acabado visual: brillo del neón, colores de los bloques, destello de explosión, selector de nivel y revisión a 1280 px y 390 px. Verificación: capturas de `/jugar/bloque-buster` en ambos anchos en `.playwright-screenshots/` y sin scroll horizontal.

---

## Criterios de aceptación

- [ ] `npm run lint` y `npm run build` terminan sin errores ni warnings de Cache Components o hidratación.
- [ ] `select playable, max_score from games where id = 'bloque-buster'` devuelve `true` y `2080`, y `ENGINES["bloque-buster"]` existe con `levels: 5`.
- [ ] `/jugar/bloque-buster` muestra un `<canvas>` con la partida lista y no muestra `.game-arena`.
- [ ] Los demás juegos no jugables (por ejemplo `/jugar/serpentina`) conservan simulación y `.game-arena`.
- [ ] ROCAS y CAÍDA se comportan igual que antes (controles, pausa sin selector de nivel, HUD, ranking).
- [ ] `components/game-player.tsx` no contiene `game.id === "..."`; el selector de nivel depende solo de `entry.levels`.
- [ ] Al empezar hay 60 bloques en parrilla de 10×6, la paleta centrada abajo y la pelota sobre ella, ya en movimiento.
- [ ] `←` y `→` mueven la paleta mientras se mantienen pulsadas, sin salir del canvas, y la página no hace scroll al pulsarlas. El ratón no mueve la paleta.
- [ ] La pelota rebota en las paredes y el techo, y rebota hacia arriba al tocar la paleta.
- [ ] Romper un bloque suma exactamente 10 puntos, se refleja en el HUD y se ve el destello de 150 ms.
- [ ] Al romper el último bloque se pasa al nivel siguiente: el HUD pasa de `01` a `02`, aparece la pirámide de 40 bloques y la pelota va un 10 % más rápida; la puntuación y las vidas se conservan.
- [ ] Los niveles 1 a 5 tienen 60, 40, 30, 39 y 39 bloques con las velocidades ×1.00, ×1.10, ×1.21, ×1.33 y ×1.46.
- [ ] Dejar caer la pelota resta una vida (el HUD pasa de `♥ ♥ ♥` a `♥ ♥`) y la pelota reaparece sobre la paleta.
- [ ] Al perder la tercera vida se abre el modal «FIN DEL JUEGO» con la puntuación final; no se dibuja ningún «GAME OVER» en el canvas.
- [ ] Al romper el último bloque del nivel 5 se abre el mismo modal con la puntuación final (máximo 2.080 sin perder el progreso) y no se dibuja ningún mensaje de victoria en el canvas.
- [ ] `P` y `Escape` pausan y reanudan a través del estado de la plataforma: el botón pasa de `PAUSA` a `REANUDAR`, aparece «EN PAUSA» y una segunda pulsación reanuda sin saltos.
- [ ] Pulsar `P` o `Escape` con la partida terminada (modal abierto) no hace nada.
- [ ] En pausa aparece `SALTAR AL NIVEL` con cinco botones y el del nivel actual resaltado; pulsar el 4 carga el nivel 4 (39 bloques, ×1.33, HUD `04`), conserva puntuación y vidas, y reanuda la partida.
- [ ] Saltar de nivel no suma puntos: la puntuación antes y después del salto es la misma.
- [ ] Ningún botón del selector aparece en la pausa de ROCAS ni de CAÍDA.
- [ ] `PAUSA` congela pelota, paleta y explosiones; `REANUDAR` continúa sin que la pelota salte de golpe.
- [ ] Tras pulsar `PAUSA` y `REANUDAR` con el ratón, `←` y `→` mueven la paleta y no hacen scroll ni activan el botón.
- [ ] `FIN` durante la partida abre el modal con la puntuación actual y detiene el juego.
- [ ] «JUGAR DE NUEVO» empieza con nivel `01`, puntuación 0, 3 vidas, 60 bloques y velocidad ×1.00, sin duplicar el bucle (la velocidad no cambia tras reiniciar varias veces).
- [ ] Escribir las iniciales en el modal no mueve la paleta.
- [ ] Suena `ball-bounce` al rebotar en paredes, techo y paleta, y `break-sound` al romper un bloque; no suena nada con la partida pausada ni terminada, y `/games/bloque-buster/ball-bounce.mp3` y `/games/bloque-buster/break-sound.mp3` responden 200.
- [ ] Con sesión iniciada, «GUARDAR PUNTUACIÓN» crea una fila en `scores` con `game_id = 'bloque-buster'`, el `user_id` del usuario y la puntuación final mostrada.
- [ ] Insertar con `max_score` superado falla: una puntuación de 2.090 en `bloque-buster` es rechazada por la política de inserción.
- [ ] Esa marca aparece en `/salon-de-la-fama` (pestaña BLOQUE BUSTER) y en el panel de `/juegos/bloque-buster` sin vaciar la caché a mano, y `Partidas` sube en 1.
- [ ] Sin sesión, el modal conserva el campo de iniciales, guarda en `localStorage["av_scores"]` y muestra `INICIA SESIÓN PARA ENTRAR AL RANKING`; no se crea fila en `scores`.
- [ ] Al pulsar `SALIR` o navegar a otra ruta se cancela el bucle y se quitan los listeners: las flechas recuperan su comportamiento normal y no hay errores en consola.
- [ ] Con React StrictMode en desarrollo hay un único bucle activo (una sola pelota, velocidad normal).
- [ ] Los colores cian, amarillo, magenta y verde del canvas salen de `--cyan`, `--yellow`, `--magenta` y `--green`, y el dibujo tiene brillo neón.
- [ ] El canvas conserva la proporción 4:3 a 1280 px y a 390 px, y a 390 px `/jugar/bloque-buster` no tiene scroll horizontal ni el selector de nivel desborda.
- [ ] `/juegos/bloque-buster` ya no muestra `PRÓXIMAMENTE` y la descripción menciona los cinco muros, las 3 vidas y el salto de nivel desde la pausa.
- [ ] `get_advisors` de seguridad no reporta avisos nuevos tras la migración.
- [ ] La consola del navegador no muestra errores ni warnings en `/jugar/bloque-buster` durante una partida completa.
- [ ] Las demás pantallas (Home, Acerca de, Biblioteca, detalle, Salón, acceso) se ven y funcionan igual que antes.

---

## Decisiones

- **Sí:** reutilizar la fila `bloque-buster` del catálogo (`update`, no `insert`). Ya tiene id, portada `cover-bricks`, categoría ARCADE y color cian; cambian `playable`, `max_score` y `long`.
- **Sí:** corregir `long`. El texto anterior hablaba de «núcleo de plasma» y de «patrones imposibles» sin describir las mecánicas reales (5 muros concretos, 3 vidas, velocidad creciente, salto de nivel).
- **Sí:** `max_score = 2080`. Hay 208 bloques a 10 puntos, así que ninguna partida legítima lo supera y la RLS rechaza valores imposibles. **No:** 1.000.000; con ese tope el ranking aceptaría puntuaciones que el juego no puede producir.
- **Sí:** conservar el selector de nivel de la pausa, por decisión del autor. Se implementa con un `goToLevel` opcional en el contrato y `levels` opcional en el registro, y lo dibuja `GamePlayer`. **No:** dibujarlo en el canvas como el original; la plataforma ya dibuja «EN PAUSA» encima y los clics no llegarían al canvas.
- **Sí:** el salto de nivel no altera la puntuación: la puntuación solo sube al romper bloques, así que no permite superar 2.080. Se acepta que un jugador pueda saltarse niveles fáciles; el ranking deja de medir «llegar hasta el nivel 5». Si molesta, se desactiva en otra spec con un ajuste del registro (`levels` ausente).
- **Sí:** ampliar el contrato con miembros opcionales en esta spec. **No:** dejarlo para otra spec: sin él, el selector no tiene dónde vivir y ROCAS y CAÍDA siguen sin cambios.
- **Sí:** solo teclado, sin ratón, por decisión del autor. El original movía la paleta con `mousemove` sobre el canvas; se descarta aunque es la forma natural de jugar. Evita escuchar el ratón y simplifica `destroy`.
- **Sí:** neón dibujado en lugar del spritesheet, por decisión del autor. Encaja con el CRT de la plataforma y con ROCAS y CAÍDA. Cuesta el destello de explosión por fotogramas, sustituido por un destello del color del bloque.
- **Sí:** incluir los dos efectos de sonido, por decisión del autor. Primera spec con assets: `public/games/bloque-buster/`. **No:** mute ni volumen; la plataforma no tiene gestión de audio y eso es otra spec.
- **Sí:** crear los `Audio` al construir el motor con `preload = "auto"` sin esperar a que carguen. La regla del contrato pide precargar antes de empezar, pero la pelota tarda unos segundos en tocar algo y los archivos pesan ~19 KB; con red lenta se puede perder el primer sonido, riesgo aceptado.
- **Sí:** `play().catch(() => {})`. Los sonidos solo se disparan tras el inicio de la partida, normalmente tras una pulsación de tecla, pero el navegador puede bloquearlos.
- **Sí:** victoria y derrota terminan igual, con `onGameOver(score)`. La plataforma tiene un único fin de partida y dos pantallas competirían. El mensaje «¡Completaste el juego!» desaparece.
- **Sí:** los cinco niveles, las constantes y la física del original, incluidas sus limitaciones (un bloque por fotograma, `vy` siempre invertido, paleta sin ángulo de rebote, pelota que reaparece ya en movimiento). Cambiarlas es una mecánica nueva.
- **Sí:** resolver las discrepancias a favor del código. La paleta mide 81 px (no 162, que es el sprite), `currentLevel` es 1-indexado y `LEVELS` usa `speed` (no `ballSpeedMultiplier`), la pausa es una bandera y no un estado, y `gray` explota con los fotogramas de `red`.
- **Sí:** `Escape` además de `P` para pausar, como el original, ambos vía `onPauseKey`; la plataforma sigue siendo la única dueña del estado de pausa.
- **Sí:** `dt` acotado a 50 ms. Es la única desviación de la lógica de tiempo del original, necesaria para no atravesar bloques ni soltar la pelota de golpe al volver de una pausa.
- **Sí:** sin vidas especiales en el HUD: Vidas muestra `♥` como en ROCAS, y `onStats([])` porque no hay stats extra.
- **Sí:** teclado en `window` y no en `document`, como el resto de motores.
- **Sí:** `preventDefault` solo en `←` y `→` con la partida activa y el foco fuera de campos de texto; `P` y `Escape` no lo necesitan.
- **Sí:** los textos de la UI siguen en español.

---

## Riesgos

| Riesgo                                                                                                                                                    | Mitigación                                                                                                                                                                                             |
| --------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| La ampliación del contrato rompe ROCAS o CAÍDA                                                                                                            | Los miembros son opcionales; los pasos 1 y 2 verifican ROCAS y CAÍDA antes de empezar Arkanoid y un criterio comprueba que no aparece el selector en ellos.                                            |
| La pelota queda en una trayectoria cerrada y no alcanza los últimos bloques (el rebote en la paleta no cambia el ángulo, solo `vx` cambia en las paredes) | Aceptado: es el comportamiento del original y la spec conserva las mecánicas. Perder una vida cambia la fase de la pelota y la desbloquea. Un control de ángulo por zona de la paleta va en otra spec. |
| Saltar de nivel desde la pausa distorsiona el ranking                                                                                                     | La puntuación no cambia al saltar y no puede superar 2.080; la RLS lo impone con `max_score`. Aceptado por decisión del autor; se desactiva quitando `levels` del registro.                            |
| La pelota atraviesa un bloque a velocidad alta (nivel 5, ~438 px/s) con un `dt` grande                                                                    | `dt` acotado a 50 ms: el desplazamiento máximo por fotograma (~22 px) es menor que la altura del bloque (24 px). Un criterio recorre el nivel 5 sin atravesar bloques.                                 |
| El primer sonido se pierde si el mp3 no ha cargado                                                                                                        | Archivos de ~19 KB con `preload = "auto"`; la primera colisión ocurre al cabo de unos segundos. Aceptado.                                                                                              |
| Autoplay bloqueado por el navegador                                                                                                                       | `play().catch(() => {})` evita errores en consola; el juego sigue sin sonido.                                                                                                                          |
| Sonidos acumulados por `cloneNode()` en partidas largas                                                                                                   | Cada clon se descarta al terminar (~0,5 s); el volumen de eventos es bajo.                                                                                                                             |
| Tras `PAUSA` con el ratón, las flechas mueven el foco o hacen scroll                                                                                      | `preventDefault` en `←` y `→` con la partida activa; si no basta, quitar el foco del botón tras el clic. Un criterio lo comprueba.                                                                     |
| El selector de cinco botones desborda a 390 px                                                                                                            | Los botones se disponen con `flex-wrap`; un criterio comprueba que no hay scroll horizontal a 390 px.                                                                                                  |
| Una tecla de flecha queda «pegada» si se suelta durante una pausa o al terminar                                                                           | `keyup` sigue escuchando mientras el motor existe y el estado de teclas se reinicia en `restart` y `destroy`.                                                                                          |
| Dos instancias del bucle por StrictMode                                                                                                                   | `destroy` cancela `requestAnimationFrame` y quita los listeners; sin estado global; carga dinámica con bandera `cancelled`.                                                                            |
| El motor atrapa teclas y rompe el campo de iniciales del modal                                                                                            | Con la partida terminada el motor ignora todas las teclas y no llama a `preventDefault`. Un criterio lo comprueba.                                                                                     |
| Tras aplicar la migración, el catálogo cacheado sigue con `playable = false`                                                                              | La caché de `getGames()` caduca con su `cacheLife`; en desarrollo se reinicia `npm run dev`. Si persiste, invalidar la etiqueta `games`. El criterio se comprueba tras recargar.                       |
| `shadowBlur` en 60 bloques penaliza el rendimiento                                                                                                        | Brillo moderado por bloque con valor bajo; se ajusta en el paso 8 sin tocar mecánicas.                                                                                                                 |
| Sin controles táctiles ni ratón el juego no es jugable en móvil                                                                                           | Aceptado: solo se garantiza que no haya scroll horizontal. Táctil va en otra spec.                                                                                                                     |
| Cliente falsificado envía una puntuación alta dentro del tope                                                                                             | Aceptado (SPEC 06). Con `max_score = 2080` el margen de trampa es pequeño; anti-trampas serio queda para otra spec.                                                                                    |

---

## Lo que **no** está en esta spec

- Control con el ratón, controles táctiles o gamepad.
- Spritesheet original y animación de explosión por fotogramas.
- Mute, volumen y música.
- Pantalla de victoria propia.
- Ángulo de rebote en la paleta, power-ups, bloques resistentes, vidas extra y cualquier mecánica nueva.
- Corregir las trayectorias cerradas de la pelota.
- Pausa automática al perder el foco, `devicePixelRatio` y pantalla completa.
- Anti-trampas, rate limit, Realtime y subida de las puntuaciones de `localStorage`.
- Los otros cinco juegos simulados.
- Tests automatizados.

Cada uno, si llega, va en su propia spec.
