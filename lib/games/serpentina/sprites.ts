// SERPENTINA: caché de sprites (modelo de la SPEC 12). Cada forma se pinta una
// sola vez, con su glow, en un canvas fuera de pantalla; en cada frame solo se
// copia con drawImage.

import {
  CELL,
  SNAKE_GLOW,
  drawBridge,
  drawFruit,
  drawHead,
  drawSegment,
  type Direction,
  type FruitName,
  type Palette,
} from "./entities";

export interface Sprite {
  canvas: HTMLCanvasElement; // forma ya pintada, glow incluido
  ox: number; // px entre el borde del sprite y el origen de su celda
  oy: number;
}

// Arte de la fruta del skin vigente (atlas tintado y silueta del contorno).
export interface FruitArt {
  image: CanvasImageSource | null;
  outline: CanvasImageSource | null;
}

// Clave por forma: "seg:<inset>", "bridge:h:<inset>", "bridge:v:<inset>",
// "head:<dir>", "fruit:<nombre>" o "fruit:none" (círculo de respaldo).
type SpriteCache = Map<string, Sprite>;

export interface SpriteSet {
  get(key: string, palette: Palette, art: FruitArt): Sprite; // crea al primer uso
  clear(): void; // al cambiar de skin
}

// Margen extra sobre el glow para el antialiasing de los bordes.
const EDGE_PAD = 1;

function padFor(blur: number, palette: Palette): number {
  return Math.ceil(2 * blur * palette.glow) + EDGE_PAD;
}

function canvasOf(w: number, h: number) {
  const canvas = document.createElement("canvas");
  canvas.width = w;
  canvas.height = h;
  return canvas;
}

/** Pinta la forma de `key` en un canvas nuevo con margen para el glow. */
function paint(key: string, palette: Palette, art: FruitArt): Sprite {
  const [type, a, b] = key.split(":");

  if (type === "fruit") {
    // La fruta (con su halo de 2 × CELL) se pinta en la celda (1, 1) de un
    // lienzo de 3 × 3 celdas: el glow del respaldo (2 × FRUIT_GLOW px) también
    // cabe. Con "none" (imagen sin cargar) drawFruit no usa el nombre.
    const canvas = canvasOf(CELL * 3, CELL * 3);
    const c = canvas.getContext("2d");
    const none = a === "none";
    if (c)
      drawFruit(
        c,
        palette,
        { col: 1, row: 1, sprite: (none ? "apple" : a) as FruitName },
        none ? null : art.image,
        none ? null : art.outline,
      );
    return { canvas, ox: CELL, oy: CELL };
  }

  const pad = padFor(SNAKE_GLOW, palette);
  const horizontal = type === "bridge" && a === "h";
  const vertical = type === "bridge" && a === "v";
  const canvas = canvasOf(
    (horizontal ? CELL * 2 : CELL) + 2 * pad,
    (vertical ? CELL * 2 : CELL) + 2 * pad,
  );
  const c = canvas.getContext("2d");
  if (c) {
    switch (type) {
      case "seg":
        drawSegment(c, palette, pad, pad, Number(a));
        break;
      case "bridge":
        drawBridge(c, palette, pad, pad, Number(b), horizontal);
        break;
      case "head":
        drawHead(c, palette, pad, pad, a as Direction);
        break;
    }
  }
  return { canvas, ox: pad, oy: pad };
}

export function createSpriteSet(): SpriteSet {
  const cache: SpriteCache = new Map();
  return {
    get(key, palette, art) {
      let sprite = cache.get(key);
      if (!sprite) {
        sprite = paint(key, palette, art);
        cache.set(key, sprite);
      }
      return sprite;
    },
    clear() {
      cache.clear();
    },
  };
}
