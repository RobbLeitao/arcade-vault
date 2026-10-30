export type GameCategory = "ARCADE" | "PUZZLE" | "SHOOTER" | "VERSUS";
export type GameColor = "cyan" | "magenta" | "yellow" | "green";

export interface Game {
  id: string;
  title: string;
  short: string;
  long: string;
  cat: GameCategory;
  cover: string;
  color: GameColor;
  playable: boolean;
  best: number | null; // null = sin puntuaciones
  plays: number;
}

export interface ScoreRow {
  rank: number;
  name: string;
  score: number;
  date: string;
}

// 842 -> "842", 15600 -> "15.6K"
export function formatPlays(n: number): string {
  if (n < 1000) return String(n);
  return `${(n / 1000).toFixed(1).replace(/\.0$/, "")}K`;
}

// dd/mm/aaaa en zona fija: igual en servidor y cliente, sin romper la hidratación.
const SCORE_DATE = new Intl.DateTimeFormat("es-ES", {
  timeZone: "Europe/Madrid",
  day: "2-digit",
  month: "2-digit",
  year: "numeric",
});

export function formatScoreDate(iso: string): string {
  return SCORE_DATE.format(new Date(iso));
}

export const CATS: ["TODOS", ...GameCategory[]] = [
  "TODOS",
  "ARCADE",
  "PUZZLE",
  "SHOOTER",
  "VERSUS",
];

