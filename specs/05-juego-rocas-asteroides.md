# SPEC 05 — Primer juego real: ROCAS (Asteroids)

> **Estado:** Implementado
> **Depende de:** SPEC 01, SPEC 04
> **Fecha:** 2026-10-28
> **Objetivo:** Portar el juego Asteroids de `references/started-games/02-asteroids` a un módulo TypeScript y montarlo en `/jugar/rocas`, con el HUD, la pausa y el modal de fin de partida de la plataforma, en lugar de la simulación actual.

---

## Por qué existe esta spec

Hoy `components/game-player.tsx` no ejecuta ningún juego: suma puntos aleatorios con un `setInterval` y dibuja un escenario de adorno (`.game-arena`). El catálogo (`lib/games.ts`) ya incluye `rocas` (ROCAS), y en `references/started-games/02-asteroids` hay un Asteroids completo en JavaScript plano (`game.js`, 510 líneas, canvas 800×600). Esta spec es la primera que conecta un juego real al reproductor. Fija el patrón (motor TS desacoplado de React, comunicado por callbacks) que reutilizarán Tetris y Arkanoid, que ya están en `references/started-games/`. Los demás juegos del catálogo siguen simulados.

---

## Alcance

**Dentro:**

- Módulo del motor en `lib/games/asteroids/` (`entities.ts` y `engine.ts`) portado de `game.js` a TypeScript, sin cambiar las mecánicas: nave con rotación, empuje e inercia; disparo con enfriamiento; asteroides de tamaño 3, 2 y 1 que se parten; puntos 20, 50 y 100 por tamaño grande, mediano y pequeño; 3 vidas; invencibilidad de 3 s al reaparecer; reaparición a los 2 s; niveles con `3 + nivel` asteroides; power-up de triple disparo (`3x`, 5 s); partículas de explosión; espacio toroidal.
- API pública del motor: `createAsteroids(canvas, callbacks)` que devuelve `{ pause, resume, restart, end, destroy }` (ver Modelo de datos).
- Componente cliente `components/asteroids-canvas.tsx`: crea el motor en un efecto, lo destruye al desmontar y expone `pause`, `resume`, `restart` y `end` al reproductor.
- `components/game-player.tsx`: para `game.id === "rocas"` renderiza el canvas en lugar de `.game-arena`, y el HUD (Puntuación, Vidas, Nivel y, solo con el power-up activo, `3x`) se alimenta de los callbacks del motor. Para el resto de juegos conserva la simulación actual sin cambios.
- Estilo neón del tema: el canvas lee los colores de las variables CSS (`--cyan`, `--yellow`, `--magenta`, `--ink`) y dibuja con brillo (`shadowBlur`). Resolución lógica 800×600; el canvas escala por CSS conservando 4:3 dentro de `.crt-screen`.
- Se elimina del canvas el HUD y el overlay "GAME OVER" originales. El fin de partida abre el modal "FIN DEL JUEGO" existente.
- Controles solo con teclado: `←` `→` rotar, `↑` propulsar, `Espacio` disparar. Se evita el scroll de la página con `preventDefault` mientras la partida está activa.
- `PAUSA` / `REANUDAR`, `FIN` y `JUGAR DE NUEVO` del reproductor controlan el motor.
- `saveScore` sin cambios (`localStorage`, clave `av_scores`, `game: "rocas"`).
- Corregir el texto `long` de `rocas` en `lib/games.ts`: quitar los OVNIs (el juego no los tiene) y mencionar el power-up de triple disparo.
- Reglas CSS nuevas, al final de `app/globals.css`, para el canvas (`.asteroids-canvas`), sin tocar reglas existentes.

**Fuera de alcance (para futuras specs):**

- Guardar puntuaciones en Supabase y alimentar el Salón de la Fama o `best` del catálogo con datos reales.
- Controles táctiles o gamepad.
- Sonido y música.
- OVNIs, hiperespacio, vidas extra y cualquier mecánica nueva que no esté en `game.js`.
- Tetris (`03-tetris`) y Arkanoid (`04-arkanoid`).
- Pausar con `Esc` o `P`, pausa automática al perder el foco de la pestaña y ajuste a `devicePixelRatio`.
- Pantalla completa.
- Tests automatizados (no hay runner configurado).

---

## Modelo de datos

