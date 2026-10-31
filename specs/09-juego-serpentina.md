# SPEC 09 — Cuarto juego real: SERPENTINA (Snake)

> **Estado:** Implementado
> **Depende de:** SPEC 05, SPEC 06, SPEC 07, SPEC 08
> **Fecha:** 2026-10-31
> **Objetivo:** Crear un motor TypeScript de Snake registrado como `serpentina`, jugable en `/jugar/serpentina` con el HUD, la pausa y el modal de la plataforma, con las frutas de `fruits.png` como comida y con ranking real en Supabase, sobre el contrato y el registro de motores de la SPEC 07.

---

## Por qué existe esta spec

A diferencia de ROCAS, CAÍDA y BLOQUE BUSTER, SERPENTINA **no tiene código de referencia** en `references/started-games/`. Solo hay material gráfico en `references/source-assets/snake-assets/`: `fruits.png` (hoja de 3790×442 px, ~586 KB, fondo transparente, 22 frutas en tres estilos) y `sprites.js` (un atlas con las coordenadas de la fila pixel-art, obtenida de _The Spriters Resource_). Por eso las mecánicas no se portan: se **definen aquí**, y esta spec es su única fuente de verdad. Se eligen las del Snake clásico, fijadas por el autor en la fase de preguntas.

`serpentina` ya existe en el catálogo como juego simulado (`playable = false`, `cover-snake`, color verde, `sort_order` 3, `max_score = 1000000`). Se reutiliza la fila con un `update`: cambian `playable`, `max_score` y `long`. El texto actual promete que «cada bocado la alarga y la hace más veloz» y habla de «núcleos magenta»; lo primero se conserva y lo segundo se sustituye por frutas.

Es el segundo juego que incluye assets (el primero fue el sonido de BLOQUE BUSTER) y el primero con una imagen. El motor lo precarga antes de arrancar, como pide el contrato.

---

## Alcance

**Dentro:**

- Motor en `lib/games/serpentina/` (`entities.ts` y `engine.ts`) con `createSerpentina(canvas, callbacks)` que cumple el contrato `GameEngine`.
- **Tablero:** canvas lógico 800×600, cuadrícula de 20×15 celdas de 40 px. **Los muros se atraviesan**: la serpiente sale por un borde y reaparece por el opuesto. Solo muere al morderse la cola.
- **Serpiente:** empieza con 3 segmentos, en la fila 7, con la cabeza en la columna 7 y mirando a la derecha. Avanza una celda por paso. No puede girar 180° sobre sí misma.
- **Comida:** una fruta a la vez en una celda libre aleatoria. Cada aparición elige una de las 22 frutas del atlas al azar. Al comerla, la serpiente crece un segmento y suma 10 puntos.
- **Niveles y velocidad:** nivel `1 + floor(frutas / 5)`. El paso dura `max(70, 150 − 10 × (nivel − 1))` ms, es decir, 150 ms en el nivel 1 y 70 ms desde el nivel 9.
- **Fin de partida:** al morderse, al llenar el tablero (300 celdas) o al llamar a `end()`. Los tres llaman a `onGameOver(score)`.
- **Vidas:** ninguna; `onLives(null)` y el HUD oculta Vidas.
- **HUD de la plataforma:** Puntuación y Nivel (de `onLevel`). Sin stats extra: `onStats([])`.
- **Controles:** `←` `↑` `→` `↓` y `W` `A` `S` `D`. Cola de hasta 2 giros pendientes, para no perder pulsaciones rápidas dentro de un mismo paso. `P` y `Escape` llaman a `onPauseKey`. Se bloquean con `preventDefault` solo las teclas de dirección, con la partida activa y el foco fuera de `input`/`textarea`.
- **Dibujo:** cuerpo de la serpiente en neón verde (`--green`) con rectángulos redondeados y brillo moderado, cabeza algo más brillante con dos ojos; rejilla tenue de fondo; frutas dibujadas con `drawImage` desde `fruits.png`.
- **Assets:** copiar `fruits.png` a `public/games/serpentina/fruits.png` y precargarla antes de crear el motor.
- **Entrada en el registro:** `ENGINES["serpentina"]` con canvas 800×600, sin `levels` (no hay selector de nivel).
- **Migración** `supabase/migrations/20261031140000_serpentina_playable.sql`: `update` de la fila `serpentina` con `playable = true`, `max_score = 2970` y `long` corregido.
- Sin tocar `app/globals.css`: la portada `cover-snake` ya existe y el canvas usa las reglas existentes.

