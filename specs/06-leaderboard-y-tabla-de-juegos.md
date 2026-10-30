# SPEC 06 — Tabla de juegos y leaderboard en Supabase

> **Estado:** Aprobado
> **Depende de:** SPEC 01, SPEC 04, SPEC 05
> **Fecha:** 2026-10-30
> **Objetivo:** Crear en Supabase las tablas `games` y `scores` con un ranking por juego y conectar catálogo, detalle, reproductor y Salón de la Fama a esos datos reales, de modo que ROCAS guarde las puntuaciones de quien tiene sesión y las muestre en el leaderboard.

---

## Por qué existe esta spec

Hoy todo lo que tiene que ver con puntuaciones es de mentira. El Salón de la Fama (`components/hall-of-fame.tsx`) y el detalle del juego (`app/juegos/[id]/page.tsx`) pintan `seededScores()`, una lista falsa generada con una semilla. `best` y `plays` de cada juego están escritos a mano en `lib/games.ts`. `saveScore` solo escribe en `localStorage` (`av_scores`), así que una puntuación no sale del navegador. Las SPEC 04 y 05 dejaron esto pendiente a propósito: la 04 entregó la identidad (`profiles`) y la 05, el primer juego real (ROCAS). Esta spec une las dos piezas: da a las puntuaciones un sitio donde vivir y vuelve el catálogo una tabla, para que añadir juegos sea insertar una fila y no editar código en varios sitios.

Solo ROCAS es real. Los otros siete juegos siguen con puntuación aleatoria simulada y no entran al ranking, pero el esquema queda preparado para que lo hagan cuando se porten.

---

## Alcance

**Dentro:**

- Migración SQL en `supabase/migrations/` con las tablas `games` y `scores`, sus índices, RLS, las vistas `leaderboard` y `game_stats`, y el seed de los 8 juegos actuales (ver Modelo de datos).
- Tabla `games` como fuente de verdad del catálogo. Biblioteca, Home (vista previa), detalle, reproductor y Salón la leen de Supabase. `lib/games.ts` conserva solo los tipos, `CATS` y utilidades de formato.
- Cliente de Supabase sin cookies para lecturas públicas cacheables (`lib/supabase/public.ts`) y funciones de lectura en `lib/games-data.ts` (`getGames`, `getGame`, `getTopScores`), con Cache Components.
- Server Action `submitScore(gameId, score)` en `app/jugar/[id]/actions.ts`. Exige sesión verificada con `getUser()`, valida la entrada, inserta en `scores` con el cliente de servidor (RLS activa) e invalida la caché del ranking.
- `components/game-player.tsx`: en un juego con `playable = true`, quien tiene sesión guarda en Supabase al pulsar "GUARDAR PUNTUACIÓN"; el invitado sigue guardando en `localStorage` y ve un aviso de que su marca no entra al ranking. Los juegos con `playable = false` conservan el comportamiento actual.
- Salón de la Fama (`/salon-de-la-fama`): una pestaña por juego con el podio y el Top 10 reales (mejor marca por jugador), y la fila "TU MEJOR MARCA" con la posición real del usuario con sesión.
- Detalle del juego (`/juegos/[id]`): `Partidas`, `Mejor global` y el panel "MEJORES PUNTUACIONES" salen de Supabase.
- `GameCard` y la Biblioteca: `MEJOR PUNTUACIÓN` real. `—` cuando el juego aún no tiene puntuaciones.
- Estados vacíos y de error en los tres sitios donde se muestra un ranking (Salón, detalle, tarjetas).
- Eliminar `seededScores`, `PLAYERS` y los campos `best` y `plays` escritos a mano de `lib/games.ts`.
- Reglas CSS nuevas, al final de `app/globals.css`, solo si hacen falta para los estados vacío y de error. No se tocan reglas existentes.

**Fuera de alcance (para futuras specs):**

