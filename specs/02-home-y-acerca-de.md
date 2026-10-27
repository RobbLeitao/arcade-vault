# SPEC 02 — Home (landing) y Acerca de

> **Estado:** Implementado
> **Depende de:** SPEC 01
> **Fecha:** 2026-10-27
> **Objetivo:** Portar a Next.js la landing (`/`) y la página Acerca de con contacto (`/acerca-de`) del template `references/templates/home-about/`, moviendo la Biblioteca a `/biblioteca`.

---

## Por qué existe esta spec

La SPEC 01 dejó la Biblioteca en `/` porque el template original no tenía landing. El template `home-about/` añade una Home de marketing que debe ocupar `/`, así que la Biblioteca cambia de ruta y todos los links que apuntaban a `/` como "el vault" se actualizan. `app/globals.css` no contiene ningún estilo de la Home ni de Acerca de: están en `references/templates/home-about/styles.css` (1744 líneas) y hay que traer solo lo que falta.

---

## Alcance

**Dentro:**

- Mover la Biblioteca de `/` a `/biblioteca` (`app/biblioteca/page.tsx`, sigue usando `components/library.tsx`).
- Home en `/` con las secciones del template: hero con siluetas flotantes, "¿Por qué Arcade Vault?" (4 feature cards), "Juegos disponibles ahora" (6 mini-cards), stats, "Actividad en vivo" (últimas puntuaciones y top jugadores), precios con FAQ y CTA final.
- Acerca de en `/acerca-de`: misión, 3 highlights, divisor de píxeles y formulario de contacto simulado (validación de campos vacíos con `shake`, terminal "MENSAJE RECIBIDO", botón "ENVIAR OTRO MENSAJE").
- Animación de revelado al hacer scroll (`.reveal` → `.in`) con `IntersectionObserver`, como un hook cliente reutilizable.
- Datos mock fijos y tipados de la Home en `lib/home.ts`; los 6 mini-cards salen de `GAMES` (`lib/games.ts`).
- Nav actualizado: links Inicio (`/`), Biblioteca (`/biblioteca`), Salón de la Fama y Acerca de (`/acerca-de`), en escritorio y en el panel móvil.
- Actualizar todas las referencias a `/` que significaban "Biblioteca" (ver plan, paso 2).
- Traer a `app/globals.css` solo los estilos del template `home-about` que faltan.
- Responsive según los breakpoints del CSS traído.

**Fuera de alcance (para futuras specs):**

- Envío real del formulario de contacto (Server Action, correo, backend).
- Actividad en vivo, top jugadores y stats dinámicos o derivados de `seededScores` / `av_scores`.
- Contador de créditos funcional (sigue fijo en `03`).
- Páginas legales, blog, SEO más allá de `metadata` básico por página.
- Modo claro e i18n.
- Cambios al resto de pantallas de la SPEC 01 más allá de actualizar links.
- Tests automatizados (no hay runner configurado).

---

## Modelo de datos

```ts
// lib/home.ts (sin "use client"; datos estáticos)
import type { GameColor } from "@/lib/games";

export interface Feature { icon: "GAMEPAD" | "FREE" | "TROPHY" | "ROCKET"; title: string; desc: string; color: GameColor }
export interface HomeStat { n: string; unit: string; sub: string }
export interface ActivityRow { player: string; game: string; score: number; when: string; color: GameColor }
export interface TopPlayer { rank: number; player: string; score: number }
export interface Faq { q: string; a: string }

export const FEATURES: Feature[];       // 4, textos idénticos a home.jsx
export const HOME_STATS: HomeStat[];    // 3: "12+", "MILES", "GLOBAL"
export const ACTIVITY: ActivityRow[];   // 7 filas
export const TOP_TODAY: TopPlayer[];    // 5 filas
export const PRICING_ITEMS: string[];   // 6 ítems de la lista del plan
export const FAQS: Faq[];               // 3 preguntas
```

```ts
// components/about-highlights: estructura local, no exportada
// { icon: "HEART" | "BROWSER" | "PLANT"; text: string; color: GameColor }[]
// Estado del formulario (cliente): { name: string; email: string; msg: string }, sent: string | null, shake: boolean
```

Convenciones:

- Los textos de la UI se mantienen en español, tal cual el template.
- Números con `toLocaleString("es-ES")`.
- No se usa `Math.random` ni `Date` en el render: las filas de actividad usan textos fijos ("hace 2 min").
- Los iconos son SVG de píxeles inline, portados sin cambios de `FeatureIcon`, `HighlightIcon` y `FloatingSilhouettes`.
- Navegación con `next/link` (`Link`), no con `onClick` + `navigate`.

