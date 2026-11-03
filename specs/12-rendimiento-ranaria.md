# SPEC 12 — Rendimiento de RANARIA: dibujo cacheado, bucle de paso fijo y HUD sin re-renders

> **Estado:** Implementado
> **Depende de:** SPEC 05, SPEC 11
> **Fecha:** 2026-11-03
> **Objetivo:** Eliminar los tirones de RANARIA en escritorio, móvil y pantallas de alta frecuencia sin cambiar su aspecto ni sus mecánicas. Para ello se cachea su dibujo en canvas fuera de pantalla, se quita el `mix-blend-mode` de las scanlines del CRT en los juegos con motor, se pasa su bucle a paso fijo y el HUD de `GamePlayer` se actualiza por `useRef` en vez de con re-renders de React.

---

## Por qué existe esta spec

RANARIA va a tirones (fps bajos) en todos los dispositivos y con los tres skins. Revisando `lib/games/ranaria/` y el reproductor aparecen cinco costes por frame:

1. **`shadowBlur` por entidad y por frame.** Coches, camiones, troncos, tortugas y bocas llevan glow de 10 px, y la rana de 18 px (`glow()` en `entities.ts`). Con NEÓN (`glow: 1`) son unas 35 sombras difuminadas a 60 fps. Es la operación más cara de Canvas 2D.
2. **El tablero estático se redibuja entero cada frame** (`drawBoard`): zonas, ondas del río, líneas de carril, setos y bocas, también con glow.
3. **Las scanlines de `.crt-screen::after` usan `mix-blend-mode: multiply`** encima de un canvas que cambia 60 veces por segundo. El navegador recompone la mezcla en cada frame. Esto pasa con cualquier skin, también con CLÁSICO (`glow: 0`), que también va a tirones.
4. **Scanlines y viñeta del skin RETRO** se pintan cada frame: 187 `fillRect` y un degradado radial a pantalla completa.
5. **El bucle usa un `dt` variable acotado a `MAX_DT = 0.05`.** Por debajo de 20 fps el juego va a cámara lenta, y a 120/144 Hz cada frame avanza un paso distinto.
6. **`GamePlayer` se re-renderiza entero con cada valor del HUD.** `onScore` y `onStats` llaman a `setScore` y `setStats`. `TIEMPO` cambia cada 0,1 s, así que React reconcilia todo el reproductor (HUD, CRT, panel de pausa y mando táctil) 10 veces por segundo, y una vez más por cada punto. Ese trabajo cae en el mismo hilo que el bucle del juego.

Como CLÁSICO también va mal, el glow no explica todo. Por eso el primer paso es **medir** (línea base) y el último compara con ella. El resto de motores comparte parte del problema, pero queda fuera por decisión del autor.

**Principio de React en esta spec (requisito del autor):** usar el mínimo de `useState` posible. Un valor que cambia durante la partida a más de una vez por segundo vive en un `useRef` y se escribe directamente en el DOM. `useState` queda solo para lo que cambia la estructura de la página (pausa, fin, guardado, skin) o cambia unas pocas veces por partida (vidas, nivel). Esto se aplica a `components/game-player.tsx` y `components/game-canvas.tsx`, que comparten los cinco juegos. Para el usuario el HUD se ve y se comporta igual.

---

## Alcance

**Dentro:**

- **Medición reproducible** con Playwright (MCP), sin código nuevo en la app:
  - intervalos entre `requestAnimationFrame` durante 10 s de partida en `/jugar/ranaria`;
  - sin throttling y con CPU ×4 (CDP `Emulation.setCPUThrottlingRate`);
  - con los tres skins;
  - antes y después de los cambios.
  - Resultados en la sección «Mediciones» de esta spec.