- Portar los otros 7 juegos. Siguen simulados, guardan en `localStorage` y su pestaña en el Salón muestra "PRÓXIMAMENTE".
- Subir a Supabase las puntuaciones que ya existan en `localStorage["av_scores"]`. Se quedan donde están.
- Datos de ejemplo (jugadores o puntuaciones falsas) en la base de datos.
- Sección "ACTIVIDAD EN VIVO" y `HOME_STATS` de la Home (`lib/home.ts`). Siguen siendo estáticos.
- Anti-trampas serio (repetición de partida, validación en servidor del estado del juego, firma de puntuaciones) y rate limit de envíos.
- Puntuaciones de invitados en el ranking.
- Filtros temporales (HOY, SEMANA, HISTÓRICO), paginación del Top 10 y perfiles públicos de jugador.
- Borrar o editar puntuaciones desde la UI, y moderación.
- Realtime (el ranking no se actualiza solo sin recargar).
- Panel de administración para altas y cambios de juegos: se hacen con migraciones SQL.
- Tipos generados de Supabase (`database.types.ts`): los tipos de fila se escriben a mano en `lib/games.ts`.
- Tests automatizados (no hay runner configurado).

---

## Modelo de datos

```sql
-- supabase/migrations/<timestamp>_games_and_scores.sql

create table public.games (
  id text primary key,                    -- slug de la URL: 'rocas', 'bloque-buster'...
  title text not null,
  short text not null,
  long text not null,
  category text not null check (category in ('ARCADE', 'PUZZLE', 'SHOOTER', 'VERSUS')),
  color text not null check (color in ('cyan', 'magenta', 'yellow', 'green')),
  cover text not null,                    -- clase CSS de la portada: 'cover-rocas'
  playable boolean not null default false, -- true = tiene motor real y admite scores
  max_score integer not null check (max_score > 0), -- tope válido por partida
  sort_order smallint not null,
  created_at timestamptz not null default now()
);

create table public.scores (
  id uuid primary key default gen_random_uuid(),
  game_id text not null references public.games (id) on delete cascade,
  user_id uuid not null references public.profiles (id) on delete cascade,
  score integer not null check (score >= 0),
  created_at timestamptz not null default now()
);

create index scores_game_score_idx on public.scores (game_id, score desc, created_at);
create index scores_user_idx on public.scores (user_id);
```

```sql
-- RLS (en la misma migración)
alter table public.games enable row level security;
alter table public.scores enable row level security;

-- games: lectura pública, sin escritura desde la app.
create policy "games are readable by everyone"
  on public.games for select using (true);

-- scores: lectura pública (el ranking es público).
create policy "scores are readable by everyone"
  on public.scores for select using (true);

-- scores: solo se inserta la propia puntuación, en un juego jugable y dentro del tope.
-- Sin políticas de update ni delete: una puntuación guardada no se modifica.
create policy "users insert their own scores"
  on public.scores for insert to authenticated
  with check (
    user_id = (select auth.uid())
    and exists (
      select 1 from public.games g
      where g.id = game_id and g.playable and score <= g.max_score
    )
  );
```

```sql
-- Vistas (security_invoker = true: respetan la RLS de las tablas base)

-- Mejor marca por jugador y juego, con su posición. Desempate: gana la más antigua.
create view public.leaderboard with (security_invoker = true) as
select
  b.game_id, b.user_id, p.username, b.score, b.achieved_at,
  row_number() over (partition by b.game_id order by b.score desc, b.achieved_at asc) as rank
from (
  select distinct on (game_id, user_id)
    game_id, user_id, score, created_at as achieved_at
  from public.scores
  order by game_id, user_id, score desc, created_at asc
) b
join public.profiles p on p.id = b.user_id;

-- Una fila por juego, también los que no tienen partidas (0 y null).
create view public.game_stats with (security_invoker = true) as
select g.id as game_id, count(s.id)::int as plays, max(s.score) as best
from public.games g
left join public.scores s on s.game_id = g.id
group by g.id;
```

```ts
// lib/games.ts (los tipos sustituyen a la constante GAMES)
export type GameCategory = "ARCADE" | "PUZZLE" | "SHOOTER" | "VERSUS";
export type GameColor = "cyan" | "magenta" | "yellow" | "green";

export interface Game {
  id: string;
  title: string;
  short: string;
  long: string;
  cat: GameCategory; // games.category
  cover: string;
  color: GameColor;
  playable: boolean;
  best: number | null; // game_stats.best; null = sin puntuaciones
  plays: number; // game_stats.plays
}

export interface ScoreRow {
  rank: number;
  name: string; // leaderboard.username
  score: number;
  date: string; // dd/mm/aaaa, de achieved_at
}

export function formatPlays(n: number): string; // 842 -> "842", 15600 -> "15.6K"
```

