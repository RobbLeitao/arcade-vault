import type { CreateGame } from "./contract";

export interface EngineEntry {
  width: number; // resolución lógica del canvas
  height: number;
  load: () => Promise<CreateGame>; // import() dinámico: un chunk por motor
}

export const ENGINES: Record<string, EngineEntry> = {
  rocas: {
    width: 800,
    height: 600,
    load: () => import("./asteroids/engine").then((m) => m.createAsteroids),
  },
};
