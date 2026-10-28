"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { useSession } from "@/lib/session";

type NavName = "inicio" | "biblioteca" | "salon" | "about" | "auth";

function activeFor(pathname: string): NavName | null {
  if (pathname === "/") return "inicio";
  if (
    pathname === "/biblioteca" ||
    pathname.startsWith("/juegos/") ||
    pathname.startsWith("/jugar/")
  ) {
    return "biblioteca";
  }
  if (pathname === "/salon-de-la-fama") return "salon";
  if (pathname === "/acerca-de") return "about";
  if (pathname === "/acceso") return "auth";
  return null;
}

export default function Nav() {
  const [open, setOpen] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);
  const pathname = usePathname();
  const { user, signOut } = useSession();
  const current = activeFor(pathname);
  const cls = (name: NavName) => (current === name ? "active" : "");
  const close = () => setOpen(false);

  // Cierra el menú de usuario al hacer clic fuera o pulsar Escape.
  useEffect(() => {
    if (!menuOpen) return;
    const onPointer = (e: PointerEvent) => {
      if (!menuRef.current?.contains(e.target as Node)) setMenuOpen(false);
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setMenuOpen(false);
    };
    document.addEventListener("pointerdown", onPointer);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("pointerdown", onPointer);
      document.removeEventListener("keydown", onKey);
    };
  }, [menuOpen]);

  const logout = async () => {
    setMenuOpen(false);
    close();
    await signOut();
  };

  return (
    <>
      <nav className="av-nav">
        <Link href="/" className="logo" onClick={close}>
          <div className="logo-mark"></div>
          <div className="logo-text neon-cyan">
            ARCADE <span className="neon-magenta">VAULT</span>
          </div>
        </Link>
        <div className="links">
          <Link href="/" className={cls("inicio")}>
            Inicio
          </Link>
          <Link href="/biblioteca" className={cls("biblioteca")}>
            Biblioteca
          </Link>
          <Link href="/salon-de-la-fama" className={cls("salon")}>
            Salón de la Fama
          </Link>
          <Link href="/acerca-de" className={cls("about")}>
            Acerca de
          </Link>
        </div>
        <div className="spacer"></div>
        <div className="coin-counter">
          <span className="coin"></span>
          <span>CRÉDITOS · 03</span>
        </div>
        {user ? (
          <div className="user-menu" ref={menuRef}>
            <button
              className="btn ghost auth-btn"
              type="button"
              aria-expanded={menuOpen}
              aria-haspopup="true"
              onClick={() => setMenuOpen((v) => !v)}
            >
              {user.name} {menuOpen ? "▴" : "▾"}
            </button>
            {menuOpen && (
              <div className="user-menu-list">
                <button
                  className="user-menu-item"
                  type="button"
                  onClick={logout}
                >
                  CERRAR SESIÓN
                </button>
              </div>
            )}
          </div>
        ) : (
          <Link href="/acceso" className="btn auth-btn">
            Iniciar Sesión
          </Link>
        )}
        <button
          className="btn ghost hamburger"
          onClick={() => setOpen(true)}
          aria-label="Menú"
        >
          ≡
        </button>
      </nav>

      <div
        className={"av-mobile-backdrop" + (open ? " open" : "")}
        onClick={close}
      ></div>
      <aside className={"av-mobile-panel" + (open ? " open" : "")}>
        <div
          className="pixel neon-cyan"
          style={{ fontSize: 11, marginBottom: 16 }}
        >
          MENÚ
        </div>
        <Link href="/" className={cls("inicio")} onClick={close}>
          Inicio
        </Link>
        <Link href="/biblioteca" className={cls("biblioteca")} onClick={close}>
          Biblioteca
        </Link>
        <Link href="/salon-de-la-fama" className={cls("salon")} onClick={close}>
          Salón de la Fama
        </Link>
        <Link href="/acerca-de" className={cls("about")} onClick={close}>
          Acerca de
        </Link>
        <Link href="/acceso" className={cls("auth")} onClick={close}>
          {user ? "Cuenta" : "Iniciar Sesión"}
        </Link>
        {user && (
          <button className="panel-link" type="button" onClick={logout}>
            CERRAR SESIÓN
          </button>
        )}
        <div style={{ flex: 1 }}></div>
        <div
          className="pixel"
          style={{
            fontSize: 9,
            color: "var(--ink-faint)",
            letterSpacing: "0.16em",
          }}
        >
          CRÉDITOS · 03
        </div>
      </aside>
    </>
  );
}
