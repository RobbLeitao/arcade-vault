# Estado móvil

Referencia de cómo se ve y se usa Arcade Vault en el móvil (navegador y PWA). La mantiene el agente `mobile-porter`, que revisa **todo el sitio** en cada invocación (`@mobile-porter`). Estándar de referencia: `specs/10-controles-tactiles-moviles.md`.

Dispositivos de prueba: 360×740, iPhone 13 (390×844), Pixel 7 (412×915), horizontal 844×390 y tablet 768×1024, con contexto móvil de Playwright (`hasTouch`, `isMobile`, pointer coarse).

Leyenda: ✅ cumple · ⚠ funciona pero falla algún criterio · ❌ sin revisar o no cumple.

## Pantallas

| Ruta                 | Vertical | Horizontal | Táctil | Revisado | Nota          |
| -------------------- | -------- | ---------- | ------ | -------- | ------------- |
| `/`                  | ❌       | ❌         | ❌     | —        | Sin revisar.  |
| `/biblioteca`        | ❌       | ❌         | ❌     | —        | Sin revisar.  |
| `/juegos/[id]`       | ❌       | ❌         | ❌     | —        | Sin revisar.  |
| `/salon-de-la-fama`  | ❌       | ❌         | ❌     | —        | Sin revisar.  |
| `/acerca-de`         | ❌       | ❌         | ❌     | —        | Sin revisar.  |
| `/acceso`            | ❌       | ❌         | ❌     | —        | Sin revisar.  |
| Nav, footer, modales | ❌       | ❌         | ❌     | —        | Sin revisar (la nav compacta en horizontal solo existe en la pantalla de juego, SPEC 10). |

## Juegos (`/jugar/[id]`)

| Juego                  | Vertical | Horizontal | Mando | Revisado   | Nota                                   |
| ---------------------- | -------- | ---------- | ----- | ---------- | -------------------------------------- |
| `rocas`                | ✅       | ✅         | ✅    | 2026-11-03 | SPEC 10.                               |
| `caida`                | ✅       | ✅         | ✅    | 2026-11-03 | SPEC 10 (autorrepetición ← → ↓).       |
| `bloque-buster`        | ✅       | ✅         | ✅    | 2026-11-03 | SPEC 10.                               |
| `serpentina`           | ✅       | ✅         | ✅    | 2026-11-03 | SPEC 10 (cruceta).                     |
| Simulados (p. ej. `gloton`) | ❌  | ❌         | —     | —          | Sin mando por diseño; sin revisar el layout. |

## PWA

Pendiente. No hay `app/manifest.ts`, iconos de app, `viewport` (`themeColor`, `viewportFit: "cover"`) ni `appleWebApp`.

Fuera de alcance por ahora: service worker, offline, push y prompt de instalación propio.

## Historial

| Fecha      | Cambio                                                       |
| ---------- | ------------------------------------------------------------ |
| 2026-11-03 | Referencia creada junto con el agente `mobile-porter`.       |
