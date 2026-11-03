# Memoria de mobile-porter

- Estado móvil por pantalla/juego y de la PWA: [references/mobile-status.md](../../../references/mobile-status.md) (fuente de verdad, no se duplica aquí).
- Estándar móvil de referencia: [SPEC 10](../../../specs/10-controles-tactiles-moviles.md).

## Preferencias y decisiones del usuario

- 2026-11-03: «móvil» = web en el navegador del móvil **y** app instalable (PWA). Sin app nativa (Capacitor) ni service worker/offline por ahora.
- 2026-11-03: cada invocación revisa **todo el sitio** (todas las rutas, juegos, nav, modales y PWA).
- 2026-11-03: el agente **implementa y verifica** (no solo audita). Sin commits ni push.
- 2026-11-03: tras `/spec-impl-game`, el coordinador indica la rama del juego y pide no cambiar de rama; se trabaja en esa rama (no en `mobile-review`).

## Criterios aprendidos

- Playwright: `browser_resize` no activa `(pointer: coarse)`; hay que crear un contexto móvil desde `browser_run_code_unsafe` (SPEC 10). Detalles y trampas: [playwright-trampas](playwright-trampas.md).
- Un canvas casi cuadrado con cruceta (RANARIA 8:7) es el caso límite en vertical: verifícalo en 390×664. El alto reservado vive en `--touch-reserve` (globals.css).
- Los objetivos de 44 px agrandan la nav y el HUD; en horizontal (≤500 px de alto) hay que quitarles el relleno vertical para que el canvas siga cabiendo.
