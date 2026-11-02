# Memoria de skin-designer

- Estado de skins por juego: [references/game-with-themes.md](../../../references/game-with-themes.md) (fuente de verdad, no se duplica aquí).

## Preferencias y decisiones del usuario

- 2026-11-02: cada juego debe tener al menos 3 skins: CLÁSICO (por defecto), NEÓN y RETRO, y cada uno debe verse bien en modo oscuro.
- 2026-11-02: **un solo juego por invocación, solo el que indique el usuario**. Nunca aplicar skins a todos ni a otros juegos.
- 2026-11-02: NEÓN = el look actual de los motores (variables CSS de `app/globals.css` con glow). CLÁSICO es un skin nuevo (arcade plano, sin glow) y es el default de los juegos con skins.
- 2026-11-02: RETRO = monitor CRT / fósforo, paleta limitada.
- 2026-11-02: el jugador elige el skin en el menú de pausa de `/jugar/[id]` (junto al selector de nivel); se recuerda por juego en localStorage (`av:skin:<gameId>`). Solo aparece en juegos con `skins: true` en el registro.
- 2026-11-02: el agente implementa (no solo spec).
- 2026-11-02 (confirmado por el usuario): RETRO va en **fósforo verde** (no ámbar) en todos los juegos.
- 2026-11-02 (confirmado): en CLÁSICO se aceptan contornos planos añadidos para llegar al contraste mínimo (p. ej. contorno de frutas en SERPENTINA).
- 2026-11-02 (confirmado): **NEÓN no se toca nunca**; si incumple un criterio se marca ⚠ en la referencia y no se corrige.
- 2026-11-02 (confirmado): el rayado denso de los ladrillos de BLOQUE BUSTER en RETRO está aprobado.

## Criterios aprendidos

- [Criterios y trampas de skins](criterios-skins.md) — luminancia/patrones RETRO, viñeta en canvas estrecho, pieza fantasma, fondo NEÓN #000, sprites, piloto, servidor dev ajeno
