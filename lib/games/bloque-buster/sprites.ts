// BLOQUE BUSTER: caché de sprites (modelo de la SPEC 12). Cada forma se pinta una
// sola vez, con su glow, en un canvas fuera de pantalla; en cada frame solo se
// copia con drawImage.

import {
  BALL_GLOW,
  BLOCK_GLOW,
  BLOCK_H,
  BLOCK_W,
  EXPLOSION_DURATION,
  EXPLOSION_GLOW,
  EXPLOSION_MAX_GROW,
  EXPLOSION_STEPS,
  PADDLE_GLOW,
  drawBall,
  drawBlock,
  drawExplosion,
  drawPaddle,
  type Palette,
} from "./entities";
import type { BlockColor } from "./levels";

export interface Sprite {
  canvas: HTMLCanvasElement; // forma ya pintada, glow incluido
  ox: number; // px entre el borde del sprite y el origen lógico (margen del glow)
  oy: number;
}

// Clave por forma: "block:<color>", "exp:<color>:<paso>", "paddle:<w>:<h>:<q>",
// "ball:<w>:<h>".
type SpriteCache = Map<string, Sprite>;

export interface SpriteSet {
  get(key: string, palette: Palette): Sprite; // crea al primer uso, después reutiliza
  clear(): void; // al cambiar de skin
}

// Paleta y pelota están en posiciones con decimales (la paleta empieza en
// x = 359,5). 1 px transparente extra por lado para que el borde con decimales
// no se recorte.
const SUBPIXEL_PAD = 1;

// La paleta se cachea por fracción de x en 1/PADDLE_SUBPX px y se pinta ya
// desplazada, porque base y extremos solapan su antialias (CLÁSICO) y un
// desplazamiento bilineal no lo reproduce. Con el paso fijo la paleta avanza
// 400/240 px por paso: sus posiciones son múltiplos de 1/6 px, exactas en 1/24.
export const PADDLE_SUBPX = 24;

function padFor(blur: number, palette: Palette): number {
  return Math.ceil(2 * blur * palette.glow);
}

function layer(w: number, h: number): HTMLCanvasElement {
  const canvas = document.createElement("canvas");
  canvas.width = w;
  canvas.height = h;
  return canvas;
}

/** Pinta la forma de `key` en un canvas nuevo con `pad` px libres por lado. */
function paint(key: string, palette: Palette): Sprite {
  const [type, a, b, frac] = key.split(":");
  switch (type) {
    case "block": {
      // El ladrillo se pinta 2 px hacia dentro de su celda: el origen lógico es
      // la esquina de la celda.
      const pad = padFor(BLOCK_GLOW, palette);
      const canvas = layer(BLOCK_W - 4 + 2 * pad, BLOCK_H - 4 + 2 * pad);
      const c = canvas.getContext("2d");
      if (c) {
        drawBlock(
          c,
          {
            x: pad - 2,
            y: pad - 2,
            w: BLOCK_W,
            h: BLOCK_H,
            color: a as BlockColor,
            alive: true,
          },
          palette,
        );
      }
      return { canvas, ox: pad - 2, oy: pad - 2 };
    }
    case "exp": {
      // El destello crece hasta 12 px por lado con bordes en medio píxel; el
      // origen lógico (esquina del bloque) es entero, así que se pinta exacto.
      const pad = EXPLOSION_MAX_GROW + padFor(EXPLOSION_GLOW, palette);
      const canvas = layer(BLOCK_W + 2 * pad, BLOCK_H + 2 * pad);
      const c = canvas.getContext("2d");
      if (c) {
        drawExplosion(
          c,
          {
            x: pad,
            y: pad,
            w: BLOCK_W,
            h: BLOCK_H,
            color: a as BlockColor,
            elapsed: (Number(b) * EXPLOSION_DURATION) / EXPLOSION_STEPS,
          },
          palette,
        );
      }
      return { canvas, ox: pad, oy: pad };
    }
    default: {
      // "paddle:<w>:<h>:<fracción>" y "ball:<w>:<h>": rectángulos con glow. La
      // paleta se pinta desplazada `fracción / PADDLE_SUBPX` px a la derecha.
      const isPaddle = type === "paddle";
      const w = Number(a);
      const h = Number(b);
      const dx = isPaddle ? Number(frac) / PADDLE_SUBPX : 0;
      const pad =
        padFor(isPaddle ? PADDLE_GLOW : BALL_GLOW, palette) + SUBPIXEL_PAD;
      const canvas = layer(w + 2 * pad, h + 2 * pad);
      const c = canvas.getContext("2d");
      if (c) {
        const rect = { x: pad + dx, y: pad, w, h };
        if (isPaddle) drawPaddle(c, rect, palette);
        else drawBall(c, { ...rect, vx: 0, vy: 0 }, palette);
      }
      return { canvas, ox: pad, oy: pad };
    }
  }
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

// Claves precalculadas para no crear strings en cada frame.
export const BLOCK_KEYS = {} as Record<BlockColor, string>;
export const EXPLOSION_KEYS = {} as Record<BlockColor, string[]>;
for (const color of [
  "red",
  "yellow",
  "cyan",
  "magenta",
  "hotpink",
  "green",
  "gray",
] as BlockColor[]) {
  BLOCK_KEYS[color] = `block:${color}`;
  EXPLOSION_KEYS[color] = Array.from(
    { length: EXPLOSION_STEPS },
    (_, step) => `exp:${color}:${step}`,
  );
}