```ts
// lib/games/asteroids/engine.ts
export interface AsteroidsCallbacks {
  onScore: (score: number) => void; // solo cuando cambia
  onLives: (lives: number) => void; // solo cuando cambia
  onLevel: (level: number) => void; // solo cuando cambia
  onPowerUp: (secondsLeft: number) => void; // paso de 0.1 s; 0 = inactivo
  onGameOver: (finalScore: number) => void; // 0 vidas o llamada a end()
}

export interface AsteroidsEngine {
  pause: () => void;
  resume: () => void;
  restart: () => void; // reinicia la partida y vuelve a emitir score 0, lives 3, level 1
  end: () => void; // termina la partida en curso y llama a onGameOver
  destroy: () => void; // cancela el bucle y quita los listeners
}

export function createAsteroids(
  canvas: HTMLCanvasElement,
  callbacks: AsteroidsCallbacks,
): AsteroidsEngine;
```

```ts
// lib/games/asteroids/entities.ts
// Bullet, Asteroid, PowerUp, Ship, Particle: mismas clases que game.js.
// update(dt) igual; draw(ctx, palette) recibe el contexto y la paleta en lugar de usar globales.
export interface Palette {
  ship: string; // --cyan
  rock: string; // --yellow
  bullet: string; // --ink
  powerUp: string; // --magenta
  spark: string; // --yellow
}
```

Convenciones:

- Constantes de `game.js` conservadas tal cual: `W = 800`, `H = 600`, `RADII = [0, 16, 30, 50]`, `SPEEDS = [0, 85, 55, 32]`, `POINTS = [0, 100, 50, 20]` (indexados por tamaño 1, 2, 3), `POWERUP_DROP_CHANCE = 0.15`, `POWERUP_DURATION = 5`, `POWERUP_TTL = 12`, `TRIPLE_SPREAD = 0.18`, `dt` máximo 0.05 s.
- El motor no usa estado global de módulo: todo el estado vive dentro de la clausura de `createAsteroids`, así que se pueden crear y destruir instancias sin residuos.
- La paleta se lee una vez al crear el motor con `getComputedStyle(document.documentElement)`.
- Los listeners de teclado van en `window` y se quitan en `destroy`. Con la partida terminada (`end` o 0 vidas) el motor deja de llamar a `preventDefault` y de reaccionar, para no interferir con el campo de iniciales del modal.
- El `Espacio` y las flechas se ignoran si el foco está en un `input` o `textarea`.
- `GamePlayer` ya no calcula el nivel a partir de la puntuación para `rocas`: usa el valor de `onLevel`. Las vidas del HUD salen de `onLives`.
- Textos de la UI en español, en el estilo de las specs anteriores.

---

## Plan de implementación

Antes de empezar, leer en `node_modules/next/dist/docs/` la guía de componentes cliente (`"use client"`) y de Cache Components, como exige `AGENTS.md`, y leer `components/game-player.tsx`, `app/jugar/[id]/page.tsx` y las reglas `.crt`, `.crt-screen`, `.game-arena` y `.hud-stat` de `app/globals.css`. Invocar `/frontend-design` para el acabado visual del canvas, como indica `CLAUDE.md`.

1. Crear `lib/games/asteroids/entities.ts` con las constantes, utilidades (`wrap`, `dist`, `rand`, `randInt`) y las cinco clases portadas, con `draw(ctx, palette)`. Verificación: `npm run lint` y `npm run build` pasan.
2. Crear `lib/games/asteroids/engine.ts` con `createAsteroids`: estado en clausura, entrada de teclado, bucle `requestAnimationFrame` con `dt` acotado, colisiones, niveles, power-up, `pause`, `resume`, `restart`, `end` y `destroy`, y las llamadas a los callbacks solo cuando el valor cambia. Sin HUD ni overlay en el canvas. Verificación: compila; `npm run lint` pasa.
3. Crear `components/asteroids-canvas.tsx` (`"use client"`): `<canvas width={800} height={600} className="asteroids-canvas">`, efecto que crea el motor y lo destruye al desmontar, y manejador (`ref`) con `pause`, `resume`, `restart` y `end`. Añadir `.asteroids-canvas` al final de `app/globals.css` (ancho 100 %, `aspect-ratio: 4 / 3`, `display: block`). Verificación: compila.
4. Integrar en `components/game-player.tsx`: si `game.id === "rocas"`, mostrar `AsteroidsCanvas` en `.crt-screen` en lugar de `.game-arena`, desactivar el `setInterval` simulado, alimentar `score`, `lives` y `level` del HUD desde los callbacks y mostrar el stat `3x` solo con power-up activo. Cablear `PAUSA`/`REANUDAR` a `pause`/`resume`, `FIN` a `end`, `onGameOver` a `setOver(true)` y `JUGAR DE NUEVO` a `restart` (más el reinicio del estado de React ya existente). Verificación: `/jugar/rocas` muestra el juego y `/jugar/caida` sigue mostrando la simulación.
5. Corregir `long` de `rocas` en `lib/games.ts`. Verificación: el texto en `/juegos/rocas` ya no menciona OVNIs y menciona el triple disparo.
6. Ajuste visual del neón (brillo, grosor de línea, colores) y revisión a 1280 px y 390 px. Verificación: capturas de `/jugar/rocas` en ambos anchos (en `.playwright-screenshots/`) y sin scroll horizontal.

