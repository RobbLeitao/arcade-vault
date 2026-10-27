"use server";

import { headers } from "next/headers";
import { Resend } from "resend";
import { type ContactState, validateContact } from "@/lib/contact";
import { checkRateLimit } from "@/lib/rate-limit";

const RATE_MAX = 3;
const RATE_WINDOW_MS = 10 * 60 * 1000;

const RATE_LIMIT_MESSAGE = "DEMASIADOS ENVÍOS. INTÉNTALO EN UNOS MINUTOS.";
const SEND_FAILED_MESSAGE = "NO PUDIMOS ENVIAR TU MENSAJE. INTÉNTALO DE NUEVO.";

function field(formData: FormData, key: string): string {
  const value = formData.get(key);
  return typeof value === "string" ? value : "";
}

export async function sendContact(
  _prev: ContactState,
  formData: FormData,
): Promise<ContactState> {
  const name = field(formData, "name").trim();
  const email = field(formData, "email").trim();
  const msg = field(formData, "msg").trim();

  // Honeypot: los bots lo rellenan. Se responde éxito sin enviar nada.
  if (field(formData, "website").trim() !== "") {
    return { status: "sent", name };
  }

  const forwarded = (await headers()).get("x-forwarded-for");
  const ip = forwarded?.split(",")[0].trim() || "unknown";
  if (!checkRateLimit(ip, RATE_MAX, RATE_WINDOW_MS)) {
    return { status: "error", message: RATE_LIMIT_MESSAGE };
  }

  const fields = validateContact({ name, email, msg });
  const firstError = Object.values(fields)[0];
  if (firstError) {
    return { status: "error", message: firstError, fields };
  }

  const apiKey = process.env.RESEND_API_KEY;
  const to = process.env.CONTACT_TO_EMAIL;
  const from = process.env.CONTACT_FROM_EMAIL || "onboarding@resend.dev";
  if (!apiKey || !to) {
    console.error("[contact] Falta RESEND_API_KEY o CONTACT_TO_EMAIL");
    return { status: "error", message: SEND_FAILED_MESSAGE };
  }

  try {
    const { error } = await new Resend(apiKey).emails.send({
      from,
      to,
      replyTo: email,
      subject: `[Arcade Vault] Mensaje de ${name.replace(/[\r\n]+/g, " ")}`,
      text: `Nombre: ${name}\nCorreo: ${email}\n\nMensaje:\n${msg}`,
    });
    if (error) {
      console.error("[contact] Resend rechazó el envío:", error.name);
      return { status: "error", message: SEND_FAILED_MESSAGE };
    }
  } catch (err) {
    console.error(
      "[contact] Fallo al contactar con Resend:",
      err instanceof Error ? err.name : "desconocido",
    );
    return { status: "error", message: SEND_FAILED_MESSAGE };
  }

  return { status: "sent", name };
}
