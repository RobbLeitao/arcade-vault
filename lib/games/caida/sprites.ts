// CAÍDA: caché de sprites (técnica de la SPEC 12). Cada bloque de la pieza en
// juego y de su fantasma se pinta una sola vez, con su glow, en un canvas fuera
// de pantalla; en cada frame solo se copia con drawImage.

import {
  BLOCK,
  BLOCK_GLOW,
  drawBlock,
  drawGhostBlock,
  type Palette,
} from "./entities";

export interface Sprite {
  canvas: HTMLCanvasElement; // bloque ya pintado, glow incluido
  ox: number; // px entre el borde del sprite y la esquina de la celda (margen)
  oy: number;
}

// Claves: "block:<color>" (bloque de pieza) y "ghost:<color>" (pieza fantasma,
// con el estilo del skin: rellena, contorno o discontinua).
type SpriteCache = Map<string, Sprite>;

export interface SpriteSet {
  get(key: string, palette: Palette): Sprite; // crea al primer uso, después reutiliza
  clear(): void; // al cambiar de skin
}

// Claves precalculadas por índice de color (0..8): sin concatenar por frame.
export const BLOCK_KEYS = Array.from({ length: 9 }, (_, i) => `block:${i}`);
export const GHOST_KEYS = Array.from({ length: 9 }, (_, i) => `ghost:${i}`);

// Margen extra sobre el glow (trazo de la fantasma).
const EXTRA_PAD = 2;

/** Pinta el bloque de `key` en un canvas nuevo con `pad` px libres por lado. */
function paint(key: string, palette: Palette): Sprite {
  const [type, color] = key.split(":");
  const pad = Math.ceil(2 * BLOCK_GLOW * palette.glow) + EXTRA_PAD;
  const canvas = document.createElement("canvas");
  canvas.width = BLOCK + 2 * pad;
  canvas.height = BLOCK + 2 * pad;
  const c = canvas.getContext("2d");
  if (c) {
    c.translate(pad, pad);
    if (type === "ghost") drawGhostBlock(c, palette, 0, 0, Number(color));
    else drawBlock(c, palette, 0, 0, Number(color));
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
