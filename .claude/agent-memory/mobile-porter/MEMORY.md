# Memoria de mobile-porter

- Estado móvil por pantalla/juego y de la PWA: [references/mobile-status.md](../../../references/mobile-status.md) (fuente de verdad, no se duplica aquí).
- Estándar móvil de referencia: [SPEC 10](../../../specs/10-controles-tactiles-moviles.md).

## Preferencias y decisiones del usuario

- 2026-11-03: «móvil» = web en el navegador del móvil **y** app instalable (PWA). Sin app nativa (Capacitor) ni service worker/offline por ahora.
- 2026-11-03: cada invocación revisa **todo el sitio** (todas las rutas, juegos, nav, modales y PWA).
- 2026-11-03: el agente **implementa y verifica** (no solo audita). Sin commits ni push.

## Criterios aprendidos

- Playwright: `browser_resize` no activa `(pointer: coarse)`; hay que crear un contexto con `devices["iPhone 13"]` (`hasTouch`, `isMobile`) desde `browser_run_code_unsafe` (SPEC 10).
