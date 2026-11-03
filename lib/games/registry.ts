import type { CreateGame } from "./contract";
import type { TouchButton, TouchLayout } from "./touch";

export interface EngineEntry {
  width: number; // resolución lógica del canvas
  height: number;
  levels?: number; // nº de niveles seleccionables en la pausa; ausente = sin selector
  skins?: true; // tiene los skins CLÁSICO, NEÓN y RETRO (selector en la pausa)
  touch?: TouchLayout; // mando táctil (solo con pointer coarse); ausente = sin mando
  load: () => Promise<CreateGame>; // import() dinámico: un chunk por motor
}

// Botones de dirección compartidos; el `aria` cambia según lo que hace cada juego.
const btn = (code: string, label: string, aria: string): TouchButton => ({
  code,
  label,
  aria,
});

export const ENGINES: Record<string, EngineEntry> = {
  rocas: {
    width: 800,
    height: 600,
    skins: true,
    touch: {
      move: [
        btn("ArrowLeft", "←", "Girar a la izquierda"),
        btn("ArrowRight", "→", "Girar a la derecha"),
        btn("ArrowUp", "↑", "Empujar"),
      ],
      moveShape: "row",
      actions: [btn("Space", "FUEGO", "Disparar")],
    },
    load: () => import("./asteroids/engine").then((m) => m.createAsteroids),
  },
  caida: {
    width: 420,
    height: 600,
    skins: true,
    touch: {
      // CAÍDA avanza una celda por keydown: estos tres emulan la autorrepetición.
      move: [
        { ...btn("ArrowLeft", "←", "Mover a la izquierda"), repeat: true },
        { ...btn("ArrowRight", "→", "Mover a la derecha"), repeat: true },
        { ...btn("ArrowDown", "↓", "Bajar la pieza"), repeat: true },
      ],
      moveShape: "row",
      actions: [
        btn("ArrowUp", "ROTAR", "Rotar la pieza"),
        btn("Space", "SOLTAR", "Soltar la pieza"),
      ],
    },
    load: () => import("./caida/engine").then((m) => m.createCaida),
  },
  "bloque-buster": {
    width: 800,
    height: 600,
    levels: 5,
    skins: true,
    touch: {
      move: [
        btn("ArrowLeft", "←", "Mover la paleta a la izquierda"),
        btn("ArrowRight", "→", "Mover la paleta a la derecha"),
      ],
      moveShape: "row",
      actions: [],
    },
    load: () =>
      import("./bloque-buster/engine").then((m) => m.createBloqueBuster),
  },
  serpentina: {
    width: 800,
    height: 600,
    skins: true,
    touch: {
      // Cruceta: el componente coloca cada botón por su `code`.
      move: [
        btn("ArrowUp", "↑", "Girar hacia arriba"),
        btn("ArrowLeft", "←", "Girar a la izquierda"),
        btn("ArrowRight", "→", "Girar a la derecha"),
        btn("ArrowDown", "↓", "Girar hacia abajo"),
      ],
      moveShape: "cross",
      actions: [],
    },
    load: async () => {
      const m = await import("./serpentina/engine");
      await m.loadFruitSprites();
      return m.createSerpentina;
    },
  },
  ranaria: {
    width: 640,
    height: 560,
    skins: true,
    touch: {
      // Cruceta: un toque = un salto; sin autorrepetición.
      move: [
        btn("ArrowUp", "↑", "Saltar hacia arriba"),
        btn("ArrowLeft", "←", "Saltar a la izquierda"),
        btn("ArrowRight", "→", "Saltar a la derecha"),
        btn("ArrowDown", "↓", "Saltar hacia abajo"),
      ],
      moveShape: "cross",
      actions: [],
    },
    load: () => import("./ranaria/engine").then((m) => m.createRanaria),
  },
};
