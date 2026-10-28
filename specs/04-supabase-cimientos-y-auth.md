# SPEC 04 — Supabase: cimientos y autenticación real

> **Estado:** Aprobado
> **Depende de:** SPEC 01, SPEC 02
> **Fecha:** 2026-10-28
> **Objetivo:** Conectar la app a Supabase (clientes SSR y refresco de sesión) y reemplazar el login simulado de `/acceso` por Supabase Auth con correo y contraseña, Google y GitHub, más un perfil con nombre de jugador único.

---

## Por qué existe esta spec

Hoy el "login" de `lib/session.tsx` solo guarda un nombre en `localStorage` (`av_user`): cualquiera puede ser cualquiera y no hay identidad que respalde las puntuaciones. Antes de guardar puntuaciones reales (otra spec) hace falta una identidad verificable. Esta spec instala Supabase y entrega esa identidad, manteniendo la forma de `useSession()` para que el resto de la UI casi no cambie. El proyecto Supabase ya existe (`xqyvdjdxlvehwbhcxggu`, vinculado en `.mcp.json`) y no tiene tablas.

---

## Alcance

**Dentro:**

- Dependencias `@supabase/supabase-js` y `@supabase/ssr`.
- Clientes de Supabase: navegador (`lib/supabase/client.ts`), servidor (`lib/supabase/server.ts`) y helper de refresco de sesión para el proxy (`lib/supabase/proxy.ts`).
- `proxy.ts` en la raíz que solo refresca la sesión (cookies). No bloquea ni redirige ninguna ruta.
- Variables de entorno `NEXT_PUBLIC_SUPABASE_URL` y `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` en `.env.local` y `.env.example`.
- Migración SQL versionada en `supabase/migrations/` con la tabla `profiles`, su trigger de alta, índices y RLS.
- Registro con correo, contraseña y nombre de jugador; inicio de sesión con correo y contraseña.
- Inicio de sesión con Google y GitHub (OAuth) mediante `/auth/callback`.
- Nombre de jugador autogenerado para quien entra con OAuth (ver Modelo de datos).
- Confirmación de correo activada: tras registrarse con correo se muestra un aviso y no se inicia sesión hasta confirmar.
- Cierre de sesión real desde el nav.
- `lib/session.tsx` reescrito sobre Supabase manteniendo `user.name`, `signOut` y `saveScore`.
- `components/auth-form.tsx` conectado a Supabase, con estados de carga y error.
- "JUGAR COMO INVITADO" se mantiene como sesión sin Supabase (ver Decisiones).

**Fuera de alcance (para futuras specs):**

- Guardar puntuaciones en Supabase. `saveScore` sigue escribiendo en `localStorage` (`av_scores`).
- Alimentar el Salón de la Fama y la Home con datos reales.
- Editar el nombre de jugador, cambiar contraseña, recuperar contraseña ("olvidé mi contraseña").
- Cambio o borrado de cuenta, avatar, perfil público.
- Reenvío del correo de confirmación.
- Bloqueo de rutas por sesión (rutas privadas).
- SMTP propio para los correos de Auth (se usa el SMTP por defecto de Supabase, con su límite).
- Anonymous Sign-ins de Supabase, MFA, magic link, otros proveedores OAuth.
- Rate limiting propio, captcha y tests automatizados (no hay runner configurado).
- Usar `service_role` en la app.

---

## Modelo de datos

```sql
-- supabase/migrations/<timestamp>_profiles.sql
create table public.profiles (
  id uuid primary key references auth.users (id) on delete cascade,
  username text not null,
  created_at timestamptz not null default now(),
  constraint profiles_username_format check (username ~ '^[A-Z0-9_]{3,10}$')
);

create unique index profiles_username_key on public.profiles (username);

alter table public.profiles enable row level security;

-- Lectura pública (el nombre será público en el Salón); sin políticas de
-- insert/update/delete: el perfil lo crea solo el trigger.
create policy "profiles are readable by everyone"
  on public.profiles for select using (true);
```

