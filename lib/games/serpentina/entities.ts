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

export interface Palette {
  snake: string; // --green
  head: string; // --green, más claro
  grid: string; // --ink con baja opacidad
  fallback: string; // --magenta; fruta si la imagen no cargó
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

// Cuerpo con rectángulos redondeados y brillo neón; la cabeza (índice 0) es más
// clara y lleva dos ojos mirando hacia `dir`.
export function drawSnake(
  ctx: CanvasRenderingContext2D,
  palette: Palette,
  snake: Cell[],
  dir: Direction,
) {
  const size = CELL - SNAKE_INSET * 2;
  ctx.save();
  ctx.shadowColor = palette.snake;
  ctx.shadowBlur = 10;
  ctx.fillStyle = palette.snake;
  for (let i = snake.length - 1; i >= 1; i--) {
    const { col, row } = snake[i];
    ctx.beginPath();
    ctx.roundRect(
      col * CELL + SNAKE_INSET,
      row * CELL + SNAKE_INSET,
      size,
      size,
      8,
    );
    ctx.fill();
  }

  const head = snake[0];
  const hx = head.col * CELL;
  const hy = head.row * CELL;
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
    ctx.fillStyle = "#fff";
    ctx.beginPath();
    ctx.arc(ex, ey, 4.5, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = "#06130a";
    ctx.beginPath();
    ctx.arc(ex + fx * 1.5, ey + fy * 1.5, 2.2, 0, Math.PI * 2);
    ctx.fill();
  }
  ctx.restore();
}

// Fruta desde fruits.png, escalada a 36 px de alto y centrada en su celda. Si la
// imagen no cargó (`image` null) dibuja un círculo de `palette.fallback`.
export function drawFruit(
  ctx: CanvasRenderingContext2D,
  palette: Palette,
  fruit: Fruit,
  image: HTMLImageElement | null,
) {
  const cx = fruit.col * CELL + CELL / 2;
  const cy = fruit.row * CELL + CELL / 2;
  ctx.save();
  if (!image) {
    ctx.shadowColor = palette.fallback;
    ctx.shadowBlur = 10;
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
  ctx.imageSmoothingEnabled = false;
  ctx.drawImage(image, s.x, s.y, s.w, s.h, cx - dw / 2, cy - dh / 2, dw, dh);
  ctx.restore();
}
