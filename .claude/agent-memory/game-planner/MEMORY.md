# Memoria de game-planner

- Historial de candidatos: [suggestions.md](suggestions.md)

## Estado del catálogo (2026-11-02)

- Todas las referencias de `references/started-games/` (02-asteroids, 03-tetris, 04-arkanoid) ya están portadas. Los próximos juegos salen de los simulados (`gloton`, `invasores`, `ranaria`, `duelo-pixel`) o son nuevos.
- Precedente de `max_score` acotado: BLOQUE BUSTER (2080) y SERPENTINA (2970) fijan un tope exacto; ROCAS y CAÍDA siguen en 1.000.000.
- Ronda 1 (2026-11-02): recomendado INVASORES (26/30). Ronda 2 (mismo día, sin spec aún de INVASORES): alternativas nuevas, recomendada GEMAS (22/30). INVASORES sigue siendo la mejor puntuada.
- Ronda 3 (mismo día): 20 candidatos nuevos en 4 bloques paralelos (shooter, puzzle, plataformas, deportes/física). Destacados: ESQUIVA y ASCENSO (26/30), CIRCUITO y HOYO (24/30).
- El `check` de `games.category` solo admite ARCADE/PUZZLE/SHOOTER/VERSUS y `color` solo cyan/magenta/yellow/green (todos ya usados). Plataformas y deportes caen en ARCADE/PUZZLE salvo migración de categoría.
- Al lanzar en paralelo, repartir por género y pasar la lista de nombres ya usados: en la ronda 3 hubo colisiones (ESQUIVA duplicado; CIRCUITO y PULSO renombrados a PISTA y COMPÁS).

## Preferencias y decisiones del usuario

- Ninguna registrada todavía (el usuario no ha elegido ni descartado candidatos explícitamente).

## Notas de criterio

- GLOTÓN ya se propuso en la ronda 2 (21/30); su riesgo (IA de perseguidores) sigue siendo el freno.
- Saltador vertical (ASCENSO) y defensa (BALUARTE, radial con teclado) ya propuestos en la ronda 3. Queda sin proponer: ciclos de luz (IA rival).
