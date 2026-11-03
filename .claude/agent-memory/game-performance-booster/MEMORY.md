# Memoria de game-performance-booster

- Estado de rendimiento por juego: [references/game-performance.md](../../../references/game-performance.md) (fuente de verdad, no se duplica aquí).
- Estándar de referencia: [SPEC 12](../../../specs/12-rendimiento-ranaria.md). Implementación modelo: `lib/games/ranaria/sprites.ts` y `lib/games/ranaria/engine.ts`.

## Preferencias y decisiones del usuario

- 2026-11-03: el agente **implementa y verifica** (no solo audita), un juego por invocación, recibido por su id. Sin commits ni push.
- 2026-11-03 (SPEC 12): el aspecto debe quedar idéntico. Bajar o quitar el glow está descartado por el autor.
- 2026-11-03 (SPEC 12): en React, el mínimo de `useState`; lo que cambia más de una vez por segundo va en `useRef` y se escribe en el DOM. Ya está hecho en `game-player.tsx` para todos los juegos.

## Criterios aprendidos (SPEC 12)

- Medir en **producción** (`npm run build && npm start`): en dev, React en modo desarrollo (`jsxDEV`) es el mayor coste de JS y falsea la comparación.
- Llamar a `page.bringToFront()` antes de medir: con la ventana tapada Chrome limita rAF a 1 fps.
- Antes y después **en la misma sesión** (`git stash`/`git stash pop`): la carga de la GPU varía entre tandas, y tres tandas seguidas sin cambios de código dieron 59,8 → 57,8 → 24,1 fps.
- La GPU Intel UHD integrada de esta máquina limita a unos 30 fps en `/jugar/*`, también sin canvas. El fondo global (`.av-bg`, `.av-noise`) cuesta unos 20 fps. Es un coste externo: se informa y no se arregla.
- El `shadowBlur` lo rasteriza la GPU: el throttling de CPU no lo refleja y, con el hilo principal libre, puede seguir habiendo 13 fps. Con sprites cacheados, NEÓN y RETRO pasaron de unos 13-16 fps a unos 26-32 fps.
- Si el fps no separa el antes del después, usar el % de hilo ocupado (`Performance.getMetrics`) y los frames > 50 ms.
- El paso fijo se verifica con un reloj virtual que sustituye a rAF; no hace falta un monitor de 120/144 Hz.
- Para contar re-renders de React, un `MutationObserver` en `.player-hud` o un hook de DevTools falso.

## Criterios aprendidos (rocas, caida, bloque-buster · 2026-11-03, 4 instancias en paralelo)

- **Instancias en paralelo** (una por worktree, puerto propio 3101-3104): los fps y el p95 no sirven (variación ×2 sin cambios de código). Usar ms de script por frame (`ScriptDuration`/frames de `Performance.getMetrics`), % de hilo, CPU por callback de rAF (envolver rAF en `addInitScript`) y A/B intercalado en la misma página. Repetir en solitario para cerrar los criterios de p95.
- El scratchpad es compartido entre instancias: usar `scratchpad/<id>/`. El stash de git es compartido por todo el repo (también entre worktrees) y `git stash drop` lo bloquea el clasificador de permisos: para el «antes», mejor copiar `.next` (`cp -r .next .next-antes`; `mv` falla en Windows) y borrar las copias al terminar (ESLint las analiza).
- Navegador MCP compartido: un `browser.newContext()` por medición; bloquear la pausa por visibilidad con un listener `visibilitychange` en captura + `stopImmediatePropagation`. `browser_run_code_unsafe` no tiene `require`/`process`; `filename` solo dentro del repo (`.playwright-mcp/`).
- Formas que **giran**: ninguna caché de glow queda ≤ 3/255 (el blur de Chrome no es invariante a la rotación, 8-13/255). Cachear solo el glow (forma trazada fuera con `shadowOffsetX`) y dibujar la forma en vectorial encima; avisar de antemano.
- CPU ×10 penaliza las cachés de sprites (`drawImage` ≈ 0,16 ms en hilo principal frente a ≈ 0,03 ms de un trazo con sombra, que paga la GPU). No representa un móvil.
- Partículas efímeras: compartir un sprite por magnitud cuantizada, nunca uno por instancia.
- Factores por frame (`v *= 0.987`) dependen de los Hz: con paso fijo, `factor ** (dt·60)`. Juegos de tick discreto: el paso fijo alimenta el temporizador con `EPS` y máximo un tick por frame.
- Texto (`fillText`) en un canvas fuera de pantalla sale con otro antialiasing (hasta 101/255): mantenerlo en el canvas visible.
- Elementos en posición con decimales: cachear por fracción (p. ej. 1/24 px) y pintar el sprite ya desplazado; el desplazamiento bilineal no reproduce rellenos solapados.
- Comparar píxeles compuestos sobre negro (canvas transparente en NEÓN); `sharp` está en `node_modules`. Repetir `getImageData` pasa el canvas a CPU: para detectar redibujos, contar llamadas de dibujo.
- `prettier --write` sobre una carpeta reescribe a LF archivos no tocados (checkout CRLF): restaurarlos con `git checkout -- <archivo>`.
- Nunca `getImageData` sobre el canvas del juego: Chrome lo pasa a CPU y cada `drawImage` desde un atlas en GPU se dispara (49 ms/frame en SERPENTINA). Leer desde una copia con `willReadFrequently`. En benchmarks síncronos, forzar el volcado en cada frame (leer 1 px de una copia), o Chrome descarta los frames tapados.
- Arcos sin sombra cacheados salen distintos (hasta 42/255); con sombra coinciden. En skins con `glow = 0`, dibujar directo.
- Si se sustituye rAF, `waitForFunction` necesita `{ polling: 100 }`. Para que el `shadowBlur` se note, llevar el juego a un estado largo con piloto automático y semilla fija.
- En solitario, esta máquina da 60 fps en `/jugar/serpentina` incluso con CPU ×10.
