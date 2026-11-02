# Memoria de game-jam

- Historial de jams: [jams.md](jams.md)
- Candidatos de `game-planner` (solo lectura): [../game-planner/suggestions.md](../game-planner/suggestions.md)

## Preferencias y decisiones del usuario

- Exige diseños ORIGINALES dentro del género: nada de formaciones, enemigos, nombres, sprites ni reglas icónicas de un título comercial (jam INVASORES, 2026-11-02). Explicar en la spec qué reglas del clásico se evitan.
- Quiere `max_score` finito y justificado por oleada/nivel, con el cálculo en la spec (jam INVASORES).
- Controles mínimos (izquierda/derecha + acción + pausa del contrato) cuando lo pide el tema.

## Notas de criterio

- `goToLevel` que conserva la puntuación (patrón de BLOQUE BUSTER, SPEC 08) permite repetir niveles y superar el tope; en las jams se usa «saltar de nivel = partida nueva desde ese nivel» para que `max_score` sea exacto.
- Validar los datos de niveles (longitud de filas, recuentos, suma de `max_score`) con un script en el scratchpad antes de escribir las specs.
- Última migración vista el 2026-11-02: `20261031140000_serpentina_playable.sql`; la jam INVASORES reservó `20261102120000_invasores_playable.sql`.
