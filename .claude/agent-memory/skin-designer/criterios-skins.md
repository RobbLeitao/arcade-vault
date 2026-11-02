---
name: criterios-skins
description: Criterios y trampas aprendidos al aplicar skins a los 4 juegos (2026-11-02): luminancia y patrones RETRO, viñeta, pieza fantasma, sprites, NEÓN ⚠, servidor dev
metadata:
  type: project
---

Criterios reutilizables tras el primer juego con skins (ROCAS, 2026-11-02):

- RETRO en **fósforo verde**: confirmado por el usuario el 2026-11-02 para todos los juegos (ver [[MEMORY]]).
- En RETRO monocromo, separar elementos por luminancia (rocas en verde medio `#1fb34a`, nave/balas/power-up casi blancos) y medir el peor caso con scanlines + viñeta encima (rocas quedaron en 3.31:1 en esquina: no subir la viñeta de 0.3).
- El fondo efectivo de NEÓN es `#000` (`.crt-screen`), porque los motores usan `clearRect`; `background: null` en la paleta lo conserva.
- El hook de formato pasa Prettier a `app/globals.css` y lo reformatea entero (~2700 líneas). **How to apply:** editar CSS con un script mínimo (o restaurar con git y reaplicar) para no meter ruido en el diff.
- La fuente Press Start 2P no tiene Ó/Á mayúsculas (salen «NEóN», «PUNTUACIóN»): es algo de toda la web, no del selector; avisarlo, no arreglarlo desde un skin.
- El error de consola de Next «URL data during prerendering» en `/jugar/[id]` ya existía (sale también en juegos sin skins): no es regresión.
- Sprites (SERPENTINA, 2026-11-02): medir el contraste píxel a píxel en el navegador (`getImageData` sobre el PNG servido por el dev server, sin dependencias), no solo el color medio. Un halo claro detrás del sprite **baja** el contraste de los sprites oscuros. Enfoque validado: RETRO = copia del atlas tintada por brillo en un canvas fuera de pantalla (en caché por skin y con la imagen original como respaldo); CLÁSICO = sprite original + contorno plano claro (silueta con `source-in`, dibujada en 8 desplazamientos). La carga del atlas en `registry.load` no se toca.
- Si NEÓN (look original, intocable) falla un criterio, se marca ⚠ en la referencia con la causa en lugar de modificarlo.
- RETRO con muchos tipos de elemento (BLOQUE BUSTER, 7 colores de ladrillo, 2026-11-02): el verde solo no da 7 brillos separables. Enfoque usado: 3 brillos × 3 patrones (macizo / hueco / rayado, campo `patterns` de la paleta) y comprobar **solo los pares que son vecinos en algún nivel** (los colores vecinos forman un K4, así que hacen falta brillo y patrón a la vez). Aplicable a las 7 piezas de CAÍDA.
- Para verificar juegos que se pierden sin input (BLOQUE BUSTER), un piloto automático en `browser_evaluate` que lee píxeles del canvas y despacha `keydown`/`keyup` en `window` permite jugar mientras se cambia de skin.
- Con otro skin-designer trabajando a la vez: no ejecutar `npm run build`, verificar con `npm run lint` + `npx tsc --noEmit`; editar registro/referencia/memoria con ediciones mínimas tras volver a leerlos.
- CAÍDA (2026-11-02): con 8 piezas que pueden tocarse todas entre sí (grafo completo) hacen falta 8 combinaciones únicas de brillo × patrón; de las 9 posibles se descarta «bajo + hueco» (el marco fino y oscuro es lo menos legible).
- Pieza fantasma: en CLÁSICO/RETRO un relleno al 20 % no llega a 3:1; usar contorno (CLÁSICO, color de la pieza) y en RETRO contorno **discontinuo** para no confundirla con las piezas huecas.
- Viñeta: los radios `H*0.45 → W*0.65` de los motores 800×600 casi coinciden en un canvas estrecho (420×600) y dan un borde duro; calcular los radios con la diagonal (`0.6·d → d`).
- Puerto 3000: puede haber un `next dev` del mismo repo arrancado por el usuario aunque te digan que está libre; Next 16 no deja arrancar un segundo servidor (sale con error). Verificar contra el existente y no pararlo: solo se para lo que arranca el agente.
