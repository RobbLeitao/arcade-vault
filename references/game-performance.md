# Rendimiento de los juegos

Estado de cada juego de `ENGINES` frente a los antipatrones de la [SPEC 12](../specs/12-rendimiento-ranaria.md). Lo mantiene el agente `game-performance-booster` (`@game-performance-booster <id>`).

Antipatrones (numeración del agente):

1. `shadowBlur` en el `draw()` de cada frame.
2. Fondo estático redibujado en cada frame.
3. Efectos del skin pintados en cada frame.
4. `setSkin` sin invalidar las cachés.
5. `dt` variable / `MAX_DT`.
6. Emisiones al HUD sin cambio de valor.
7. Asignaciones evitables por frame.

✅ resuelto o no aplica · ❌ presente · ⚠ presente, justificado · ? sin auditar

## Estado por juego

| Juego (id)      | 1   | 2   | 3   | 4   | 5   | 6   | 7   | fps · p95 (NEÓN, sin throttling / CPU ×4) | Fecha      | Nota                                                                       |
| --------------- | --- | --- | --- | --- | --- | --- | --- | ----------------------------------------- | ---------- | -------------------------------------------------------------------------- |
| `ranaria`       | ✅  | ✅  | ✅  | ✅  | ✅  | ?   | ?   | 12,9 · 100,2 → 27,5 · 50,5 / 15,2 · 83,7 → 26,4 · 66,7 | 2026-11-03 | SPEC 12. Puntos 6 y 7 sin auditar por el agente.                            |
| `rocas`         | ✅  | ✅  | ✅  | ✅  | ✅  | ✅  | ✅  | 58,6 · 16,9 → 59,4 · 16,8 / 58,0 · 16,9 → 60,0 · 16,9 | 2026-11-03 | Glow cacheado (`sprites.ts`) + trazo vectorial; efectos RETRO cacheados; paso fijo 1/240 con `DRAG ** (dt·60)`; compactación sin `filter`. A revisar: glow girado difiere ≤8/255 NEÓN y ≤13/255 RETRO (CLÁSICO idéntico); CPU ×10 baja en NEÓN/RETRO (34,6→28,3 y 33,3→29,2 fps). Medido bajo carga paralela. |
| `caida`         | ✅  | ✅  | ✅  | ✅  | ✅  | ✅  | ✅  | no concluyente (carga paralela); script/frame NEÓN 0,43→0,28 ms, ×4 2,61→1,87 ms | 2026-11-03 | Sprites de pieza/fantasma, capas cacheadas de tablero, panel y efectos; paso fijo 1/240 (una fila por frame). Aspecto ≤2/255. A revisar: «SIGUIENTE» con `fillText` por frame; cámara lenta desde <10 fps. Re-medir en solitario. |
| `bloque-buster` | ✅  | ✅  | ✅  | ✅  | ✅  | ✅  | ✅  | 33,3 · 50,1 → 41,4 · 50,0 / 29,0 · 50,1 → 56,8 · 33,1 (no concluyente) | 2026-11-03 | Sprites (ladrillos, destellos, paleta por fracción de 1/24 px, pelota), capa `board` + `effects`, paso fijo 1/240. Hilo ocupado menor. A revisar: colisiones por paso en vez de por frame; pelota con filtrado subpíxel (≤14/255 en el borde). Re-medir en solitario. |
| `serpentina`    | ✅  | ✅  | ✅  | ✅  | ✅  | ✅  | ✅  | 60,0 · 16,8 → 59,9 · 16,8 / 60,0 · 16,9 → 60,0 · 16,8 | 2026-11-03 | Sprites (solo con glow), fondo y efectos cacheados, paso fijo 1/240 con ≤1 paso por frame. Aspecto ≤1/255. Con serpiente corta ya daba 60 fps; con 30 segmentos el dibujo en NEÓN baja de 3,7-4,2 a 1,1-1,3 ms/frame. Medido en solitario. A revisar: CLÁSICO dibuja la serpiente directa (sin sprites); cámara lenta desde <10 fps. |

## Mediciones

### ranaria (2026-11-03)

Ver la sección «Mediciones» de la SPEC 12 (producción, misma sesión, tres skins, sin throttling, CPU ×4 y ×10).

### rocas (2026-11-03)

Producción, 10 s con la nave girando y disparando, antes/después intercalados (A/B/A/B) **bajo carga paralela de 4 agentes**. Par final contiguo con poca carga, NEÓN (fps · p95): sin throttling 58,6 · 16,9 → 59,4 · 16,8; CPU ×4 58,0 · 16,9 → 60,0 · 16,9; CPU ×10 34,6 · 50,1 → 28,3 · 50,2 (RETRO ×10 33,3 → 29,2). Con ×10 copiar el glow cuesta más en el hilo principal que el `shadowBlur` (que paga la GPU, no frenada por el throttling). Paso fijo: a 60/120/144 Hz y frames de 50 ms la nave recorre lo mismo (≤0,7 %); antes, un 30-38 % menos a 120/144 Hz. Capturas: CLÁSICO 0/255, NEÓN ≤8/255, RETRO ≤13/255 (solo glow de formas que giran).

