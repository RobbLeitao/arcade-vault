# SPEC 03 — Envío real de correo desde el formulario de contacto

> **Estado:** Implementado
> **Depende de:** SPEC 02
> **Fecha:** 2026-10-27
> **Objetivo:** Hacer que el formulario de contacto de `/acerca-de` envíe el mensaje por correo al equipo mediante una Server Action y Resend, con validación en servidor y protección anti-spam.

---

## Por qué existe esta spec

La SPEC 02 dejó el formulario de contacto solo en el front: valida campos vacíos y muestra la terminal "MENSAJE RECIBIDO", pero el mensaje no sale de la página. Esta spec añade el backend mínimo para que el envío sea real. La terminal de éxito solo debe aparecer cuando el correo se envió de verdad.

---

## Alcance

**Dentro:**

- Server Action `sendContact` en `app/acerca-de/actions.ts` que recibe el `FormData` del formulario.
- Envío del correo con Resend (paquete `resend`), solo al equipo, en texto plano.
- Asunto `[Arcade Vault] Mensaje de {nombre}` y `Reply-To` con el correo del visitante.
- Validación en servidor con límites fijos (ver Modelo de datos). La validación del cliente (campos vacíos y `shake`) se mantiene como está.
- Anti-spam: campo honeypot oculto y límite por IP en memoria (3 envíos cada 10 minutos).
- Estados del formulario: enviando (botón deshabilitado con texto `ENVIANDO…`), éxito (terminal "MENSAJE RECIBIDO") y error (línea de error dentro del formulario, conservando lo escrito).
- Configuración por variables de entorno: `RESEND_API_KEY`, `CONTACT_TO_EMAIL`, `CONTACT_FROM_EMAIL`.
- `.env.example` con los nombres de las variables, sin valores.
- Si falta `RESEND_API_KEY` o el proveedor falla, la acción devuelve un error y el formulario lo muestra. Nunca se simula un éxito.

**Fuera de alcance (para futuras specs):**

- Correo de confirmación o auto-respuesta a quien escribe.
- Plantilla HTML del correo.
- Captcha (Turnstile u otro).
- Guardar los mensajes en base de datos o archivo.
- Verificar un dominio propio en Resend y enviar desde él.
- Límite de envíos compartido entre instancias (Redis u otro almacén externo).
- Panel para leer los mensajes, adjuntos, i18n y tests automatizados (no hay runner configurado).

---

## Modelo de datos

```ts
// lib/contact.ts (sin "use server"; compartido por la acción y el formulario)
export const CONTACT_LIMITS = {
  name: { min: 1, max: 60 },
  email: { min: 3, max: 120 },
  msg: { min: 10, max: 2000 },
} as const;

export type ContactField = "name" | "email" | "msg";

export type ContactState =
  | { status: "idle" }
  | { status: "sent"; name: string }
  | {
      status: "error";
      message: string;
      fields?: Partial<Record<ContactField, string>>;
    };

export function validateContact(raw: {
  name: string;
  email: string;
  msg: string;
}): Partial<Record<ContactField, string>>; // vacío = válido
```

```ts
// lib/rate-limit.ts (en memoria, por instancia del servidor)
export function checkRateLimit(
  key: string,
  max: number,
  windowMs: number,
): boolean; // true = permitido
```

```
# .env.example (nombres, sin valores)
RESEND_API_KEY=
CONTACT_TO_EMAIL=
CONTACT_FROM_EMAIL=onboarding@resend.dev
```

Convenciones:

- Todos los campos se normalizan con `trim()` antes de validar y enviar.
- El campo honeypot se llama `website`. Va en el `FormData` pero no en `ContactState`.
- La IP se toma del primer valor de `x-forwarded-for` (`await headers()`); si no existe, la clave es `"unknown"`.
- Los textos de error van en español y no revelan detalles internos (clave, proveedor, stack).
- `RESEND_API_KEY` solo se lee en el servidor. Nunca lleva el prefijo `NEXT_PUBLIC_`.

Mensajes de error fijos:

- Validación: `NOMBRE: 1 A 60 CARACTERES`, `CORREO NO VÁLIDO`, `MENSAJE: 10 A 2000 CARACTERES`.
- Límite excedido: `DEMASIADOS ENVÍOS. INTÉNTALO EN UNOS MINUTOS.`
- Falta configuración o falla el proveedor: `NO PUDIMOS ENVIAR TU MENSAJE. INTÉNTALO DE NUEVO.`

