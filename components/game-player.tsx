"use client";

import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import GameCanvas, { type GameHandle } from "@/components/game-canvas";
import TouchControls from "@/components/touch-controls";
import { submitScore } from "@/app/jugar/[id]/actions";
import type { Game } from "@/lib/games";
import type { HudStat } from "@/lib/games/contract";
import { ENGINES } from "@/lib/games/registry";
import {
  DEFAULT_SKIN,
  SKIN_IDS,
  SKIN_LABELS,
  loadSkin,
  saveSkin,
  type SkinId,
} from "@/lib/games/skins";
import { useSession } from "@/lib/session";

const LIVES = 3;
const POINTS_PER_LEVEL = 2500;

export default function GamePlayer({ game }: { game: Game }) {
  const { user, saveScore } = useSession();
  // Los juegos con motor en el registro corren reales; el resto sigue simulado.
  const entry = ENGINES[game.id];
  const engineRef = useRef<GameHandle>(null);
  const [score, setScore] = useState(0);
  const [lives, setLives] = useState<number | null>(LIVES);
  const [engineLevel, setEngineLevel] = useState(1);
  const [stats, setStats] = useState<HudStat[]>([]);
  // Skin del juego (solo motores con `skins`). Se lee de localStorage solo en
  // el cliente; no altera el HTML hidratado porque el selector solo aparece en
  // la pausa y el canvas se pinta tras montar.
  const [skin, setSkin] = useState<SkinId>(() =>
    entry?.skins && typeof window !== "undefined"
      ? loadSkin(game.id)
      : DEFAULT_SKIN,
  );
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
  const level = entry ? engineLevel : 1 + Math.floor(score / POINTS_PER_LEVEL);

  useEffect(() => {
    if (!entry) return;
    if (paused) engineRef.current?.pause();
    else engineRef.current?.resume();
  }, [entry, paused]);

  // Auto-pausa al ocultar la página (cambio de pestaña o de app). Girar la
  // pantalla no la oculta, así que no pausa. Con la partida terminada no hace nada.
  useEffect(() => {
    if (over) return;
    const onVisibility = () => {
      if (document.visibilityState === "hidden") setPaused(true);
    };
    document.addEventListener("visibilitychange", onVisibility);
    return () => document.removeEventListener("visibilitychange", onVisibility);
  }, [over]);

  useEffect(() => {
    if (entry || over || paused) return;
    const t = setInterval(
      () => setScore((s) => s + Math.floor(10 + Math.random() * 90)),
      220,
    );
    return () => clearInterval(t);
  }, [entry, over, paused]);

  const restart = () => {
    setScore(0);
    setPaused(false);
    setOver(false);
    setSaved(false);
    setSaving(false);
    setSaveFailed(false);
    setAuthLost(false);
    runRef.current += 1;
    // El motor vuelve a emitir vidas, nivel y stats al reiniciar.
    engineRef.current?.restart();
  };

  const finish = () => {
    if (entry) engineRef.current?.end();
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
        <div className="hud-stats">
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
          {lives !== null && (
            <div className="hud-stat lives">
              <div className="l">Vidas</div>
              <div className="v">{"♥ ".repeat(lives).trim() || "—"}</div>
            </div>
          )}
          <div className="hud-stat level">
            <div className="l">Nivel</div>
            <div className="v">{String(level).padStart(2, "0")}</div>
          </div>
          {stats.map((stat) => (
            <div key={stat.key} className="hud-stat">
              <div className="l">{stat.label}</div>
              <div
                className="v"
                style={{ color: `var(--${stat.color ?? "cyan"})` }}
              >
                {stat.value}
              </div>
            </div>
          ))}
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

      {/* Escenario: canvas + mando táctil (debajo en vertical, a los lados en
          horizontal). Sin pointer coarse el mando no se monta y el escenario
          es un simple contenedor. */}
      <div className={"player-stage" + (entry?.touch ? " has-touch" : "")}>
        <div
          className={entry ? "crt crt-fit" : "crt"}
          style={
            entry
              ? ({
                  "--game-aspect": entry.width / entry.height,
                } as React.CSSProperties)
              : undefined
          }
        >
          <div
            className="crt-screen"
            style={
              entry
                ? { aspectRatio: `${entry.width} / ${entry.height}` }
                : undefined
            }
          >
            {entry ? (
              <GameCanvas
                ref={engineRef}
                gameId={game.id}
                label={`Juego ${game.title}`}
                skin={entry.skins ? skin : undefined}
                onScore={setScore}
                onLives={setLives}
                onLevel={setEngineLevel}
                onStats={setStats}
                onGameOver={handleGameOver}
                onPauseKey={() => setPaused((p) => !p)}
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
                  {entry?.levels && (
                    <div className="level-picker">
                      <div className="level-picker-label mono">
                        SALTAR AL NIVEL
                      </div>
                      <div className="level-picker-list">
                        {Array.from(
                          { length: entry.levels },
                          (_, i) => i + 1,
                        ).map((n) => (
                          <button
                            key={n}
                            type="button"
                            className={
                              "btn level-btn" +
                              (n === engineLevel ? " current" : "")
                            }
                            aria-pressed={n === engineLevel}
                            onClick={() => {
                              engineRef.current?.goToLevel?.(n);
                              setPaused(false);
                            }}
                          >
                            {n}
                          </button>
                        ))}
                      </div>
                    </div>
                  )}
                  {entry?.skins && (
                    <div className="level-picker">
                      <div
                        id="skin-picker-label"
                        className="level-picker-label mono"
                      >
                        SKIN
                      </div>
                      <div
                        className="level-picker-list"
                        role="group"
                        aria-labelledby="skin-picker-label"
                      >
                        {SKIN_IDS.map((id) => (
                          <button
                            key={id}
                            type="button"
                            className={
                              "btn skin-btn" + (id === skin ? " current" : "")
                            }
                            aria-pressed={id === skin}
                            onClick={() => {
                              setSkin(id);
                              saveSkin(game.id, id);
                            }}
                          >
                            {SKIN_LABELS[id]}
                          </button>
                        ))}
                      </div>
                    </div>
                  )}
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
        {entry?.touch && !over && (
          <TouchControls layout={entry.touch} disabled={paused || over} />
        )}
      </div>

      {over && (
        <div className="modal-bd">
          <div className="modal">
            <h2>FIN DEL JUEGO</h2>
            <div className="final-label">PUNTUACIÓN FINAL</div>
            <div className="final">{score.toLocaleString("es-ES")}</div>
            {!saved ? (
              <div className={"input-row" + (ranked ? " solo" : "")}>
                {!ranked && (
                  <input
                    aria-label="Tus iniciales"
                    autoComplete="off"
                    autoCapitalize="characters"
                    enterKeyHint="done"
                    maxLength={10}
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
