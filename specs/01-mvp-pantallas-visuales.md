# SPEC 01 — MVP visual de Arcade Vault (5 pantallas)

> **Estado:** Aprobado
> **Depende de:** ninguna
> **Fecha:** 2026-10-27
> **Objetivo:** Portar a Next.js (App Router, rutas reales) las 5 pantallas del template `references/templates/` con datos mock y sesión falsa, sin implementar ningún juego.

---

## Por qué existe esta spec

El repo es un scaffold de Create Next App con el tema ya volcado (`app/globals.css` contiene las 970 líneas de `styles.css` y `app/layout.tsx` ya carga Press Start 2P, JetBrains Mono y Courier Prime, además de `.av-bg`, `.av-noise` y `#root`). Falta la capa de componentes y rutas. El template de referencia es un SPA con React UMD, Babel y navegación por hash; aquí se convierte a App Router sin cambiar el aspecto visual.

---

## Alcance

**Dentro:**

- Módulo de datos mock tipado en `lib/games.ts` (port de `data.jsx`): `GAMES`, `CATS`, `PLAYERS`, `seededScores`.
- Sesión falsa en `localStorage` (`av_user`) expuesta con un provider cliente.
- `Nav` (con menú móvil), contador de créditos estático y footer, montados en `app/layout.tsx`.
- Pantallas, cada una con su ruta real:
  - Biblioteca: `/` (hero, buscador, chips de categoría, grid de tarjetas con tilt, estado vacío).
  - Detalle de juego: `/juegos/[id]` (portada, tags, stats, leaderboard top 10).
  - Reproductor: `/jugar/[id]` (HUD, CRT, arena falsa, pausa, modal "Fin del juego", guardado en `av_scores`).
  - Acceso: `/acceso` (tabs iniciar sesión / crear cuenta, invitado, botones sociales sin efecto).
  - Salón de la Fama: `/salon-de-la-fama` (tabs por juego, podio, tabla, fila "tu mejor marca" si hay sesión).
- `not-found` para un `id` de juego inexistente.
- Responsive según el CSS existente (breakpoints 840 / 900 / 720 px).

**Fuera de alcance (para futuras specs):**

- Cualquier juego real (lógica, canvas, input de teclado o táctil).
- Backend, base de datos, autenticación real, OAuth con Google o GitHub.
- Leer `av_scores` para mostrar puntuaciones reales del usuario: el reproductor solo escribe, y el Salón sigue mostrando datos mock.
- Contador de créditos funcional (queda fijo en `03`).
- Validación de formularios, recuperación de contraseña, perfil de usuario, términos reales.
- Tests automatizados (no hay runner configurado).
- Modo claro, i18n y SEO más allá del `metadata` actual.

---

## Modelo de datos

```ts
// lib/games.ts
export type GameCategory = "ARCADE" | "PUZZLE" | "SHOOTER" | "VERSUS";
export type GameColor = "cyan" | "magenta" | "yellow" | "green";

export interface Game {
  id: string;            // slug de la URL, p. ej. "bloque-buster"
  title: string;
  short: string;
  long: string;
  cat: GameCategory;
  cover: string;         // clase CSS existente: "cover-bricks", "cover-tetro", ...
  color: GameColor;
  best: number;
  plays: string;         // texto ya formateado, p. ej. "12.4K"
}

export interface ScoreRow {
  rank: number;
  name: string;
  score: number;
  date: string;          // "DD/MM/2026"
}

export const GAMES: Game[];                          // 8 juegos, idénticos a data.jsx
export const CATS: ["TODOS", ...GameCategory[]];
export function seededScores(seed: number, count?: number): ScoreRow[]; // determinista
```

```ts
// lib/session.tsx (cliente)
export interface SessionUser { name: string }       // MAYÚSCULAS, máx. 10 caracteres
// localStorage "av_user": JSON de SessionUser, ausente = invitado
// localStorage "av_scores": JSON de { game: string; score: number; name: string; at: number }[]
```

Convenciones:

- Los ids de juego son los de `data.jsx`: `bloque-buster`, `caida`, `serpentina`, `gloton`, `invasores`, `rocas`, `ranaria`, `duelo-pixel`.
- Números formateados con `toLocaleString("es-ES")`.
- Los textos de la UI se mantienen en español, tal cual el template.
- `seededScores` no usa `Math.random` ni `Date`: debe dar el mismo resultado en servidor y cliente.

---

## Plan de implementación

Antes de empezar, leer las guías relevantes de `node_modules/next/dist/docs/` (App Router, Cache Components, rutas dinámicas, `not-found`), como exige `AGENTS.md`.

1. Crear `lib/games.ts` con tipos, `GAMES`, `CATS`, `PLAYERS` y `seededScores`. Verificación: `npm run build` compila.
2. Crear `lib/session.tsx` (`SessionProvider` y hook `useSession`) con `av_user`, `signIn`, `signOut` y `saveScore`. Leer `localStorage` en un efecto o con `useSyncExternalStore`, sin romper la hidratación. Verificación: compila y el layout sigue renderizando.
3. Crear `components/nav.tsx` (con menú móvil y `usePathname` para el estado activo) y `components/footer.tsx`. Montarlos en `app/layout.tsx` dentro de `#root`, con `<main className="av-main">` y el `SessionProvider`. Verificación: el nav y el footer aparecen sobre el `page.tsx` actual.
4. Biblioteca: crear `components/game-card.tsx` y `components/library.tsx` (cliente, con buscador y chips) y reemplazar `app/page.tsx`. Verificación: `/` muestra 8 tarjetas, el filtro funciona y el estado vacío aparece.
5. Detalle: crear `app/juegos/[id]/page.tsx` con `generateStaticParams` y `notFound()` para ids inválidos, más `app/not-found.tsx`. Verificación: `/juegos/caida` renderiza y `/juegos/xyz` muestra el 404.
6. Reproductor: crear `components/game-player.tsx` (cliente, partida simulada) y `app/jugar/[id]/page.tsx`. Verificación: el puntaje sube, la pausa lo detiene, FIN abre el modal y guardar escribe en `av_scores`.
7. Acceso: crear `app/acceso/page.tsx` y `components/auth-form.tsx`. Verificación: entrar redirige a `/` con el nombre en el nav; invitado deja el nav sin sesión.
8. Salón de la Fama: crear `app/salon-de-la-fama/page.tsx` y `components/hall-of-fame.tsx` (cliente, tabs por juego). Verificación: el podio y la tabla cambian al cambiar de juego, y "tu mejor marca" aparece solo con sesión.
9. Limpiar el scaffold: eliminar lo que quede del template de Create Next App y sus assets no usados, y confirmar que `AGENTS.md` sigue en su sitio.

---

## Criterios de aceptación

- [ ] `npm run lint` termina sin errores.
- [ ] `npm run build` termina sin errores ni warnings de Cache Components o hidratación.
- [ ] Las 5 rutas (`/`, `/juegos/[id]`, `/jugar/[id]`, `/acceso`, `/salon-de-la-fama`) responden 200 para los 8 ids de juego.
- [ ] `/juegos/xyz` y `/jugar/xyz` muestran la página `not-found`.
- [ ] La consola del navegador no muestra errores ni warnings de hidratación en ninguna ruta.
- [ ] La biblioteca muestra 8 tarjetas; escribir "caí" deja solo CAÍDA; elegir PUZZLE deja solo CAÍDA; una búsqueda sin coincidencias muestra "NO HAY RESULTADOS".
- [ ] Hacer clic en una tarjeta o en su botón JUGAR lleva a `/juegos/[id]` de ese juego.
- [ ] El detalle muestra tags, descripción larga, las 3 stats, 10 filas de leaderboard y los botones "JUGAR AHORA" (→ `/jugar/[id]`) y "VOLVER AL VAULT" (→ `/`).
- [ ] En el reproductor el puntaje aumenta mientras la partida corre y deja de aumentar en pausa; el botón alterna PAUSA y REANUDAR.
- [ ] En el reproductor, FIN abre el modal con la puntuación final; "GUARDAR PUNTUACIÓN" agrega una entrada a `localStorage.av_scores` y muestra "PUNTUACIÓN GUARDADA_".
- [ ] "JUGAR DE NUEVO" reinicia el puntaje a 0; "VOLVER AL VAULT" lleva a `/`; SALIR lleva a `/juegos/[id]`.
- [ ] En `/acceso`, enviar el formulario con usuario "px_kai" guarda `av_user = {"name":"PX_KAI"}` y redirige a `/`.
- [ ] Con sesión, el nav muestra el nombre y al pulsarlo cierra la sesión (borra `av_user`); sin sesión muestra "Iniciar Sesión".
- [ ] "JUGAR COMO INVITADO" redirige a `/` sin crear `av_user`.
- [ ] La pestaña "CREAR CUENTA" muestra el campo de correo; "INICIAR SESIÓN" lo oculta.
- [ ] En `/salon-de-la-fama`, cambiar de juego actualiza el podio (3 puestos) y las 12 filas; la fila "TU MEJOR MARCA" aparece solo con sesión.
- [ ] El link activo del nav corresponde a la ruta actual (`/juegos/*` y `/jugar/*` marcan "Biblioteca").
- [ ] A 390 px de ancho no hay scroll horizontal; el nav muestra el botón hamburguesa y el panel lateral abre y cierra.
- [ ] Recargar `/` con sesión iniciada conserva el nombre en el nav.