### caida (2026-11-03)

Producción, 10 s con semilla fija y caídas rápidas, **bajo carga paralela**: fps y p95 no concluyentes (NEÓN ×4 sin cambios de código: 59,5 y 55,8). Script por frame (antes → después; ×1 / ×4 / ×10): CLÁSICO 0,45→0,36 / 3,70→2,23 / 11,22→10,34 ms; NEÓN 0,43→0,28 / 2,61→1,87 / 13,08→7,64; RETRO 0,67→0,33 / 4,38→1,71 / 22,93→7,06. Periodo de caída: antes 1005,6-1006,9 ms según Hz y ×4 con frames de 200 ms; después 1000 ms exactos (×2 con 200 ms). Capturas: CLÁSICO 0/255, NEÓN y RETRO ≤2/255.

### bloque-buster (2026-11-03)

Producción, 10 s con un bot que sigue la pelota, **bajo carga paralela**: fps variaron hasta ×2 entre tandas sin cambios. Ronda 2 (fps · p95 · % hilo), NEÓN: ×1 33,3 · 50,1 · 7 % → 41,4 · 50,0 · 9 %; ×4 29,0 · 50,1 · 48 % → 56,8 · 33,1 · 66 %. % de hilo con ×4: CLÁSICO 58→44 %, RETRO 81→42 %. A/B intercalado en la misma página: el nuevo gana en los 3 pares (22,7→24,1, 13,8→16,4, 11,6→14,1 fps); JS de dibujo 0,24-0,48 → 0,18-0,23 ms/frame. Paso fijo: la pelota termina a ≤1 paso de diferencia entre 60/120/144 Hz y 50 ms (antes, hasta 20 px). Capturas ≤2/255 salvo la pelota con decimales (≤14/255 en el borde).

### serpentina (2026-11-03)

Producción (`next start -p 3104`), **en solitario**, builds antes/después alternados en la misma sesión (se descartó una primera tanda bajo carga paralela). rAF 10 s con serpiente de 3 piezas: 57-60 fps · p95 16,8-16,9 ms en todos los skins y throttlings, antes y después (el rAF no separa los builds). Coste de dibujo con 30 segmentos (ms/frame, ×1 / ×4): CLÁSICO 2,13-2,40 → 2,05-2,20 / 2,32-2,40 → 2,22-2,23; NEÓN 3,72-4,20 → 1,07-1,20 / 4,42-4,80 → 1,40-2,03; RETRO 2,68-4,58 → 0,95-1,97 / 3,65-4,45 → 1,47-2,55. Paso fijo (pasos en 2 s): 13 a 60/120/144 Hz y 50 ms en ambos; a 15 fps 9 → 12; a 200 ms 3 → 5 (cámara lenta sin saltos). Capturas: CLÁSICO 0/255, NEÓN y RETRO ≤1/255.

## Regresiones y costes externos

- Fondo global del sitio (`.av-bg`, `.av-noise` en `app/layout.tsx` y `app/globals.css`): unos 20 fps de coste en `/jugar/*` con la GPU integrada (SPEC 12). Fuera del alcance del agente; candidato a una spec propia.

## Historial

| Fecha      | Juego     | Cambio                                                     |
| ---------- | --------- | ---------------------------------------------------------- |
| 2026-11-03 | —         | Creado el registro con el agente `game-performance-booster`. |
| 2026-11-03 | `ranaria` | Estado inicial tomado de la SPEC 12.                       |
| 2026-11-03 | `rocas`   | Glow cacheado y trazo vectorial, efectos RETRO cacheados, paso fijo 1/240 (`DRAG` escalado por `dt`), compactación sin `filter`. Medido bajo carga paralela. |
| 2026-11-03 | `caida`   | Sprites de pieza y fantasma, capas cacheadas de tablero, panel y efectos, paso fijo 1/240 (una fila por frame). Medido bajo carga paralela. |
| 2026-11-03 | `bloque-buster` | Sprites con glow, capa de ladrillos y de efectos, paso fijo 1/240, destellos sin arrays por paso. Medido bajo carga paralela. |
| 2026-11-03 | `serpentina` | Sprites cacheados con glow, fondo y efectos en canvas, paso fijo 1/240 s con ≤1 paso por frame; aspecto ≤1/255. Medido en solitario. |