---

## Criterios de aceptación

- [ ] `npm run lint` y `npm run build` terminan sin errores ni warnings de Cache Components o hidratación.
- [ ] `/jugar/rocas` muestra un `<canvas>` con la nave en el centro y 4 asteroides, y no muestra `.game-arena`.
- [ ] `/jugar/caida` (y los demás juegos distintos de `rocas`) se comporta exactamente como antes, con puntuación simulada y `.game-arena`.
- [ ] `←` y `→` rotan la nave, `↑` la propulsa y `Espacio` dispara; la página no hace scroll al pulsarlas.
- [ ] Destruir un asteroide grande suma 20, uno mediano 50 y uno pequeño 100, y se refleja en el HUD de la plataforma.
- [ ] Un asteroide grande destruido se parte en 2 medianos, un mediano en 2 pequeños y un pequeño no se parte.
- [ ] El HUD muestra `♥ ♥ ♥` al empezar y pierde un corazón tras chocar con un asteroide; la nave reaparece a los ~2 s y parpadea sin morir durante 3 s.
- [ ] Al destruir todos los asteroides el nivel del HUD pasa a `02` y aparecen 5 asteroides nuevos (`3 + nivel`).
- [ ] Al recoger el power-up, el HUD muestra `3x` con la cuenta atrás de 5 s, la nave dispara 3 balas en abanico y al llegar a 0 el stat desaparece.
- [ ] Al perder la tercera vida se abre el modal "FIN DEL JUEGO" con la puntuación final y no se dibuja ningún "GAME OVER" en el canvas.
- [ ] `FIN` durante la partida abre el mismo modal con la puntuación actual y detiene el juego.
- [ ] `PAUSA` congela nave, asteroides y balas y muestra "EN PAUSA"; `REANUDAR` continúa sin saltos bruscos.
- [ ] Tras pulsar `PAUSA` y `REANUDAR` con el ratón, pulsar `Espacio` dispara y no vuelve a pulsar el botón.
- [ ] "JUGAR DE NUEVO" empieza una partida con puntuación 0, 3 vidas, nivel `01` y asteroides nuevos, sin duplicar el bucle (la velocidad del juego no cambia tras reiniciar varias veces).
- [ ] En el modal, escribir las iniciales en el campo (incluida la barra espaciadora) funciona y no mueve ni dispara la nave.
- [ ] "GUARDAR PUNTUACIÓN" escribe en `localStorage["av_scores"]` una entrada con `game: "rocas"`, la puntuación final y el nombre indicado.
- [ ] Al pulsar `SALIR` o navegar a otra ruta se cancela el bucle y se quitan los listeners: `Espacio` y las flechas vuelven a hacer scroll normal y no hay errores en consola.
- [ ] Con React StrictMode en desarrollo hay un único bucle activo (una sola nave, velocidad normal).
- [ ] Los colores del canvas salen de las variables del tema (nave cian, asteroides amarillos, power-up magenta) y las líneas tienen brillo.
- [ ] El canvas conserva la proporción 4:3 a 1280 px y a 390 px, y a 390 px `/jugar/rocas` no tiene scroll horizontal.
- [ ] La descripción de ROCAS en `/juegos/rocas` no menciona OVNIs y menciona el triple disparo.
- [ ] La consola del navegador no muestra errores ni warnings en `/jugar/rocas` durante una partida completa.
- [ ] Las demás pantallas (Home, Acerca de, Biblioteca, detalle, Salón, acceso) se ven y funcionan igual que antes.

---

## Decisiones