- **Caché de sprites** en un módulo nuevo, `lib/games/ranaria/sprites.ts`. Cada forma (coche por variante y sentido, camión por ancho y sentido, tronco por ancho, tortugas a flote o sumergidas por tamaño, rana por orientación y salto) se pinta una sola vez con su glow en un `<canvas>` fuera de pantalla. En cada frame se copia con `drawImage`.
- **Fondo cacheado:** el tablero (zonas, ondas, líneas, setos, bocas y ranas en bocas ocupadas) se pinta en un canvas fuera de pantalla. Solo se rehace al cambiar el skin o al cambiar `goals`.
- **Capa de efectos cacheada:** scanlines y viñeta del skin se pintan una vez en un canvas fuera de pantalla (`null` si el skin no tiene efectos). Cada frame se aplican con un solo `drawImage`.
- **`setSkin`** vacía la caché de sprites y rehace fondo y capa de efectos con la nueva paleta.
- **Bucle de paso fijo** en `lib/games/ranaria/engine.ts`: acumulador con `STEP = 1/240` s y como máximo `MAX_FRAME = 0.1` s de simulación por frame. Se emite y se dibuja una vez por `requestAnimationFrame`. Desaparece `MAX_DT`.
- **CSS del CRT** en `app/globals.css`: en los juegos con motor (`.crt-fit .crt-screen::after`) las scanlines pasan a negro semitransparente sin `mix-blend-mode`. Los juegos simulados no cambian.
- **HUD sin re-renders** en `components/game-player.tsx`:
  - `score` y `stats` dejan de ser `useState`;
  - Puntuación y el valor y el color de cada stat se guardan en refs y se escriben en el DOM (`textContent`, `style.color`) desde `onScore` y `onStats`;
  - solo hay re-render cuando cambia el **conjunto** de stats (claves o etiquetas), algo que ocurre al empezar la partida, no cuando cambian sus valores;
  - la puntuación final del modal se fija una vez al terminar (`finalScore`, en el mismo render que `over`);
  - la simulación de los juegos sin motor (intervalo de 220 ms) también escribe por ref, puntuación y nivel incluidos.
- **`useState` mínimo** en `GamePlayer`: se quedan los estados de estructura (`paused`, `over`, `saved`, `saving`, `saveFailed`, `authLost`, `typedName`, `skin`), los de baja frecuencia (`lives`, `engineLevel`) y los nuevos `finalScore` y `statLayout`. Se revisa también `components/game-canvas.tsx`: no añade estados y mantiene los callbacks en refs como ahora.
- **Aspecto idéntico:** capturas antes/después de cada skin en el mismo estado inicial. Solo se aceptan diferencias de subpíxel por redondear la posición de dibujo a píxeles enteros.

**Fuera de alcance (para futuras specs):**

- Optimizar los motores de ROCAS, CAÍDA, BLOQUE BUSTER y SERPENTINA. Comparten el `shadowBlur` por frame. Si se hace, irá en otra spec que reutilice las técnicas de esta. Sí se benefician del HUD sin re-renders, porque `GamePlayer` es común.
- Pasar `lives` y `engineLevel` a refs. Cambian unas pocas veces por partida y el selector de nivel de la pausa depende de `engineLevel`.
- `React.memo`, contextos o una librería de estado externa para el HUD.
- Modo de calidad baja automático según los fps.
- Contador de FPS en la app.
- `devicePixelRatio` y nitidez en pantallas retina.
- Cambios de mecánicas, velocidades, puntuación o paletas.

---

## Modelo de datos

No hay datos persistentes nuevos, ni cambios en Supabase ni en `localStorage`. Solo aparecen estructuras en memoria del motor y del reproductor.

```ts
// lib/games/ranaria/sprites.ts
interface Sprite {
  canvas: HTMLCanvasElement; // forma ya pintada, glow incluido
  ox: number; // px entre el borde del sprite y el origen lógico (margen del glow)
  oy: number;
}

// Clave por forma, p. ej. "car:0:1", "truck:3:-1", "log:4",
// "turtle:2:up", "turtle:3:down", "frog:left:jump", "frog:up:rest".
type SpriteCache = Map<string, Sprite>;

interface SpriteSet {
  get(key: string, palette: Palette): Sprite; // crea al primer uso, después reutiliza
  clear(): void; // al cambiar de skin
}
```

