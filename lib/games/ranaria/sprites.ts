// RANARIA: caché de sprites (SPEC 12). Cada forma se pinta una sola vez, con su
// glow, en un canvas fuera de pantalla; en cada frame solo se copia con drawImage.

import {
  CELL,
  FROG_GLOW,
  GLOW,
  drawCar,
  drawFrogShape,
  drawLog,
  drawTruck,
  drawTurtles,
  type Direction,
  type Palette,
} from "./entities";

export interface Sprite {
  canvas: HTMLCanvasElement; // forma ya pintada, glow incluido
  ox: number; // px entre el borde del sprite y el origen lógico (margen del glow)
  oy: number;
}

// Clave por forma, p. ej. "car:0:1", "truck:3:-1", "log:4",
// "turtle:2:up", "turtle:3:down", "frog:left:jump", "frog:up:rest".
type SpriteCache = Map<string, Sprite>;

export interface SpriteSet {
  get(key: string, palette: Palette): Sprite; // crea al primer uso, después reutiliza
  clear(): void; // al cambiar de skin
}

// Margen extra sobre el glow: la silueta de la rana (patas estiradas con trazo
// de 9 px) sobresale de su celda aunque el skin no tenga glow.
const STROKE_PAD = 4;

function padFor(blur: number, palette: Palette): number {
  return Math.ceil(2 * blur * palette.glow) + STROKE_PAD;
}

/** Pinta la forma de `key` en un canvas nuevo con `pad` px libres por lado. */
function paint(key: string, palette: Palette): Sprite {
  const [type, a, b] = key.split(":");
  const isFrog = type === "frog";
  const pad = padFor(isFrog ? FROG_GLOW : GLOW, palette);
  // Ancho en celdas: coche y rana ocupan 1; el resto lo lleva en la clave.
  const cells = isFrog || type === "car" ? 1 : Number(a);
  const canvas = document.createElement("canvas");
  canvas.width = cells * CELL + 2 * pad;
  canvas.height = CELL + 2 * pad;
  const c = canvas.getContext("2d");
  if (c) {
    c.save();
    c.translate(pad, pad);
    switch (type) {
      case "car":
        // En los coches `a` es la variante de color, no el ancho.
        drawCar(c, palette, 0, 0, Number(a), Number(b) as 1 | -1);
        break;
      case "truck":
        drawTruck(c, palette, 0, 0, Number(a), Number(b) as 1 | -1);
        break;
      case "log":
        drawLog(c, palette, 0, 0, Number(a));
        break;
      case "turtle":
        drawTurtles(c, palette, 0, 0, Number(a), b === "down");
        break;
      case "frog":
        drawFrogShape(
          c,
          palette,
          CELL / 2,
          CELL / 2,
          a as Direction,
          b === "jump",
        );
        break;
    }
    c.restore();
  }
  return { canvas, ox: pad, oy: pad };
}

export function createSpriteSet(): SpriteSet {
  const cache: SpriteCache = new Map();
  return {
    get(key, palette) {
      let sprite = cache.get(key);
      if (!sprite) {
        sprite = paint(key, palette);
        cache.set(key, sprite);
      }
      return sprite;
    },
    clear() {
      cache.clear();
    },
  };
}
