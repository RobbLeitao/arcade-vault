# Memoria de skin-designer

- Estado de skins por juego: [references/game-with-themes.md](../../../references/game-with-themes.md) (fuente de verdad, no se duplica aquí).

## Preferencias y decisiones del usuario

- 2026-11-02: cada juego debe tener al menos 3 skins: CLÁSICO (por defecto), NEÓN y RETRO, y cada uno debe verse bien en modo oscuro.
- 2026-11-02: **un solo juego por invocación, solo el que indique el usuario**. Nunca aplicar skins a todos ni a otros juegos.
- 2026-11-02: NEÓN = el look actual de los motores (variables CSS de `app/globals.css` con glow). CLÁSICO es un skin nuevo (arcade plano, sin glow) y es el default de los juegos con skins.
- 2026-11-02: RETRO = monitor CRT / fósforo, paleta limitada.
- 2026-11-02: el jugador elige el skin en el menú de pausa de `/jugar/[id]` (junto al selector de nivel); se recuerda por juego en localStorage (`av:skin:<gameId>`). Solo aparece en juegos con `skins: true` en el registro.
- 2026-11-02: el agente implementa (no solo spec).
