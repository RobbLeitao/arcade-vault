export const W = 800;
export const H = 600;
export const CELL = 40;
export const COLS = 20; // W / CELL
export const ROWS = 15; // H / CELL
export const START_LENGTH = 3;
export const START_COL = 7; // cabeza; el cuerpo queda en 6 y 5
export const START_ROW = 7;
export const POINTS_PER_FRUIT = 10;
export const FRUITS_PER_LEVEL = 5;
export const STEP_BASE_MS = 150;
export const STEP_DECREASE_MS = 10; // por nivel
export const STEP_MIN_MS = 70;
export const MAX_QUEUED_TURNS = 2;

const FRUIT_MARGIN = 2; // px por lado dentro de la celda
const SNAKE_INSET = 2;
const TAPER_SEGMENTS = 3; // piezas de la cola que se afinan
const OUTLINE_PX = 1.5; // grosor del contorno de la fruta, en px del canvas

export type Direction = "up" | "down" | "left" | "right";

export interface Cell {
  col: number; // 0..COLS-1
  row: number; // 0..ROWS-1
}

export interface Fruit extends Cell {
  sprite: FruitName; // fruta elegida al aparecer
}

// Recorte dentro de fruits.png (fila pixel-art, y = 136, h = 160), de sprites.js.
export type FruitName =
  | "banana"
  | "orange"
  | "grape"
  | "garlic"
  | "eggplant"
  | "strawberry"
  | "cherry"
  | "carrot"
  | "mushroom"
  | "broccoli"
  | "watermelon"
  | "pepper"
  | "kiwi"
  | "lemon"
  | "peach"
  | "peanut"
  | "apple"
  | "tomato"
  | "berries"
  | "grapes2"
  | "pineapple"
  | "melon";

export interface SpriteRect {
  x: number;
  y: number;
  w: number;
  h: number;
}

export const FRUIT_SPRITES: Record<FruitName, SpriteRect> = {
  banana: { x: 34, y: 136, w: 110, h: 160 },
  orange: { x: 186, y: 136, w: 150, h: 160 },
  grape: { x: 378, y: 136, w: 110, h: 160 },
  garlic: { x: 540, y: 136, w: 130, h: 160 },
  eggplant: { x: 712, y: 136, w: 130, h: 160 },
  strawberry: { x: 894, y: 136, w: 110, h: 160 },
  cherry: { x: 1066, y: 136, w: 110, h: 160 },
  carrot: { x: 1228, y: 136, w: 130, h: 160 },
  mushroom: { x: 1400, y: 136, w: 130, h: 160 },
  broccoli: { x: 1582, y: 136, w: 110, h: 160 },
  watermelon: { x: 1734, y: 136, w: 150, h: 160 },
  pepper: { x: 1906, y: 136, w: 150, h: 160 },
  kiwi: { x: 2068, y: 136, w: 170, h: 160 },
  lemon: { x: 2250, y: 136, w: 140, h: 160 },
  peach: { x: 2432, y: 136, w: 130, h: 160 },
  peanut: { x: 2604, y: 136, w: 130, h: 160 },
  apple: { x: 2786, y: 136, w: 110, h: 160 },
  tomato: { x: 2948, y: 136, w: 130, h: 160 },
  berries: { x: 3110, y: 136, w: 150, h: 160 },
  grapes2: { x: 3302, y: 136, w: 110, h: 160 },
  pineapple: { x: 3454, y: 136, w: 150, h: 160 },
  melon: { x: 3637, y: 136, w: 130, h: 160 },
};

export const FRUIT_NAMES = Object.keys(FRUIT_SPRITES) as FruitName[];

export type Rgb = readonly [number, number, number];

// Paleta de un skin (ver ./skins.ts). Los efectos son campos, no ramas por skin.
export interface Palette {
  snake: string; // cuerpo
  head: string; // cabeza, distinta del cuerpo
  eyeWhite: string;
  pupil: string;
  grid: string; // rejilla decorativa
  fallback: string; // fruta si la imagen no cargó
  background: string | null; // null = clearRect (se ve el negro de .crt-screen)
  glow: number; // multiplicador del shadowBlur; 0 = sin glow
  fruitHalo: { rgb: string; alpha: number } | null; // halo radial tras la fruta
  fruitTint: { dark: Rgb; light: Rgb } | null; // rampa de tintado del atlas
  fruitOutline: string | null; // contorno plano alrededor de la silueta
  scanlines: number; // opacidad de las scanlines; 0 = ninguna
  vignette: number; // opacidad de la viñeta en las esquinas; 0 = ninguna
}