- **Sí:** portar `game.js` a un módulo TypeScript con una API de callbacks. Desacopla el motor de React, permite que el HUD sea el de la plataforma y sirve de patrón para Tetris y Arkanoid.
- **No:** iframe con el HTML original en `public/`. Es rápido, pero el HUD, la pausa y las puntuaciones solo se conectan con `postMessage` y el marco CRT queda fuera.
- **No:** reescribir el juego con estado de React y un bucle propio. Más trabajo y riesgo de rendimiento sin ningún beneficio frente al módulo TS.
- **Sí:** el HUD de la plataforma es el único. Es coherente con los demás juegos y evita información duplicada. Se quita el HUD dibujado en el canvas.
- **Sí:** el indicador del power-up (`3x`) pasa al HUD de la plataforma como stat condicional, porque el HUD del canvas desaparece.
- **Sí:** estilo neón del tema, solo cambia el dibujo y no las mecánicas. Encaja con el resto de la plataforma; el blanco original desentonaría dentro del CRT.
- **Sí:** el color amarillo para los asteroides, por ser el color de ROCAS en el catálogo (`color: "yellow"`).
- **Sí:** el fin de partida usa el modal "FIN DEL JUEGO" existente y se elimina el overlay "GAME OVER" y el reinicio con `Espacio`. Dos pantallas de fin competirían entre sí; el modal ya ofrece guardar y reiniciar.
- **Sí:** las puntuaciones siguen en `localStorage` mediante `saveScore`. Mover las puntuaciones a Supabase es otra spec (ya decidido en la SPEC 04).
- **Sí:** el motor emite callbacks solo cuando el valor cambia (y el power-up a pasos de 0.1 s). Evita renderizar React a 60 fps.
- **Sí:** el motor no usa estado global de módulo y se limpia en `destroy`. Necesario para StrictMode y para navegar entre juegos sin residuos.
- **Sí:** solo teclado en esta spec. Es lo que tiene el juego original; los controles táctiles merecen su propio diseño.
- **Sí:** se conservan todas las constantes y mecánicas de `game.js`, incluido el power-up de triple disparo que el README original no menciona pero el código sí implementa.
- **Sí:** corregir el texto `long` de `rocas`. Prometía OVNIs que el juego no tiene.
- **Sí:** los demás juegos conservan la simulación. Cada uno tendrá su propia spec cuando se porte.
- **Sí:** los textos de la UI siguen en español, en el estilo de las specs anteriores.

---

## Riesgos

| Riesgo                                                                           | Mitigación                                                                                                                                                |
| -------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------- |
| StrictMode monta el efecto dos veces y deja dos bucles o dos juegos de listeners | `destroy` cancela `requestAnimationFrame` y quita los listeners; el motor no tiene estado global. Un criterio verifica un único bucle.                    |
| Tras pulsar `PAUSA` con el ratón, `Espacio` vuelve a activar el botón enfocado   | Se llama a `preventDefault` en `Espacio` mientras la partida está activa, y un criterio lo comprueba. Si no basta, quitar el foco del botón tras el clic. |
| Las flechas y `Espacio` hacen scroll en la página                                | `preventDefault` solo mientras la partida está activa y el foco no está en un campo de texto.                                                             |
| El motor atrapa `Espacio` y rompe el campo de iniciales del modal                | Con la partida terminada el motor ignora las teclas y no llama a `preventDefault`. Un criterio lo comprueba.                                              |
| Re-renders de React a 60 fps por los callbacks                                   | Los callbacks se emiten solo al cambiar el valor y el power-up en pasos de 0.1 s.                                                                         |
| `dt` grande al reanudar tras pausa o cambio de pestaña                           | `dt` acotado a 0.05 s y `lastTime` se reinicia en `resume`.                                                                                               |
| `shadowBlur` penaliza el rendimiento en equipos modestos                         | Se aplica con moderación (nave, asteroides, balas) y se ajusta en el paso 6. Si hace falta, se reduce el brillo sin tocar las mecánicas.                  |
| El canvas queda pequeño y sin controles táctiles en móvil                        | Aceptado en esta spec: solo se garantiza que no haya scroll horizontal. Los controles táctiles quedan para otra spec.                                     |
| Leer las variables CSS falla si el tema cambia                                   | Se leen una sola vez al crear el motor, con valores por defecto iguales a los del tema.                                                                   |

---

## Lo que **no** está en esta spec

- Guardar o leer puntuaciones en Supabase, Salón de la Fama y `best` del catálogo con datos reales.
- Controles táctiles o gamepad.
- Sonido y música.
- OVNIs, hiperespacio, vidas extra y mecánicas nuevas.
- Tetris y Arkanoid.
- Pausa con `Esc`/`P`, pausa automática al perder el foco, ajuste a `devicePixelRatio` y pantalla completa.
- Tests automatizados.

Cada uno, si llega, va en su propia spec.
