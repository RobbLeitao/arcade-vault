# Juegos implementados

Juegos jugables de Arcade Vault (`games.playable = true` en Supabase), en el orden del catálogo (`sort_order`).

> Datos consultados en la base de datos el 2026-11-02. Las partidas y el mejor puntaje cambian con el uso.

## Resumen

| #   | Juego         | ID              | Categoría | Color   | Puntaje máx. | Spec                                                                 |
| --- | ------------- | --------------- | --------- | ------- | ------------ | -------------------------------------------------------------------- |
| 1   | BLOQUE BUSTER | `bloque-buster` | ARCADE    | cyan    | 2.080        | [08-juego-bloque-buster](../specs/08-juego-bloque-buster.md)         |
| 2   | CAÍDA         | `caida`         | PUZZLE    | magenta | 1.000.000    | [07-juego-caida](../specs/07-juego-caida.md)                         |
| 3   | SERPENTINA    | `serpentina`    | ARCADE    | green   | 2.970        | [09-juego-serpentina](../specs/09-juego-serpentina.md)               |
| 4   | ROCAS         | `rocas`         | SHOOTER   | yellow  | 1.000.000    | [05-juego-rocas-asteroides](../specs/05-juego-rocas-asteroides.md)   |

## BLOQUE BUSTER

> Rebota la pelota y destruye muros de neón.

Mueve la paleta con las flechas y rebota la pelota para pulverizar cinco muros de bloques de neón: parrilla, pirámide, tablero de ajedrez, filas con huecos y un marco con cruz. Cada bloque suma 10 puntos, tienes 3 vidas y la pelota gana un 10 % de velocidad en cada nivel. Desde la pausa puedes saltar a cualquier nivel.

- **ID:** `bloque-buster` · **Categoría:** ARCADE · **Color:** cyan · **Portada:** `cover-bricks`
- **Puntaje máximo (RLS):** 2.080
- **Motor:** `lib/games/bloque-buster/` (`createBloqueBuster`), canvas 800×600, 5 niveles seleccionables en la pausa
- **Assets:** `public/games/bloque-buster/` (`ball-bounce.mp3`, `break-sound.mp3`)
- **Estadísticas:** 3 partidas · mejor puntaje 390

## CAÍDA

> Encaja las piezas antes de que el techo te aplaste.

Ocho piezas geométricas, incluida una tuerca con hueco, descienden por un pozo de 10×20. Muévelas, rótalas y suéltalas de golpe para completar líneas; una pieza fantasma marca dónde aterrizarán y verás la siguiente. Cada 10 líneas subes de nivel y la caída se acelera.

- **ID:** `caida` · **Categoría:** PUZZLE · **Color:** magenta · **Portada:** `cover-tetro`
- **Puntaje máximo (RLS):** 1.000.000
- **Motor:** `lib/games/caida/` (`createCaida`), canvas 420×600
- **Estadísticas:** 2 partidas · mejor puntaje 976

## SERPENTINA

> Crece sin morder tu propia cola.

Una serpiente de luz recorre una cuadrícula de 20×15 buscando fruta. Muévela con las flechas o WASD: cada pieza suma 10 puntos y la alarga, y cada 5 frutas subes de nivel y ganas velocidad. Los muros se atraviesan y reaparecen por el lado opuesto; solo pierdes si te muerdes la cola.

- **ID:** `serpentina` · **Categoría:** ARCADE · **Color:** green · **Portada:** `cover-snake`
- **Puntaje máximo (RLS):** 2.970
- **Motor:** `lib/games/serpentina/` (`createSerpentina`), canvas 800×600; precarga el atlas de frutas antes de arrancar
- **Assets:** `public/games/serpentina/fruits.png`
- **Estadísticas:** 1 partida · mejor puntaje 140

## ROCAS

> Pulveriza asteroides en gravedad cero.

Tu nave triangular flota en vacío absoluto. Dispara y rota para dividir rocas en fragmentos cada vez más pequeños. Recoge el power-up 3x para disparar en abanico durante 5 segundos.

- **ID:** `rocas` · **Categoría:** SHOOTER · **Color:** yellow · **Portada:** `cover-rocas`
- **Puntaje máximo (RLS):** 1.000.000
- **Motor:** `lib/games/asteroids/` (`createAsteroids`), canvas 800×600
- **Estadísticas:** 4 partidas · mejor puntaje 1.380

## Pendientes (en catálogo, aún no jugables)

GLOTÓN (`gloton`), INVASORES (`invasores`), RANARIA (`ranaria`) y DUELO PIXEL (`duelo-pixel`) están en la tabla `games` con `playable = false`; en la plataforma se muestran como simulados.