```ts
// app/jugar/[id]/actions.ts
export type SubmitScoreResult =
  { ok: true } | { ok: false; error: "AUTH" | "INVALID" | "FAILED" };

export async function submitScore(
  gameId: string,
  score: number,
): Promise<SubmitScoreResult>;
```

Seed (en la misma migración): los 8 juegos de `lib/games.ts` con sus ids, textos, categorías, colores y portadas actuales, `sort_order` 1 a 8 en el orden actual y `max_score = 1000000`. Solo `rocas` lleva `playable = true`.

Convenciones:

- Los ids de `games` son los de hoy (`bloque-buster`, `caida`, `serpentina`, `gloton`, `invasores`, `rocas`, `ranaria`, `duelo-pixel`) porque ya son las URLs y la clave `game` de `av_scores`.
- `games.cover` guarda el nombre de la clase CSS de `app/globals.css`. Acopla BD y estilos, pero evita un mapa en código que haya que sincronizar al añadir un juego.
- Las puntuaciones son enteros. Cada partida guardada es una fila: `plays` es `count(*)` de `scores` y no cuenta partidas de invitados ni las que no se guardan.
- La fecha del ranking es la de `created_at` de la mejor marca, en formato `dd/mm/aaaa` y zona horaria `Europe/Madrid`, calculada igual en servidor y cliente para no romper la hidratación.
- Las lecturas públicas (`games`, `game_stats`, `leaderboard`) usan el cliente sin cookies y `"use cache"` con etiquetas (`games`, `scores`). `submitScore` usa el cliente de servidor con cookies (`lib/supabase/server.ts`) y, tras insertar, invalida la etiqueta `scores`.
- "Tu mejor marca" en el Salón se pide desde el navegador a la vista `leaderboard` filtrando por `username` (único). Así la página sigue siendo cacheable y no depende de la sesión.
- Mensajes de error fijos (mayúsculas): `INICIA SESIÓN PARA ENTRAR AL RANKING`, `NO PUDIMOS GUARDAR LA PUNTUACIÓN. INTÉNTALO DE NUEVO.`, `NO PUDIMOS CARGAR EL RANKING.`, `NO PUDIMOS CARGAR LOS JUEGOS.`
- Estados vacíos: `AÚN NO HAY PUNTUACIONES. SÉ EL PRIMERO.` (juego jugable sin partidas) y `PRÓXIMAMENTE` (juego con `playable = false`).
- Textos de la UI en español, en el estilo de las specs anteriores.

---

## Plan de implementación

Antes de empezar, leer en `node_modules/next/dist/docs/` las guías de Cache Components (`"use cache"`, `cacheLife`, `cacheTag`, `updateTag`), de Server Actions y de `generateStaticParams`, como exige `AGENTS.md`. Para Supabase, consultar la documentación vigente con `search_docs` del MCP (vistas con `security_invoker`, políticas con `auth.uid()`). Leer `lib/supabase/server.ts`, `lib/session.tsx`, `components/game-player.tsx`, `components/hall-of-fame.tsx` y `app/juegos/[id]/page.tsx`. Invocar `/frontend-design` para los estados vacío y de error, como indica `CLAUDE.md`. Antes de la migración, inspeccionar el proyecto con `list_tables`.