```ts
// lib/games/ranaria/engine.ts (estado nuevo)
const STEP = 1 / 240; // s de simulación por paso
const MAX_FRAME = 0.1; // s máximos simulados por frame (más = cámara lenta)
let acc: number; // tiempo pendiente de simular
let board: HTMLCanvasElement; // fondo cacheado
let boardDirty: boolean; // true al cambiar `goals` o el skin
let effects: HTMLCanvasElement | null; // scanlines + viñeta; null sin efectos
```

```ts
// components/game-player.tsx (refs y estados nuevos)
const scoreRef = useRef(0); // puntuación vigente (guardar, fin, simulación)
const scoreElRef = useRef<HTMLDivElement>(null); // .v de Puntuación
const levelElRef = useRef<HTMLDivElement>(null); // .v de Nivel (solo simulados)
const statsRef = useRef<HudStat[]>([]); // últimos stats recibidos
const statElsRef = useRef(new Map<string, HTMLDivElement>()); // .v por stat.key

// Re-render solo si cambia este layout (firma "key|label;…").
const [statLayout, setStatLayout] = useState<{ key: string; label: string }[]>(
  [],
);
const [finalScore, setFinalScore] = useState(0); // se fija al terminar
```

Convenciones:

- Los sprites usan las mismas funciones de dibujo actuales de `entities.ts` (`drawCar`, `drawTruck`, `drawLog`, `drawTurtles`, `drawFrogShape`). Se pintan en el canvas fuera de pantalla con un desplazamiento de `pad` px por lado, siendo `pad = ceil(2 × shadowBlur)` del glow aplicado.
- Posición de dibujo en cada frame: `Math.round(x) - ox`, `Math.round(y) - oy`.
- Los canvas fuera de pantalla son `document.createElement("canvas")`, no `OffscreenCanvas`.
- Los `.v` que se escriben por ref no tienen hijos en el JSX. Así React nunca pisa el texto escrito a mano. El valor inicial lo escribe un ref callback al montar el nodo, a partir de `scoreRef`/`statsRef`. Durante el render no se lee ningún `ref.current`, que es lo que exige la regla `react-hooks` del lint.
- Formato igual que ahora: Puntuación con `toLocaleString("es-ES")`, nivel con `padStart(2, "0")`, color del stat como `var(--<color>)`.

---

## Plan de implementación

1. **Línea base.** Con el dev server y Playwright, medir `/jugar/ranaria` antes de tocar nada:
   - cada skin, sin throttling y con CPU ×4;
   - 10 s de intervalos entre `requestAnimationFrame` con la partida en marcha;
   - calcular fps medio, p95 en ms y número de frames > 50 ms.

   Grabar también una traza de rendimiento (CDP `Tracing` o `Profiler`) con NEÓN y CPU ×4, y anotar qué consume más tiempo por frame. Guardar `.playwright-screenshots/perf/antes-<skin>.png`: la partida recién empezada, en pausa al primer frame. Rellenar la fila «Antes» de «Mediciones».

2. **CSS del CRT.** Añadir en `app/globals.css` la regla `.crt-fit .crt-screen::after` con `mix-blend-mode: normal` y el mismo `repeating-linear-gradient`. Comprobar que `/jugar/gloton` (simulado) mantiene el `multiply`. Medir NEÓN con CPU ×4 y anotarlo como resultado intermedio.
3. **Bucle de paso fijo.** En `engine.ts`, sustituir `MAX_DT` por el acumulador:
   - `acc += min(elapsed, MAX_FRAME)`;
   - `while (acc >= STEP) { update(STEP); acc -= STEP; }`;
   - después, `emit()` y `draw()` una vez.

   Si `update` termina la partida (`finished`), sale del bucle. `startLoop` pone `acc = 0` y `lastTime = null`. Comprobar a ojo que velocidades, salto de 120 ms, temporizador y tortugas no cambian.