**Fuera de alcance (para futuras specs):**

- Controles táctiles (swipe), gamepad y control con el ratón.
- Sonido y música.
- Vidas, power-ups, frutas especiales o de más puntos, obstáculos, varios tableros y modo con muros mortales.
- Los otros dos estilos de `fruits.png` (ilustrado y fotográfico); solo se usa la fila pixel-art que describe `sprites.js`.
- Sprites para el cuerpo y la cabeza de la serpiente (solo existen frutas).
- Pausa automática al perder el foco, ajuste a `devicePixelRatio` y pantalla completa.
- Anti-trampas, rate limit y Realtime (siguen fuera, como en la SPEC 06).
- Portar los otros cuatro juegos simulados.
- Tests automatizados (no hay runner configurado).

---

## Modelo de datos

```ts
// lib/games/serpentina/entities.ts
export const W = 800;
export const H = 600;
export const CELL = 40;
export const COLS = 20; // W / CELL
export const ROWS = 15; // H / CELL
export const START_LENGTH = 3;
export const START_COL = 7; // cabeza; el cuerpo queda en 6 y 5
export const START_ROW = 7;
export const POINTS_PER_FRUIT = 10;
export const FRUITS_PER_LEVEL = 5;
export const STEP_BASE_MS = 150;
export const STEP_DECREASE_MS = 10; // por nivel
export const STEP_MIN_MS = 70;
export const MAX_QUEUED_TURNS = 2;

export type Direction = "up" | "down" | "left" | "right";

export interface Cell {
  col: number; // 0..COLS-1
  row: number; // 0..ROWS-1
}

export interface Fruit extends Cell {
  sprite: FruitName; // fruta elegida al aparecer
}

// Recorte dentro de fruits.png (fila pixel-art, y = 136, h = 160), de sprites.js.
export type FruitName =
  | "banana"
  | "orange"
  | "grape"
  | "garlic"
  | "eggplant"
  | "strawberry"
  | "cherry"
  | "carrot"
  | "mushroom"
  | "broccoli"
  | "watermelon"
  | "pepper"
  | "kiwi"
  | "lemon"
  | "peach"
  | "peanut"
  | "apple"
  | "tomato"
  | "berries"
  | "grapes2"
  | "pineapple"
  | "melon";

export interface SpriteRect {
  x: number;
  y: number;
  w: number;
  h: number;
}

export const FRUIT_SPRITES: Record<FruitName, SpriteRect>; // mismas 22 coordenadas que sprites.js

export interface Palette {
  snake: string; // --green
  head: string; // --green, más claro
  grid: string; // --ink con baja opacidad
  fallback: string; // --magenta; fruta si la imagen no cargó
}

export function stepMs(level: number): number; // max(STEP_MIN_MS, STEP_BASE_MS - STEP_DECREASE_MS * (level - 1))
```

```ts
// lib/games/serpentina/engine.ts
export function loadFruitSprites(): Promise<void>; // precarga /games/serpentina/fruits.png en un caché de módulo de solo lectura tras cargar
export function createSerpentina(
  canvas: HTMLCanvasElement,
  callbacks: GameCallbacks,
): GameEngine; // sin goToLevel
```

```ts
// lib/games/registry.ts (se añade una entrada)
serpentina: {
  width: 800,
  height: 600,
  load: async () => {
    const m = await import("./serpentina/engine");
    await m.loadFruitSprites();
    return m.createSerpentina;
  },
},
```

Convenciones:

- Coordenadas por celda `(col, row)` con origen arriba a la izquierda; se dibuja en `col * CELL`, `row * CELL`.
- La serpiente es un arreglo de `Cell` con la cabeza en el índice 0. Un `Set` de claves `col,row` permite colocar la fruta en una celda libre y detectar mordidas en O(1).
- **Paso a tiempo fijo.** El bucle usa `requestAnimationFrame` con `dt` acotado a 50 ms y acumula `dt` en un contador; cada vez que supera `stepMs(nivel)` se ejecuta un paso lógico. `lastTime` se reinicia en `resume` y el acumulador se conserva.
- **Paso lógico:** (1) toma el siguiente giro de la cola si existe y no es opuesto a la dirección actual; (2) calcula la nueva cabeza con módulo (`(col + dx + COLS) % COLS`); (3) si coincide con una celda del cuerpo **que seguirá ocupada tras el paso**, termina la partida; (4) si coincide con la fruta, la serpiente crece (no se quita la cola), suma 10 puntos y aparece otra fruta; si no, se quita la cola.
- **Mordida:** la celda que la cola va a abandonar en este paso cuenta como libre (la cabeza puede entrar en ella) salvo que se coma una fruta en ese mismo paso, porque entonces la cola no se mueve.
- **Cola de giros:** un giro se encola solo si es distinto de la última dirección encolada (o de la actual si la cola está vacía) y no la invierte. Máximo `MAX_QUEUED_TURNS`; el resto se descarta.
- **Victoria:** si tras comer no queda ninguna celda libre, `onGameOver(score)`. La puntuación máxima posible es **2.970** (297 frutas × 10, partiendo de 3 segmentos).
- **Fruta nueva:** celda libre aleatoria y fruta al azar entre las 22. Con 3 segmentos iniciales siempre hay celdas libres.
- Mapeo a callbacks: `onScore` al comer; `onLevel(n)` al cambiar de nivel (cada 5 frutas) y al crear y reiniciar; `onLives(null)` y `onStats([])` una vez al crear y en `restart`; `onGameOver(score)` al morderse, al llenar el tablero o con `end()`.
- La imagen se precarga en el `load` del registro, antes de crear el motor, así que el primer fotograma ya dibuja las frutas. Si la carga falla, `loadFruitSprites` no rechaza: el motor dibuja un círculo `--magenta` en la celda de la fruta y el juego sigue siendo jugable.
- Los sprites se dibujan escalados para caber en la celda con un margen de 2 px por lado (alto 36 px, ancho proporcional al recorte) y centrados. Con `imageSmoothingEnabled = false` para conservar el pixel-art.
- La paleta se lee una vez al crear el motor con `getComputedStyle(document.documentElement)`, con valores por defecto iguales a los del tema.
- Sin estado global de módulo salvo el caché de solo lectura de la imagen precargada, que es seguro entre instancias; todo el estado del juego (serpiente, fruta, dirección, cola de giros, puntuación, acumulador) vive en la clausura de `createSerpentina`.
- Teclado en `window`, quitado en `destroy`. `P` y `Escape` no pausan por sí mismos: llaman a `callbacks.onPauseKey?.()`. Con la partida terminada el motor ignora todas las teclas y no llama a `preventDefault`. La cola de giros y la dirección se reinician en `restart`.
- Sin HUD ni overlays dibujados: puntuación, nivel y fin los muestra la plataforma.
- El motor no guarda puntuaciones: solo llama a `onGameOver(finalScore)`.

---

## Plan de implementación

Antes de empezar, leer en `node_modules/next/dist/docs/` la guía de componentes cliente (`"use client"`), la de Cache Components y la de archivos estáticos en `public/`, como exige `AGENTS.md`. Leer `components/game-player.tsx`, `components/game-canvas.tsx`, `lib/games/contract.ts`, `lib/games/registry.ts`, `lib/games/caida/engine.ts` (motor de referencia del contrato) y las reglas `.crt`, `.crt-screen`, `.crt-fit`, `.hud-stat` de `app/globals.css`. Invocar `/frontend-design` para el acabado visual del tablero, de la serpiente y de las frutas, como indica `CLAUDE.md`. Antes y después de la migración, ejecutar `list_tables` y `get_advisors` de seguridad del MCP de Supabase.