1. Crear la migración `supabase/migrations/<timestamp>_games_and_scores.sql` con `games`, `scores`, índices, RLS, vistas y seed, y aplicarla (MCP `apply_migration` o Supabase CLI). Ejecutar `get_advisors` de seguridad. Verificación: `list_tables` muestra `games` y `scores` con RLS activo; `select * from game_stats` devuelve 8 filas con `plays = 0` y `best = null`; el asesor de seguridad no reporta avisos nuevos.
2. Probar las políticas con SQL en una rama o con un usuario de prueba que luego se borra: insertar como `authenticated` una puntuación propia en `rocas` funciona; en otro `user_id`, en `caida` (no jugable) o con `score` mayor que `max_score` falla; `update` y `delete` fallan; `anon` puede leer pero no insertar. Verificación: los siete casos dan el resultado esperado.
3. Crear `lib/supabase/public.ts` (cliente de `@supabase/supabase-js` con la clave publishable, sin sesión ni cookies) y `lib/games-data.ts` con `getGames()`, `getGame(id)` y `getTopScores()` marcadas con `"use cache"`, `cacheLife` y `cacheTag`. `getTopScores()` pide con una sola consulta las filas con `rank <= 10` de todos los juegos y las agrupa por `game_id`. Ajustar `lib/games.ts` a los tipos nuevos, añadir `formatPlays` y conservar `GAMES` solo hasta el paso siguiente. Verificación: `npm run lint` y `npm run build` pasan.
4. Migrar la Biblioteca y la Home a la BD: `app/biblioteca/page.tsx` y `app/page.tsx` llaman a `getGames()` y pasan los juegos por props a `Library` y `HomePage` (vista previa con los 6 primeros). `GameCard` muestra `MEJOR PUNTUACIÓN` con `—` si es `null`. Verificación: `/biblioteca` muestra 8 tarjetas con `—`, la búsqueda y las categorías siguen filtrando y la Home muestra 6 mini-tarjetas.
5. Migrar detalle y reproductor: `app/juegos/[id]/page.tsx` y `app/jugar/[id]/page.tsx` usan `getGame` y `generateStaticParams` desde `getGames()`. El detalle muestra `Partidas` con `formatPlays`, `Mejor global` y el panel "MEJORES PUNTUACIONES" desde `getTopScores()` (Top 10 del juego, estado vacío o `PRÓXIMAMENTE`). Verificación: `/juegos/rocas` muestra el estado vacío y `/juegos/caida` muestra `PRÓXIMAMENTE`; un id inexistente sigue mostrando la pantalla 404.
6. Crear `app/jugar/[id]/actions.ts` con `submitScore`: `getUser()` (sin sesión devuelve `AUTH`), comprueba que `score` sea entero finito y `>= 0` y que `gameId` sea un texto (si no, `INVALID`), inserta con el cliente de servidor y, si va bien, invalida la etiqueta `scores`; cualquier otro error devuelve `FAILED` sin detalles internos. Verificación: compila; llamada de prueba sin sesión devuelve `AUTH`.
7. Conectar `components/game-player.tsx`: en un juego jugable con sesión, "GUARDAR PUNTUACIÓN" llama a `submitScore`, con botón deshabilitado y texto de carga mientras espera, y no permite un segundo envío de la misma partida. Se oculta el campo de iniciales (el nombre es el del perfil). Con éxito muestra `▸ PUNTUACIÓN GUARDADA_`; con error muestra el mensaje fijo con `role="alert"` y deja reintentar. El invitado sigue con `saveScore` y ve `INICIA SESIÓN PARA ENTRAR AL RANKING`. Los juegos no jugables no cambian. Verificación: una partida de ROCAS con sesión crea una fila en `scores` con el `user_id` correcto y la puntuación final.
8. Migrar el Salón: `app/salon-de-la-fama/page.tsx` carga `getGames()` y `getTopScores()` y pasa ambos a `HallOfFame`. Las pestañas son los 8 juegos. Podio y tabla salen de las filas reales (huecos del podio con "VACANTE" si hay menos de 3), con estado vacío o `PRÓXIMAMENTE`. Con sesión, un efecto cliente pide la fila del usuario en `leaderboard` por `username` y muestra "TU MEJOR MARCA" con su posición real, o `AÚN NO TIENES MARCA EN <JUEGO>` si no tiene. Verificación: tras guardar una puntuación en ROCAS aparece en el Salón y en el detalle.
9. Limpiar: borrar `GAMES`, `PLAYERS` y `seededScores` de `lib/games.ts` y comprobar con búsqueda que nada más los usa (`lib/home.ts` y `app/acerca-de/page.tsx` solo importan tipos). Añadir las clases CSS de los estados vacío y de error si hacen falta. Revisar `/biblioteca`, `/juegos/rocas` y `/salon-de-la-fama` a 1280 px y 390 px, con capturas en `.playwright-screenshots/`. Verificación: `npm run lint` y `npm run build` pasan sin warnings y no hay scroll horizontal a 390 px.

---

## Criterios de aceptación

