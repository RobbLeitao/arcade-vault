# Checklist base para specs de juego

Sustituye `<id>` por el id del juego en la tabla `games` y `<Título>` por su título. Añade los criterios y riesgos específicos del juego.

## Equivalencias conocidas (reutilizar siempre la fila)

| Referencia                    | Fila de `games` | Estado             |
| ----------------------------- | --------------- | ------------------ |
| `02-asteroids`                | `rocas`         | Hecho (SPEC 05/06) |
| `03-tetris`                   | `caida`         | Hecho (SPEC 07)    |
| `04-arkanoid`                 | `bloque-buster` | Pendiente          |
| Snake sin referencia          | `serpentina`    | Pendiente          |
| Pac-Man sin referencia        | `gloton`        | Pendiente          |
| Space Invaders sin referencia | `invasores`     | Pendiente          |
| Frogger sin referencia        | `ranaria`       | Pendiente          |
| Pong sin referencia           | `duelo-pixel`   | Pendiente          |

Comprueba el estado real mirando `playable` en las migraciones; esta tabla puede quedar desactualizada.

## Plantillas SQL

Juego con equivalente (lo habitual):

```sql
-- supabase/migrations/<timestamp>_<id>_playable.sql
update public.games
set playable = true,
    long = '<descripción fiel a las mecánicas portadas>'
where id = '<id>';
```

Juego nuevo:

```sql
insert into public.games
  (id, title, short, long, category, color, cover, playable, max_score, sort_order)
values
  ('<id>', '<TÍTULO>', '<short>', '<long>',
   '<ARCADE|PUZZLE|SHOOTER|VERSUS>', '<cyan|magenta|yellow|green>',
   'cover-<id>', true, 1000000, <siguiente sort_order>);
```

No hay que tocar RLS, vistas ni `submitScore`: la política de inserción ya acepta cualquier juego con `playable = true` dentro de `max_score`, y `leaderboard` y `game_stats` incluyen todos los juegos.

## Criterios de aceptación base

- [ ] `npm run lint` y `npm run build` terminan sin errores ni warnings de Cache Components o hidratación.
- [ ] `select playable from games where id = '<id>'` devuelve `true`, y `ENGINES["<id>"]` existe.
- [ ] `/jugar/<id>` muestra un `<canvas>` con la partida lista y no muestra `.game-arena`.
- [ ] Los demás juegos no jugables (por ejemplo `/jugar/serpentina`) conservan simulación y `.game-arena`.
- [ ] ROCAS se comporta igual que antes (controles, pausa, HUD, ranking).
- [ ] Los controles del juego funcionan y la página no hace scroll al pulsarlos.
- [ ] La puntuación del HUD de la plataforma coincide con las reglas de puntos del juego original.
- [ ] El HUD muestra solo los stats que el juego tiene (si no tiene vidas, no aparece Vidas).
- [ ] `PAUSA` congela el juego y muestra "EN PAUSA"; `REANUDAR` continúa sin saltos bruscos.
- [ ] Tras pulsar `PAUSA` y `REANUDAR` con el ratón, la tecla de acción del juego no vuelve a activar el botón.
- [ ] El fin natural de la partida abre el modal "FIN DEL JUEGO" con la puntuación final, y no se dibuja ningún "GAME OVER" en el canvas.
- [ ] `FIN` durante la partida abre el mismo modal con la puntuación actual y detiene el juego.
- [ ] "JUGAR DE NUEVO" empieza una partida limpia sin duplicar el bucle (la velocidad no cambia tras reiniciar varias veces).
- [ ] Escribir las iniciales en el modal (incluida la barra espaciadora) no mueve ni acciona el juego.
- [ ] Con sesión iniciada, "GUARDAR PUNTUACIÓN" crea una fila en `scores` con `game_id = '<id>'`, el `user_id` del usuario y la puntuación final mostrada.
- [ ] Esa marca aparece en `/salon-de-la-fama` (pestaña <Título>) y en el panel de `/juegos/<id>` sin vaciar la caché a mano, y `Partidas` sube en 1.
- [ ] Sin sesión, el modal conserva el campo de iniciales, guarda en `localStorage["av_scores"]` y muestra `INICIA SESIÓN PARA ENTRAR AL RANKING`; no se crea fila en `scores`.
- [ ] Al pulsar `SALIR` o navegar a otra ruta se cancela el bucle y se quitan los listeners: las teclas del juego vuelven a su comportamiento normal y no hay errores en consola.
- [ ] Con React StrictMode en desarrollo hay un único bucle activo.
- [ ] Los colores del canvas salen de las variables del tema y el dibujo tiene brillo neón.
- [ ] El canvas conserva su proporción a 1280 px y a 390 px, y a 390 px `/jugar/<id>` no tiene scroll horizontal.
- [ ] `/juegos/<id>` ya no muestra `PRÓXIMAMENTE` y la descripción corresponde a las mecánicas reales.
- [ ] `get_advisors` de seguridad no reporta avisos nuevos tras la migración.
- [ ] La consola del navegador no muestra errores ni warnings en `/jugar/<id>` durante una partida completa.
- [ ] Las demás pantallas se ven y funcionan igual que antes.

## Riesgos base

| Riesgo                                                                           | Mitigación                                                                                                                     |
| -------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------ |
| StrictMode monta el efecto dos veces y deja dos bucles o dos juegos de listeners | `destroy` cancela `requestAnimationFrame` y quita los listeners; sin estado global; la carga dinámica usa bandera `cancelled`. |
| Tras `PAUSA` con el ratón, la tecla de acción vuelve a activar el botón          | `preventDefault` en esa tecla mientras la partida está activa; si no basta, quitar el foco del botón tras el clic.             |
| Las teclas del juego hacen scroll en la página                                   | `preventDefault` solo con la partida activa y el foco fuera de campos de texto.                                                |
| El motor atrapa teclas y rompe el campo de iniciales del modal                   | Con la partida terminada el motor ignora las teclas y no llama a `preventDefault`.                                             |
| Re-renders de React a 60 fps por los callbacks                                   | Callbacks solo al cambiar el valor; valores continuos a pasos de 0.1 s.                                                        |
| `dt` grande al reanudar tras pausa o cambio de pestaña                           | `dt` acotado a 0.05 s y `lastTime` reiniciado en `resume`.                                                                     |
| `shadowBlur` penaliza el rendimiento en equipos modestos                         | Uso moderado y ajuste en el último paso sin tocar mecánicas.                                                                   |
| Sin controles táctiles el juego no es jugable en móvil                           | Aceptado: solo se garantiza que no haya scroll horizontal. Táctil va en otra spec.                                             |
| Juego `playable = true` sin motor real contamina el ranking                      | La migración y la entrada en `ENGINES` van en la misma spec; no se activa antes de que el motor funcione.                      |
| Cliente falsificado envía una puntuación alta dentro del tope                    | Aceptado (SPEC 06). Anti-trampas serio queda para otra spec; `max_score` se ajusta con una migración.                          |
| Assets o sonidos del original con licencia o peso desconocidos                   | Por defecto fuera de alcance; si se incluyen, la spec lo declara y se revisa el peso.                                          |

## Fuera de alcance por defecto

- Controles táctiles o gamepad.
- Sonido y música (salvo decisión explícita).
- Pausa con `Esc`/`P`, pausa automática al perder foco, ajuste a `devicePixelRatio` y pantalla completa.
- Mecánicas nuevas que no estén en el original.
- Subir a Supabase las puntuaciones de `localStorage`.
- Anti-trampas, rate limit y Realtime.
- Tests automatizados (no hay runner).
- Otros juegos del catálogo.