---

## Plan de implementación

Antes de empezar, leer las guías relevantes de `node_modules/next/dist/docs/` (App Router, Cache Components, `metadata`, `Link`), como exige `AGENTS.md`. La interfaz se diseña siguiendo `/frontend-design` y las clases del template.

1. Calcular el delta de CSS entre `references/templates/home-about/styles.css` y `app/globals.css` y añadir al final de `globals.css` solo las reglas que faltan (`.home*`, `.silo*`, `.mini-*`, `.feature-*`, `.stat-*`, `.activity-*`, `.price-*`, `.faq-*`, `.about*`, `.contact*`, `.terminal-success`, `.reveal`, etc.). No tocar las reglas existentes. Verificación: `npm run build` compila y las pantallas actuales no cambian.
2. Mover la Biblioteca a `/biblioteca`: crear `app/biblioteca/page.tsx` con `<Library />` y actualizar a `/biblioteca` los links "VOLVER AL VAULT" y equivalentes en `components/hall-of-fame.tsx`, `components/game-player.tsx`, `app/not-found.tsx` y `app/juegos/[id]/page.tsx`, y el `router.push` de `components/auth-form.tsx` tras entrar o jugar como invitado. Verificación: `/biblioteca` muestra las 8 tarjetas y esos botones llevan a ella.
3. Actualizar `components/nav.tsx`: añadir Inicio (`/`) y Acerca de (`/acerca-de`), apuntar Biblioteca a `/biblioteca`, y ajustar `activeFor` (`/` → inicio; `/biblioteca`, `/juegos/*`, `/jugar/*` → biblioteca; `/acerca-de` → about). El logo lleva a `/`. Verificación: el link activo corresponde a cada ruta, en escritorio y en el panel móvil.
4. Crear `lib/home.ts` con los datos mock tipados. Verificación: compila.
5. Crear `hooks/use-reveal.ts` (cliente) con el `IntersectionObserver` que añade `.in` a los `.reveal`. Verificación: compila.
6. Crear `components/home/floating-silhouettes.tsx`, `components/home/feature-icon.tsx` y `components/home/mini-card.tsx` (la mini-card es un `Link` a `/juegos/[id]`). Verificación: compila.
7. Crear `components/home/home-page.tsx` (cliente, usa `useReveal`) con todas las secciones y reemplazar `app/page.tsx` para que renderice la Home y exporte `metadata`. Verificación: `/` muestra las 7 secciones; los CTA llevan a `/biblioteca`, `/acceso` y `/salon-de-la-fama`.
8. Crear `components/about/highlight-icon.tsx`, `components/about/contact-form.tsx` (cliente) y `app/acerca-de/page.tsx` con misión, highlights, divisor y contacto, con su `metadata`. Verificación: `/acerca-de` renderiza; enviar vacío hace shake; enviar completo muestra la terminal con el nombre en mayúsculas.
9. Revisión visual en 1280 px y 390 px de `/` y `/acerca-de`, y de las pantallas de la SPEC 01 para confirmar que no hay regresiones por el CSS añadido.

---

## Criterios de aceptación

- [ ] `npm run lint` termina sin errores.
- [ ] `npm run build` termina sin errores ni warnings de Cache Components o hidratación.
- [ ] `/`, `/biblioteca`, `/acerca-de`, `/acceso` y `/salon-de-la-fama` responden 200.
- [ ] `/biblioteca` muestra las 8 tarjetas y conserva buscador, chips y estado "NO HAY RESULTADOS".
- [ ] `/` ya no renderiza la Biblioteca y muestra, en orden: hero, "¿POR QUÉ ARCADE VAULT?" (4 cards), "JUEGOS DISPONIBLES AHORA" (6 mini-cards), stats (3 bloques), "ACTIVIDAD EN VIVO" (7 filas de puntuaciones y 5 de top), "PRECIOS" (plan, 6 ítems y 3 preguntas) y "¿LISTO PARA JUGAR?".
- [ ] En el hero, "EXPLORAR JUEGOS" lleva a `/biblioteca` y "CREAR CUENTA" a `/acceso`.
- [ ] Cada mini-card lleva a `/juegos/[id]` de su juego; "VER TODOS LOS JUEGOS →", "INSERTAR MONEDA →" llevan a `/biblioteca`; "VER SALÓN →" a `/salon-de-la-fama`; "EMPEZAR GRATIS →" a `/acceso`.
- [ ] Las secciones con `.reveal` reciben la clase `in` al entrar en el viewport.
- [ ] "VOLVER AL VAULT" en detalle, reproductor (modal), Salón y 404 lleva a `/biblioteca`.
- [ ] Tras iniciar sesión o pulsar "JUGAR COMO INVITADO" en `/acceso` se redirige a `/biblioteca`.
- [ ] El nav muestra Inicio, Biblioteca, Salón de la Fama y Acerca de; el link activo corresponde a la ruta (`/juegos/*` y `/jugar/*` marcan "Biblioteca"); el logo lleva a `/`.
- [ ] En `/acerca-de`, enviar el formulario con algún campo vacío no envía y aplica la clase `shake` ~400 ms.
- [ ] En `/acerca-de`, enviar con los 3 campos llenos y nombre "px_kai" muestra "MENSAJE RECIBIDO… GRACIAS, PX_KAI."; "ENVIAR OTRO MENSAJE" restaura el formulario vacío.
- [ ] No se realiza ninguna petición de red al enviar el formulario de contacto.
- [ ] La consola del navegador no muestra errores ni warnings de hidratación en `/` ni en `/acerca-de`.
- [ ] A 390 px de ancho no hay scroll horizontal en `/` ni en `/acerca-de`; el panel móvil incluye los 4 links y "Iniciar Sesión"/"Cuenta".
- [ ] Las pantallas de la SPEC 01 (detalle, reproductor, acceso, Salón) se ven igual que antes salvo los links actualizados.

