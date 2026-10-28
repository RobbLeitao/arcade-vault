-- Perfiles de jugador: nombre público único, creado por trigger al registrarse.

create table public.profiles (
  id uuid primary key references auth.users (id) on delete cascade,
  username text not null,
  created_at timestamptz not null default now(),
  constraint profiles_username_format check (username ~ '^[A-Z0-9_]{3,10}$')
);

create unique index profiles_username_key on public.profiles (username);

alter table public.profiles enable row level security;

-- Lectura pública (el nombre será público en el Salón). Sin políticas de
-- insert/update/delete: el perfil lo crea solo el trigger.
create policy "profiles are readable by everyone"
  on public.profiles for select
  using (true);

-- Alta automática del perfil.
--   * Registro con correo: usa raw_user_meta_data->>'username' tal cual (ya
--     validado en el cliente). Si está repetido o mal formado, el insert falla
--     y el registro se rechaza.
--   * OAuth (sin 'username'): deriva el nombre de full_name / user_name / name o
--     del prefijo del correo, lo normaliza y añade sufijo numérico si ya existe.
create function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  chosen text := nullif(new.raw_user_meta_data ->> 'username', '');
  base text;
  candidate text;
  n int := 0;
begin
  if chosen is not null then
    insert into public.profiles (id, username) values (new.id, upper(chosen));
    return new;
  end if;

  base := upper(regexp_replace(
    coalesce(
      nullif(new.raw_user_meta_data ->> 'full_name', ''),
      nullif(new.raw_user_meta_data ->> 'user_name', ''),
      nullif(new.raw_user_meta_data ->> 'name', ''),
      split_part(coalesce(new.email, ''), '@', 1)
    ),
    '[^A-Za-z0-9_]', '', 'g'
  ));

  if length(base) < 3 then
    base := base || 'PLAYER';
  end if;
  base := left(base, 10);

  candidate := base;
  while exists (select 1 from public.profiles where username = candidate) loop
    n := n + 1;
    candidate := left(base, 10 - length(n::text)) || n::text;
  end loop;

  insert into public.profiles (id, username) values (new.id, candidate);
  return new;
end;
$$;

-- Solo lo ejecuta el trigger, no se expone como RPC.
revoke execute on function public.handle_new_user() from public, anon, authenticated;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();
