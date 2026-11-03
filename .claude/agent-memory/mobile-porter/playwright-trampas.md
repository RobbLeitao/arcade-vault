---
name: playwright-trampas
description: Trampas de Playwright MCP y del dev server al auditar el móvil de Arcade Vault (contextos móviles, viewport de diseño, toques reales, CSS desfasado)
metadata:
  type: feedback
---

Trampas comprobadas en la revisión del 2026-11-03.

- En `browser_run_code_unsafe` no existen `require` ni `devices`: los contextos móviles se crean a mano con `page.context().browser().newContext({ viewport, isMobile: true, hasTouch: true, userAgent })`.
  **Why:** `devices["iPhone 13"]` falla con «require is not defined».
  **How to apply:** el viewport real del iPhone 13 es 390×664 (horizontal 750×342); pruébalo además de 390×844, porque ahí aparecen problemas que en 844 no se ven.
- `filename` de `browser_run_code_unsafe` solo admite rutas dentro del repo (p. ej. `.playwright-mcp/`). Borra esos scripts al terminar: ESLint los analiza y salen como warnings en `npm run lint`.
- Con `isMobile` un desborde no aparece como scroll horizontal: el viewport de diseño se ensancha (`innerWidth` pasa de 844 a 919). Para encontrar al culpable, mide contra `screen.width`, no contra `innerWidth`.
- `dispatchEvent('pointerdown')` con un `pointerId` inventado hace que falle `setPointerCapture` (error falso). Para pulsar de verdad usa CDP `Input.dispatchTouchEvent` (`touchStart`/`touchEnd`), que también sirve para el multitoque.
- Si editas `app/globals.css` desde bash (node/sed), Turbopack a veces no recompila; `touch` no basta. Añadir y quitar un salto de línea sí lo fuerza. Antes de medir, comprueba con `curl` que el CSS servido incluye la regla nueva.
- No uses Edit/Write en `globals.css`: el hook ejecuta Prettier y reformatearía el archivo entero (ya incumplía Prettier antes). Edítalo con scripts de node.
- Los estilos en línea (`style={{ fontSize }}`) no se pueden ajustar desde una media query: pásalos a una clase con los mismos valores de escritorio.
