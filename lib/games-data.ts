import { cacheLife, cacheTag } from "next/cache";
import {
  formatScoreDate,
  type Game,
  type GameCategory,
  type GameColor,
  type ScoreRow,
} from "@/lib/games";
import { createPublicClient } from "@/lib/supabase/public";

export type Loaded<T> = { ok: true; data: T } | { ok: false };

interface GameDbRow {
  id: string;
  title: string;
  short: string;
  long: string;
  category: GameCategory;
  color: GameColor;
  cover: string;
  playable: boolean;
}

interface GameStatsDbRow {
  game_id: string;
  plays: number;
  best: number | null;
}

interface LeaderboardDbRow {
  game_id: string;
  username: string;
  score: number;
  achieved_at: string;
  rank: number;
}

// Las funciones cacheadas lanzan ante un error de Supabase para que no se
// guarde un resultado vacío; los exportados de abajo lo convierten en `ok: false`.
async function fetchGames(): Promise<Game[]> {
  "use cache";
  cacheLife("hours");
  cacheTag("games", "scores");

  const supabase = createPublicClient();
  const [games, stats] = await Promise.all([
    supabase
      .from("games")
      .select("id, title, short, long, category, color, cover, playable")
      .order("sort_order"),
    supabase.from("game_stats").select("game_id, plays, best"),
  ]);
  if (games.error) throw games.error;
  if (stats.error) throw stats.error;

  const byGame = new Map(
    (stats.data as GameStatsDbRow[]).map((s) => [s.game_id, s]),
  );
  return (games.data as GameDbRow[]).map((g) => ({
    id: g.id,
    title: g.title,
    short: g.short,
    long: g.long,
    cat: g.category,
    cover: g.cover,
    color: g.color,
    playable: g.playable,
    best: byGame.get(g.id)?.best ?? null,
    plays: byGame.get(g.id)?.plays ?? 0,
  }));
}

async function fetchTopScores(): Promise<Record<string, ScoreRow[]>> {
  "use cache";
  cacheLife("hours");
  cacheTag("scores");

  const { data, error } = await createPublicClient()
    .from("leaderboard")
    .select("game_id, username, score, achieved_at, rank")
    .lte("rank", 10)
    .order("game_id")
    .order("rank");
  if (error) throw error;

  const byGame: Record<string, ScoreRow[]> = {};
  for (const r of data as LeaderboardDbRow[]) {
    (byGame[r.game_id] ??= []).push({
      rank: r.rank,
      name: r.username,
      score: r.score,
      date: formatScoreDate(r.achieved_at),
    });
  }
  return byGame;
}

export async function getGames(): Promise<Loaded<Game[]>> {
  try {
    return { ok: true, data: await fetchGames() };
  } catch {
    return { ok: false };
  }
}

// `data: null` = el juego no existe (404); `ok: false` = fallo de lectura.
export async function getGame(id: string): Promise<Loaded<Game | null>> {
  const games = await getGames();
  if (!games.ok) return games;
  return { ok: true, data: games.data.find((g) => g.id === id) ?? null };
}

// Top 10 de cada juego, agrupado por `game_id`. Un juego sin filas no aparece.
export async function getTopScores(): Promise<
  Loaded<Record<string, ScoreRow[]>>
> {
  try {
    return { ok: true, data: await fetchTopScores() };
  } catch {
    return { ok: false };
  }
}
