# SPEC 10 — Controles táctiles: jugar en el móvil

> **Estado:** Aprobado
> **Depende de:** SPEC 05, SPEC 07, SPEC 08, SPEC 09
> **Fecha:** 2026-11-03
> **Objetivo:** Añadir un mando virtual en pantalla, visible solo en dispositivos táctiles, que despacha las mismas teclas que ya entienden los motores para que ROCAS, CAÍDA, BLOQUE BUSTER y SERPENTINA se puedan jugar en un móvil, en vertical y en horizontal.

---

## Por qué existe esta spec

Los cuatro motores (`lib/games/*/engine.ts`) solo escuchan `keydown`/`keyup` en `window` y leen `e.code`. En un móvil no hay teclado, así que hoy los juegos se ven pero no se pueden jugar. Las SPEC 05, 07, 08 y 09 dejaron el táctil fuera de alcance de forma explícita.

La decisión central es **no tocar los motores**. El mando despacha `KeyboardEvent` sintéticos con el mismo `code` que el teclado (`ArrowLeft`, `Space`…). Así el táctil se comporta exactamente como el teclado, y un juego nuevo solo necesita declarar su disposición de botones en el registro.

Hay una diferencia entre teclado y botón: el sistema operativo autorrepite una tecla mantenida y un botón táctil no. ROCAS, BLOQUE BUSTER y SERPENTINA leen el estado mantenido (o un giro por pulsación) y no lo necesitan. CAÍDA mueve una celda por `keydown`, así que sus botones `←` `→` `↓` emulan la autorrepetición.

---

## Alcance

**Dentro:**

- **Tipos y despacho** en `lib/games/touch.ts`: `TouchButton`, `TouchLayout`, constantes de autorrepetición y las funciones `pressKey(code, repeat)` y `releaseKey(code)`, que despachan `new KeyboardEvent("keydown" | "keyup", { code, repeat, cancelable: true })` en `window`.
- **Registro:** campo opcional `touch?: TouchLayout` en `EngineEntry` (`lib/games/registry.ts`), con la disposición de los cuatro juegos:

  | Juego         | Grupo izquierdo (`move`)                       | Grupo derecho (`actions`)               |
  | ------------- | ---------------------------------------------- | --------------------------------------- |
  | ROCAS         | fila `←` `→` (girar) y `↑` (empuje)            | `FUEGO` = `Space`                       |
  | CAÍDA         | fila `←` `→` `↓`, los tres con autorrepetición | `ROTAR` = `ArrowUp`, `SOLTAR` = `Space` |
  | BLOQUE BUSTER | fila `←` `→`                                   | ninguno                                 |
  | SERPENTINA    | cruceta `↑` `←` `→` `↓`                        | ninguno                                 |

- **Componente** `components/touch-controls.tsx` (`"use client"`): pinta el mando a partir del `TouchLayout`. Usa Pointer Events (`pointerdown` → `pressKey`, `pointerup`/`pointercancel`/`lostpointercapture` → `releaseKey`) con `setPointerCapture`, de modo que varios dedos pulsan varios botones a la vez (girar + empujar + disparar en ROCAS).
- **Visibilidad:** el mando solo se monta cuando `matchMedia("(pointer: coarse)")` coincide. Se lee con `useSyncExternalStore` y un snapshot de servidor `false`, para que el HTML hidratado no cambie. En escritorio con ratón no aparece.
- **Estado del mando:** prop `disabled` (partida en pausa o terminada). Al pasar a `disabled`, o al desmontarse, el componente suelta todas las teclas mantenidas (`releaseKey` de cada una) y cancela los temporizadores de autorrepetición. Con la partida terminada el mando no se muestra.
- **Autorrepetición:** un botón con `repeat: true` despacha un `keydown` al pulsar, otro con `repeat: true` a los 170 ms y luego uno cada 50 ms mientras se mantiene.
- **Gestos del navegador bloqueados en el mando:** `touch-action: none`, `user-select: none`, `-webkit-touch-callout: none`, `-webkit-tap-highlight-color: transparent` y `preventDefault` en `contextmenu`. Mantener pulsado un botón no abre el menú contextual, no selecciona texto, no hace zoom ni scroll.
- **Accesibilidad:** cada botón es un `<button type="button">` con `aria-label` (p. ej. «Girar a la izquierda») y estado visual de pulsado (clase `pressed`). El grupo tiene `role="group"` y `aria-label="Mando táctil"`.
- **Disposición en `components/game-player.tsx` y `app/globals.css`:**
  - **Vertical:** canvas arriba y, debajo, el mando con el grupo `move` a la izquierda y `actions` a la derecha.
  - **Horizontal** (`(orientation: landscape) and (pointer: coarse)`): grupo `move` a la izquierda del canvas y `actions` a la derecha.
  - El marco `.crt-fit` recalcula su ancho máximo con pointer coarse para que HUD + canvas + mando quepan sin scroll en 390×844 (vertical) y 844×390 (horizontal).