---

## Decisiones

- **Sí:** Home y Acerca de en una sola spec. Comparten CSS, nav y patrón de revelado; separar duplicaría el trabajo de CSS y nav.
- **Sí:** Biblioteca en `/biblioteca`. Libera `/` para la landing y mantiene la convención de URLs en español de la SPEC 01.
- **No:** Biblioteca en `/juegos`. Se confunde con el segmento dinámico `/juegos/[id]`.
- **Sí:** Acerca de en `/acerca-de`, en español como `/salon-de-la-fama`.
- **Sí:** formulario de contacto solo front y simulado, como el template. Un envío real abre decisiones de backend y correo.
- **Sí:** datos de la Home hardcodeados en `lib/home.ts`, tipados. El template los define así y se reemplazan luego cambiando una importación.
- **No:** derivar actividad y top de `seededScores`. Más trabajo, el template no lo pide, y mezclaría datos que hoy son independientes.
- **Sí:** mini-cards a partir de `GAMES.slice(0, 6)`. Evita duplicar títulos y categorías.
- **Sí:** reutilizar las clases CSS del template y traer solo el delta a `globals.css`. Garantiza fidelidad visual; reescribir en utilidades de Tailwind sería mucho trabajo sin ganancia.
- **Sí:** hook `useReveal` con `IntersectionObserver`. El efecto necesita el DOM y vive en un efecto cliente, compatible con Cache Components.
- **Sí:** `Link` en lugar de `onClick`+`navigate`, para tener URLs reales y prefetch.
- **Sí:** créditos fijos en `03`, igual que en la SPEC 01.

---

## Riesgos

| Riesgo | Mitigación |
| --- | --- |
| Colisión o regresión por el CSS añadido (nombres de clase repetidos con la SPEC 01) | Añadir solo reglas ausentes; revisar visualmente las pantallas de la SPEC 01 (paso 9). |
| Secciones `.reveal` quedan invisibles si el observer no corre (JS desactivado o fallo) | El hook se monta en el cliente y observa también los elementos ya visibles al montar; verificar en recarga con scroll a mitad de página. |
| Hydration mismatch en la Home | Sin `Math.random`/`Date` en el render; textos de actividad fijos; el estado de revelado solo cambia clases desde un efecto. |
| Links antiguos a `/` como Biblioteca quedan sin actualizar | Búsqueda de `href="/"` y `push("/")` en `app/` y `components/` en el paso 2, cubierta por criterios de aceptación. |
| `#root { height: 100% }` y el footer con secciones largas | Verificar scroll y footer en 390 px y 1280 px, ajustando solo con el CSS existente. |
| Animaciones de siluetas y hero afectan el rendimiento móvil | Respetar el CSS del template; revisar `prefers-reduced-motion` si el template lo contempla. |

---

## Lo que **no** está en esta spec

- Envío real del formulario de contacto.
- Datos dinámicos o derivados de puntuaciones reales en la Home.
- Créditos funcionales.
- Páginas legales, blog o SEO avanzado.
- Cambios de diseño o lógica en detalle, reproductor, acceso o Salón, aparte de los links.
- Tests automatizados.

Cada uno, si llega, va en su propia spec.