4. **Fondo y efectos cacheados.** En `engine.ts`:
   - pintar `drawBoard` en `board` cuando `boardDirty` sea true;
   - marcarlo al ocupar una boca, al completar ronda, en `init` y en `applyPalette`;
   - pintar scanlines y viñeta en `effects` dentro de `applyPalette`;
   - `draw()` pasa a `drawImage(board)` → carriles → rana → `drawImage(effects)`.
5. **Caché de sprites.** Crear `lib/games/ranaria/sprites.ts` con `SpriteSet` y exportar desde `entities.ts` las funciones de forma que necesita. `drawLane` y `drawFrog` reciben el `SpriteSet` y dibujan con `drawImage` en vez de rutas y `shadowBlur`. `applyPalette` llama a `clear()`.
6. **Puntuación por ref.** En `game-player.tsx`:
   - sustituir `score`/`setScore` por `scoreRef` + `scoreElRef`, con una función `writeScore(v)` que pasa a `onScore`;
   - la simulación de los juegos sin motor llama a `writeScore` y escribe el nivel en `levelElRef`;
   - `handleGameOver` y `finish` (simulados) fijan `finalScore`, y el modal lo muestra;
   - `restart` y `save` usan `scoreRef.current`.

   Comprobar en RANARIA y en `/jugar/gloton` que la puntuación sube, que el modal muestra la final y que guardar envía ese valor.

7. **Stats por ref.** Sustituir `stats`/`setStats` por `statsRef`, `statElsRef` y `statLayout`. `onStats` escribe valores y colores en los nodos del `Map` y solo llama a `setStatLayout` si cambia la firma de claves y etiquetas. Comprobar `TIEMPO` y `BOCAS` en RANARIA, y los stats de los otros cuatro juegos.
8. **Medición final.** Repetir las mediciones del paso 1 con los tres skins, sin throttling y con CPU ×4, y rellenar la fila «Después». Guardar `.playwright-screenshots/perf/despues-<skin>.png` en el mismo estado del paso 1 y compararlas con las de «antes».

---

## Criterios de aceptación

- [ ] `npm run lint` y `npm run build` terminan sin errores.
- [ ] La sección «Mediciones» tiene las filas «Antes» y «Después» completas para los tres skins, sin throttling y con CPU ×4.
- [ ] Sin throttling, con cada skin, el p95 del intervalo entre frames es ≤ 18 ms y no hay frames > 50 ms en 10 s.
- [ ] Con CPU ×4, con cada skin, el p95 es ≤ 34 ms y es menor que el p95 «Antes» del mismo skin.
- [ ] Las capturas `despues-<skin>.png` coinciden con `antes-<skin>.png` a simple vista (colores, glow, formas, scanlines, viñeta) para CLÁSICO, NEÓN y RETRO.
- [ ] En `lib/games/ranaria/`, `shadowBlur` solo se asigna en código que pinta sprites o el fondo cacheado, nunca en el camino de `draw()` de cada frame.
- [ ] Cambiar de skin en la pausa se ve al instante con la nueva paleta y no reinicia la partida.
- [ ] Ocupar una boca muestra la silueta de la rana en ella. Completar la ronda vacía las 5 bocas.
- [ ] Con CPU ×4 y 120 Hz emulados, un tronco del carril 1 tarda lo mismo en cruzar la pantalla que sin throttling a 60 Hz, con una diferencia ≤ 5 %.
- [ ] Mecánicas sin cambios: salto de 120 ms, temporizador de 15 s en el nivel 1, ciclo de tortugas 3 s / 1,5 s, muertes y puntuación como en la SPEC 11.
- [ ] Pausa, reanudar, `FIN`, reinicio y mando táctil funcionan igual que antes.
- [ ] `/jugar/gloton` conserva `mix-blend-mode: multiply` en `.crt-screen::after`. En los juegos con motor el valor calculado es `normal`.
- [ ] ROCAS, CAÍDA, BLOQUE BUSTER y SERPENTINA se ven y se juegan igual que antes.
- [ ] Ningún archivo de `lib/games/` fuera de `ranaria/` cambia.
- [ ] `components/game-player.tsx` no tiene `useState` para `score` ni para `stats`. `onScore` no llama a ningún setter de React, y `onStats` solo llama a `setStatLayout` cuando cambian claves o etiquetas.
- [ ] Los únicos `useState` de `GamePlayer` son `lives`, `engineLevel`, `statLayout`, `finalScore`, `skin`, `paused`, `over`, `typedName`, `saved`, `saving`, `saveFailed` y `authLost`. `GameCanvas` no añade ninguno.
- [ ] Durante 10 s de partida en RANARIA sin morir ni ocupar bocas, `GamePlayer` no se re-renderiza. Se comprueba con un `MutationObserver` en `.player-hud`: solo cambian los nodos de texto de los `.v`, nunca se añaden ni quitan elementos.
- [ ] En los cinco juegos, Puntuación, Nivel y stats del HUD muestran los mismos valores, formatos y colores que antes, también tras `JUGAR DE NUEVO`.
- [ ] El modal de fin muestra la puntuación final, y `GUARDAR PUNTUACIÓN` envía ese mismo valor, con sesión y como invitado.
- [ ] `/jugar/gloton` (simulado) sigue subiendo puntuación y nivel, y su modal muestra la puntuación al pulsar `FIN`.
- [ ] No hay warnings de hidratación en la consola de `/jugar/ranaria` ni de `/jugar/gloton`.

