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

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export function validateContact(raw: {
  name: string;
  email: string;
  msg: string;
}): Partial<Record<ContactField, string>> {
  const name = raw.name.trim();
  const email = raw.email.trim();
  const msg = raw.msg.trim();
  const errors: Partial<Record<ContactField, string>> = {};

  if (name.length < CONTACT_LIMITS.name.min || name.length > CONTACT_LIMITS.name.max) {
    errors.name = `NOMBRE: ${CONTACT_LIMITS.name.min} A ${CONTACT_LIMITS.name.max} CARACTERES`;
  }
  if (
    email.length < CONTACT_LIMITS.email.min ||
    email.length > CONTACT_LIMITS.email.max ||
    !EMAIL_RE.test(email)
  ) {
    errors.email = "CORREO NO VÁLIDO";
  }
  if (msg.length < CONTACT_LIMITS.msg.min || msg.length > CONTACT_LIMITS.msg.max) {
    errors.msg = `MENSAJE: ${CONTACT_LIMITS.msg.min} A ${CONTACT_LIMITS.msg.max} CARACTERES`;
  }

  return errors;
}
