"use client";

import { useRouter } from "next/navigation";
import { useState, type FormEvent } from "react";
import type { AuthError, Provider } from "@supabase/supabase-js";
import { createClient } from "@/lib/supabase/client";
import { useSession } from "@/lib/session";

type AuthState =
  | { status: "idle" }
  | { status: "loading" }
  | { status: "error"; message: string }
  | { status: "check-email"; email: string }; // registro pendiente de confirmar

const USERNAME_RE = /^[A-Z0-9_]{3,10}$/;
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const PASSWORD_MIN = 8;

const MSG = {
  username: "USUARIO: 3 A 10 CARACTERES (A-Z, 0-9, _)",
  email: "CORREO NO VÁLIDO",
  password: "CONTRASEÑA: MÍNIMO 8 CARACTERES",
  credentials: "CORREO O CONTRASEÑA INCORRECTOS",
  unconfirmed: "CONFIRMA TU CORREO ANTES DE ENTRAR",
  usernameTaken: "ESE USUARIO YA EXISTE",
  emailTaken: "ESE CORREO YA ESTÁ REGISTRADO",
  generic: "NO PUDIMOS COMPLETAR EL ACCESO. INTÉNTALO DE NUEVO.",
} as const;

function signInMessage(error: AuthError): string {
  if (error.code === "email_not_confirmed") return MSG.unconfirmed;
  if (error.code === "invalid_credentials") return MSG.credentials;
  return MSG.generic;
}

function signUpMessage(error: AuthError): string {
  if (error.code === "user_already_exists" || error.code === "email_exists") {
    return MSG.emailTaken;
  }
  // El trigger de perfiles rechaza el registro si el usuario ya existe.
  if (/database error saving new user/i.test(error.message)) {
    return MSG.usernameTaken;
  }
  return MSG.generic;
}