---

## Plan de implementación

Antes de empezar, leer en `node_modules/next/dist/docs/` la guía de formularios (`01-app/02-guides/forms.md`), la de mutación de datos (`07-mutating-data.md`), `headers()` y Cache Components, como exige `AGENTS.md`. Para Resend, consultar su documentación vigente al instalar el paquete.

1. Instalar la dependencia con `npm install resend`. Crear `.env.example` y añadir `!.env.example` a `.gitignore` (hoy `.env*` lo ignoraría). Crear `.env.local` con las tres variables reales (lo hace la persona dueña de la clave; no se commitea ni se pega en el chat). Verificación: `git check-ignore .env.local` lo marca como ignorado, `.env.example` queda trackeable y `npm run build` compila.
2. Crear `lib/contact.ts` con `CONTACT_LIMITS`, los tipos y `validateContact` (correo con formato válido, longitudes de `CONTACT_LIMITS`). Verificación: compila.
3. Crear `lib/rate-limit.ts` con `checkRateLimit` (mapa por clave, limpia entradas vencidas al consultar). Verificación: compila.
4. Crear `app/acerca-de/actions.ts` (`"use server"`) con `sendContact(prev, formData): Promise<ContactState>`. Orden: honeypot lleno → devolver `sent` sin enviar; límite por IP; validación; comprobar `RESEND_API_KEY` y `CONTACT_TO_EMAIL`; enviar con Resend (`from` = `CONTACT_FROM_EMAIL`, `replyTo` = correo del visitante, asunto y cuerpo en texto plano con nombre, correo y mensaje); capturar fallos y devolver el error genérico. Verificación: compila y `npm run lint` pasa.
5. Añadir a `app/globals.css`, al final, las reglas `.contact-error` (línea de error con el magenta del tema) y `.contact-hp` (oculta el honeypot fuera de pantalla sin `display: none`). No tocar reglas existentes. Verificación: `npm run build` compila.
6. Actualizar `components/about/contact-form.tsx`: `useActionState(sendContact, { status: "idle" })`, el formulario con `action={formAction}`, el `onSubmit` actual que bloquea el envío y aplica `shake` si hay campos vacíos, campo honeypot `website` (`tabIndex={-1}`, `autoComplete="off"`, `aria-hidden`), `maxLength` según `CONTACT_LIMITS`, botón deshabilitado con `ENVIANDO…` mientras `isPending`, línea de error con `role="alert"` y terminal de éxito solo cuando `state.status === "sent"` (nombre en mayúsculas desde `state.name`). "ENVIAR OTRO MENSAJE" reinicia el estado remontando el formulario con una `key`. Verificación: con la clave real, enviar un mensaje completo en `/acerca-de` y recibirlo en `CONTACT_TO_EMAIL`.

---

## Criterios de aceptación

- [ ] `npm run lint` y `npm run build` terminan sin errores ni warnings de Cache Components o hidratación.
- [ ] Con las variables configuradas, enviar nombre, correo y mensaje válidos entrega un correo a `CONTACT_TO_EMAIL`.
- [ ] El correo recibido tiene asunto `[Arcade Vault] Mensaje de {nombre}`, cuerpo en texto plano con nombre, correo y mensaje, y `Reply-To` igual al correo del visitante.
- [ ] Mientras se envía, el botón está deshabilitado y muestra `ENVIANDO…`.
- [ ] La terminal "MENSAJE RECIBIDO… GRACIAS, {NOMBRE}." solo aparece después de que la acción devuelve `sent`.
- [ ] Enviar con algún campo vacío no llama al servidor (sin petición POST) y aplica `shake` ~400 ms, como antes.
- [ ] Enviar un mensaje de 5 caracteres muestra `MENSAJE: 10 A 2000 CARACTERES`, no envía correo y conserva lo escrito.
- [ ] Sin `RESEND_API_KEY` definida, enviar un mensaje válido muestra `NO PUDIMOS ENVIAR TU MENSAJE. INTÉNTALO DE NUEVO.`, no muestra la terminal de éxito y conserva lo escrito.
- [ ] Con una `RESEND_API_KEY` inválida se obtiene el mismo error genérico y el mensaje de error no contiene la clave ni texto del proveedor.
- [ ] Rellenar el campo oculto `website` (desde las herramientas de desarrollo) muestra la terminal de éxito pero no llega ningún correo.
- [ ] El cuarto envío válido desde la misma IP en menos de 10 minutos muestra `DEMASIADOS ENVÍOS. INTÉNTALO EN UNOS MINUTOS.` y no envía correo.
- [ ] "ENVIAR OTRO MENSAJE" restaura el formulario vacío y sin mensaje de error.
- [ ] Buscar `RESEND_API_KEY` y el valor de la clave en `.next/static` no da ningún resultado.
- [ ] `git check-ignore .env.local` confirma que `.env.local` está ignorado, y `.env.example` no contiene valores secretos.
- [ ] La consola del navegador no muestra errores ni warnings en `/acerca-de`, y a 390 px no hay scroll horizontal.