---

## Decisiones

- **Sí:** rutas reales del App Router. Las URLs son compartibles y las specs futuras (juegos, backend) encajan sin reestructurar.
- **No:** port literal del SPA con hash. Desaprovecha el router y habría que deshacerlo después.
- **Sí:** mock tipado en `lib/games.ts`. Sin backend todavía, y se reemplaza luego por una API o DB cambiando una importación.
- **No:** JSON estático en `public/`. Añade fetch y manejo de Cache Components sin beneficio ahora.
- **Sí:** sesión falsa en `localStorage` como el template, para poder ver los estados logueado e invitado.
- **No:** UI sin estado. Pierde los estados que el diseño ya define.
- **Sí:** reproductor con partida simulada (puntaje aleatorio, pausa, modal, guardado en `av_scores`). Deja el contenedor y el HUD listos para montar un juego real en otra spec.
- **No:** reproductor estático o "Próximamente". Obliga a reconstruir el HUD cuando lleguen los juegos.
- **Sí:** reutilizar el CSS ya presente en `app/globals.css` con las mismas clases del template (`.btn`, `.card`, `.crt`, ...). Garantiza fidelidad visual con el diseño aprobado.
- **No:** reescribir los estilos como utilidades de Tailwind. Es un trabajo grande sin ganancia visual.
- **Sí:** todo en una sola spec. Es un port visual con un único sistema de diseño compartido.
- **Sí:** `av_scores` solo se escribe. Leerlo mezclaría datos reales y mock en el Salón y pertenece a una spec de puntuaciones.
- **Sí:** créditos fijos en `03`, como en el template.

---

## Riesgos

| Riesgo | Mitigación |
| --- | --- |
| Hydration mismatch al leer `localStorage` en el primer render | Leer la sesión en un efecto o con `useSyncExternalStore` y renderizar el estado "sin sesión" en servidor. |
| Cache Components rechaza `Math.random` o `Date.now` durante el prerender | El puntaje aleatorio vive solo en un efecto cliente. `seededScores` es determinista. |
| `params` asíncronos en rutas dinámicas de Next 16 | Seguir la guía de `node_modules/next/dist/docs/` y usar `generateStaticParams` para los 8 ids. |
| `#root { height: 100% }` y el footer pueden romper el layout al pasar a Next | Verificar visualmente en 390 px y 1280 px, y ajustar solo con el CSS existente. |
| `localStorage` bloqueado (modo privado) | Envolver lecturas y escrituras en `try/catch` y degradar a invitado. |

---

## Lo que **no** está en esta spec

- Ningún juego real.
- Backend, base de datos o autenticación real.
- Puntuaciones reales leídas desde `av_scores`.
- Créditos funcionales.
- Tests automatizados.

Cada uno, si llega, va en su propia spec.