1. Copiar `references/source-assets/snake-assets/snake-assets/fruits.png` a `public/games/serpentina/fruits.png`. Verificación: `/games/serpentina/fruits.png` responde 200 con el peso original (~586 KB).
2. Crear `lib/games/serpentina/entities.ts` con las constantes, los tipos, `FRUIT_SPRITES` (las 22 coordenadas de `sprites.js`), `stepMs` y las funciones de dibujo (`drawGrid`, `drawSnake`, `drawFruit`) con `draw(ctx, palette)`. Verificación: `npm run lint` y `npm run build` pasan; `stepMs(1) = 150`, `stepMs(5) = 110` y `stepMs(9) = 70` (comprobado leyendo la fórmula).
3. Crear `lib/games/serpentina/engine.ts` con `loadFruitSprites` y `createSerpentina`: estado en clausura, entrada de teclado con cola de giros, bucle con paso fijo y `dt` acotado, movimiento con envoltura, mordida, crecimiento, aparición de fruta, niveles, victoria, `pause`, `resume`, `restart`, `end` y `destroy`, y los callbacks solo al cambiar. Verificación: compila y `npm run lint` pasa.
4. Añadir `serpentina` a `ENGINES` en `lib/games/registry.ts` (800×600, carga con `loadFruitSprites`). Verificación: `/jugar/serpentina` muestra el motor real en lugar de `.game-arena`, se puede jugar y la pausa con `P` funciona; mientras `playable` siga en `false`, la partida se guarda solo en `localStorage`.
5. Crear `supabase/migrations/20261031140000_serpentina_playable.sql` y aplicarla (MCP `apply_migration` o CLI):

   ```sql
   update public.games
   set playable = true,
       max_score = 2970,
       long = 'Una serpiente de luz recorre una cuadrícula de 20×15 buscando fruta. Muévela con las flechas o WASD: cada pieza suma 10 puntos y la alarga, y cada 5 frutas subes de nivel y ganas velocidad. Los muros se atraviesan y reaparecen por el lado opuesto; solo pierdes si te muerdes la cola.'
   where id = 'serpentina';
   ```

   Ejecutar `get_advisors` de seguridad. Verificación: `select playable, max_score from games where id = 'serpentina'` devuelve `true` y `2970`, `/juegos/serpentina` ya no muestra `PRÓXIMAMENTE` y una partida con sesión crea una fila en `scores`.

6. Acabado visual: brillo de la serpiente y de la rejilla, ojos de la cabeza, escala de las frutas y revisión a 1280 px y 390 px. Verificación: capturas de `/jugar/serpentina` en ambos anchos en `.playwright-screenshots/` y sin scroll horizontal.

---

## Criterios de aceptación