```sql
-- Trigger de alta (security definer, search_path fijo, en el mismo archivo)
-- public.handle_new_user() after insert on auth.users:
--   1. Toma raw_user_meta_data->>'username' si viene del registro con correo.
--   2. Si no existe (OAuth), lo deriva de full_name / user_name / name o, en último
--      caso, del prefijo del correo.
--   3. Normaliza: mayúsculas, solo A-Z0-9_, recortado a 10, mínimo 3 (relleno "PLAYER").
--   4. Si ya existe, acorta y añade sufijo numérico hasta que sea único.
```

```ts
// lib/session.tsx (forma pública sin cambios incompatibles)
export interface SessionUser {
  name: string; // profiles.username
}

interface SessionContextValue {
  user: SessionUser | null; // null = invitado o sin sesión
  signOut: () => Promise<void>;
  saveScore: (entry: Omit<ScoreEntry, "at">) => void; // sigue en localStorage
}
// Se elimina signIn(name): la sesión la crea Supabase Auth, no el cliente.
```

```ts
// components/auth-form.tsx (estado local)
type AuthState =
  | { status: "idle" }
  | { status: "loading" }
  | { status: "error"; message: string }
  | { status: "check-email"; email: string }; // registro pendiente de confirmar
```

```
# .env.example (nombres, sin valores secretos)
NEXT_PUBLIC_SUPABASE_URL=
NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY=
```

Convenciones:

- Reglas del nombre de jugador: único sin distinguir mayúsculas (se guarda siempre en mayúsculas), 3 a 10 caracteres, solo `A-Z`, `0-9` y `_`. La UI lo muestra en mayúsculas, como hoy.
- El formulario de "CREAR CUENTA" pide usuario, correo y contraseña (mínimo 8 caracteres). "INICIAR SESIÓN" pide correo y contraseña. El campo "Usuario" desaparece de la pestaña de login.
- El nombre del registro viaja en `options.data.username` de `signUp` y lo lee el trigger. El cliente normaliza y valida el formato antes de enviar, y la base de datos lo valida de nuevo.
- Si el nombre ya existe en el registro con correo, el trigger falla y la UI muestra `ESE USUARIO YA EXISTE`.
- La sesión del cliente se obtiene con `supabase.auth.getUser()` al montar y se mantiene con `onAuthStateChange`. En servidor se usa siempre `getUser()`, nunca `getSession()` sin verificar.
- Solo la clave publishable se usa en la app. La clave `service_role` no se añade a ningún archivo de la app.
- Redirección tras entrar (correo u OAuth): `/biblioteca`. El callback de OAuth y el enlace de confirmación usan `/auth/callback?next=/biblioteca`.
- Textos de la UI en español, en el estilo de la SPEC 02.

Mensajes de error fijos (en mayúsculas, sin revelar detalles internos):

- Credenciales incorrectas: `CORREO O CONTRASEÑA INCORRECTOS`.
- Correo sin confirmar: `CONFIRMA TU CORREO ANTES DE ENTRAR`.
- Usuario repetido: `ESE USUARIO YA EXISTE`.
- Correo ya registrado: `ESE CORREO YA ESTÁ REGISTRADO`.
- Validación: `USUARIO: 3 A 10 CARACTERES (A-Z, 0-9, _)`, `CORREO NO VÁLIDO`, `CONTRASEÑA: MÍNIMO 8 CARACTERES`.
- Fallo de OAuth o error inesperado: `NO PUDIMOS COMPLETAR EL ACCESO. INTÉNTALO DE NUEVO.`

---

## Plan de implementación

Antes de empezar, leer en `node_modules/next/dist/docs/` las guías `01-app/02-guides/authentication.md`, `authentication-with-cache-components.md` y `01-app/03-api-reference/03-file-conventions/proxy.md`, como exige `AGENTS.md`. Para Supabase, consultar la documentación vigente de Auth con `@supabase/ssr` (por ejemplo con `search_docs` del MCP). Antes de la migración, inspeccionar el proyecto con `list_tables`.

