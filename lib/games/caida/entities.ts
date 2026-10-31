export const COLS = 10;
export const ROWS = 20;
export const BLOCK = 30;
export const BOARD_W = COLS * BLOCK; // 300
export const W = 420; // BOARD_W + panel lateral de 120 px
export const H = ROWS * BLOCK; // 600
export const LINE_SCORES = [0, 100, 300, 500, 800];
export const KICKS = [0, -1, 1, -2, 2];

// Índice 1..8 = I, O, T, S, Z, J, L, N (tuerca). Las celdas guardan su índice.
export const PIECES: (number[][] | null)[] = [
  null,
  [
    [0, 0, 0, 0],
    [1, 1, 1, 1],
    [0, 0, 0, 0],
    [0, 0, 0, 0],
  ], // I
  [
    [2, 2],
    [2, 2],
  ], // O
  [
    [0, 3, 0],
    [3, 3, 3],
    [0, 0, 0],
  ], // T
  [
    [0, 4, 4],
    [4, 4, 0],
    [0, 0, 0],
  ], // S
  [
    [5, 5, 0],
    [0, 5, 5],
    [0, 0, 0],
  ], // Z
  [
    [6, 0, 0],
    [6, 6, 6],
    [0, 0, 0],
  ], // J
  [
    [0, 0, 7],
    [7, 7, 7],
    [0, 0, 0],
  ], // L
  [
    [8, 8, 8],
    [8, 0, 8],
    [8, 8, 8],
  ], // N (tuerca)
];

export type Board = number[][];

export interface Piece {
  type: number; // 1..8
  shape: number[][]; // matriz cuadrada; las celdas guardan el índice de color
  x: number; // columna de la esquina superior izquierda
  y: number; // fila; 0 al aparecer
}

export interface Palette {
  colors: (string | null)[]; // índice 0 = null; 1..8 = color de cada pieza
  grid: string; // línea de la cuadrícula
  label: string; // texto "SIGUIENTE"
}

export function createBoard(): Board {
  return Array.from({ length: ROWS }, () => new Array<number>(COLS).fill(0));
}

export function collide(
  board: Board,
  shape: number[][],
  ox: number,
  oy: number,
): boolean {
  for (let r = 0; r < shape.length; r++) {
    for (let c = 0; c < shape[r].length; c++) {
      if (!shape[r][c]) continue;
      const nx = ox + c;
      const ny = oy + r;
      if (nx < 0 || nx >= COLS || ny >= ROWS) return true;
      if (ny >= 0 && board[ny][nx]) return true;
    }
  }
  return false;
}

export function rotateCW(shape: number[][]): number[][] {
  const rows = shape.length;
  const cols = shape[0].length;
  const result = Array.from({ length: cols }, () =>
    new Array<number>(rows).fill(0),
  );
  for (let r = 0; r < rows; r++)
    for (let c = 0; c < cols; c++) result[c][rows - 1 - r] = shape[r][c];
  return result;
}

// Bloque neón en coordenadas de celda (x, y); el llamante traslada el contexto
// si dibuja fuera del tablero.
export function drawBlock(
  ctx: CanvasRenderingContext2D,
  palette: Palette,
  x: number,
  y: number,
  colorIndex: number,
  alpha = 1,
) {
  const color = palette.colors[colorIndex];
  if (!color) return;
  const px = x * BLOCK + 1;
  const py = y * BLOCK + 1;
  const size = BLOCK - 2;
  ctx.save();
  ctx.globalAlpha = alpha;
  ctx.shadowColor = color;
  ctx.shadowBlur = 8;
  ctx.fillStyle = color;
  ctx.fillRect(px, py, size, size);
  ctx.shadowBlur = 0;
  ctx.fillStyle = "rgba(255,255,255,0.14)";
  ctx.fillRect(px, py, size, 4);
  ctx.restore();
}