- [ ] `npm run lint` y `npm run build` terminan sin errores ni warnings de Cache Components o hidratación.
- [ ] `list_tables` muestra `games` y `scores` con RLS activo, y `get_advisors` de seguridad no reporta avisos nuevos tras la migración.
- [ ] `supabase/migrations/` contiene la migración y `select count(*) from games` devuelve 8, con `playable = true` solo en `rocas`.
- [ ] Con la clave publishable y sin sesión se pueden leer `games`, `scores`, `leaderboard` y `game_stats`, pero `insert`, `update` y `delete` sobre `games` y `scores` fallan.
- [ ] Un usuario autenticado puede insertar una puntuación propia en `rocas` y no puede hacerlo con otro `user_id`, en `caida`, con `score` negativo ni con `score > max_score`.
- [ ] Nadie puede hacer `update` ni `delete` sobre `scores` con la clave publishable.
- [ ] `/biblioteca` muestra 8 tarjetas procedentes de `games`, con `MEJOR PUNTUACIÓN` igual a `—` mientras no haya puntuaciones, y la búsqueda y los filtros de categoría siguen funcionando.
- [ ] La Home muestra las 6 primeras tarjetas por `sort_order` en "JUEGOS DISPONIBLES AHORA".
- [ ] `/juegos/rocas` muestra `Partidas` y `Mejor global` reales y el estado vacío `AÚN NO HAY PUNTUACIONES. SÉ EL PRIMERO.` mientras no hay filas.
- [ ] `/juegos/caida` y los demás juegos no jugables muestran `PRÓXIMAMENTE` en el panel de puntuaciones, y `/juegos/no-existe` muestra la pantalla 404 ("JUEGO NO ENCONTRADO"). Con Cache Components el código HTTP de la respuesta es 200, igual que antes de esta spec.
- [ ] Con sesión iniciada, terminar una partida de ROCAS y pulsar "GUARDAR PUNTUACIÓN" crea una fila en `scores` con el `user_id` del usuario, `game_id = 'rocas'` y la puntuación final mostrada en el modal.
- [ ] Mientras se guarda, el botón queda deshabilitado, y tras guardar no se puede enviar la misma partida otra vez; "JUGAR DE NUEVO" habilita un nuevo envío.
- [ ] Con sesión iniciada, el modal de fin de partida de ROCAS no muestra el campo de iniciales y el nombre mostrado es el del perfil.
- [ ] Si `submitScore` falla (por ejemplo, sin red), el modal muestra `NO PUDIMOS GUARDAR LA PUNTUACIÓN. INTÉNTALO DE NUEVO.` y el botón permite reintentar.
- [ ] Sin sesión, el modal de ROCAS conserva el campo de iniciales, guarda en `localStorage["av_scores"]` y muestra `INICIA SESIÓN PARA ENTRAR AL RANKING`; no se crea ninguna fila en `scores`.
- [ ] El modal de los juegos no jugables (por ejemplo `/jugar/caida`) se comporta exactamente como antes.
- [ ] Llamar a `submitScore` sin sesión devuelve `{ ok: false, error: "AUTH" }`, y con una puntuación no entera, negativa o `NaN` devuelve `INVALID`, sin insertar nada.
- [ ] Tras guardar una puntuación, aparece en `/salon-de-la-fama` (pestaña ROCAS) y en el panel de `/juegos/rocas` sin tener que vaciar la caché a mano, y `Partidas` sube en 1.
- [ ] El ranking muestra una sola fila por jugador (su mejor marca): un usuario con tres partidas guardadas aparece una vez, con la puntuación más alta.
- [ ] Con dos jugadores con la misma puntuación, queda por delante el que la logró antes.
- [ ] El Salón muestra como máximo 10 filas por juego, el podio con los tres primeros y `VACANTE` en los huecos que falten.
- [ ] Con sesión iniciada, "TU MEJOR MARCA EN ROCAS" muestra el nombre del usuario, su mejor puntuación y su posición real aunque esté fuera del Top 10, y `AÚN NO TIENES MARCA EN ROCAS` si no ha jugado. Sin sesión no aparece.
- [ ] La pestaña de un juego no jugable en el Salón muestra `PRÓXIMAMENTE`.
- [ ] Si Supabase no responde, las pantallas afectadas muestran `NO PUDIMOS CARGAR EL RANKING.` o `NO PUDIMOS CARGAR LOS JUEGOS.` en lugar de una pantalla en blanco.
- [ ] No quedan referencias a `seededScores`, `PLAYERS` ni `GAMES` en el código, y `lib/games.ts` ya no contiene `best` ni `plays` escritos a mano.
- [ ] Buscar `service_role` en el código, `.env.example` y `.next/static` no da ningún resultado.
- [ ] La consola del navegador no muestra errores ni warnings en `/biblioteca`, `/juegos/rocas`, `/jugar/rocas` y `/salon-de-la-fama`, y a 390 px esas rutas no tienen scroll horizontal.
- [ ] Home, Acerca de, acceso, el menú de sesión y el juego ROCAS (controles, pausa, HUD) se ven y funcionan igual que antes.