---

## Decisiones

- **Sí:** Resend como proveedor. API HTTP simple, plan gratis y sin servidor SMTP que mantener.
- **No:** SMTP con Nodemailer. Obliga a gestionar credenciales de un buzón y un servidor SMTP.
- **No:** solo guardar el mensaje sin correo. No cumple el objetivo de enviar un correo.
- **Sí:** Server Action con `useActionState`. Es lo idiomático en Next 16, no expone una URL pública y evita un `fetch` en el cliente.
- **No:** Route Handler `POST /api/contacto`. Más código y una API pública que proteger.
- **Sí:** correo solo al equipo, sin auto-respuesta. Un único envío por mensaje, y con el remitente `onboarding@resend.dev` de Resend no se puede escribir a terceros.
- **Sí:** honeypot más límite por IP en memoria. Sin servicios externos ni cuentas nuevas.
- **No:** captcha. Añade cuenta, claves y un script externo para un formulario de bajo tráfico.
- **Sí:** el honeypot lleno devuelve éxito sin enviar. Así el bot no aprende que fue detectado.
- **Sí:** errores dentro del formulario, conservando lo escrito. La terminal de éxito queda reservada para envíos reales.
- **No:** terminal de error con botón "REINTENTAR". Obliga a rediseñar la terminal.
- **Sí:** si falta la clave, error visible y nunca éxito simulado, tampoco en desarrollo. Un éxito falso ocultaría una configuración rota.
- **Sí:** texto plano con `Reply-To`. Responder al visitante es un clic y no hace falta plantilla visual.
- **Sí:** límites de validación aprobados: nombre 1–60, correo máximo 120 con formato válido, mensaje 10–2000.
- **Sí:** los textos de la UI siguen en español, en el estilo de la SPEC 02.

---

## Riesgos

| Riesgo | Mitigación |
| --- | --- |
| Sin dominio verificado, Resend solo entrega desde `onboarding@resend.dev` al correo de la propia cuenta | `CONTACT_TO_EMAIL` debe ser el correo con el que se creó la cuenta de Resend. Verificar un dominio propio queda para otra spec. |
| El límite por IP vive en memoria: se reinicia con el servidor y no se comparte entre instancias | Es aceptable para este tráfico. Un almacén compartido queda fuera de alcance. |
| `x-forwarded-for` puede falsificarse o faltar según el hosting | Se usa como mejor esfuerzo, con clave `"unknown"` si no existe. El honeypot y la validación siguen activos. |
| Fuga de la clave de Resend | Solo se lee en la acción (servidor), sin prefijo `NEXT_PUBLIC_`. `.env.local` está ignorado por git y un criterio verifica que no aparece en `.next/static`. |
| Doble envío por doble clic | El botón se deshabilita mientras la acción está pendiente. |
| `headers()` dentro de la acción podría chocar con Cache Components | Las Server Actions se ejecutan en tiempo de petición. El criterio de build sin warnings lo cubre. |
| Caída del proveedor | La acción captura el fallo y devuelve el error genérico; el usuario conserva lo escrito y puede reintentar. |
| Next no recarga `.env.local` en un dev server ya iniciado | Reiniciar `npm run dev` tras crear o cambiar las variables. |

---

## Lo que **no** está en esta spec

- Correo de confirmación o auto-respuesta al visitante.
- Plantilla HTML del correo.
- Captcha.
- Guardar los mensajes en base de datos o archivo.
- Dominio propio verificado en Resend.
- Límite de envíos distribuido.
- Panel de lectura de mensajes, adjuntos, i18n y tests automatizados.

Cada uno, si llega, va en su propia spec.
