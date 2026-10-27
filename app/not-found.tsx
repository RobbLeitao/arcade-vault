import Link from "next/link";

export default function NotFound() {
  return (
    <div
      className="fade-in"
      style={{ textAlign: "center", padding: "96px 32px" }}
    >
      <div
        className="pixel neon-magenta"
        style={{ fontSize: 40, marginBottom: 20 }}
      >
        404
      </div>
      <div className="pixel neon-cyan" style={{ fontSize: 14, marginBottom: 12 }}>
        JUEGO NO ENCONTRADO
      </div>
      <p style={{ color: "var(--ink-dim)", marginBottom: 32 }}>
        Esta máquina no existe en el vault.
      </p>
      <Link href="/biblioteca" className="btn lg">
        VOLVER AL VAULT
      </Link>
    </div>
  );
}