- **HUD compacto** en `≤720px`: `.hud-stat` más pequeños y `PAUSA` / `FIN` / `SALIR` en una fila, para que el conjunto quepa en un móvil de 390×844.
- **Auto-pausa:** en `game-player.tsx`, `visibilitychange` con `document.visibilityState === "hidden"` pone la partida en pausa si no ha terminado. Aplica a todos los dispositivos y a los juegos simulados. Girar la pantalla no pausa.
- Invocar `/frontend-design` para el acabado visual del mando (coherente con el tema neón y los skins de la plataforma).

**Fuera de alcance (para futuras specs):**

- Gestos sobre el canvas (swipe en SERPENTINA o CAÍDA, arrastrar la paleta en BLOQUE BUSTER).
- Deslizar el dedo de un botón a otro sin levantarlo (cada toque queda ligado al botón donde empezó).
- Gamepad físico y control con el ratón.
- Vibración háptica (`navigator.vibrate`).
- Aviso «mejor en horizontal» y bloqueo de orientación.
- Pantalla completa (Fullscreen API).
- Interruptor para mostrar u ocultar el mando y su persistencia en `localStorage`.
- Mando con colores por skin (el mando usa los tokens del tema de la plataforma, no la paleta del juego).
- Ajuste del canvas a `devicePixelRatio`.
- Pausa automática al girar la pantalla o al perder el foco (`blur`).
- Cambios en los motores o en `lib/games/contract.ts`.
- Revisión responsive de las demás pantallas (Home, Biblioteca, detalle, Salón, Acerca de, acceso).
- Mando para los juegos simulados (no tienen motor).
- Tests automatizados (no hay runner configurado).

---

## Modelo de datos

```ts
// lib/games/touch.ts
export interface TouchButton {
  code: string; // KeyboardEvent.code que se despacha: "ArrowLeft", "Space"…
  label: string; // texto visible: "←", "FUEGO"
  aria: string; // nombre accesible: "Girar a la izquierda"
  repeat?: true; // autorrepetición mientras se mantiene (CAÍDA ← → ↓)
}

export interface TouchLayout {
  move: TouchButton[]; // grupo izquierdo (dirección)
  moveShape: "row" | "cross"; // fila de botones o cruceta (SERPENTINA)
  actions: TouchButton[]; // grupo derecho; [] = sin botones de acción
}

export const REPEAT_DELAY_MS = 170; // primera repetición
export const REPEAT_INTERVAL_MS = 50; // repeticiones siguientes
```

```ts
// lib/games/registry.ts (cambio)
export interface EngineEntry {
  width: number;
  height: number;
  levels?: number;
  skins?: true;
  touch?: TouchLayout; // ausente = sin mando táctil
  load: () => Promise<CreateGame>;
}
```

Con `moveShape: "cross"`, el grupo `move` debe tener exactamente los cuatro botones `ArrowUp`, `ArrowLeft`, `ArrowRight` y `ArrowDown`. El componente los coloca en cruz por su `code`.

Los eventos sintéticos solo rellenan `code`, `repeat` y `cancelable`. Los motores solo leen `e.code` y `e.repeat`, e ignoran `e.key`. Su `target` es `window`, así que el filtro `isTextField` de los motores no los descarta.

No hay persistencia nueva ni cambios en Supabase.

---

## Plan de implementación

Antes de empezar, leer en `node_modules/next/dist/docs/` la guía de componentes cliente (`"use client"`) y la de hidratación, como exige `AGENTS.md`. Leer `components/game-player.tsx`, `components/game-canvas.tsx`, `lib/games/registry.ts`, la entrada de teclado de los cuatro motores (`onKeyDown`/`onKeyUp`) y las reglas `.av-player`, `.player-hud`, `.hud-stat`, `.hud-actions`, `.crt`, `.crt-fit` y `.crt-screen` de `app/globals.css`. Invocar `/frontend-design` para el aspecto del mando, como indica `CLAUDE.md`.

