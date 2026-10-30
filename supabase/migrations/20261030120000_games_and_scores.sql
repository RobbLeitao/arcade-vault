-- Catálogo de juegos y puntuaciones, con ranking por juego.

create table public.games (
  id text primary key,
  title text not null,
  short text not null,
  long text not null,
  category text not null check (category in ('ARCADE', 'PUZZLE', 'SHOOTER', 'VERSUS')),
  color text not null check (color in ('cyan', 'magenta', 'yellow', 'green')),
  -- Clase CSS de la portada en app/globals.css.
  cover text not null,
  -- true = tiene motor real y admite puntuaciones.
  playable boolean not null default false,
  -- Tope válido por partida.
  max_score integer not null check (max_score > 0),
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

alter table public.games enable row level security;
alter table public.scores enable row level security;

-- games: lectura pública, sin escritura desde la app (las altas son migraciones).
create policy "games are readable by everyone"
  on public.games for select
  using (true);

-- scores: lectura pública (el ranking es público).
create policy "scores are readable by everyone"
  on public.scores for select
  using (true);

-- scores: solo se inserta la propia puntuación, en un juego jugable y dentro del
-- tope. Sin políticas de update ni delete: una puntuación guardada no cambia.
create policy "users insert their own scores"
  on public.scores for insert
  to authenticated
  with check (
    user_id = (select auth.uid())
    and exists (
      select 1
      from public.games g
      where g.id = scores.game_id
        and g.playable
        and scores.score <= g.max_score
    )
  );

-- Mejor marca por jugador y juego, con su posición. Desempate: gana la más antigua.
create view public.leaderboard
with (security_invoker = true) as
select
  b.game_id,
  b.user_id,
  p.username,
  b.score,
  b.achieved_at,
  row_number() over (
    partition by b.game_id
    order by b.score desc, b.achieved_at asc
  ) as rank
from (
  select distinct on (game_id, user_id)
    game_id,
    user_id,
    score,
    created_at as achieved_at
  from public.scores
  order by game_id, user_id, score desc, created_at asc
) b
join public.profiles p on p.id = b.user_id;

-- Una fila por juego, también los que no tienen partidas (plays = 0, best = null).
create view public.game_stats
with (security_invoker = true) as
select
  g.id as game_id,
  count(s.id)::int as plays,
  max(s.score) as best
from public.games g
left join public.scores s on s.game_id = g.id
group by g.id;

insert into public.games
  (id, title, short, long, category, color, cover, playable, max_score, sort_order)
values
  ('bloque-buster', 'BLOQUE BUSTER',
   'Rebota la pelota y destruye muros de neón.',
   'Pilota una nave-paleta y rebota un núcleo de plasma para pulverizar muros de bloques cromáticos. Cada nivel reorganiza la grilla en patrones imposibles. ¿Hasta dónde llegará tu racha?',
   'ARCADE', 'cyan', 'cover-bricks', false, 1000000, 1),
  ('caida', 'CAÍDA',
   'Encaja las piezas antes de que el techo te aplaste.',
   'Piezas geométricas descienden desde la oscuridad. Rótalas, encástralas y limpia líneas para sobrevivir. La velocidad aumenta sin piedad cada 10 líneas.',
   'PUZZLE', 'magenta', 'cover-tetro', false, 1000000, 2),
  ('serpentina', 'SERPENTINA',
   'Crece sin morder tu propia cola.',
   'Una serpiente de luz recorre la grilla buscando núcleos magenta. Cada bocado la alarga y la hace más veloz. Un movimiento en falso y se devora a sí misma.',
   'ARCADE', 'green', 'cover-snake', false, 1000000, 3),
  ('gloton', 'GLOTÓN',
   'Devora puntos y escapa de los fantasmas.',
   'Un círculo glotón patrulla un laberinto coleccionando puntos luminosos. Cuatro espectros lo persiguen, pero cada cierto tiempo aparece una píldora que invierte los papeles.',
   'ARCADE', 'yellow', 'cover-glot', false, 1000000, 4),
  ('invasores', 'INVASORES',
   'Defiende el planeta de filas alienígenas.',
   'Olas de pixeles hostiles descienden formación tras formación. Mueve tu cañón en horizontal y abre fuego con precisión, antes de que toquen la superficie.',
   'SHOOTER', 'green', 'cover-invaders', false, 1000000, 5),
  ('rocas', 'ROCAS',
   'Pulveriza asteroides en gravedad cero.',
   'Tu nave triangular flota en vacío absoluto. Dispara y rota para dividir rocas en fragmentos cada vez más pequeños. Recoge el power-up 3x para disparar en abanico durante 5 segundos.',
   'SHOOTER', 'yellow', 'cover-rocas', true, 1000000, 6),
  ('ranaria', 'RANARIA',
   'Cruza la autopista de pixeles.',
   'Salta entre carriles de coches a toda velocidad y troncos a la deriva en el río. Llega a los nenúfares antes de que se acabe el tiempo.',
   'ARCADE', 'green', 'cover-rana', false, 1000000, 7),
  ('duelo-pixel', 'DUELO PIXEL',
   'Dos paletas. Una pelota. Reflejos máximos.',
   'El duelo más puro: dos paletas verticales se enfrentan por rebotar una pelota luminosa. Modo solitario contra la CPU o partida local a dos jugadores.',
   'VERSUS', 'cyan', 'cover-duelo', false, 1000000, 8);