---

## Mediciones

Intervalo entre `requestAnimationFrame` durante 10 s de partida en `/jugar/ranaria` (Playwright, Chromium). Formato: fps medio · p95 ms · frames > 50 ms.

| Momento | Skin    | Sin throttling           | CPU ×4          |
| ------- | ------- | ------------------------ | --------------- |
| Antes   | CLÁSICO | 60,0 · 16,8 · 0          | 60,0 · 16,8 · 0 |
| Antes   | NEÓN    | 60,0 · 16,8 · 0          | 60,0 · 16,8 · 0 |
| Antes   | RETRO   | 60,0 · 16,8 · 0          | 60,0 · 16,8 · 0 |
| Después | CLÁSICO | — (ver «Medición final») | —               |
| Después | NEÓN    | — (ver «Medición final») | —               |
| Después | RETRO   | — (ver «Medición final») | —               |

Entorno «Antes»: Chrome 156 en Windows 11, pantalla de 60 Hz y `npm run dev` (React en modo desarrollo). Con la ventana tapada Chrome limita `requestAnimationFrame` a 1 fps. Por eso cada medición llama antes a `page.bringToFront()`.

En esta máquina la línea base ya llega a 60 fps con CPU ×4, así que el intervalo entre frames no separa el antes del después. Como métrica complementaria se mide la **ocupación del hilo principal**: `TaskDuration` / tiempo transcurrido, de `Performance.getMetrics`, durante 5 s. Formato: fps · p95 ms · % hilo ocupado.

| Momento | Skin    | Sin throttling           | CPU ×4             | CPU ×10             |
| ------- | ------- | ------------------------ | ------------------ | ------------------- |
| Antes   | CLÁSICO | 59,8 · 16,8 · 12 %       | 59,8 · 16,8 · 51 % | 31,6 · 66,8 · 93 %  |
| Antes   | NEÓN    | 59,7 · 16,8 · 10 %       | 59,8 · 16,8 · 56 % | 36,6 · 50,1 · 93 %  |
| Antes   | RETRO   | 59,7 · 16,8 · 11 %       | 59,7 · 16,8 · 55 % | 13,9 · 216,6 · 92 % |
| Después | CLÁSICO | — (ver «Medición final») | —                  | —                   |
| Después | NEÓN    | — (ver «Medición final») | —                  | —                   |
| Después | RETRO   | — (ver «Medición final») | —                  | —                   |

**Medición final (paso 8), en producción y en la misma sesión.** Primero el «antes» (con `git stash` de la implementación, `npm run build && npm start`) y después el «después» (`git stash pop` y nuevo build). Cada medición se hace en un contexto de Playwright nuevo, con la ventana al frente, durante 10 s de partida. Formato: fps · p95 ms · frames > 50 ms · % hilo ocupado.

