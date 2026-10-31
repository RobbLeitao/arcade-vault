import type { GameColor } from "@/lib/games";

export interface HudStat {
  key: string; // estable, para el key de React
  label: string; // "Triple", "Líneas"
  value: string; // ya formateado: "3x 4.2s", "12"
  color?: GameColor; // color del tema; por defecto --cyan
}

export interface GameCallbacks {
  onScore: (score: number) => void; // solo cuando cambia
  onLives: (lives: number | null) => void; // null = sin vidas
  onLevel: (level: number) => void; // solo cuando cambia
  onStats: (stats: HudStat[]) => void; // [] = ninguno; solo cuando cambian
  onGameOver: (finalScore: number) => void; // fin natural o llamada a end()
  onPauseKey?: () => void; // el jugador pulsó la tecla de pausa del juego
}

export interface GameEngine {
  pause: () => void;
  resume: () => void;
  restart: () => void; // reinicia y vuelve a emitir score, lives, level y stats
  end: () => void; // termina la partida en curso y llama a onGameOver
  destroy: () => void; // cancela el bucle y quita los listeners
}

export type CreateGame = (
  canvas: HTMLCanvasElement,
  callbacks: GameCallbacks,
) => GameEngine;
