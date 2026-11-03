// ROCAS: caché del glow (SPEC 12). El glow (shadowBlur) de cada forma se pinta
// una sola vez en un canvas fuera de pantalla; en cada frame solo se copia con
// drawImage debajo de la forma, que se sigue trazando en vectorial y sin sombra.
// Así el trazo queda idéntico aunque la forma gire (nave, rocas) o cambie de
// alfa (chispas), y el coste del difuminado desaparece del frame.

import {
  BULLET_GLOW,
  FLAME_GLOW,
  POWERUP_GLOW,
  ROCK_GLOW,
  SHIP_GLOW,
  SPARK_GLOW,
  bulletShape,
  flameShape,
  powerUpFrameShape,
  powerUpTextShape,
  rockShape,
  shipShape,
  sparkShape,
  type Asteroid,
  type Palette,
} from "./entities";

export interface Sprite {
  canvas: HTMLCanvasElement; // solo el glow de la forma
  ox: number; // px entre el borde del sprite y el origen lógico de la forma
  oy: number;
}

// Clave por forma: "bullet", "ship", "flame:<2·len>", "spark:<2·len>",
// "pu:<4·r>", "pu-text". Las rocas (polígono propio) van por instancia.
type SpriteCache = Map<string, Sprite>;

export interface SpriteSet {
  get(key: string, palette: Palette): Sprite; // crea al primer uso, después reutiliza
  rock(asteroid: Asteroid, palette: Palette): Sprite; // por roca; se libera con ella
  clear(): void; // al cambiar de skin
}

type Shape = (c: CanvasRenderingContext2D) => void;

// Caja de la forma en coordenadas lógicas, con margen para el grosor del trazo.
interface Bounds {
  x0: number;
  y0: number;
  x1: number;
  y1: number;
}

/**
 * Pinta solo la sombra de `shape`: la forma se traza fuera del canvas y
 * shadowOffsetX (en px de dispositivo, sin transformar) trae la sombra dentro.
 * `pad = ceil(2 × shadowBlur)` por lado para que el difuminado no se recorte.
 */
function paintGlow(
  b: Bounds,
  blur: number,
  color: string,
  palette: Palette,
  shape: Shape,
): Sprite {
  const shadowBlur = blur * palette.glow;
  const pad = Math.ceil(2 * shadowBlur);
  const x0 = Math.floor(b.x0);
  const y0 = Math.floor(b.y0);
  const ox = pad - x0;
  const oy = pad - y0;
  const canvas = document.createElement("canvas");
  canvas.width = Math.ceil(b.x1) - x0 + 2 * pad;
  canvas.height = Math.ceil(b.y1) - y0 + 2 * pad;
  const c = canvas.getContext("2d");
  if (c) {
    const off = canvas.width + canvas.height;
    c.translate(ox - off, oy);
    c.shadowOffsetX = off;
    c.shadowColor = color;
    c.shadowBlur = shadowBlur;
    shape(c);
  }
  return { canvas, ox, oy };
}

function paint(key: string, palette: Palette): Sprite {
  const [type, a] = key.split(":");
  switch (type) {
    case "bullet":
      return paintGlow(
        { x0: -4, y0: -4, x1: 4, y1: 4 },
        BULLET_GLOW,
        palette.bullet,
        palette,
        (c) => bulletShape(c, palette),
      );
    case "ship":
      return paintGlow(
        { x0: -14, y0: -11, x1: 22, y1: 11 },
        SHIP_GLOW,
        palette.ship,
        palette,
        (c) => shipShape(c, palette),
      );
    case "flame": {
      const len = Number(a) / 2;
      return paintGlow(
        { x0: -10 - len, y0: -6, x1: -6, y1: 6 },
        FLAME_GLOW,
        palette.flame,
        palette,
        (c) => flameShape(c, palette, len),
      );
    }
    case "spark": {
      const len = Number(a) / 2;
      return paintGlow(
        { x0: -len - 2, y0: -2, x1: 2, y1: 2 },
        SPARK_GLOW,
        palette.spark,
        palette,
        (c) => sparkShape(c, palette, len),
      );
    }
    case "pu": {
      const r = Number(a) / 4;
      const e = r * Math.SQRT2 + 2; // marco girado 45° más medio trazo
      return paintGlow(
        { x0: -e, y0: -e, x1: e, y1: e },
        POWERUP_GLOW,
        palette.powerUp,
        palette,
        (c) => powerUpFrameShape(c, palette, r),
      );
    }
    default: // "pu-text"
      return paintGlow(
        { x0: -14, y0: -10, x1: 14, y1: 10 },
        POWERUP_GLOW,
        palette.powerUp,
        palette,
        (c) => powerUpTextShape(c, palette),
      );
  }
}

function paintRock(asteroid: Asteroid, palette: Palette): Sprite {
  const e = asteroid.radius + 2;
  return paintGlow(
    { x0: -e, y0: -e, x1: e, y1: e },
    ROCK_GLOW,
    palette.rock,
    palette,
    (c) => rockShape(c, palette, asteroid.verts),
  );
}

export function createSpriteSet(): SpriteSet {
  const cache: SpriteCache = new Map();
  let rocks = new WeakMap<Asteroid, Sprite>();
  return {
    get(key, palette) {
      let sprite = cache.get(key);
      if (!sprite) {
        sprite = paint(key, palette);
        cache.set(key, sprite);
      }
      return sprite;
    },
    rock(asteroid, palette) {
      let sprite = rocks.get(asteroid);
      if (!sprite) {
        sprite = paintRock(asteroid, palette);
        rocks.set(asteroid, sprite);
      }
      return sprite;
    },
    clear() {
      cache.clear();
      rocks = new WeakMap();
    },
  };
}