1. Instalar con `npm install @supabase/supabase-js @supabase/ssr`. Obtener la URL y la clave publishable (`get_project_url` y `get_publishable_keys` del MCP), añadirlas a `.env.local` y los nombres a `.env.example`. Verificación: `npm run build` compila y `git check-ignore .env.local` lo marca como ignorado.
2. Crear `lib/supabase/client.ts` y `lib/supabase/server.ts` (`createBrowserClient` y `createServerClient` con cookies de `await cookies()`). Verificación: compila y `npm run lint` pasa.
3. Crear `lib/supabase/proxy.ts` y `proxy.ts` en la raíz: refresca la sesión y propaga las cookies, sin redirigir. Verificación: `npm run build` compila, todas las rutas existentes responden como antes y no hay warnings de Cache Components.
4. Crear el archivo de migración en `supabase/migrations/` con `profiles`, índice único, RLS, política de lectura y trigger `handle_new_user`. Aplicarla al proyecto (MCP `apply_migration` o Supabase CLI) y ejecutar `get_advisors` de seguridad. Verificación: `list_tables` muestra `profiles` con RLS activo, el asesor de seguridad no reporta problemas nuevos y una inserción de prueba en `auth.users` (rama o usuario de prueba que luego se borra) crea el perfil esperado, incluida la colisión de nombres.
5. Configurar Auth en el proyecto (pasos manuales de la persona dueña, documentados en el PR): Site URL `http://localhost:3000`, Redirect URLs con `http://localhost:3000/auth/callback`, confirmación de correo activada y proveedores Google y GitHub con sus claves (apps OAuth creadas en cada consola). Las claves secretas de OAuth viven solo en el dashboard de Supabase. Verificación: el dashboard muestra ambos proveedores habilitados.
6. Crear `app/auth/callback/route.ts`: intercambia el `code` por sesión (`exchangeCodeForSession`) y redirige a `next` (solo rutas relativas internas; cualquier otro valor cae en `/biblioteca`). Ante error redirige a `/acceso?error=oauth`. Verificación: compila.
7. Reescribir `lib/session.tsx`: `SessionProvider` usa el cliente de navegador, carga el usuario y su `profiles.username`, escucha `onAuthStateChange` y expone `user`, `signOut` (cierra sesión en Supabase) y `saveScore` sin cambios. Quitar `signIn` y la clave `av_user`. Actualizar los consumidores que lo requieran (`components/nav.tsx`, `components/auth-form.tsx`). Verificación: `/biblioteca` y `/salon-de-la-fama` cargan sin sesión y sin errores en consola, y el nav muestra "Iniciar Sesión".
8. Conectar `components/auth-form.tsx`: login con `signInWithPassword`, registro con `signUp` (con `options.data.username` y `emailRedirectTo`), botones GOOGLE y GITHUB con `signInWithOAuth`, `AuthState` con botón deshabilitado y texto de carga, errores con `role="alert"` y mensajes fijos, y vista "REVISA TU CORREO" tras registrarse. "JUGAR COMO INVITADO" llama a `signOut` si hay sesión y navega a `/biblioteca`. Las clases visuales se reutilizan; si hace falta una clase nueva (línea de error, vista de confirmación), se añade al final de `app/globals.css` sin tocar reglas existentes. Verificación: el flujo completo de correo y contraseña funciona de punta a punta en el navegador.
9. Verificar OAuth con Google y GitHub y el cierre de sesión desde el nav. Revisión visual de `/acceso` a 1280 px y 390 px (estados idle, carga, error y confirmación).

---

## Criterios de aceptación

