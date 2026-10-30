"use client";

import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import AsteroidsCanvas, {
  type AsteroidsHandle,
} from "@/components/asteroids-canvas";
import { submitScore } from "@/app/jugar/[id]/actions";
import type { Game } from "@/lib/games";
import { useSession } from "@/lib/session";

const LIVES = 3;
const POINTS_PER_LEVEL = 2500;

export default function GamePlayer({ game }: { game: Game }) {
  const { user, saveScore } = useSession();
  // ROCAS corre con su motor real; el resto de juegos sigue simulado.
  const isRocas = game.id === "rocas";
  const engineRef = useRef<AsteroidsHandle>(null);
  const [score, setScore] = useState(0);
  const [lives, setLives] = useState(LIVES);
  const [engineLevel, setEngineLevel] = useState(1);
  const [powerUpLeft, setPowerUpLeft] = useState(0);
  const [paused, setPaused] = useState(false);
  const [over, setOver] = useState(false);
  const [typedName, setTypedName] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);
  const [saving, setSaving] = useState(false);
  const [saveFailed, setSaveFailed] = useState(false);
  // La sesión se perdió justo al guardar: la marca queda solo en local.
  const [authLost, setAuthLost] = useState(false);
  // Identifica la partida en curso para ignorar respuestas de una anterior.
  const runRef = useRef(0);

  // Entra al ranking solo un juego jugable con sesión iniciada.
  const ranked = game.playable && user !== null;
  const showGuestNote = game.playable && (user === null || authLost);

  // Hasta que el usuario edita el campo, el nombre sigue a la sesión
  // (que llega tras la hidratación).
  const name = typedName ?? user?.name ?? "INVITADO";
  const level = isRocas
    ? engineLevel
    : 1 + Math.floor(score / POINTS_PER_LEVEL);

  useEffect(() => {
    if (!isRocas) return;
    if (paused) engineRef.current?.pause();
    else engineRef.current?.resume();
  }, [isRocas, paused]);

  useEffect(() => {
    if (isRocas || over || paused) return;
    const t = setInterval(
      () => setScore((s) => s + Math.floor(10 + Math.random() * 90)),
      220,
    );
    return () => clearInterval(t);
  }, [isRocas, over, paused]);

  const restart = () => {
    setScore(0);
    setPaused(false);
    setOver(false);
    setSaved(false);
    setSaving(false);
    setSaveFailed(false);
    setAuthLost(false);
    runRef.current += 1;
    // El motor vuelve a emitir vidas, nivel y power-up al reiniciar.
    engineRef.current?.restart();
  };

  const finish = () => {
    if (isRocas) engineRef.current?.end();
    else setOver(true);
  };

  const handleGameOver = (finalScore: number) => {
    setScore(finalScore);
    setPaused(false);
    setOver(true);
  };

  const saveLocal = () => {
    saveScore({ game: game.id, score, name });
    setSaved(true);
  };

  const save = async () => {
    if (!ranked) {
      saveLocal();
      return;
    }
    if (saving || saved) return;
    const run = runRef.current;
    setSaving(true);
    setSaveFailed(false);
    const result = await submitScore(game.id, score);
    if (run !== runRef.current) return;
    setSaving(false);
    if (result.ok) {
      setSaved(true);
    } else if (result.error === "AUTH") {
      setAuthLost(true);
      saveLocal();
    } else {
      setSaveFailed(true);
    }
  };

  return (
    <div className="av-player fade-in">
      <div className="player-hud">
        <div style={{ display: "flex", gap: 24, flexWrap: "wrap" }}>
          <div className="hud-stat">
            <div className="l">Jugador</div>
            <div className="v" style={{ color: "var(--ink)" }}>
              {name}
            </div>
          </div>
          <div className="hud-stat">
            <div className="l">Puntuación</div>
            <div className="v">{score.toLocaleString("es-ES")}</div>
          </div>
          <div className="hud-stat lives">
            <div className="l">Vidas</div>
            <div className="v">{"♥ ".repeat(lives).trim() || "—"}</div>
          </div>
          <div className="hud-stat level">
            <div className="l">Nivel</div>
            <div className="v">{String(level).padStart(2, "0")}</div>
          </div>
          {isRocas && powerUpLeft > 0 && (
            <div className="hud-stat">
              <div className="l">Triple</div>
              <div className="v" style={{ color: "var(--magenta)" }}>
                3x {powerUpLeft.toFixed(1)}s
              </div>
            </div>
          )}
        </div>
        <div className="hud-actions">
          <button className="btn yellow" onClick={() => setPaused((p) => !p)}>
            {paused ? "REANUDAR" : "PAUSA"}
          </button>
          <button className="btn magenta" onClick={finish}>
            FIN
          </button>
          <Link href={`/juegos/${game.id}`} className="btn ghost">
            SALIR
          </Link>
        </div>
      </div>

      <div className={isRocas ? "crt crt-fit" : "crt"}>
        <div className="crt-screen">
          {isRocas ? (
            <AsteroidsCanvas
              ref={engineRef}
              onScore={setScore}
              onLives={setLives}
              onLevel={setEngineLevel}
              onPowerUp={setPowerUpLeft}
              onGameOver={handleGameOver}
            />
          ) : (
            <div className="game-arena">
              <div className="grid-floor"></div>
              <div className="enemy e1"></div>
              <div className="enemy e2"></div>
              <div className="enemy e3"></div>
              <div className="player-ship"></div>
            </div>
          )}
          {paused && (
            <div
              className="crt-content"
              style={{ background: "rgba(0,0,0,0.6)", zIndex: 5 }}
            >
              <div>
                <div className="pixel neon-yellow" style={{ fontSize: 22 }}>
                  EN PAUSA
                </div>
                <div
                  className="mono"
                  style={{
                    fontSize: 11,
                    color: "var(--ink-dim)",
                    marginTop: 10,
                    letterSpacing: "0.16em",
                  }}
                >
                  PULSA REANUDAR PARA CONTINUAR
                </div>
              </div>
            </div>
          )}
        </div>
        <div className="crt-bottom">
          <span className="led">SEÑAL OK</span>
          <span>{game.title} · CRT-83 · 60 HZ</span>
          <span>CARGA · 1MB</span>
        </div>
      </div>

      {over && (
        <div className="modal-bd">
          <div className="modal">
            <h2>FIN DEL JUEGO</h2>
            <div className="final-label">PUNTUACIÓN FINAL</div>
            <div className="final">{score.toLocaleString("es-ES")}</div>
            {!saved ? (
              <div className="input-row">
                {!ranked && (
                  <input
                    value={name}
                    onChange={(e) =>
                      setTypedName(e.target.value.toUpperCase().slice(0, 10))
                    }
                    placeholder="TUS INICIALES"
                  />
                )}
                <button className="btn yellow" onClick={save} disabled={saving}>
                  {saving ? "GUARDANDO…" : "GUARDAR PUNTUACIÓN"}
                </button>
              </div>
            ) : (
              <div className="toast-saved">▸ PUNTUACIÓN GUARDADA_</div>
            )}
            {saveFailed && (
              <div
                role="alert"
                className="mono"
                style={{ color: "var(--magenta)", fontSize: 11, marginTop: 10 }}
              >
                NO PUDIMOS GUARDAR LA PUNTUACIÓN. INTÉNTALO DE NUEVO.
              </div>
            )}
            {showGuestNote && (
              <div
                className="mono"
                style={{
                  color: "var(--ink-dim)",
                  fontSize: 11,
                  letterSpacing: "0.12em",
                  marginTop: 10,
                }}
              >
                INICIA SESIÓN PARA ENTRAR AL RANKING
              </div>
            )}
            <div className="actions">
              <button className="btn" onClick={restart}>
                JUGAR DE NUEVO
              </button>
              <Link href="/biblioteca" className="btn magenta">
                VOLVER AL VAULT
              </Link>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
