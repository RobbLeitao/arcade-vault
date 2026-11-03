# Sugerencias de game-planner

Estados: `sugerido` / `recomendado` / `elegido` (tiene spec en `specs/`) / `descartado` / `implementado` (en `ENGINES` o `playable = true`).

| Fecha      | Título      | id            | Categoría | Color | Origen                              | Total | Estado      | Motivo                                                                                   |
| ---------- | ----------- | ------------- | --------- | ----- | ----------------------------------- | ----- | ----------- | ---------------------------------------------------------------------------------------- |
| 2026-11-02 | INVASORES   | `invasores`   | SHOOTER   | green | Simulado del catálogo, sin referencia | 26/30 | recomendado | Mecánica de tirador fijo distinta de ROCAS, controles mínimos, puntuación acotable por oleadas. |
| 2026-11-02 | RANARIA     | `ranaria`     | ARCADE    | green | Simulado del catálogo, sin referencia | 24/30 | sugerido    | Mecánica de cruce por carriles nueva, pero sería el tercer ARCADE jugable.               |
| 2026-11-02 | DUELO PIXEL | `duelo-pixel` | VERSUS    | cyan  | Simulado del catálogo, sin referencia | 22/30 | sugerido    | Única categoría sin jugable, pero puntuación poco competitiva y IA de CPU a ajustar.     |
| 2026-11-02 | GEMAS       | `gemas`       | PUZZLE    | magenta | Nuevo (género intercambio de tres) | 22/30 | recomendado | Segundo PUZZLE, sin física ni IA; tope exacto con jugadas limitadas (50.000). Alternativa a INVASORES. |
| 2026-11-02 | GLOTÓN      | `gloton`      | ARCADE    | yellow | Simulado del catálogo, sin referencia | 21/30 | sugerido    | Encaje visual perfecto, pero tercer ARCADE y riesgo alto por laberinto + 4 perseguidores con IA. |
| 2026-11-02 | CERCO       | `cerco`       | ARCADE    | cyan  | Nuevo (género captura de territorio) | 21/30 | sugerido    | Mecánica inédita y muy neón, pero relleno de áreas y colisiones con la estela elevan el riesgo. |
| 2026-11-02 | ESQUIVA     | `esquiva`     | SHOOTER   | magenta | Nuevo (esquivar proyectiles)       | 26/30 | recomendado | Ronda 3 (20 juegos). Supervivencia 180 s sin disparar, sin assets ni IA; tope exacto 3.000. |
| 2026-11-02 | ASCENSO     | `ascenso`     | ARCADE    | magenta | Nuevo (saltador vertical)           | 26/30 | recomendado | Ronda 3. Mecánica vertical inédita, 2 teclas, 5 tramos; tope exacto 6.000.               |
| 2026-11-02 | PULSO       | `pulso`       | ARCADE    | yellow | Nuevo (timing de un botón)          | 25/30 | sugerido    | Ronda 3. Riesgo mínimo, tope 3.500, pero poco profundo.                                   |
| 2026-11-02 | BALUARTE    | `baluarte`    | SHOOTER   | cyan  | Nuevo (defensa radial)              | 24/30 | sugerido    | Ronda 3. Torreta central con escudo de 8 segmentos, 10 oleadas; tope 2.500.              |
| 2026-11-02 | CIRCUITO    | `circuito`    | PUZZLE    | green | Nuevo (girar casillas de cable)     | 24/30 | recomendado | Ronda 3. Niveles generados siempre resolubles, sin diseño manual; tope 2.000.            |
| 2026-11-02 | ESTELA      | `estela`      | ARCADE    | cyan  | Nuevo (runner por tramos)           | 24/30 | sugerido    | Ronda 3. 6 tramos finitos, tope 3.000; salto variable delicado.                          |
| 2026-11-02 | PÉNDULO     | `pendulo`     | ARCADE    | yellow | Nuevo (columpio con gancho)         | 24/30 | sugerido    | Ronda 3. Un botón, mecánica inédita, tope 3.000; ajuste de física del péndulo.          |
| 2026-11-02 | HOYO        | `hoyo`        | PUZZLE    | green | Nuevo (minigolf cenital)            | 24/30 | recomendado | Ronda 3. Por turnos, física simple, 9 hoyos; tope exacto 4.500.                          |
| 2026-11-02 | ENJAMBRE    | `enjambre`    | SHOOTER   | magenta | Nuevo (twin-stick de arena)        | 23/30 | sugerido    | Ronda 3. 12 oleadas, tope 3.420; ghosting de teclado.                                     |
| 2026-11-02 | PRISMA      | `prisma`      | PUZZLE    | cyan  | Nuevo (láser y espejos)             | 23/30 | sugerido    | Ronda 3. Mejor estética del bloque; 10 niveles a mano; tope 1.500.                       |
| 2026-11-02 | APAGÓN      | `apagon`      | PUZZLE    | yellow | Nuevo (invertir luces vecinas)      | 23/30 | sugerido    | Ronda 3. El más simple; solución matemática conocida resta competitividad; tope 2.250.   |
| 2026-11-02 | PISTA       | `pista`       | ARCADE    | magenta | Nuevo (contrarreloj cenital)       | 23/30 | sugerido    | Ronda 3 (propuesto como CIRCUITO, renombrado por colisión). 3 circuitos × 3 vueltas; tope 9.000. |
| 2026-11-02 | PARÁBOLA    | `parabola`    | SHOOTER   | yellow | Nuevo (artillería con viento)       | 23/30 | sugerido    | Ronda 3. Complejidad baja, 5 niveles × 5 dianas; tope 12.500.                            |
| 2026-11-02 | COMPÁS      | `compas`      | ARCADE    | magenta | Nuevo (ritmo de 4 carriles)        | 23/30 | sugerido    | Ronda 3 (propuesto como PULSO, renombrado por colisión). Riesgo de sincronía de audio; tope 144.000. |
| 2026-11-02 | CENTELLA    | `centella`    | SHOOTER   | cyan  | Nuevo (scroll vertical)             | 22/30 | sugerido    | Ronda 3. 5 sectores guionizados; riesgo de parecer otro INVASORES; tope 4.500.          |
| 2026-11-02 | ECO         | `eco`         | PUZZLE    | magenta | Nuevo (memoria de secuencias)      | 22/30 | sugerido    | Ronda 3. Depende de WebAudio; poca dispersión en ranking; tope 3.250.                    |
| 2026-11-02 | FUGA        | `fuga`        | ARCADE    | green | Nuevo (laberinto contrarreloj)      | 22/30 | sugerido    | Ronda 3. Sin IA, láseres intermitentes, 8 laberintos; tope 3.200.                        |
| 2026-11-02 | EMPUJE      | `empuje`      | PUZZLE    | yellow | Nuevo (empujar cajas)               | 20/30 | sugerido    | Ronda 3. Niveles a mano caros y bloqueos sin salida; tope 1.500.                          |
| 2026-11-02 | CAVERNA     | `caverna`     | SHOOTER   | yellow | Nuevo (scroll horizontal en túnel)  | 19/30 | sugerido    | Ronda 3. El más caro del bloque shooter; tope 4.800.                                      |
| 2026-11-02 | RESORTE     | `resorte`     | ARCADE    | cyan  | Nuevo (pinball vertical)            | 19/30 | sugerido    | Ronda 3. Física de flippers arriesgada; sin tope natural (1.000.000).                    |