- [ ] `npm run lint` y `npm run build` terminan sin errores ni warnings de Cache Components o hidratación.
- [ ] `git check-ignore .env.local` confirma que está ignorado y `.env.example` contiene solo nombres de variables, sin valores.
- [ ] `supabase/migrations/` contiene la migración y `list_tables` muestra `profiles` con RLS activo.
- [ ] El asesor de seguridad de Supabase (`get_advisors`) no reporta avisos de seguridad nuevos tras la migración.
- [ ] Registrarse con usuario `px_kai`, correo y contraseña de 8+ caracteres muestra "REVISA TU CORREO" y no inicia sesión.
- [ ] Tras confirmar el correo, el enlace lleva a `/biblioteca` con la sesión iniciada y el nav muestra `PX_KAI`.
- [ ] En `profiles` existe una fila con `id` igual al de `auth.users` y `username = 'PX_KAI'`.
- [ ] Iniciar sesión con ese correo y la contraseña correcta lleva a `/biblioteca` con el nombre `PX_KAI` en el nav.
- [ ] Iniciar sesión con contraseña incorrecta muestra `CORREO O CONTRASEÑA INCORRECTOS` y no revela si el correo existe.
- [ ] Iniciar sesión sin haber confirmado el correo muestra `CONFIRMA TU CORREO ANTES DE ENTRAR`.
- [ ] Registrar un segundo usuario `PX_KAI` (en cualquier combinación de mayúsculas) muestra `ESE USUARIO YA EXISTE` y no crea cuenta.
- [ ] Un usuario de 2 caracteres o con espacios se rechaza en el cliente con `USUARIO: 3 A 10 CARACTERES (A-Z, 0-9, _)` y sin petición de red.
- [ ] Entrar con Google y con GitHub crea sesión, redirige a `/biblioteca` y crea un perfil con nombre que cumple `^[A-Z0-9_]{3,10}$`.
- [ ] Dos cuentas OAuth cuyo nombre derivado coincida reciben nombres distintos (el segundo con sufijo numérico) y ambas entran sin error.
- [ ] "CERRAR SESIÓN" en el nav cierra la sesión en Supabase: tras recargar, el nav muestra "Iniciar Sesión" y no quedan cookies `sb-*` de sesión.
- [ ] Recargar `/biblioteca` con sesión iniciada mantiene al usuario (cookies y `proxy.ts` funcionando).
- [ ] "JUGAR COMO INVITADO" lleva a `/biblioteca` sin sesión de Supabase y sin errores.
- [ ] `/auth/callback?next=https://ejemplo.com` redirige a `/biblioteca`, no al sitio externo.
- [ ] Un usuario autenticado no puede hacer `insert`, `update` ni `delete` sobre `profiles` con la clave publishable (RLS lo rechaza), y cualquiera puede leer los nombres.
- [ ] Buscar `service_role` y secretos de OAuth en `.next/static`, `.env.example` y el código no da ningún resultado.
- [ ] La consola del navegador no muestra errores ni warnings en `/`, `/acceso` y `/biblioteca`, y a 390 px `/acceso` no tiene scroll horizontal.
- [ ] Las demás pantallas (Home, Acerca de, detalle, reproductor, Salón) se ven y funcionan igual que antes.

---

## Decisiones

- **Sí:** cimientos y Auth en una sola spec. Auth no se puede probar sin los clientes, y separar obligaría a una spec sin resultado visible. Las puntuaciones quedan aparte.
- **No:** incluir puntuaciones y Salón de la Fama. Sumaría una tercera área (esquema, RLS de escritura, anti-trampas) y haría la spec demasiado grande.
- **Sí:** `@supabase/ssr` con clientes de navegador y servidor. Es el camino oficial para Next con cookies y encaja con el App Router.
- **Sí:** `proxy.ts` solo para refrescar sesión, sin bloquear rutas. Todo el sitio sigue siendo público y no hay rutas privadas que proteger todavía.
- **Sí:** correo y contraseña más Google y GitHub. El formulario ya tiene esos botones y cubre las dos formas habituales de entrar.
- **No:** magic link, Anonymous Sign-ins y otros proveedores. Más superficie sin necesidad hoy.
- **Sí:** iniciar sesión con correo, no con usuario. Es el identificador nativo de Supabase Auth. Entrar por usuario exigiría una función SQL que resuelva usuario a correo, con riesgo de enumerar cuentas.
- **Sí:** tabla `profiles` con `username` único, creada por un trigger. Separa el nombre público del correo, sirve al Salón más adelante y funciona igual para registro con correo y OAuth.
- **No:** guardar el nombre solo en `user_metadata`. No se puede garantizar unicidad ni consultar por nombre.
- **Sí:** nombre autogenerado para OAuth, con sufijo si hay colisión. Evita una pantalla extra de onboarding. Editar el nombre queda para otra spec.
- **Sí:** reglas del nombre 3–10 caracteres `A-Z0-9_`, único sin distinguir mayúsculas, guardado en mayúsculas. El límite de 10 y las mayúsculas vienen del `signIn` actual.
- **Sí:** confirmación de correo activada. Es lo correcto para producción, aunque en desarrollo exige un buzón real y el SMTP por defecto de Supabase tiene un límite bajo de envíos por hora.
- **Sí:** el trigger es `security definer` con `search_path` fijo y los perfiles no tienen políticas de escritura. Nadie puede crear o editar perfiles desde el cliente.
- **Sí:** lectura pública de `profiles`. El nombre de jugador es público por diseño (Salón de la Fama).
- **Sí:** `useSession()` mantiene `user.name`, `signOut` y `saveScore`. Así `nav`, `game-player` y `hall-of-fame` casi no cambian. Se elimina `signIn` porque ya no tiene sentido crear sesión desde el cliente.
- **Sí:** `saveScore` sigue en `localStorage`. Mover las puntuaciones a Supabase es otra spec.
- **Sí:** "JUGAR COMO INVITADO" sigue sin cuenta y sin Supabase. Es lo menos invasivo y no ensucia `auth.users` con usuarios anónimos.
- **Sí:** solo la clave publishable en la app, con la seguridad en RLS. No hay ningún caso de uso para `service_role`.
- **Sí:** migraciones como archivos SQL en `supabase/migrations/`. Quedan versionadas en git y revisables en PRs.
- **Sí:** verificar con el flujo real de registro, login y logout, sin ruta de salud aparte. Auth ejercita la conexión completa.
- **Sí:** redirección `next` limitada a rutas internas relativas. Evita un open redirect en `/auth/callback`.
- **Sí:** los textos de la UI siguen en español, en el estilo de las specs anteriores.