- [ ] `npm run lint` y `npm run build` terminan sin errores ni warnings de Cache Components o hidratación.
- [ ] `select playable, max_score from games where id = 'serpentina'` devuelve `true` y `2970`, y `ENGINES["serpentina"]` existe sin `levels`.
- [ ] `/jugar/serpentina` muestra un `<canvas>` con la partida lista y no muestra `.game-arena`.
- [ ] Los demás juegos no jugables (por ejemplo `/jugar/gloton`) conservan simulación y `.game-arena`.
- [ ] ROCAS, CAÍDA y BLOQUE BUSTER se comportan igual que antes (controles, pausa, HUD, ranking).
- [ ] `components/game-player.tsx` no contiene `game.id === "..."` y no se modifica en esta spec.
- [ ] Al empezar hay una serpiente de 3 segmentos mirando a la derecha y una fruta visible en una celda libre, cargada desde `fruits.png`.
- [ ] `←` `↑` `→` `↓` y `W` `A` `S` `D` cambian la dirección; la página no hace scroll al pulsarlas.
- [ ] Pulsar la dirección contraria a la actual no hace nada ni mata a la serpiente.
- [ ] Pulsar dos giros seguidos dentro de un mismo paso (por ejemplo `↑` y luego `←`) ejecuta ambos en pasos consecutivos.
- [ ] Al comer una fruta, la serpiente crece un segmento, la puntuación sube exactamente 10 y aparece otra fruta en una celda libre, que puede ser de otro tipo.
- [ ] La fruta nunca aparece sobre el cuerpo de la serpiente.
- [ ] Al salir por un borde, la serpiente reaparece por el borde opuesto sin morir (se comprueba en los cuatro lados).
- [ ] Morderse la cola abre el modal «FIN DEL JUEGO» con la puntuación final; no se dibuja ningún «GAME OVER» en el canvas.
- [ ] Entrar en la celda que la cola abandona en ese mismo paso no cuenta como mordida.
- [ ] El HUD muestra Puntuación y Nivel `01` al empezar, y no muestra Vidas.
- [ ] Tras comer 5 frutas el HUD pasa a `02` y la serpiente se mueve más rápido (paso de 140 ms); a partir del nivel 9 la velocidad deja de aumentar.
- [ ] `P` y `Escape` pausan y reanudan a través del estado de la plataforma: el botón pasa de `PAUSA` a `REANUDAR`, aparece «EN PAUSA» y una segunda pulsación reanuda sin que la serpiente salte de golpe.
- [ ] Pulsar `P` o `Escape` con la partida terminada (modal abierto) no hace nada.
- [ ] `PAUSA` congela la serpiente; durante la pausa, pulsar una dirección no la cambia.
- [ ] Tras pulsar `PAUSA` y `REANUDAR` con el ratón, las flechas mueven la serpiente y no hacen scroll ni activan el botón.
- [ ] `FIN` durante la partida abre el modal con la puntuación actual y detiene el juego.
- [ ] «JUGAR DE NUEVO» empieza con nivel `01`, puntuación 0, 3 segmentos mirando a la derecha y una cola de giros vacía, sin duplicar el bucle (la velocidad no cambia tras reiniciar varias veces).
- [ ] Escribir las iniciales en el modal (incluidas `W`, `A`, `S`, `D` y las flechas) no mueve la serpiente.
- [ ] Si `fruits.png` no carga (bloqueada en la red del navegador), la fruta se dibuja como un círculo magenta y el juego sigue funcionando sin errores en consola.
- [ ] `/games/serpentina/fruits.png` responde 200.
- [ ] Con sesión iniciada, «GUARDAR PUNTUACIÓN» crea una fila en `scores` con `game_id = 'serpentina'`, el `user_id` del usuario y la puntuación final mostrada.
- [ ] Insertar con `max_score` superado falla: una puntuación de 2.980 en `serpentina` es rechazada por la política de inserción.
- [ ] Esa marca aparece en `/salon-de-la-fama` (pestaña SERPENTINA) y en el panel de `/juegos/serpentina` sin vaciar la caché a mano, y `Partidas` sube en 1.
- [ ] Sin sesión, el modal conserva el campo de iniciales, guarda en `localStorage["av_scores"]` y muestra `INICIA SESIÓN PARA ENTRAR AL RANKING`; no se crea fila en `scores`.
- [ ] Al pulsar `SALIR` o navegar a otra ruta se cancela el bucle y se quitan los listeners: las flechas recuperan su comportamiento normal y no hay errores en consola.
- [ ] Con React StrictMode en desarrollo hay un único bucle activo (una sola serpiente, velocidad normal).
- [ ] La serpiente y la rejilla usan `--green` y `--ink` del tema, y el dibujo tiene brillo neón.
- [ ] El canvas conserva la proporción 4:3 a 1280 px y a 390 px, y a 390 px `/jugar/serpentina` no tiene scroll horizontal.
- [ ] `/juegos/serpentina` ya no muestra `PRÓXIMAMENTE` y la descripción menciona la cuadrícula, la fruta, los niveles por velocidad y los muros que se atraviesan; ya no menciona «núcleos magenta».
- [ ] `get_advisors` de seguridad no reporta avisos nuevos tras la migración.
- [ ] La consola del navegador no muestra errores ni warnings en `/jugar/serpentina` durante una partida completa.
- [ ] Las demás pantallas (Home, Acerca de, Biblioteca, detalle, Salón, acceso) se ven y funcionan igual que antes.

---

## Decisiones