export function stepMs(level: number): number {
  return Math.max(STEP_MIN_MS, STEP_BASE_MS - STEP_DECREASE_MS * (level - 1));
}

export function drawGrid(ctx: CanvasRenderingContext2D, palette: Palette) {
  ctx.save();
  ctx.strokeStyle = palette.grid;
  ctx.lineWidth = 1;
  ctx.beginPath();
  for (let c = 1; c < COLS; c++) {
    ctx.moveTo(c * CELL + 0.5, 0);
    ctx.lineTo(c * CELL + 0.5, H);
  }
  for (let r = 1; r < ROWS; r++) {
    ctx.moveTo(0, r * CELL + 0.5);
    ctx.lineTo(W, r * CELL + 0.5);
  }
  ctx.stroke();
  ctx.restore();
}

export const SNAKE_GLOW = 14; // shadowBlur del cuerpo con glow = 1
export const FRUIT_GLOW = 10; // shadowBlur del círculo de respaldo con glow = 1

// Margen (px) de la pieza `i` del cuerpo: las tres últimas se afinan hacia la cola.
export function segmentInset(i: number, length: number): number {
  const fromTail = length - 1 - i;
  return SNAKE_INSET + Math.max(0, TAPER_SEGMENTS - fromTail);
}

function snakeGlow(ctx: CanvasRenderingContext2D, palette: Palette) {
  ctx.shadowColor = palette.snake;
  ctx.shadowBlur = SNAKE_GLOW * palette.glow;
}

// Pieza del cuerpo en la celda de origen (x, y), con su glow.
export function drawSegment(
  ctx: CanvasRenderingContext2D,
  palette: Palette,
  x: number,
  y: number,
  inset: number,
) {
  ctx.save();
  snakeGlow(ctx, palette);
  ctx.fillStyle = palette.snake;
  ctx.beginPath();
  ctx.roundRect(x + inset, y + inset, CELL - inset * 2, CELL - inset * 2, 8);
  ctx.fill();
  ctx.restore();
}

// Puente entre dos piezas contiguas para que el cuerpo se lea continuo; (x, y)
// es el origen de la celda de menor columna/fila de las dos.
export function drawBridge(
  ctx: CanvasRenderingContext2D,
  palette: Palette,
  x: number,
  y: number,
  inset: number,
  horizontal: boolean,
) {
  const size = CELL - inset * 2;
  ctx.save();
  snakeGlow(ctx, palette);
  ctx.fillStyle = palette.snake;
  if (horizontal) ctx.fillRect(x + CELL / 2, y + inset, CELL, size);
  else ctx.fillRect(x + inset, y + CELL / 2, size, CELL);
  ctx.restore();
}