| Momento | Skin    | Sin throttling           | CPU ×4                   | CPU ×10                   |
| ------- | ------- | ------------------------ | ------------------------ | ------------------------- |
| Antes   | CLÁSICO | 53,8 · 33,3 · 0 · 18 %   | 25,3 · 99,7 · 85 · 44 %  | 14,8 · 116,3 · 106 · 53 % |
| Antes   | NEÓN    | 12,9 · 100,2 · 126 · 6 % | 15,2 · 83,7 · 123 · 29 % | 15,2 · 84,1 · 118 · 48 %  |
| Antes   | RETRO   | 13,1 · 100,1 · 124 · 7 % | 16,3 · 83,4 · 120 · 28 % | 16,0 · 83,5 · 115 · 41 %  |
| Después | CLÁSICO | 25,8 · 50,6 · 43 · 9 %   | 31,4 · 50,0 · 15 · 40 %  | 28,3 · 65,7 · 41 · 56 %   |
| Después | NEÓN    | 27,5 · 50,5 · 34 · 10 %  | 26,4 · 66,7 · 30 · 46 %  | 30,4 · 66,5 · 37 · 53 %   |
| Después | RETRO   | 26,1 · 51,3 · 51 · 10 %  | 32,2 · 50,0 · 16 · 39 %  | 19,6 · 133,3 · 67 · 82 %  |

Lectura:

- **NEÓN y RETRO mejoran claramente:** de unos 13-16 fps a unos 26-32 fps, y los frames de más de 50 ms bajan de unos 120 a 15-51 en 10 s. En «antes» el hilo principal estaba casi libre (6-7 %) a 13 fps: el límite era la GPU rasterizando el `shadowBlur` en cada frame, que es lo que eliminan los sprites (paso 5).
- **CLÁSICO sin throttling sale peor (53,8 → 25,8), y no es atribuible al código.** CLÁSICO no tiene glow, el hilo principal baja del 18 % al 9 % y con CPU ×4 mejora (25,3 → 31,4). Entre tanda y tanda cambió la carga de la GPU de la máquina.
- **El entorno limita en torno a 30 fps.** GPU Intel UHD integrada, compartida con otras ventanas abiertas. En la misma sesión una página vacía da 60 fps, `/jugar/ranaria` unos 30 fps, y `/jugar/gloton`, que no tiene canvas, 25,5 fps. Ocultar el canvas de RANARIA no cambia los fps (29 frente a 30).
- **El coste restante está fuera del motor:** en el fondo global del sitio (`.av-bg` y `.av-noise`, de `app/layout.tsx` y `app/globals.css`). Prueba inyectando CSS solo en el navegador:

  | Variante de `/jugar/ranaria` (NEÓN, sin throttling)      | fps     |
  | -------------------------------------------------------- | ------- |
  | Tal cual                                                 | 26,5-30 |
  | Sin la animación de la rejilla (`.av-bg::before`)        | 30,1    |
  | Sin las scanlines del fondo (`.av-bg::after`, `overlay`) | 33,1    |
  | Sin la rejilla en perspectiva                            | 37,8    |
  | Sin `.av-bg` ni `.av-noise`                              | 49,5    |
  | Sin canvas (`visibility: hidden`)                        | 29,0    |

- **Paso fijo (paso 3), con un reloj virtual que sustituye a `requestAnimationFrame`:** en 2 s virtuales `TIEMPO` baja 2,0 s a 60, 120 y 144 Hz y con frames de 50 ms. Con frames de 200 ms baja 1,0 s, la cámara lenta prevista.
- **HUD (pasos 6 y 7):** 0 commits de React en 10 s de partida, frente a unos 100 antes. Se contaron con un hook de DevTools falso.
- **Capturas** `despues-<skin>.png` frente a `antes-<skin>.png`: diferencia máxima de 3/255 en las zonas estáticas (rana en la salida, metas y mediana) con los tres skins.

**Intermedio, tras el paso 2 (CSS del CRT), NEÓN:**