- **Sí:** reutilizar la fila `serpentina` del catálogo (`update`, no `insert`). Ya tiene id, portada `cover-snake`, categoría ARCADE y color verde; cambian `playable`, `max_score` y `long`.
- **Sí:** corregir `long`. El texto anterior hablaba de «núcleos magenta» y de que la serpiente «se devora a sí misma»; el juego usa frutas, y la descripción nueva recoge las mecánicas reales (muros que se atraviesan, niveles de velocidad).
- **Sí:** definir las mecánicas en esta spec, ya que no hay código de referencia. Son las del Snake clásico y las eligió el autor. Cambiarlas después es una decisión de otra spec.
- **Sí:** cuadrícula de 20×15 con celdas de 40 px sobre un canvas de 800×600. Conserva el 4:3 de ROCAS y BLOQUE BUSTER y las celdas son lo bastante grandes para que el sprite se vea nítido. **No:** 17×15 (cuadrado) ni una cuadrícula más fina.
- **Sí:** muros que se atraviesan, por decisión del autor. Es el modo más indulgente y deja la cola como única causa de muerte. **No:** muros mortales (la variante de Google Snake): la dificultad no depende del borde.
- **Sí:** velocidad por nivel y nivel cada 5 frutas, con paso inicial de 150 ms, −10 ms por nivel y mínimo de 70 ms. Coincide con la promesa del catálogo («la hace más veloz») y el mínimo evita un juego injugable. Son valores de partida fijados por el autor y se afinan en el paso 6 sin tocar las mecánicas.
- **Sí:** 10 puntos por fruta, constantes. **No:** puntos que crecen con el nivel; complicaban `max_score` y el ranking sin ningún beneficio.
- **Sí:** `max_score = 2970`. En 300 celdas con 3 iniciales caben 297 frutas, a 10 puntos cada una. Ninguna partida legítima lo supera y la RLS rechaza valores imposibles. **No:** 1.000.000.
- **Sí:** sin vidas, `onLives(null)`. Una mordida termina la partida, como el original del género.
- **Sí:** cola de hasta 2 giros pendientes, por decisión del autor. Sin ella, dos pulsaciones rápidas en un mismo paso se pierden y la serpiente se siente «sorda» en los niveles altos.
- **Sí:** la celda que la cola abandona cuenta como libre salvo que se coma una fruta en ese paso. Es la regla estándar y evita muertes injustas al perseguirse la cola.
- **Sí:** paso lógico de duración fija con acumulador, en lugar de mover la serpiente por `dt`. Mantiene el movimiento discreto de la cuadrícula; el `dt` acotado a 50 ms evita ráfagas de pasos al volver de una pausa.
- **Sí:** usar la fila pixel-art de `fruits.png` que describe `sprites.js`, con las 22 frutas y una al azar en cada aparición, por decisión del autor. Encaja con el estilo retro de la plataforma. **No:** los otros dos estilos de la hoja; mezclar tres estilos desentonaría, y se pueden añadir en otra spec.
- **Sí:** el cuerpo y la cabeza de la serpiente se dibujan con rectángulos neón, no con sprites. No hay sprites de serpiente y el neón encaja con ROCAS, CAÍDA y BLOQUE BUSTER.
- **Sí:** precargar la imagen en el `load` del registro, antes de crear el motor, para cumplir la regla del contrato de precargar antes de empezar. **No:** cargarla dentro de `createSerpentina`: el contrato es síncrono y la primera fruta se dibujaría vacía.
- **Sí:** si la imagen no carga, se dibuja un círculo magenta y el juego continúa. Un asset roto no debe bloquear una partida ni dejar al jugador sin ver la comida.
- **Sí:** subir `fruits.png` entera (~586 KB) a `public/games/serpentina/` sin recortarla ni optimizarla. Es el material aportado y se descarga una sola vez por su caché; optimizar el peso va en otra spec si molesta.
- **Sí:** victoria al llenar el tablero con `onGameOver(score)`. La plataforma solo tiene un fin de partida. Es casi inalcanzable (297 frutas), pero evita un bucle infinito sin celda libre.
- **Sí:** solo teclado, flechas y WASD. **No:** swipe táctil ni gamepad; es el diseño de otra spec, igual que en las anteriores.
- **Sí:** sin sonido. No hay assets de audio y es la opción por defecto del contrato.
- **Sí:** sin stats extra en el HUD (`onStats([])`). La longitud se deduce de la puntuación y no aporta información nueva.
- **Sí:** `P` y `Escape` vía `onPauseKey`; la plataforma sigue siendo la única dueña del estado de pausa.
- **Sí:** teclado en `window`, como el resto de motores, y `preventDefault` solo en las teclas de dirección con la partida activa y el foco fuera de campos de texto.
- **Sí:** no modificar `components/game-player.tsx`, `components/game-canvas.tsx` ni `app/globals.css`. El contrato ya cubre este juego (sin vidas, sin stats, sin selector) y la portada existe.
- **Sí:** los textos de la UI siguen en español.