// Cabeza más clara, con glow, y dos ojos (sin glow) mirando hacia `dir`.
export function drawHead(
  ctx: CanvasRenderingContext2D,
  palette: Palette,
  hx: number,
  hy: number,
  dir: Direction,
) {
  ctx.save();
  snakeGlow(ctx, palette);
  ctx.fillStyle = palette.head;
  ctx.beginPath();
  ctx.roundRect(hx + 1, hy + 1, CELL - 2, CELL - 2, 10);
  ctx.fill();

  ctx.shadowBlur = 0;
  const cx = hx + CELL / 2;
  const cy = hy + CELL / 2;
  const fx = dir === "right" ? 1 : dir === "left" ? -1 : 0; // adelante
  const fy = dir === "down" ? 1 : dir === "up" ? -1 : 0;
  const sx = -fy; // lateral (perpendicular a la marcha)
  const sy = fx;
  for (const side of [-1, 1]) {
    const ex = cx + fx * 7 + sx * side * 8;
    const ey = cy + fy * 7 + sy * side * 8;
    ctx.fillStyle = palette.eyeWhite;
    ctx.beginPath();
    ctx.arc(ex, ey, 4.5, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = palette.pupil;
    ctx.beginPath();
    ctx.arc(ex + fx * 1.5, ey + fy * 1.5, 2.2, 0, Math.PI * 2);
    ctx.fill();
  }
  ctx.restore();
}

// Fruta desde fruits.png (o su copia tintada del skin), escalada a 36 px de alto
// y centrada en su celda; `outline` es la silueta del atlas para el contorno. Si
// la imagen no cargó (`image` null) dibuja un círculo de `palette.fallback`.
export function drawFruit(
  ctx: CanvasRenderingContext2D,
  palette: Palette,
  fruit: Fruit,
  image: CanvasImageSource | null,
  outline: CanvasImageSource | null,
) {
  const cx = fruit.col * CELL + CELL / 2;
  const cy = fruit.row * CELL + CELL / 2;
  ctx.save();
  if (!image) {
    ctx.shadowColor = palette.fallback;
    ctx.shadowBlur = FRUIT_GLOW * palette.glow;
    ctx.fillStyle = palette.fallback;
    ctx.beginPath();
    ctx.arc(cx, cy, CELL / 2 - FRUIT_MARGIN - 4, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();
    return;
  }
  const s = FRUIT_SPRITES[fruit.sprite];
  const dh = CELL - FRUIT_MARGIN * 2;
  const dw = (s.w * dh) / s.h;
  // Halo suave para que la fruta destaque sobre el fondo oscuro
  if (palette.fruitHalo) {
    const { rgb, alpha } = palette.fruitHalo;
    const halo = ctx.createRadialGradient(cx, cy, 2, cx, cy, CELL / 2 + 4);
    halo.addColorStop(0, `rgba(${rgb}, ${alpha})`);
    halo.addColorStop(1, `rgba(${rgb}, 0)`);
    ctx.fillStyle = halo;
    ctx.fillRect(cx - CELL, cy - CELL, CELL * 2, CELL * 2);
  }
  ctx.imageSmoothingEnabled = false;
  const dx = cx - dw / 2;
  const dy = cy - dh / 2;
  if (outline) {
    for (const [ox, oy] of OUTLINE_OFFSETS)
      ctx.drawImage(outline, s.x, s.y, s.w, s.h, dx + ox, dy + oy, dw, dh);
  }
  ctx.drawImage(image, s.x, s.y, s.w, s.h, dx, dy, dw, dh);
  ctx.restore();
}

const OUTLINE_OFFSETS = [-1, 0, 1].flatMap((x) =>
  [-1, 0, 1]
    .filter((y) => x !== 0 || y !== 0)
    .map((y) => [x * OUTLINE_PX, y * OUTLINE_PX] as const),
);

// Silueta del atlas rellena de un color plano (para el contorno de la fruta).
export function silhouetteAtlas(
  image: HTMLImageElement,
  color: string,
): HTMLCanvasElement | null {
  const canvas = document.createElement("canvas");
  canvas.width = image.naturalWidth;
  canvas.height = image.naturalHeight;
  const c = canvas.getContext("2d");
  if (!c) return null;
  c.drawImage(image, 0, 0);
  c.globalCompositeOperation = "source-in";
  c.fillStyle = color;
  c.fillRect(0, 0, canvas.width, canvas.height);
  return canvas;
}

// Copia del atlas tintada en una rampa de dos colores según el brillo de cada
// píxel: conserva silueta, alfa y sombreado. Devuelve null si no se puede leer.
export function tintAtlas(
  image: HTMLImageElement,
  tint: { dark: Rgb; light: Rgb },
): HTMLCanvasElement | null {
  try {
    const canvas = document.createElement("canvas");
    canvas.width = image.naturalWidth;
    canvas.height = image.naturalHeight;
    const c = canvas.getContext("2d");
    if (!c) return null;
    c.drawImage(image, 0, 0);
    const data = c.getImageData(0, 0, canvas.width, canvas.height);
    const px = data.data;
    const [dr, dg, db] = tint.dark;
    const [lr, lg, lb] = tint.light;
    for (let i = 0; i < px.length; i += 4) {
      if (px[i + 3] === 0) continue;
      const t = (0.299 * px[i] + 0.587 * px[i + 1] + 0.114 * px[i + 2]) / 255;
      px[i] = dr + (lr - dr) * t;
      px[i + 1] = dg + (lg - dg) * t;
      px[i + 2] = db + (lb - db) * t;
    }
    c.putImageData(data, 0, 0);
    return canvas;
  } catch {
    return null;
  }
}