1. Crear `lib/games/touch.ts` con los tipos, las constantes y `pressKey`/`releaseKey`. Verificación: `npm run lint` y `npm run build` pasan; en la consola del navegador, en `/jugar/serpentina`, despachar a mano `keydown` con `code: "ArrowUp"` en `window` gira la serpiente.
2. Añadir `touch?: TouchLayout` a `EngineEntry` y la disposición de los cuatro juegos en `ENGINES`, según la tabla del alcance. Verificación: compila; nada cambia todavía en pantalla.
3. Crear `components/touch-controls.tsx`: detección de `(pointer: coarse)` con `useSyncExternalStore`, botones con Pointer Events y captura, clase `pressed`, autorrepetición, `disabled` que suelta las teclas, limpieza al desmontar y bloqueo de `contextmenu`. Verificación: compila y `npm run lint` pasa.
4. Montar `TouchControls` en `components/game-player.tsx` cuando `entry?.touch` exista, con `disabled={paused || over}` y oculto con `over`. Envolver canvas y mando en un contenedor de escenario (`.player-stage`) que permita las dos disposiciones. Verificación: en escritorio (1280 px, ratón) la pantalla se ve igual que antes; con emulación móvil el mando aparece bajo el canvas.
5. Añadir en `app/globals.css` los estilos del mando (`.touch-pad`, `.touch-group`, `.touch-btn`, `.touch-btn.pressed`, cruceta), la disposición horizontal con pointer coarse, el recálculo de `.crt-fit` con pointer coarse y el HUD compacto en `≤720px`. Verificación: capturas en 390×844 y 844×390 sin scroll en `.playwright-screenshots/touch/`.
6. Añadir la auto-pausa por `visibilitychange` en `game-player.tsx` (solo si la partida no ha terminado; el listener se quita al desmontar). Verificación: cambiar de pestaña durante una partida y volver la deja en «EN PAUSA».
7. Acabado visual con `/frontend-design` y verificación en dispositivo real: `npm run build` y `npm run start -- -H 0.0.0.0`, y abrir la IP de la máquina desde un móvil de la misma red. Verificación: los cuatro juegos se juegan una partida completa en el móvil.

La verificación automática usa Playwright con un contexto móvil (`devices["iPhone 13"]`, con `hasTouch` e `isMobile`) creado con `browser_run_code_unsafe`, porque `browser_resize` solo cambia el tamaño y no activa `(pointer: coarse)`.

---

## Criterios de aceptación