---

## Riesgos

| Riesgo                                                                                                                                  | Mitigación                                                                                                                                                                                  |
| --------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Configurar OAuth exige crear apps en Google y GitHub y pegar sus claves en el dashboard, algo que no se puede automatizar desde el repo | El paso 5 lo documenta como manual. Si un proveedor no está listo, el resto de la spec se puede verificar sin él.                                                                           |
| El SMTP por defecto de Supabase limita los correos por hora y solo entrega a miembros del equipo del proyecto                           | Usar el correo del dueño del proyecto para las pruebas. Un SMTP propio queda fuera de alcance.                                                                                              |
| El trigger de alta falla y bloquea el registro (colisión de nombre o formato)                                                           | El trigger normaliza y desambigua los nombres derivados. Solo el nombre elegido a mano puede fallar y la UI lo muestra como `ESE USUARIO YA EXISTE`. Se prueba con colisiones en el paso 4. |
| Open redirect en `/auth/callback`                                                                                                       | `next` se acepta solo si empieza por `/` y no por `//`. Criterio de aceptación específico.                                                                                                  |
| Fuga de claves                                                                                                                          | Solo la publishable es pública por diseño. `service_role` y secretos OAuth no entran al repo. Un criterio busca en `.next/static` y el código.                                              |
| `getSession()` en servidor confía en cookies sin verificar                                                                              | En servidor se usa solo `getUser()`.                                                                                                                                                        |
| `proxy.ts` o `cookies()` chocan con Cache Components                                                                                    | `proxy.ts` solo refresca cookies, y los clientes de servidor se usan solo en rutas dinámicas y handlers. El criterio de build sin warnings lo cubre.                                        |
| Hydration mismatch al mostrar el usuario en el nav                                                                                      | El estado inicial es `null` (invitado) en servidor y primer render, y el usuario real se carga en un efecto cliente, como hacía el store de `localStorage`.                                 |
| Sesiones locales antiguas (`av_user`) quedan en `localStorage`                                                                          | Al montar se borra la clave `av_user` obsoleta. Las puntuaciones `av_scores` no se tocan.                                                                                                   |
| El nombre derivado de OAuth puede ser ofensivo o confuso                                                                                | Aceptado para esta spec. Editar el nombre queda para otra.                                                                                                                                  |
| Next no recarga `.env.local` en un dev server ya iniciado                                                                               | Reiniciar `npm run dev` tras crear o cambiar las variables.                                                                                                                                 |

---

## Lo que **no** está en esta spec

- Guardar o leer puntuaciones en Supabase, Salón de la Fama y Home con datos reales.
- Editar nombre, recuperar o cambiar contraseña, borrar cuenta, avatar o perfil público.
- Reenvío del correo de confirmación.
- Rutas privadas o bloqueo por sesión.
- SMTP propio, magic link, Anonymous Sign-ins, MFA y otros proveedores OAuth.
- Uso de `service_role` en la app.
- Rate limiting propio, captcha y tests automatizados.

Cada uno, si llega, va en su propia spec.
