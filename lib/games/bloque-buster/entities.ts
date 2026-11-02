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

// Patrón de relleno del ladrillo (RETRO lo usa para distinguir tipos con paleta limitada).
export type BlockPattern = "solid" | "hollow" | "striped";

// Paleta y efectos de un skin (ver ./skins.ts).
export interface Palette {
  blocks: Record<BlockColor, string>;
  patterns: Record<BlockColor, BlockPattern> | null; // null = todos macizos
  paddle: string;
  paddleCaps: string | null; // extremos de la paleta en otro color (CLÁSICO)
  ball: string;
  background: string | null; // null = transparente (fondo #000 de .crt-screen)
  glow: number; // multiplicador de shadowBlur; 0 = sin glow
  bevel: boolean; // filo claro arriba y sombra abajo en ladrillos y paleta
  scanlines: number; // opacidad de las scanlines; 0 = sin ellas
  vignette: number; // opacidad de la viñeta en las esquinas; 0 = sin ella
}

export function collideAABB(a: Rect, b: Rect): boolean {
  return (
    a.x < b.x + b.w && a.x + a.w > b.x && a.y < b.y + b.h && a.y + a.h > b.y
  );
}

// Ladrillo: relleno (con glow según el skin), patrón opcional y biselado.
export function drawBlock(
  ctx: CanvasRenderingContext2D,
  block: Block,
  palette: Palette,
) {
  const color = palette.blocks[block.color];
  const pattern = palette.patterns?.[block.color] ?? "solid";
  const x = block.x + 2;
  const y = block.y + 2;
  const w = block.w - 4;
  const h = block.h - 4;
  ctx.save();
  ctx.shadowColor = color;
  ctx.shadowBlur = 6 * palette.glow;
  ctx.fillStyle = color;
  ctx.fillRect(x, y, w, h);
  ctx.shadowBlur = 0;
  if (pattern !== "solid") {
    ctx.fillStyle = palette.background ?? "#000";
    if (pattern === "hollow") {
      ctx.fillRect(x + 4, y + 4, w - 8, h - 8);
    } else {
      for (let sx = x + 5; sx < x + w - 3; sx += 8)
        ctx.fillRect(sx, y + 3, 3, h - 6);
    }
  }
  if (palette.bevel) {
    ctx.fillStyle = "rgba(255,255,255,0.22)";
    ctx.fillRect(x, y, w, 3);
    ctx.fillStyle = "rgba(0,0,0,0.28)";
    ctx.fillRect(x, y + h - 4, w, 4);
  }
  ctx.restore();
}

export function drawPaddle(
  ctx: CanvasRenderingContext2D,
  paddle: Paddle,
  palette: Palette,
) {
  ctx.save();
  ctx.shadowColor = palette.paddle;
  ctx.shadowBlur = 12 * palette.glow;
  ctx.fillStyle = palette.paddle;
  ctx.fillRect(paddle.x, paddle.y, paddle.w, paddle.h);
  ctx.shadowBlur = 0;
  if (palette.paddleCaps) {
    ctx.fillStyle = palette.paddleCaps;
    ctx.fillRect(paddle.x, paddle.y, 12, paddle.h);
    ctx.fillRect(paddle.x + paddle.w - 12, paddle.y, 12, paddle.h);
  }
  if (palette.bevel) {
    ctx.fillStyle = "rgba(255,255,255,0.35)";
    ctx.fillRect(paddle.x, paddle.y, paddle.w, 3);
  }
  ctx.restore();
}

export function drawBall(
  ctx: CanvasRenderingContext2D,
  ball: Ball,
  palette: Palette,
) {
  ctx.save();
  ctx.shadowColor = palette.ball;
  ctx.shadowBlur = 10 * palette.glow;
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
  ctx.shadowBlur = 14 * palette.glow;
  ctx.fillStyle = color;
  ctx.fillRect(exp.x - grow, exp.y - grow, exp.w + grow * 2, exp.h + grow * 2);
  ctx.restore();
}