- [ ] `npm run lint` y `npm run build` terminan sin errores ni warnings de hidratación o de Cache Components.
- [ ] Ningún archivo de `lib/games/*/engine.ts`, `lib/games/*/entities.ts` ni `lib/games/contract.ts` cambia en esta spec.
- [ ] En escritorio con ratón (1280 px, Chromium sin emulación) `/jugar/rocas`, `/jugar/caida`, `/jugar/bloque-buster` y `/jugar/serpentina` no muestran el mando y se ven igual que antes.
- [ ] En escritorio, el teclado sigue controlando los cuatro juegos igual que antes (flechas, `Space`, `P`, `Escape`, WASD en SERPENTINA).
- [ ] Con emulación móvil (`hasTouch`, `isMobile`, 390×844) los cuatro juegos muestran el mando bajo el canvas, con el grupo de dirección a la izquierda y las acciones a la derecha.
- [ ] Con emulación móvil en 844×390, el grupo de dirección queda a la izquierda del canvas y el de acciones a la derecha.
- [ ] En 390×844 y 844×390, HUD, canvas y mando caben sin scroll vertical ni horizontal, y el canvas conserva su proporción (4:3, o 420:600 en CAÍDA).
- [ ] ROCAS: mantener `←` o `→` gira la nave de forma continua, mantener `↑` la impulsa y `FUEGO` dispara.
- [ ] ROCAS: girar, empujar y disparar a la vez con tres dedos funciona (los tres efectos se ven en el mismo momento).
- [ ] CAÍDA: un toque corto en `←` mueve la pieza una sola celda; mantenerlo la mueve celda a celda de forma continua hasta soltar.
- [ ] CAÍDA: `↓` mantenido baja la pieza de forma continua, `ROTAR` gira la pieza una vez por toque y `SOLTAR` la deja caer de golpe una vez por toque.
- [ ] BLOQUE BUSTER: mantener `←` o `→` mueve la paleta de forma continua y se detiene al soltar.
- [ ] SERPENTINA: la cruceta tiene los cuatro botones en cruz y cada toque gira la serpiente; dos toques rápidos dentro de un mismo paso ejecutan ambos giros.
- [ ] Al soltar un dedo, o si el navegador cancela el toque (`pointercancel`), la tecla correspondiente se suelta: ninguna acción se queda «enganchada».
- [ ] Mantener pulsado un botón del mando no abre el menú contextual, no selecciona texto, no hace scroll ni zoom.
- [ ] Al pulsar `PAUSA` con una tecla del mando mantenida, la tecla se suelta; al `REANUDAR`, la nave, la pieza o la paleta no siguen moviéndose solas.
- [ ] Con la partida en pausa, tocar los botones del mando no mueve nada.
- [ ] Con la partida terminada el mando no se muestra, y el modal «FIN DEL JUEGO» (iniciales, guardar, jugar de nuevo) funciona con el táctil.
- [ ] «JUGAR DE NUEVO» vuelve a mostrar el mando y este funciona en la nueva partida.
- [ ] El selector de nivel (BLOQUE BUSTER) y el de skin del panel de pausa se pueden usar con el táctil.
- [ ] Ocultar la página durante una partida (cambiar de pestaña o de app) la deja en «EN PAUSA» al volver; con la partida terminada no ocurre nada.
- [ ] Girar el móvil durante una partida no la pausa ni la reinicia, y el mando cambia de disposición.
- [ ] Cada botón del mando tiene un `aria-label` en español y el grupo tiene `role="group"` con `aria-label="Mando táctil"`.
- [ ] Al salir con `SALIR` o navegar a otra ruta con una tecla del mando mantenida, no queda ninguna tecla pulsada ni temporizador activo (no hay errores en consola).
- [ ] Los juegos simulados (por ejemplo `/jugar/gloton`) no muestran mando y su auto-pausa al ocultar la página funciona.
- [ ] En un móvil real (Android o iOS), en la red local con `npm run start -- -H 0.0.0.0`, se completa una partida de cada uno de los cuatro juegos solo con el táctil.
- [ ] La consola del navegador no muestra errores ni warnings durante una partida con el mando.
- [ ] Hay capturas de los cuatro juegos en 390×844 y en 844×390 en `.playwright-screenshots/touch/`.

---

## Decisiones

- **Sí:** mando virtual con botones en pantalla. Es predecible, igual para todos los juegos y encaja con ROCAS, que necesita varias acciones a la vez. **No:** gestos sobre el canvas; cada juego necesitaría lógica propia y ROCAS encaja mal. **No:** esquema mixto; más trabajo y más casos a verificar. Los gestos pueden llegar en otra spec.
- **Sí:** teclas sintéticas (`KeyboardEvent` en `window`). Los motores no cambian y el táctil hereda todo el comportamiento del teclado (pausa, filtro de campos de texto, `preventDefault`). **No:** ampliar el contrato con un método `input(action, pressed)`; obligaría a tocar los cuatro motores sin ganar nada visible hoy.
- **Sí:** disposición por juego en el registro (`ENGINES[id].touch`). `game-player.tsx` sigue sin `game.id === "..."` y un juego nuevo solo declara sus botones. Mantiene el patrón de `levels` y `skins`.
- **Sí:** mostrar el mando solo con `(pointer: coarse)`. En escritorio no estorba. **No:** interruptor manual con `localStorage`; la detección automática basta para el caso real. **No:** siempre visible.
- **Sí:** `useSyncExternalStore` con snapshot de servidor `false`. El servidor no conoce el puntero y así no hay desajuste de hidratación.
- **Sí:** Pointer Events con `setPointerCapture`. Soportan multitáctil y ratón/lápiz con la misma API, y la captura garantiza el `pointerup` aunque el dedo salga del botón. **No:** Touch Events; duplicarían la lógica para el ratón.
- **No:** deslizar de un botón a otro sin levantar el dedo. Exige hit-testing manual durante `pointermove`; se puede añadir si la cruceta de SERPENTINA resulta incómoda.
- **Sí:** autorrepetición solo en `←` `→` `↓` de CAÍDA (170 ms y luego cada 50 ms), declarada por botón con `repeat: true`. Es el único motor que avanza por `keydown`; los demás leen el estado mantenido. `ROTAR` y `SOLTAR` no repiten, igual que en el teclado se haría una pulsación por giro.
- **Sí:** disposición de botones 1:1 con los controles de teclado actuales (tabla del alcance). **No:** disparo automático en ROCAS; cambia la jugabilidad y obliga a tocar el motor.
- **Sí:** pausa con el botón `PAUSA` del HUD, que ya existe. **No:** un botón de pausa en el mando; sería un duplicado.
- **Sí:** vertical y horizontal, con el mando debajo en vertical y a los lados en horizontal. **No:** Fullscreen API; iOS Safari no la soporta en iPhone y añade un caso degradado.
- **Sí:** auto-pausa con `visibilitychange` en todos los dispositivos. En móvil es habitual cambiar de app a mitad de partida. **No:** pausar al girar la pantalla; el usuario gira para jugar mejor y la partida debe seguir.
- **Sí:** HUD compacto en `≤720px`, necesario para que HUD, canvas y mando quepan en 390×844.
- **No:** vibración háptica (solo Android) ni aviso «mejor en horizontal». Se descartaron en la fase de preguntas.
- **Sí:** el mando usa los tokens del tema de la plataforma (`--cyan`, `--magenta`, `--ink`…). **No:** colorearlo con la paleta del skin del juego; acoplaría el mando a cada `skins.ts`.
- **Sí:** verificación en dispositivo real con `npm run start -- -H 0.0.0.0` (build de producción). Evita tocar `next.config.ts` para permitir orígenes del servidor de desarrollo en la red local.