- El valor calculado de `.crt-screen::after` es `mix-blend-mode: normal` en `/jugar/ranaria` y `/jugar/rocas`, y `multiply` en `/jugar/gloton`.
- Rendimiento **no concluyente**. Hubo que reiniciar el dev server y borrar `.next/dev/cache/turbopack`, porque servía el CSS viejo. Después, tres tandas seguidas dieron resultados cada vez peores sin cambios de código:
  - sin throttling: 59,8 → 57,8 → 24,1 fps;
  - CPU ×4: 41,1 → 44,1 → 11,2 fps.
- En la última tanda el hilo principal solo estaba ocupado un 24 % a 24 fps. El límite no era el JavaScript, sino la GPU o la composición, compartidas con otras ventanas de Chrome abiertas en la máquina.
- Un perfil de esa tanda sigue mostrando React en modo desarrollo como el mayor coste de JavaScript (`jsxDEV`, `prepareFreshStack`, `commitMutationEffectsOnFiber`, en torno al 9 %), con el motor en torno al 0,3 %.

Mayor consumo por frame según la traza del paso 1 (perfil de CPU de 5 s con CPU ×4, tiempo propio):

- **React en modo desarrollo** es el mayor coste de JavaScript, en torno al 15 % del tiempo total: `jsxDEV` ~10 %, `ReactElement`, `GamePlayer`, `prepareFreshStack` y `jsx`. Un `MutationObserver` sobre `.av-player` registra unos 10 commits por segundo, todos en los `.v` del HUD (`TIEMPO`). Lo atacan los pasos 6 y 7.
- **Dibujo del motor** en torno al 4 %: `loop`, `glow`, `drawLog`, `drawTurtles`, `fill`, `stroke`, `roundRect`. En RETRO suma `fillRect`, de las scanlines del canvas, que es el skin que más cae con CPU ×10. Lo atacan los pasos 4 y 5.
- `(program)`, del 17 al 21 %, es trabajo nativo del navegador: composición, raster del canvas y GC. El `shadowBlur` del glow lo rasteriza la GPU, así que el throttling de CPU no lo refleja. CLÁSICO (sin glow) y NEÓN cuestan casi lo mismo en CPU.

---

## Decisiones

- **Sí:** solo RANARIA. Es donde el autor ve el problema. Los otros motores irán en otra spec si hace falta.
- **Sí:** medir antes de optimizar. CLÁSICO no tiene glow y también va a tirones, así que la causa no es una sola.
- **Sí:** sprites cacheados con el glow pintado dentro. Mantienen el aspecto idéntico, que es requisito del autor. Copiar un bitmap cuesta mucho menos que difuminar una sombra en cada frame.
- **No:** bajar o quitar el glow. Cambia el look y el autor lo descartó.
- **No:** modo de calidad baja automático. Es más complejo y queda fuera de alcance.
- **Sí:** scanlines con negro semitransparente sin `mix-blend-mode` en `.crt-fit`. Sobre negro con alfa `a`, `multiply` y `normal` dan el mismo resultado, `destino × (1 − a)`. Así no cambia nada visible y el navegador deja de recomponer la mezcla.
- **No:** quitar el blend solo en RANARIA. Añadiría una excepción por juego en el reproductor, y el cambio es imperceptible en los cinco.
- **Sí:** paso fijo de 1/240 s. A 60, 120 y 144 Hz el error por frame es menor de 0,4 px, sin necesidad de interpolar.
- **No:** paso de 1/120 s. A 144 Hz algunos frames no avanzarían ningún paso, y eso es justo un tirón.
- **Sí:** tope de 0,1 s simulados por frame. Por debajo de 10 fps el juego va a cámara lenta en vez de teletransportar la rana o los vehículos. La pausa automática al ocultar la pestaña ya evita los saltos largos.
- **Sí:** canvas fuera de pantalla con `document.createElement("canvas")`. Funciona en todos los navegadores que soporta la plataforma, Safari incluido.
- **No:** `OffscreenCanvas` ni un worker. Es más complejo y no hace falta para este volumen.
- **Sí:** redondear la posición de dibujo a píxeles enteros. `drawImage` en subpíxel obliga a filtrar el bitmap y la diferencia visual es nula.
- **No:** contador de FPS en la app. La medición con Playwright basta y no añade código al producto.
- **Sí:** mínimo de `useState` y `useRef` para lo que cambia a alta frecuencia, por requisito del autor. Puntuación y stats se escriben en el DOM por ref, y `GamePlayer` deja de re-renderizarse 10 veces por segundo por `TIEMPO`.
- **Sí:** el cambio va en `GamePlayer`, común a los cinco juegos. Es el único sitio donde se reciben los callbacks, y una excepción solo para RANARIA sería peor. Los criterios verifican que el HUD de los cinco no cambia.
- **Sí:** `.v` sin hijos en el JSX y valor inicial escrito por ref callback. Si hubiera `{valor}` en el JSX, cualquier re-render por otra causa (pausa) podría pisar lo escrito a mano. Además, leer `ref.current` en el render lo marca el lint.
- **Sí:** `statLayout` en estado. Que aparezca o desaparezca un stat cambia la estructura del HUD y necesita un render. Ocurre al empezar la partida, no por frame.
- **Sí:** `lives` y `engineLevel` siguen en estado. Cambian unas pocas veces por partida, y `engineLevel` marca el nivel actual en el selector de la pausa.
- **No:** `React.memo` del HUD o del CRT. Reduce el coste de cada render pero no evita el render de `GamePlayer`. Los refs sí lo evitan.
- **No:** contexto o store externo (`useSyncExternalStore`) para el HUD. Es más código para el mismo resultado que los refs.

