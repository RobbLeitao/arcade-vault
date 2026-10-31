import type { CreateGame } from "./contract";

export interface EngineEntry {
  width: number; // resolución lógica del canvas
  height: number;
  levels?: number; // nº de niveles seleccionables en la pausa; ausente = sin selector
  load: () => Promise<CreateGame>; // import() dinámico: un chunk por motor
}

export const ENGINES: Record<string, EngineEntry> = {
  rocas: {
    width: 800,
    height: 600,
    load: () => import("./asteroids/engine").then((m) => m.createAsteroids),
  },
  caida: {
    width: 420,
    height: 600,
    load: () => import("./caida/engine").then((m) => m.createCaida),
  },
  "bloque-buster": {
    width: 800,
    height: 600,
    levels: 5,
    load: () =>
      import("./bloque-buster/engine").then((m) => m.createBloqueBuster),
  },
  serpentina: {
    width: 800,
    height: 600,
    load: async () => {
      const m = await import("./serpentina/engine");
      await m.loadFruitSprites();
      return m.createSerpentina;
    },
  },
};
