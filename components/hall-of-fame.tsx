"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { formatScoreDate, type Game, type ScoreRow } from "@/lib/games";
import { useSession } from "@/lib/session";
import { createClient } from "@/lib/supabase/client";

interface MyMark {
  rank: number;
  score: number;
  date: string;
}

// Marcas del usuario por juego; `name` evita mostrar las de otra sesión.
interface MyMarks {
  name: string;
  byGame: Record<string, MyMark> | null; // null = falló la lectura
}

const emptyStyle = {
  textAlign: "center",
  padding: "32px 12px",
  color: "var(--ink-faint)",
} as const;

// `games` y `scores` son null cuando falló su lectura.
export default function HallOfFame({
  games,
  scores,
}: {
  games: Game[] | null;
  scores: Record<string, ScoreRow[]> | null;
}) {
  const { user } = useSession();
  const [tab, setTab] = useState(games?.[0]?.id ?? "");
  const [marks, setMarks] = useState<MyMarks | null>(null);

  // La fila "TU MEJOR MARCA" depende de la sesión: se pide desde el navegador
  // para que la página siga siendo cacheable.
  const userName = user?.name ?? null;
  useEffect(() => {
    if (!userName) return;
    let active = true;
    createClient()
      .from("leaderboard")
      .select("game_id, score, achieved_at, rank")
      .eq("username", userName)
      .then(({ data, error }) => {
        if (!active) return;
        if (error || !data) {
          setMarks({ name: userName, byGame: null });
          return;
        }
        const byGame: Record<string, MyMark> = {};
        for (const r of data) {
          byGame[r.game_id] = {
            rank: r.rank,
            score: r.score,
            date: formatScoreDate(r.achieved_at),
          };
        }
        setMarks({ name: userName, byGame });
      });
    return () => {
      active = false;
    };
  }, [userName]);

  const head = (
    <div className="hall-head">
      <h1>SALÓN DE LA FAMA</h1>
      <p className="pixel" style={{ fontSize: 10 }}>
        LOS NOMBRES QUE NUNCA SE BORRAN DE LA PANTALLA
      </p>
    </div>
  );

  if (games === null) {
    return (
      <div className="av-hall fade-in">
        {head}
        <div role="alert" style={{ ...emptyStyle, padding: 80 }}>
          <div
            className="pixel"
            style={{ fontSize: 14, color: "var(--magenta)" }}
          >
            NO PUDIMOS CARGAR LOS JUEGOS.
          </div>
        </div>
      </div>
    );
  }

  const game = games.find((g) => g.id === tab) ?? games[0];
  const rows = scores?.[game.id] ?? [];
  const mine = userName && marks?.name === userName ? marks.byGame : undefined;
  const myMark = mine?.[game.id];
  const slot = (i: number) =>
    rows[i] ?? { rank: i + 1, name: "VACANTE", score: null, date: "" };

  const podium = (i: number) => {
    const r = slot(i);
    return {
      name: r.name,
      score: r.score === null ? "—" : r.score.toLocaleString("es-ES"),
      date: r.date,
    };
  };
  const [first, second, third] = [podium(0), podium(1), podium(2)];

  return (
    <div className="av-hall fade-in">
      {head}

      <div className="hall-tabs">
        {games.map((g) => (
          <button
            key={g.id}
            className={"chip" + (game.id === g.id ? " active" : "")}
            onClick={() => setTab(g.id)}
          >
            {g.title}
          </button>
        ))}
      </div>

      {!game.playable ? (
        <div className="pixel" style={{ ...emptyStyle, fontSize: 12 }}>
          PRÓXIMAMENTE
        </div>
      ) : scores === null ? (
        <div role="alert" style={{ ...emptyStyle, color: "var(--magenta)" }}>
          NO PUDIMOS CARGAR EL RANKING.
        </div>
      ) : (
        <>
          {rows.length > 0 && (
            <div className="podium">
              <div className="podium-slot silver">
                <div className="rank-num">02</div>
                <div className="name">{second.name}</div>
                <div className="score">{second.score}</div>
                <div className="date">{second.date}</div>
              </div>
              <div className="podium-slot gold">
                <div
                  className="pixel"
                  style={{
                    fontSize: 9,
                    color: "var(--gold)",
                    letterSpacing: "0.18em",
                  }}
                >
                  CAMPEÓN
                </div>
                <div
                  className="rank-num"
                  style={{ fontSize: 36, marginTop: 4 }}
                >
                  01
                </div>
                <div className="name">{first.name}</div>
                <div className="score" style={{ fontSize: 20 }}>
                  {first.score}
                </div>
                <div className="date">{first.date}</div>
              </div>
              <div className="podium-slot bronze">
                <div className="rank-num">03</div>
                <div className="name">{third.name}</div>
                <div className="score">{third.score}</div>
                <div className="date">{third.date}</div>
              </div>
            </div>
          )}

          <div className="hall-table">
            {rows.length === 0 ? (
              <div style={emptyStyle}>
                AÚN NO HAY PUNTUACIONES. SÉ EL PRIMERO.
              </div>
            ) : (
              <>
                <div className="th">
                  <div>RANGO</div>
                  <div>JUGADOR</div>
                  <div>PUNTUACIÓN</div>
                  <div>FECHA</div>
                </div>
                {rows.map((r, i) => (
                  <div
                    key={r.name}
                    className={
                      "tr" +
                      (i === 0
                        ? " top1"
                        : i === 1
                          ? " top2"
                          : i === 2
                            ? " top3"
                            : "")
                    }
                    style={{ animationDelay: `${i * 50}ms` }}
                  >
                    <div className="rk">#{String(r.rank).padStart(2, "0")}</div>
                    <div className="pl">{r.name}</div>
                    <div className="sc">{r.score.toLocaleString("es-ES")}</div>
                    <div className="dt">{r.date}</div>
                  </div>
                ))}
              </>
            )}
            {user && mine && !myMark && (
              <div className="tr you-label">
                ▸ AÚN NO TIENES MARCA EN {game.title}
              </div>
            )}
            {user && myMark && (
              <>
                <div className="tr you-label">
                  ▸ TU MEJOR MARCA EN {game.title}
                </div>
                <div
                  className="tr you"
                  style={{ animationDelay: `${rows.length * 50 + 50}ms` }}
                >
                  <div className="rk" style={{ color: "var(--yellow)" }}>
                    #{String(myMark.rank).padStart(2, "0")}
                  </div>
                  <div className="pl" style={{ color: "var(--yellow)" }}>
                    {user.name}
                  </div>
                  <div
                    className="sc"
                    style={{
                      color: "var(--yellow)",
                      textShadow: "0 0 6px rgba(245,255,0,0.5)",
                    }}
                  >
                    {myMark.score.toLocaleString("es-ES")}
                  </div>
                  <div className="dt">{myMark.date}</div>
                </div>
              </>
            )}
          </div>
        </>
      )}

      <div style={{ textAlign: "center", marginTop: 32 }}>
        <Link href="/biblioteca" className="btn lg">
          VOLVER A LA BIBLIOTECA
        </Link>
      </div>
    </div>
  );
}
