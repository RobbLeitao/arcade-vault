import type { BlockColor } from "./levels";

export const W = 800;
export const H = 600;
export const PADDLE_SPEED = 400;
export const BLOCK_COLS = 10;
export const BLOCK_ROWS = 6;
export const BLOCK_W = 64;
export const BLOCK_H = 24;
export const BLOCKS_ORIGIN_X = (W - BLOCK_COLS * BLOCK_W) / 2; // 80
export const BLOCKS_ORIGIN_Y = 80;
export const BASE_BALL_VX = 200;
export const BASE_BALL_VY = -300;
export const EXPLOSION_DURATION = 150; // ms
export const EXPLOSION_STEPS = 4;
export const POINTS_PER_BLOCK = 10;
export const START_LIVES = 3;

export interface Rect {
  x: number;
  y: number;
  w: number;
  h: number;
}
export type Paddle = Rect; // w 81, h 14, y 560
export interface Ball extends Rect {
  vx: number;
  vy: number;
} // w 16, h 16
export interface Block extends Rect {
  color: BlockColor;
  alive: boolean;
}
export interface Explosion extends Rect {
  color: BlockColor;
  elapsed: number; // ms
}

export interface Palette {
  blocks: Record<BlockColor, string>; // cian, amarillo, magenta y verde del tema; rojo, rosa y gris fijos
  paddle: string; // --cyan
  ball: string; // --ink
}

export function collideAABB(a: Rect, b: Rect): boolean {
  return (
    a.x < b.x + b.w && a.x + a.w > b.x && a.y < b.y + b.h && a.y + a.h > b.y
  );
}

// Bloque neón: relleno con brillo moderado y un filo claro arriba.
export function drawBlock(
  ctx: CanvasRenderingContext2D,
  block: Block,
  palette: Palette,
) {
  const color = palette.blocks[block.color];
  const x = block.x + 1;
  const y = block.y + 1;
  const w = block.w - 2;
  const h = block.h - 2;
  ctx.save();
  ctx.shadowColor = color;
  ctx.shadowBlur = 6;
  ctx.fillStyle = color;
  ctx.fillRect(x, y, w, h);
  ctx.shadowBlur = 0;
  ctx.fillStyle = "rgba(255,255,255,0.18)";
  ctx.fillRect(x, y, w, 4);
  ctx.restore();
}

export function drawPaddle(
  ctx: CanvasRenderingContext2D,
  paddle: Paddle,
  palette: Palette,
) {
  ctx.save();
  ctx.shadowColor = palette.paddle;
  ctx.shadowBlur = 12;
  ctx.fillStyle = palette.paddle;
  ctx.fillRect(paddle.x, paddle.y, paddle.w, paddle.h);
  ctx.shadowBlur = 0;
  ctx.fillStyle = "rgba(255,255,255,0.35)";
  ctx.fillRect(paddle.x, paddle.y, paddle.w, 3);
  ctx.restore();
}

export function drawBall(
  ctx: CanvasRenderingContext2D,
  ball: Ball,
  palette: Palette,
) {
  ctx.save();
  ctx.shadowColor = palette.ball;
  ctx.shadowBlur = 10;
  ctx.fillStyle = palette.ball;
  ctx.fillRect(ball.x, ball.y, ball.w, ball.h);
  ctx.restore();
}

// Destello del color del bloque que crece y se desvanece en 4 pasos.
export function drawExplosion(
  ctx: CanvasRenderingContext2D,
  exp: Explosion,
  palette: Palette,
) {
  const step = Math.min(
    Math.floor((exp.elapsed / EXPLOSION_DURATION) * EXPLOSION_STEPS),
    EXPLOSION_STEPS - 1,
  );
  const t = (step + 1) / EXPLOSION_STEPS; // 0.25 .. 1
  const grow = 2 + t * 10;
  const color = palette.blocks[exp.color];
  ctx.save();
  ctx.globalAlpha = 1 - t * 0.8;
  ctx.shadowColor = color;
  ctx.shadowBlur = 14;
  ctx.fillStyle = color;
  ctx.fillRect(exp.x - grow, exp.y - grow, exp.w + grow * 2, exp.h + grow * 2);
  ctx.restore();
}
