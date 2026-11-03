# Juegos con skins

Referencia de qué juegos tienen ya sus skins. La mantiene el agente `skin-designer`, que trabaja **un solo juego por invocación** y **solo el juego que indique el usuario** (`@skin-designer <id>`). Nunca aplica skins al resto.

## Skins obligatorios

| id        | Etiqueta | Rol           | Dirección visual                                                  |
| --------- | -------- | ------------- | ----------------------------------------------------------------- |
| `clasico` | CLÁSICO  | Por defecto   | Arcade plano: colores saturados de recreativa, sin glow.          |
| `neon`    | NEÓN     | Look original | Paleta actual (variables CSS de `app/globals.css`) con glow.      |
| `retro`   | RETRO    | CRT / fósforo | Paleta limitada, scanlines suaves, glow mínimo de fósforo.        |

Los tres deben verse bien en modo oscuro: fondo del canvas ≤ `--bg-3`, elementos ≥ 3:1 y texto ≥ 4.5:1 de contraste.

Leyenda: ✅ cumple · ⚠ existe pero falla algún criterio · ❌ no existe.

## Sistema base de skins

Creado (2026-11-02, con ROCAS). Archivos: `lib/games/skins.ts` (`SkinId`, `SKIN_IDS`, `DEFAULT_SKIN = "clasico"`, `SKIN_LABELS`, `loadSkin`/`saveSkin` con `av:skin:<gameId>`), `lib/games/contract.ts` (`CreateGameOptions { skin? }` y `GameEngine.setSkin?`), `lib/games/registry.ts` (`skins?: true`), `components/game-canvas.tsx` (prop `skin`, `setSkin` en caliente sin recrear el motor) y `components/game-player.tsx` (selector SKIN en el panel de pausa, solo con `entry.skins`), con estilo `.btn.skin-btn` en `app/globals.css` (mismo aspecto que `.level-btn`). Los juegos sin `skins` no muestran selector y conservan su look neón.

## Estado por juego

