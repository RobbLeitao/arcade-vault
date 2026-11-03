# Estado móvil

Referencia de cómo se ve y se usa Arcade Vault en el móvil (navegador y PWA). La mantiene el agente `mobile-porter`, que revisa **todo el sitio** en cada invocación (`@mobile-porter`). Estándar de referencia: `specs/10-controles-tactiles-moviles.md`.

Dispositivos de prueba: 360×740, iPhone 13 (390×844 y 390×664, el viewport real de Safari con sus barras), Pixel 7 (412×915), horizontal 844×390 y 750×342, y tablet 768×1024, con contexto móvil de Playwright (`hasTouch`, `isMobile`, pointer coarse). Escritorio de referencia: 1280 px con ratón.

Leyenda: ✅ cumple · ⚠ funciona pero falla algún criterio · ❌ sin revisar o no cumple.

## Pantallas

| Ruta                 | Vertical | Horizontal | Táctil | Revisado   | Nota |
| -------------------- | -------- | ---------- | ------ | ---------- | ---- |
| `/`                  | ✅       | ✅         | ✅     | 2026-11-03 | Ticker de actividad ya no desborda a 360 px; hero con `100svh`. |
| `/biblioteca`        | ✅       | ✅         | ✅     | 2026-11-03 | Búsqueda a 16 px y a todo el alto del recuadro, `inputMode/enterKeyHint="search"`; chips ≥44 px. |
| `/juegos/[id]`       | ✅       | ✅         | ✅     | 2026-11-03 | Revisados `ranaria`, `rocas` y `gloton`. Fecha del top 10 a 12 px (clase `.lb-date`). |
| `/salon-de-la-fama`  | ✅       | ✅         | ✅     | 2026-11-03 | A ≤520 px la tabla pasa a 3 columnas (rango · jugador · puntuación) con la fecha bajo el jugador; antes las cabeceras se solapaban y la columna FECHA desbordaba. |
| `/acerca-de`         | ✅       | ✅         | ✅     | 2026-11-03 | Inputs a 16 px con pointer coarse; `autoComplete` `nickname`/`email`. |
| `/acceso`            | ✅       | ✅         | ✅     | 2026-11-03 | Inputs a 16 px; pestañas, botones sociales y JUGAR COMO INVITADO ≥44 px. |
| Nav, footer, modales | ✅       | ✅         | ✅     | 2026-11-03 | Nav: «Entrar» a ≤480 px (una sola línea), menú ☰ hasta 1040 px y versión compacta entre 1041 y 1260 px (antes desbordaba por debajo de ~1250 px). Ítems del ☰ de 48 px. Modal de fin con scroll interno y `100dvh`, y compacto en horizontal. |

## Juegos (`/jugar/[id]`)

| Juego                       | Vertical | Horizontal | Mando | Revisado   | Nota |
| --------------------------- | -------- | ---------- | ----- | ---------- | ---- |
| `ranaria`                   | ✅       | ✅         | ✅    | 2026-11-03 | Canvas 8:7 (1.143). Antes la cruceta no cabía en 390×664 y el canvas se cortaba en 844×390. Ahora cabe en 390×844, 390×664, 844×390 y 750×342. Un toque = un `keydown` (sin autorrepetición), verificado con toques CDP. |
| `rocas`                     | ✅       | ✅         | ✅    | 2026-11-03 | SPEC 10. Multitoque (girar + empujar + disparar) verificado. |
| `caida`                     | ✅       | ✅         | ✅    | 2026-11-03 | SPEC 10 (autorrepetición ← → ↓). |
| `bloque-buster`             | ✅       | ✅         | ✅    | 2026-11-03 | SPEC 10. |
| `serpentina`                | ✅       | ✅         | ✅    | 2026-11-03 | SPEC 10 (cruceta); también se beneficia de la reserva de alto para cruceta. |
| Simulados (p. ej. `gloton`) | ✅       | ⚠          | —     | 2026-11-03 | Sin mando por diseño. En horizontal el CRT ya se ajusta al alto, pero la nav no se compacta y la página hace algo de scroll (aceptable para una demo). |

## PWA

| Elemento               | Estado | Nota |
| ---------------------- | ------ | ---- |
| Manifest               | ✅     | `app/manifest.ts` → `/manifest.webmanifest` (`application/manifest+json`): `standalone`, `orientation: any`, `lang: es`, colores `#0a0a0f`. |
| Iconos                 | ✅     | `public/icons/icon-192.png`, `icon-512.png` (`any`), `icon-maskable-512.png` (marca dentro del 80 % de zona segura); `app/apple-icon.png` (180) y `app/icon.png` (64). Marca del logo con halo neón. |
| Viewport / safe areas  | ✅     | `viewport` en `app/layout.tsx`: `device-width`, `initialScale: 1`, `viewportFit: "cover"`, `themeColor`; sin bloqueo de zoom. Nav, contenido, footer, panel ☰, mando y modales usan `env(safe-area-inset-*)` con pointer coarse. |
| Standalone             | ✅     | `appleWebApp` (`capable`, `black-translucent`). En `display-mode: standalone` vertical la nav baja bajo el notch. La nav basta para volver (logo → inicio, ☰ con todas las rutas). Sin probar en un dispositivo real instalado. |
| Service worker/offline | —      | Pendiente, otra spec (también push y prompt de instalación propio). |

## Pendientes y decisiones a revisar

- ⚠ Contraste de `--ink-faint` (#4a4f70, ~2.5:1 sobre `--bg`) en escritorio. En móvil (≤720 px o pointer coarse) se aclara con `color-mix` hacia `--ink-dim` (~4.9:1). Propuesta: una spec de tokens que lo suba para todo el sitio.
- ⚠ Texto pequeño en escritorio (Press Start 2P a 8–9 px en la nav, chips y etiquetas): solo se ha subido en móvil.
- Decisión a revisar: el botón de acceso muestra «Entrar» a ≤480 px.
- Decisión a revisar: el pie decorativo del CRT también se oculta en vertical con mando.
- Decisión a revisar: etiquetas del HUD de juego a 10 px mono (no 12 px) para no quitar alto al canvas.
- Decisión a revisar: la nav pasa al menú ☰ por debajo de 1040 px también con ratón (antes desbordaba).

## Historial

| Fecha      | Cambio |
| ---------- | ------ |
| 2026-11-03 | Referencia creada junto con el agente `mobile-porter`. |
| 2026-11-03 | Primera revisión completa. RANARIA cabe en vertical y horizontal (reserva de alto para la cruceta). Nav sin desborde (☰ ≤1040 px, «Entrar» ≤480 px). Salón y ticker sin desborde a 360 px. Inputs a 16 px, objetivos ≥44 px, texto mínimo 12/10 px y contraste de `--ink-faint` en móvil. Safe areas. PWA creada (manifest, iconos, viewport, appleWebApp). |