export default function AuthForm({
  callbackError = false,
}: {
  callbackError?: boolean;
}) {
  const router = useRouter();
  const { signOut } = useSession();
  const [tab, setTab] = useState<"in" | "up">("in");
  const [user, setUser] = useState("");
  const [pass, setPass] = useState("");
  const [email, setEmail] = useState("");
  const [state, setState] = useState<AuthState>(
    callbackError
      ? { status: "error", message: MSG.generic }
      : { status: "idle" },
  );

  const loading = state.status === "loading";
  const fail = (message: string) => setState({ status: "error", message });

  const switchTab = (next: "in" | "up") => {
    setTab(next);
    setState({ status: "idle" });
  };

  const submit = async (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const cleanEmail = email.trim();
    const username = user.trim().toUpperCase();

    if (tab === "up" && !USERNAME_RE.test(username)) return fail(MSG.username);
    if (!EMAIL_RE.test(cleanEmail)) return fail(MSG.email);
    if (tab === "up" && pass.length < PASSWORD_MIN) return fail(MSG.password);
    if (tab === "in" && !pass) return fail(MSG.credentials);

    setState({ status: "loading" });
    const supabase = createClient();

    if (tab === "in") {
      const { error } = await supabase.auth.signInWithPassword({
        email: cleanEmail,
        password: pass,
      });
      if (error) return fail(signInMessage(error));
      router.push("/");
      return;
    }

    const { data, error } = await supabase.auth.signUp({
      email: cleanEmail,
      password: pass,
      options: {
        data: { username },
        emailRedirectTo: `${location.origin}/auth/callback?next=/`,
      },
    });
    if (error) return fail(signUpMessage(error));
    // Con confirmación de correo, un correo ya registrado no da error: vuelve
    // un usuario sin identidades.
    if (data.user?.identities?.length === 0) return fail(MSG.emailTaken);
    setState({ status: "check-email", email: cleanEmail });
  };

  const oauth = async (provider: Provider) => {
    setState({ status: "loading" });
    const { error } = await createClient().auth.signInWithOAuth({
      provider,
      options: {
        redirectTo: `${location.origin}/auth/callback?next=/`,
      },
    });
    if (error) fail(MSG.generic);
  };

  const guest = async () => {
    await signOut();
    router.push("/biblioteca");
  };

  return (
    <div className="av-auth-wrap fade-in">
      <div className="auth-card">
        <div className="auth-header">
          <div className="mark"></div>
          <h2 className="neon-cyan">ARCADE VAULT</h2>
          <div
            className="mono"
            style={{
              fontSize: 11,
              color: "var(--ink-faint)",
              letterSpacing: "0.16em",
              marginTop: 6,
            }}
          >
            ACCESO AL SISTEMA · v2.6
          </div>
        </div>

        {state.status === "check-email" ? (
          <div className="terminal-success">
            <div className="term-bar">
              <span className="dot r"></span>
              <span className="dot y"></span>
              <span className="dot g"></span>
              <span className="term-title">VAULT-OS // ACCESO</span>
            </div>
            <div className="term-body">
              <div className="line">
                <span className="prompt">vault@arcade:~$</span> ./crear_cuenta
              </div>
              <div className="line dim">[OK] Cuenta creada…</div>
              <div className="line dim">
                [OK] Enlace de confirmación enviado a {state.email}
              </div>
              <div className="line success">
                &gt; REVISA TU CORREO Y PULSA EL ENLACE PARA ENTRAR.
                <span className="caret">_</span>
              </div>
              <div style={{ marginTop: 18 }}>
                <button
                  className="btn ghost"
                  type="button"
                  onClick={() => switchTab("in")}
                >
                  VOLVER A INICIAR SESIÓN
                </button>
              </div>
            </div>
          </div>
        ) : (
          <>
            <div className="auth-tabs">
              <button
                type="button"
                className={tab === "in" ? "on" : ""}
                onClick={() => switchTab("in")}
              >
                INICIAR SESIÓN
              </button>
              <button
                type="button"
                className={tab === "up" ? "on" : ""}
                onClick={() => switchTab("up")}
              >
                CREAR CUENTA
              </button>
            </div>

            <form onSubmit={submit} noValidate>
              {tab === "up" && (
                <div className="field slide-in">
                  <label htmlFor="auth-user">Usuario</label>
                  <input
                    id="auth-user"
                    name="username"
                    autoComplete="username"
                    maxLength={10}
                    value={user}
                    onChange={(e) => setUser(e.target.value)}
                    placeholder="px_kai"
                  />
                </div>
              )}
              <div className="field">
                <label htmlFor="auth-email">Correo electrónico</label>
                <input
                  id="auth-email"
                  name="email"
                  type="email"
                  autoComplete="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="jugador@vault.gg"
                />
              </div>
              <div className="field">
                <label htmlFor="auth-pass">Contraseña</label>
                <input
                  id="auth-pass"
                  name="password"
                  type="password"
                  autoComplete={
                    tab === "in" ? "current-password" : "new-password"
                  }
                  value={pass}
                  onChange={(e) => setPass(e.target.value)}
                  placeholder="••••••••"
                />
              </div>

              {state.status === "error" && (
                <div className="auth-error" role="alert">
                  {state.message}
                </div>
              )}

              <button
                className="btn lg"
                type="submit"
                disabled={loading}
                style={{ width: "100%", marginTop: 8 }}
              >
                {loading
                  ? tab === "in"
                    ? "ENTRANDO…"
                    : "CREANDO…"
                  : tab === "in"
                    ? "ENTRAR AL VAULT"
                    : "CREAR Y JUGAR"}
              </button>
            </form>

            <button
              type="button"
              className="btn ghost"
              style={{ width: "100%", marginTop: 10 }}
              onClick={guest}
              disabled={loading}
            >
              JUGAR COMO INVITADO
            </button>

            <div className="auth-divider">O CONTINÚA CON</div>
            <div className="social">
              <button
                className="btn ghost"
                type="button"
                disabled={loading}
                onClick={() => oauth("google")}
              >
                ◆ GOOGLE
              </button>
              <button
                className="btn ghost"
                type="button"
                disabled={loading}
                onClick={() => oauth("github")}
              >
                ▣ GITHUB
              </button>
            </div>
          </>
        )}

        <div
          style={{
            marginTop: 18,
            textAlign: "center",
            fontSize: 11,
            color: "var(--ink-faint)",
            letterSpacing: "0.1em",
          }}
        >
          AL ENTRAR ACEPTAS LOS TÉRMINOS DEL SALÓN ARCADE
        </div>
      </div>
    </div>
  );
}