---

## Riesgos

| Riesgo                                                                                                                     | Mitigación                                                                                                                                    |
| -------------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------- |
| La traza muestra que el coste principal está fuera del motor (HUD de React, composición del CRT) y no se llega al objetivo | El paso 2 ya cubre la composición. Lo demás se anota en «Mediciones» y se propone otra spec. No se amplía el alcance sobre la marcha.         |
| El glow del sprite se recorta en el borde del canvas fuera de pantalla                                                     | `pad = ceil(2 × shadowBlur)` por lado. Las capturas antes/después lo comprueban.                                                              |
| Los intervalos de `requestAnimationFrame` en Playwright no reflejan un móvil real                                          | CPU ×4 aproxima un móvil de gama media. Las mediciones son comparativas (antes/después), no absolutas.                                        |
| La rana en una boca ocupada sale distinta al venir del fondo cacheado                                                      | Se usa la misma `drawFrogShape` y se rehace el fondo al cambiar `goals`. El criterio de bocas lo verifica.                                    |
| Con el paso fijo cambia la sensación de las velocidades                                                                    | Las velocidades siguen en celdas/s. Un criterio compara el tiempo de cruce de un tronco.                                                      |
| Escribir en el DOM por ref desincroniza el HUD (valor viejo tras reiniciar, o tras un re-render por pausa)                 | Los `.v` no tienen hijos en el JSX y los motores reemiten todo al `restart`. El criterio de `JUGAR DE NUEVO` lo verifica en los cinco juegos. |
| El cambio en `GamePlayer` rompe otro juego                                                                                 | Se prueban los cinco y `/jugar/gloton`. El contrato `GameCallbacks` no cambia.                                                                |
| Un stat nuevo aparece sin valor hasta el siguiente `onStats`                                                               | El ref callback del nodo escribe el último valor de `statsRef` al montarlo.                                                                   |

---

## Lo que **no** está en esta spec

- Optimizar los motores de ROCAS, CAÍDA, BLOQUE BUSTER y SERPENTINA.
- Pasar `lives` y `engineLevel` a refs, `React.memo` del HUD o un store externo.
- Modo de calidad baja automático y contador de FPS.
- `devicePixelRatio` y nitidez retina.
- Cambios de mecánicas, velocidades, puntuación o paletas.
- Tests automatizados de rendimiento.

Cada uno, si llega, va en su propia spec.