---

## Riesgos

| Riesgo                                                                                | Mitigación                                                                                                                                                        |
| ------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Las coordenadas de `sprites.js` recortan mal alguna fruta (bordes cortados o vecinas) | Un paso del plan revisa a ojo las 22 frutas en el canvas; si alguna falla, se corrige su `SpriteRect` en `entities.ts` sin tocar el motor.                        |
| `fruits.png` pesa ~586 KB y retrasa el primer fotograma en redes lentas               | Se precarga antes de crear el motor y el navegador la cachea; el canvas aparece al cargar. Optimizar el peso queda fuera de alcance y puede hacerse más adelante. |
| La imagen no carga y la partida arranca sin frutas visibles                           | Fallback con círculo magenta; un criterio lo comprueba bloqueando la petición.                                                                                    |
| Dos giros en un mismo paso pueden invertir la dirección (arriba y luego abajo)        | La cola descarta giros opuestos a la última dirección encolada y a la actual. Un criterio lo comprueba.                                                           |
| El acumulador de tiempo ejecuta varios pasos seguidos tras una pausa o un lag         | `dt` acotado a 50 ms (menor que el paso mínimo de 70 ms) y `lastTime` reiniciado en `resume`: como mucho se ejecuta un paso por fotograma.                        |
| Las teclas `W` `A` `S` `D` rompen el campo de iniciales del modal                     | Con la partida terminada el motor ignora todas las teclas y no llama a `preventDefault`. Un criterio lo comprueba.                                                |
| Las flechas hacen scroll en la página                                                 | `preventDefault` solo con la partida activa y el foco fuera de campos de texto.                                                                                   |
| Tras `PAUSA` con el ratón, las flechas mueven el foco o hacen scroll                  | `preventDefault` en las flechas con la partida activa; si no basta, quitar el foco del botón tras el clic. Un criterio lo comprueba.                              |
| Dos instancias del bucle por StrictMode                                               | `destroy` cancela `requestAnimationFrame` y quita los listeners; el único estado de módulo es el caché de la imagen; carga dinámica con bandera `cancelled`.      |
| Con el tablero casi lleno, buscar una celda libre aleatoria tarda                     | Se elige entre la lista de celdas libres calculada con el `Set` de la serpiente; con 300 celdas el coste es irrelevante.                                          |
| Los valores de velocidad (150/−10/70 ms) resultan demasiado lentos o rápidos          | Constantes en `entities.ts`, ajustables en el paso 6 sin cambiar la lógica; el cambio no afecta a `max_score`, que depende del número de celdas.                  |
| Sin controles táctiles el juego no es jugable en móvil                                | Aceptado: solo se garantiza que no haya scroll horizontal. Táctil va en otra spec.                                                                                |
| Tras aplicar la migración, el catálogo cacheado sigue con `playable = false`          | La caché de `getGames()` caduca con su `cacheLife`; en desarrollo se reinicia `npm run dev`. Si persiste, invalidar la etiqueta `games`.                          |
| Cliente falsificado envía una puntuación alta dentro del tope                         | Aceptado (SPEC 06). Con `max_score = 2970` el margen es pequeño; anti-trampas serio queda para otra spec.                                                         |

---

## Lo que **no** está en esta spec

- Controles táctiles, gamepad y ratón.
- Sonido y música.
- Vidas, power-ups, frutas especiales, obstáculos, otros tableros y muros mortales.
- Los estilos ilustrado y fotográfico de `fruits.png`, y sprites para la serpiente.
- Optimizar el peso de `fruits.png`.
- Pausa automática al perder el foco, `devicePixelRatio` y pantalla completa.
- Anti-trampas, rate limit, Realtime y subida de las puntuaciones de `localStorage`.
- Los otros cuatro juegos simulados.
- Tests automatizados.

Cada uno, si llega, va en su propia spec.