---

## Riesgos

| Riesgo                                                                                                         | Mitigación                                                                                                                                                                     |
| -------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| Una tecla se queda pulsada (el dedo sale de la pantalla, el sistema cancela el toque)                          | `setPointerCapture`, y `releaseKey` en `pointerup`, `pointercancel` y `lostpointercapture`. Al pasar a `disabled` o al desmontar se sueltan todas. Un criterio lo comprueba.   |
| iOS Safari hace zoom con doble toque o abre la lupa al mantener pulsado                                        | `touch-action: none`, `user-select: none`, `-webkit-touch-callout: none` y `preventDefault` en `contextmenu` sobre el mando.                                                   |
| Desajuste de hidratación al decidir en el servidor si se muestra el mando                                      | `useSyncExternalStore` con snapshot de servidor `false`; el mando aparece tras hidratar. Un criterio exige build sin warnings de hidratación.                                  |
| Playwright MCP no activa `(pointer: coarse)` con `browser_resize`                                              | Contexto móvil con `devices["iPhone 13"]` desde `browser_run_code_unsafe`; además, verificación en dispositivo real.                                                           |
| En móviles pequeños en horizontal (alto ~360 px) el canvas queda demasiado pequeño                             | El `.crt-fit` con pointer coarse descuenta el HUD compacto y usa `100dvh`; se revisa en 844×390 y, si no basta, se reduce el relleno del marco `.crt` solo con pointer coarse. |
| Un portátil con pantalla táctil y ratón reporta `(pointer: coarse)` como falso y no ve mando                   | Aceptado: usa el teclado. El interruptor manual queda fuera de alcance y puede llegar en otra spec.                                                                            |
| Un motor futuro lee `e.key` en lugar de `e.code` y el mando no le llega                                        | `contract.md` del skill `nuevo-juego` ya pide `e.code`; el modelo de datos de esta spec documenta que el despacho solo rellena `code` y `repeat`.                              |
| La autorrepetición de CAÍDA a 50 ms es demasiado rápida o lenta en el táctil                                   | Constantes en `lib/games/touch.ts`, ajustables en el paso 7 sin tocar el motor.                                                                                                |
| Los eventos sintéticos llegan también a otros listeners de `window` (p. ej. el `Escape` del menú de `nav.tsx`) | El mando no despacha `Escape` ni `P`; solo flechas y `Space`, que ningún otro componente escucha en `window`.                                                                  |

---

## Lo que **no** está en esta spec

- Gestos sobre el canvas y deslizar de un botón a otro.
- Gamepad físico y ratón.
- Vibración háptica, aviso de orientación, bloqueo de orientación y pantalla completa.
- Interruptor manual del mando y su persistencia.
- Mando coloreado por skin.
- `devicePixelRatio`, pausa al girar y pausa por `blur`.
- Cambios en los motores o en el contrato.
- Revisión responsive del resto de pantallas.
- Mando para los juegos simulados.
- Tests automatizados.

Cada uno, si llega, va en su propia spec.