| Juego         | id              | Carpeta                     | CLÁSICO | NEÓN | RETRO | Contraste mín. | Fecha | Notas                                        |
| ------------- | --------------- | --------------------------- | ------- | ---- | ----- | -------------- | ----- | -------------------------------------------- |
| ROCAS         | `rocas`         | `lib/games/asteroids/`      | ✅      | ✅   | ✅    | 5.48:1 (texto «3x» NEÓN); elementos ≥ 3.31:1 (rocas RETRO en esquina con viñeta) | 2026-11-02 | CLÁSICO: vectores blancos/azules sin glow sobre `#000`. RETRO: fósforo verde, scanlines 0.1 y viñeta 0.3. A revisar: fósforo verde (no ámbar) y power-up RETRO en verde-lima. |
| CAÍDA         | `caida`         | `lib/games/caida/`          | ✅      | ⚠    | ✅    | Texto «SIGUIENTE» ≥ 6.68:1 (NEÓN). Elementos: CLÁSICO ≥ 3.38:1 (T violeta en la banda de sombra del bisel; cuerpo ≥ 5.45:1, fantasma ≥ 4.12:1), NEÓN piezas ≥ 5.48:1 pero fantasma 1.15:1, RETRO ≥ 3.31:1 (piezas de brillo bajo en esquina con scanline + viñeta) | 2026-11-02 | CLÁSICO: piezas planas con bisel, sin glow, fondo `#000`, azul/violeta aclarados, fantasma en contorno del color de la pieza. RETRO: fósforo verde, las 8 piezas (incluida la tuerca) con combinación única de 3 brillos × 3 patrones (sin «bajo hueco»), fantasma en contorno discontinuo, scanlines 0.1 y viñeta 0.3 ajustada al canvas estrecho. NEÓN ⚠ sin cambios por regla: la pieza fantasma (relleno al 20 %) queda en 1.15–1.60:1. A revisar: fantasma en contorno en CLÁSICO/RETRO y equivalencia pieza→patrón en RETRO. |
| BLOQUE BUSTER | `bloque-buster` | `lib/games/bloque-buster/`  | ✅      | ✅   | ✅    | 3.14:1 (ladrillo magenta NEÓN, en la banda de sombra del bisel); cuerpo de los elementos ≥ 5.45:1; sin texto en el canvas | 2026-11-02 | CLÁSICO: ladrillos planos con bisel, magenta→violeta, paleta plateada con extremos rojos, fondo `#000`. RETRO: fósforo verde, 3 brillos × 3 patrones (macizo/hueco/rayado) para que ningún par de vecinos coincida; scanlines 0.1, viñeta 0.3. A revisar: fósforo verde (no ámbar) y la equivalencia color→patrón en RETRO. |
| SERPENTINA    | `serpentina`    | `lib/games/serpentina/`     | ✅      | ⚠    | ✅    | Sin texto en canvas. Elementos: CLÁSICO ≥ 5.62:1 (contorno de fruta 15.35:1), NEÓN serpiente 15.66:1 pero sprite morado 2.35:1 con halo, RETRO ≥ 3.19:1 (fruta tintada en esquina con scanline + viñeta; serpiente 3.31:1) | 2026-11-02 | Sprites: CLÁSICO los conserva sin halo y con contorno plano `#d9dce8`; RETRO usa una copia del atlas tintada a fósforo verde (rampa por brillo, en caché y con la imagen original como respaldo). NEÓN ⚠ sin cambios por regla: el halo blanco deja el sprite morado (`garlic`) en 2.35:1 y cabeza/cuerpo se distinguen solo por forma y ojos (1.08:1). A revisar: fósforo verde, contorno claro en CLÁSICO. |
| RANARIA       | `ranaria`       | `lib/games/ranaria/`        | ✅      | ⚠    | ✅    | Sin texto en canvas. Elementos: CLÁSICO ≥ 3.39:1 (rana sobre tortuga roja; troncos/tortugas sobre el río ≥ 4.06:1), NEÓN vehículos y apoyos ≥ 5.14:1 pero rana sobre tortuga 1.00:1, sobre tronco 2.30:1 y tortuga sumergida 2.31:1, RETRO ≥ 3.98:1 (apoyos sobre el río en esquina con scanline + viñeta; contorno de la rana sobre apoyo 4.17:1) | 2026-11-03 | CLÁSICO: colores de la recreativa original (río azul marino, mediana violeta, troncos marrones, tortugas rojas, camiones blancos, rana verde clara), sin glow, fondo `#000`. RETRO: fósforo verde, zonas por brillo, apoyos en verde medio y rana casi blanca con contorno oscuro (`frogOutline`), scanlines 0.1 y viñeta 0.3 con radios por semidiagonal. Tortuga sumergida en CLÁSICO/RETRO: anillo discontinuo a opacidad plena. NEÓN ⚠ sin cambios por regla: rana y tortugas comparten `--green` y la tortuga sumergida es un anillo al 30 %. Las franjas de zona (río, seguras, seto) superan la luminancia de `--bg-3` en NEÓN (como el original) y en CLÁSICO/RETRO salvo río; el fondo principal (carretera) cumple. A revisar: contorno de la rana en RETRO, anillo discontinuo y criterio de fondo aplicado solo a la carretera. |

## Historial

| Fecha      | Juego | Cambio                                   |
| ---------- | ----- | ---------------------------------------- |
| 2026-11-02 | —     | Creación de la referencia (estado inicial). |
| 2026-11-02 | ROCAS | Sistema base de skins creado y skins CLÁSICO, NEÓN y RETRO aplicados a `rocas`. |
| 2026-11-02 | SERPENTINA | Skins CLÁSICO, NEÓN y RETRO aplicados a `serpentina` (atlas tintado en RETRO, contorno de fruta en CLÁSICO). |
| 2026-11-02 | BLOQUE BUSTER | Skins CLÁSICO, NEÓN y RETRO aplicados a `bloque-buster` (patrones de ladrillo en RETRO). |
| 2026-11-02 | CAÍDA | Skins CLÁSICO, NEÓN y RETRO aplicados a `caida` (brillo × patrón en RETRO, fantasma en contorno); todos los juegos tienen ya skins. |
| 2026-11-03 | RANARIA | Skins CLÁSICO, NEÓN y RETRO aplicados a `ranaria` (paleta de recreativa en CLÁSICO, contorno de rana en RETRO). |
