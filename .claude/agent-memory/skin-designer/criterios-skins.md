---
name: criterios-skins
description: Criterios y trampas aprendidos al aplicar skins (ROCAS, 2026-11-02) útiles para CAÍDA, BLOQUE BUSTER y SERPENTINA
metadata:
  type: project
---

Criterios reutilizables tras el primer juego con skins (ROCAS, 2026-11-02):

- RETRO elegido en **fósforo verde** por el agente (no confirmado por el usuario). **Why:** sin preferencia previa; verde es el CRT más reconocible. **How to apply:** mantenerlo en los demás juegos por coherencia salvo que el usuario pida ámbar; si lo pide, actualizar aquí y en [[MEMORY]].
- En RETRO monocromo, separar elementos por luminancia (rocas en verde medio `#1fb34a`, nave/balas/power-up casi blancos) y medir el peor caso con scanlines + viñeta encima (rocas quedaron en 3.31:1 en esquina: no subir la viñeta de 0.3).
- El fondo efectivo de NEÓN es `#000` (`.crt-screen`), porque los motores usan `clearRect`; `background: null` en la paleta lo conserva.
- El hook de formato pasa Prettier a `app/globals.css` y lo reformatea entero (~2700 líneas). **How to apply:** editar CSS con un script mínimo (o restaurar con git y reaplicar) para no meter ruido en el diff.
- La fuente Press Start 2P no tiene Ó/Á mayúsculas (salen «NEóN», «PUNTUACIóN»): es algo de toda la web, no del selector; avisarlo, no arreglarlo desde un skin.
- El error de consola de Next «URL data during prerendering» en `/jugar/[id]` ya existía (sale también en juegos sin skins): no es regresión.