---

## Decisiones

- **Sí:** `games` como fuente de verdad del catálogo en la BD. Añadir un juego pasa a ser una migración con un `insert`, no tocar `lib/games.ts` en cinco sitios.
- **No:** dejar `games` como tabla mínima solo para la clave foránea. Obligaba a mantener dos listas sincronizadas, justo lo que esta spec quiere evitar.
- **No:** tabla espejo sin conectar a la UI. Sin lectores reales, el esquema no se validaría hasta que alguien lo necesite.
- **Sí:** columna `playable`. Hace explícito que solo ROCAS admite puntuaciones y deja listo el interruptor para los demás: portar un juego es poner `playable = true`, sin cambios de esquema.
- **Sí:** solo ROCAS guarda en Supabase. Los otros siete generan puntuaciones aleatorias; en el ranking serían ruido, no datos.
- **No:** sembrar puntuaciones o jugadores falsos. El ranking vacío es honesto y las filas falsas necesitarían perfiles ficticios o una columna de nombre libre.
- **Sí:** el catálogo y `Partidas` salen de `game_stats` y `best` es `null` sin partidas. Se eliminan los números inventados de `lib/games.ts` (incluido el `24` de DUELO PIXEL, que no era una puntuación).
- **Sí:** `plays` es el conteo de filas de `scores`. Es un dato real sin escrituras anónimas. Se acepta que no cuente partidas de invitados ni las no guardadas.
- **No:** un contador `plays` incrementado al iniciar cada partida. Obligaría a permitir escrituras sin sesión, con riesgo de abuso.
- **Sí:** el envío pasa por una Server Action con sesión verificada con `getUser()`, y la RLS repite la validación. Dos capas: la acción da errores controlados y la base de datos protege aunque alguien llame a la API directamente.
- **No:** insert directo desde el cliente. Era más simple pero la validación solo dependía de la RLS y de lo que el navegador mande.
- **No:** puntuaciones de invitados en el ranking. Necesitarían un nombre libre suplantable y un captcha o rate limit.
- **Sí:** el invitado conserva `saveScore` en `localStorage`, con un aviso visible. No se pierde la función actual y se le explica por qué no entra al ranking.
- **Sí:** tope por juego (`games.max_score`) comprobado en la política de inserción. Corta valores absurdos con una regla que vive en la BD. No evita un cliente que falsifique una puntuación dentro del rango; eso es otra spec.
- **Sí:** `max_score = 1000000` para todos los juegos al inicio. Es un tope generoso para que ninguna partida legítima de ROCAS se rechace; se ajusta con una migración cuando haya datos reales.
- **No:** rate limit en esta spec. `lib/rate-limit.ts` guarda estado en memoria y no es fiable en serverless; hacerlo bien pide almacenamiento compartido.
- **Sí:** una puntuación guardada es inmutable (sin políticas de `update` ni `delete`). Simplifica la integridad del ranking; los borrados, si hacen falta, son tarea de administración.
- **Sí:** ranking de mejor marca por jugador, Top 10 por juego. Con todas las partidas, un jugador activo llenaría el podio él solo.
- **Sí:** desempate por antigüedad. Gana quien llegó primero a esa puntuación, y el resultado es determinista (`row_number`, no `rank`).
- **Sí:** el ranking y las estadísticas se resuelven en vistas SQL con `security_invoker = true`. El cálculo vive junto a los datos y las vistas respetan la RLS en lugar de saltársela.
- **No:** filtros temporales (HOY, SEMANA, HISTÓRICO). Suman zonas horarias y consultas por rango; el Salón ya cumple su función sin ellos.
- **Sí:** las lecturas públicas usan un cliente sin cookies con `"use cache"` y etiquetas, e `submitScore` invalida la etiqueta `scores`. Mantiene las páginas cacheables bajo Cache Components, y la persona que guarda ve su marca al instante.
- **Sí:** "TU MEJOR MARCA" se pide desde el navegador. Así el Salón no lee cookies, sigue siendo cacheable y no hay dos versiones de la página según la sesión.
- **Sí:** `getTopScores()` trae el Top 10 de todos los juegos en una consulta. Son como mucho 80 filas y las pestañas cambian sin red.
- **Sí:** `games.cover` guarda la clase CSS de la portada. Se acopla a `globals.css` a cambio de no tener un mapa en código.
- **Sí:** se conservan los ids actuales de los juegos. Ya son las URLs y la clave `game` de `av_scores`.
- **No:** subir las `av_scores` locales. Son fáciles de falsear, vienen de juegos simulados y exigen lógica de deduplicación.
- **No:** `database.types.ts` generado en esta spec. Son tres tablas y dos vistas; se escribe a mano lo mínimo y se generan tipos cuando haya más superficie.
- **No:** fallback al catálogo de `lib/games.ts` si Supabase falla. Dos fuentes de verdad vuelven a aparecer por la puerta de atrás; se muestra un mensaje de error.
- **Sí:** los textos de la UI siguen en español, en el estilo de las specs anteriores.

---

## Riesgos

| Riesgo                                                                                                                   | Mitigación                                                                                                                                                                            |
| ------------------------------------------------------------------------------------------------------------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Cache Components no permite leer `cookies()` dentro de `"use cache"`                                                     | Las lecturas cacheadas usan `lib/supabase/public.ts`, sin cookies. Solo `submitScore` (Server Action) usa el cliente con cookies. El criterio de build sin warnings lo cubre.         |
| El ranking queda desactualizado tras guardar una marca                                                                   | `submitScore` invalida la etiqueta `scores`. Un criterio comprueba que la marca aparece en el Salón y el detalle sin vaciar la caché a mano.                                          |
| La política de inserción con subconsulta a `games` falla o es lenta                                                      | `games` tiene 8 filas y `id` es clave primaria. Se prueba cada caso (jugable, no jugable, tope) en el paso 2.                                                                         |
| Cliente falsificado envía una puntuación alta dentro del tope                                                            | Aceptado en esta spec: solo se corta lo burdo. Anti-trampas serio queda para otra spec y el tope se puede bajar con una migración.                                                    |
| Una persona envía miles de puntuaciones                                                                                  | Aceptado por ahora: el ranking solo cuenta la mejor de cada jugador, así que no desplaza a otros, pero `scores` crece. Rate limit con almacenamiento compartido queda para otra spec. |
| El build necesita Supabase (`generateStaticParams` lee `games`)                                                          | Aceptado. Si la BD no responde en el build, falla de forma visible en lugar de publicar un catálogo vacío.                                                                            |
| Si Supabase falla en tiempo de ejecución, caen Biblioteca, detalle y Salón                                               | Las funciones de lectura devuelven un estado de error y las pantallas muestran `NO PUDIMOS CARGAR LOS JUEGOS.` / `NO PUDIMOS CARGAR EL RANKING.`. No hay catálogo de reserva.         |
| Hydration mismatch en fechas del ranking                                                                                 | Formato `dd/mm/aaaa` con zona horaria fija (`Europe/Madrid`), igual en servidor y cliente.                                                                                            |
| `username` único pero no inmutable: si alguna spec futura permite cambiarlo, "TU MEJOR MARCA" por `username` se rompería | Hoy el nombre no se puede editar (SPEC 04). Si eso cambia, la consulta pasa a filtrar por `user_id`.                                                                                  |
| Doble envío de la misma partida (doble clic o StrictMode)                                                                | Botón deshabilitado durante el envío y un marcador de "guardada" por partida. Un criterio lo comprueba.                                                                               |
| El modal retiene una puntuación y la persona pierde la sesión antes de guardar                                           | `submitScore` devuelve `AUTH` y el modal muestra `INICIA SESIÓN PARA ENTRAR AL RANKING`; la partida no se pierde, queda disponible el guardado local.                                 |
| Un juego que pasa a `playable = true` sin motor real contamina el ranking                                                | Cambiar `playable` solo se hace en una migración, junto con la spec que porta el juego.                                                                                               |

---

## Lo que **no** está en esta spec

- Portar los otros 7 juegos al ranking (siguen simulados y con `PRÓXIMAMENTE`).
- Subir las puntuaciones antiguas de `localStorage` o sembrar datos de ejemplo.
- Puntuaciones de invitados en el ranking.
- Anti-trampas serio, repetición de partidas y rate limit.
- "ACTIVIDAD EN VIVO" y estadísticas de la Home con datos reales.
- Filtros temporales, paginación, perfiles públicos de jugador y Realtime.
- Panel de administración de juegos y moderación de puntuaciones.
- Tipos generados de Supabase y tests automatizados.

Cada uno, si llega, va en su propia spec.
