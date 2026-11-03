// RANARIA: constantes, tipos, carriles y dibujo con primitivas canvas (SPEC 11).
// Las formas se pintan una vez en sprites cacheados (SPEC 12, ver sprites.ts).

import type { Sprite, SpriteSet } from "./sprites";

export const CELL = 40;
export const COLS = 16;
export const ROWS = 14;
export const W = COLS * CELL; // 640
export const H = ROWS * CELL; // 560

export const ROW_GOALS = 0;
export const ROW_RIVER_TOP = 1;
export const ROW_RIVER_BOT = 6;
export const ROW_SAFE_MID = 7;
export const ROW_ROAD_TOP = 8;
export const ROW_ROAD_BOT = 12;
export const ROW_START = 13;
export const START_COL = 7;

export const GOAL_COLS = [1, 4, 7, 10, 13]; // primera columna de cada boca (ancho 2)
export const START_LIVES = 3;
export const HOP_MS = 120;
export const LANE_SPAN = 20; // COLS + 4: longitud del circuito de cada carril, en celdas
export const LEVEL_SPEEDUP = 1.15; // multiplicador por nivel, compuesto
export const MAX_SPEED_LEVEL = 10; // a partir de aquí la velocidad deja de subir
export const TURTLE_UP_S = 3;
export const TURTLE_DOWN_S = 1.5;
export const TURTLE_CYCLE_S = TURTLE_UP_S + TURTLE_DOWN_S;
export const HITBOX_MARGIN = 0.2; // celdas recortadas por cada lado de la rana en carretera

export const POINTS_STEP = 10;
export const POINTS_GOAL = 50;
export const POINTS_PER_SECOND_LEFT = 10;
export const POINTS_ROUND = 200;

export type Direction = "up" | "down" | "left" | "right";
export type EntityType = "car" | "truck" | "log" | "turtle";

export interface Entity {
  col: number; // borde izquierdo, en celdas (fraccionario)
  width: number; // celdas
  type: EntityType;
  variant: number; // 0..2: color de coche; sin uso en el resto
  diveT?: number; // solo tortugas: segundos dentro del ciclo de 4,5 s
  submerged?: boolean; // solo tortugas
}

export interface Lane {
  row: number;
  speed: number; // celdas/s, ya escalada por nivel
  dir: 1 | -1; // 1 = hacia la derecha
  entities: Entity[];
}

export interface Frog {
  col: number; // fraccionario en el río, entero fuera de él
  row: number;
  animating: boolean;
  animT: number; // ms dentro del salto
  fromCol: number;
  fromRow: number;
  targetCol: number;
  targetRow: number;
  facing: Direction;
}

export interface Palette {
  road: string; // --bg
  water: string; // --cyan muy oscurecido
  safe: string; // --green oscurecido
  hedge: string; // --green oscurecido
  goal: string; // --bg-3
  goalBorder: string; // --gold
  cars: [string, string, string]; // --magenta, --yellow, --cyan
  truck: string; // --silver
  log: string; // --bronze
  turtle: string; // --green
  submerged: string; // contorno de la tortuga sumergida
  submergedAlpha: number; // opacidad de ese contorno (NEÓN = 0.3)
  submergedDash: number[]; // trazo discontinuo; [] = continuo
  frog: string; // --green
  frogOutline: string | null; // contorno oscuro que separa la rana de su apoyo
  eye: string; // --ink
  glow: number; // multiplicador de shadowBlur (NEÓN = 1)
  scanlines: number; // opacidad de las scanlines; 0 = sin ellas
  vignette: number; // opacidad de la viñeta en las esquinas; 0 = sin ella
}

export function timeLimit(level: number): number {
  return Math.max(8, 16 - level);
}

export function speedFactor(level: number): number {
  return LEVEL_SPEEDUP ** (Math.min(level, MAX_SPEED_LEVEL) - 1);
}

// ── Carriles del nivel 1 (tabla de la SPEC 11) ────────────────────────────────

interface LaneDef {
  row: number;
  dir: 1 | -1;
  speed: number; // celdas/s en el nivel 1
  type: EntityType;
  width: number;
  cols: number[]; // posiciones iniciales
}

const LANE_DEFS: LaneDef[] = [
  // Río
  { row: 1, dir: 1, speed: 1.5, type: "log", width: 4, cols: [0, 7, 14] },
  { row: 2, dir: 1, speed: 4.5, type: "log", width: 2, cols: [0, 5, 10, 15] },
  {
    row: 3,
    dir: -1,
    speed: 2.25,
    type: "turtle",
    width: 2,
    cols: [0, 5, 10, 15],
  },
  { row: 4, dir: 1, speed: 3, type: "log", width: 4, cols: [0, 10] },
  { row: 5, dir: 1, speed: 1.5, type: "log", width: 3, cols: [0, 7, 14] },
  { row: 6, dir: -1, speed: 2.25, type: "turtle", width: 3, cols: [0, 7, 14] },
  // Carretera
  { row: 8, dir: -1, speed: 2.25, type: "truck", width: 3, cols: [0, 10] },
  { row: 9, dir: 1, speed: 3.75, type: "truck", width: 2, cols: [0, 7, 14] },
  { row: 10, dir: -1, speed: 6, type: "car", width: 1, cols: [0, 10] },
  { row: 11, dir: 1, speed: 3, type: "car", width: 1, cols: [1, 8, 15] },
  { row: 12, dir: -1, speed: 2.25, type: "car", width: 1, cols: [0, 7, 14] },
];

export function buildLanes(level: number): Lane[] {
  const factor = speedFactor(level);
  return LANE_DEFS.map((def) => ({
    row: def.row,
    dir: def.dir,
    speed: def.speed * factor,
    entities: def.cols.map((col, i) => {
      const entity: Entity = {
        col,
        width: def.width,
        type: def.type,
        variant: (def.row + i) % 3,
      };
      if (def.type === "turtle") {
        // Desfase de 1,5 s entre grupos: nunca se sumergen todos a la vez.
        entity.diveT = (i * TURTLE_DOWN_S) % TURTLE_CYCLE_S;
        entity.submerged = entity.diveT >= TURTLE_UP_S;
      }
      return entity;
    }),
  }));
}

// ── Dibujo ────────────────────────────────────────────────────────────────────

export const GLOW = 10; // shadowBlur base, escalado por palette.glow
export const FROG_GLOW = 18;

function glow(ctx: CanvasRenderingContext2D, color: string, palette: Palette) {
  ctx.shadowColor = color;
  ctx.shadowBlur = GLOW * palette.glow;
}

function noGlow(ctx: CanvasRenderingContext2D) {
  ctx.shadowBlur = 0;
}

/** Fondos por zona, setos y bocas (con silueta de rana si están ocupadas). */
export function drawBoard(
  ctx: CanvasRenderingContext2D,
  palette: Palette,
  goals: boolean[],
) {
  ctx.save();
  noGlow(ctx);

  // Carretera y fondo general
  ctx.fillStyle = palette.road;
  ctx.fillRect(0, 0, W, H);

  // Río
  ctx.fillStyle = palette.water;
  ctx.fillRect(
    0,
    ROW_RIVER_TOP * CELL,
    W,
    (ROW_RIVER_BOT - ROW_RIVER_TOP + 1) * CELL,
  );

  // Ondas tenues y estáticas: el río se lee como agua, no como un bloque plano.
  ctx.strokeStyle = palette.eye;
  ctx.globalAlpha = 0.07;
  ctx.lineWidth = 1.5;
  ctx.beginPath();
  for (let r = ROW_RIVER_TOP; r <= ROW_RIVER_BOT; r++) {
    for (let i = 0; i < 6; i++) {
      const x = ((i * 113 + r * 47) % (W - 30)) + 5;
      const y = r * CELL + 12 + ((i * 7 + r * 5) % 18);
      ctx.moveTo(x, y);
      ctx.quadraticCurveTo(x + 6, y - 4, x + 12, y);
      ctx.quadraticCurveTo(x + 18, y + 4, x + 24, y);
    }
  }
  ctx.stroke();
  ctx.globalAlpha = 1;

  // Zonas seguras
  ctx.fillStyle = palette.safe;
  ctx.fillRect(0, ROW_SAFE_MID * CELL, W, CELL);
  ctx.fillRect(0, ROW_START * CELL, W, CELL);

  // Líneas discontinuas entre carriles de carretera
  ctx.strokeStyle = palette.eye;
  ctx.globalAlpha = 0.18;
  ctx.lineWidth = 2;
  ctx.setLineDash([14, 12]);
  ctx.beginPath();
  for (let r = ROW_ROAD_TOP + 1; r <= ROW_ROAD_BOT; r++) {
    ctx.moveTo(0, r * CELL);
    ctx.lineTo(W, r * CELL);
  }
  ctx.stroke();
  ctx.setLineDash([]);
  ctx.globalAlpha = 1;

  // Fila de metas: seto completo y bocas encima
  ctx.fillStyle = palette.hedge;
  ctx.fillRect(0, ROW_GOALS * CELL, W, CELL);
  GOAL_COLS.forEach((col, i) => {
    const x = col * CELL;
    const y = ROW_GOALS * CELL;
    ctx.fillStyle = palette.goal;
    ctx.fillRect(x + 3, y + 4, CELL * 2 - 6, CELL - 4);
    glow(ctx, palette.goalBorder, palette);
    ctx.strokeStyle = palette.goalBorder;
    ctx.lineWidth = 2;
    ctx.strokeRect(x + 3, y + 4, CELL * 2 - 6, CELL - 4);
    noGlow(ctx);
    if (goals[i])
      drawFrogShape(ctx, palette, x + CELL, y + CELL / 2 + 2, "up", false);
  });

  ctx.restore();
}

/** Copia un sprite con su origen lógico en (x, y), redondeado a píxel entero. */
function blit(
  ctx: CanvasRenderingContext2D,
  sprite: Sprite,
  x: number,
  y: number,
) {
  ctx.drawImage(
    sprite.canvas,
    Math.round(x) - sprite.ox,
    Math.round(y) - sprite.oy,
  );
}

/** Clave del sprite de una entidad (ver `SpriteSet` en sprites.ts). */
function spriteKey(e: Entity, dir: 1 | -1): string {
  switch (e.type) {
    case "car":
      return `car:${e.variant % 3}:${dir}`;
    case "truck":
      return `truck:${e.width}:${dir}`;
    case "log":
      return `log:${e.width}`;
    case "turtle":
      return `turtle:${e.width}:${e.submerged ? "down" : "up"}`;
  }
}

/** Entidades de un carril, copiadas desde la caché de sprites (sin shadowBlur). */
export function drawLane(
  ctx: CanvasRenderingContext2D,
  palette: Palette,
  lane: Lane,
  sprites: SpriteSet,
) {
  const y = lane.row * CELL;
  for (const e of lane.entities) {
    // Las que están fuera del canvas se recortan solas.
    blit(ctx, sprites.get(spriteKey(e, lane.dir), palette), e.col * CELL, y);
  }
}

export function drawCar(
  ctx: CanvasRenderingContext2D,
  palette: Palette,
  x: number,
  y: number,
  variant: number,
  dir: 1 | -1,
) {
  const color = palette.cars[variant % 3];
  // Ruedas
  noGlow(ctx);
  ctx.fillStyle = palette.eye;
  for (const wx of [x + 10, x + CELL - 10])
    for (const wy of [y + 8, y + CELL - 8]) {
      ctx.beginPath();
      ctx.arc(wx, wy, 4, 0, Math.PI * 2);
      ctx.fill();
    }
  // Carrocería
  glow(ctx, color, palette);
  ctx.fillStyle = color;
  ctx.beginPath();
  ctx.roundRect(x + 4, y + 10, CELL - 8, CELL - 20, 5);
  ctx.fill();
  // Parabrisas hacia delante
  noGlow(ctx);
  ctx.fillStyle = palette.road;
  const wx = dir === 1 ? x + CELL - 16 : x + 8;
  ctx.fillRect(wx, y + 14, 8, CELL - 28);
}

export function drawTruck(
  ctx: CanvasRenderingContext2D,
  palette: Palette,
  x: number,
  y: number,
  width: number,
  dir: 1 | -1,
) {
  const len = width * CELL;
  const cab = 14;
  const cabX = dir === 1 ? x + len - cab - 3 : x + 3;
  const trailerX = dir === 1 ? x + 3 : x + cab + 6;
  // Remolque
  glow(ctx, palette.truck, palette);
  ctx.strokeStyle = palette.truck;
  ctx.lineWidth = 2;
  ctx.fillStyle = palette.road;
  ctx.beginPath();
  ctx.roundRect(trailerX, y + 7, len - cab - 9, CELL - 14, 3);
  ctx.fill();
  ctx.stroke();
  // Cabina
  ctx.fillStyle = palette.truck;
  ctx.beginPath();
  ctx.roundRect(cabX, y + 9, cab, CELL - 18, 3);
  ctx.fill();
  noGlow(ctx);
}

export function drawLog(
  ctx: CanvasRenderingContext2D,
  palette: Palette,
  x: number,
  y: number,
  width: number,
) {
  const len = width * CELL;
  glow(ctx, palette.log, palette);
  ctx.fillStyle = palette.log;
  ctx.beginPath();
  ctx.roundRect(x + 2, y + 6, len - 4, CELL - 12, 12);
  ctx.fill();
  noGlow(ctx);
  // Vetas
  ctx.strokeStyle = palette.water;
  ctx.globalAlpha = 0.55;
  ctx.lineWidth = 2;
  ctx.beginPath();
  for (let i = 0; i < width; i++) {
    const vx = x + i * CELL + 10;
    ctx.moveTo(vx, y + 15);
    ctx.lineTo(vx + 16, y + 15);
    ctx.moveTo(vx + 8, y + 25);
    ctx.lineTo(vx + 22, y + 25);
  }
  ctx.stroke();
  ctx.globalAlpha = 1;
}

export function drawTurtles(
  ctx: CanvasRenderingContext2D,
  palette: Palette,
  x: number,
  y: number,
  count: number,
  submerged: boolean,
) {
  for (let i = 0; i < count; i++) {
    const cx = x + i * CELL + CELL / 2;
    const cy = y + CELL / 2;
    if (submerged) {
      // Contorno tenue: no sirve de apoyo.
      noGlow(ctx);
      ctx.globalAlpha = palette.submergedAlpha;
      ctx.strokeStyle = palette.submerged;
      ctx.lineWidth = 2;
      ctx.setLineDash(palette.submergedDash);
      ctx.beginPath();
      ctx.arc(cx, cy, 13, 0, Math.PI * 2);
      ctx.stroke();
      ctx.setLineDash([]);
      ctx.globalAlpha = 1;
      continue;
    }
    // Patas
    noGlow(ctx);
    ctx.fillStyle = palette.turtle;
    for (const [dx, dy] of [
      [-12, -11],
      [12, -11],
      [-12, 11],
      [12, 11],
    ]) {
      ctx.beginPath();
      ctx.arc(cx + dx, cy + dy, 4, 0, Math.PI * 2);
      ctx.fill();
    }
    // Caparazón con escamas
    glow(ctx, palette.turtle, palette);
    ctx.beginPath();
    ctx.arc(cx, cy, 14, 0, Math.PI * 2);
    ctx.fill();
    noGlow(ctx);
    ctx.strokeStyle = palette.water;
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.arc(cx, cy, 7, 0, Math.PI * 2);
    ctx.moveTo(cx, cy - 14);
    ctx.lineTo(cx, cy - 7);
    ctx.moveTo(cx, cy + 7);
    ctx.lineTo(cx, cy + 14);
    ctx.moveTo(cx - 14, cy);
    ctx.lineTo(cx - 7, cy);
    ctx.moveTo(cx + 7, cy);
    ctx.lineTo(cx + 14, cy);
    ctx.stroke();
  }
}

const FACING_ANGLE: Record<Direction, number> = {
  up: 0,
  right: Math.PI / 2,
  down: Math.PI,
  left: -Math.PI / 2,
};

/** Rana centrada en (cx, cy), mirando hacia `facing`; con patas extendidas si salta. */
export function drawFrogShape(
  ctx: CanvasRenderingContext2D,
  palette: Palette,
  cx: number,
  cy: number,
  facing: Direction,
  jumping: boolean,
) {
  ctx.save();
  ctx.translate(cx, cy);
  ctx.rotate(FACING_ANGLE[facing]);
  ctx.lineCap = "round";
  const reach = jumping ? 17 : 12;
  const legs = () => {
    ctx.beginPath();
    ctx.moveTo(-8, -6);
    ctx.lineTo(-reach, jumping ? -16 : -12);
    ctx.moveTo(8, -6);
    ctx.lineTo(reach, jumping ? -16 : -12);
    ctx.moveTo(-8, 7);
    ctx.lineTo(-reach, jumping ? 17 : 12);
    ctx.moveTo(8, 7);
    ctx.lineTo(reach, jumping ? 17 : 12);
  };
  if (palette.frogOutline) {
    // Silueta 2,5 px más ancha detrás de la rana, sin glow.
    noGlow(ctx);
    ctx.strokeStyle = palette.frogOutline;
    ctx.lineWidth = 9;
    legs();
    ctx.stroke();
    ctx.lineWidth = 5;
    ctx.beginPath();
    ctx.ellipse(0, 0, 12, 14, 0, 0, Math.PI * 2);
    ctx.stroke();
  }
  // La rana es lo único con brillo reforzado: se localiza de un vistazo.
  ctx.shadowColor = palette.frog;
  ctx.shadowBlur = FROG_GLOW * palette.glow;
  ctx.fillStyle = palette.frog;
  ctx.strokeStyle = palette.frog;
  ctx.lineWidth = 4;
  // Patas: recogidas en reposo, estiradas en el salto
  legs();
  ctx.stroke();
  // Cuerpo (elipse 28×24)
  ctx.beginPath();
  ctx.ellipse(0, 0, 12, 14, 0, 0, Math.PI * 2);
  ctx.fill();
  noGlow(ctx);
  // Ojos
  for (const ex of [-6, 6]) {
    ctx.fillStyle = palette.eye;
    ctx.beginPath();
    ctx.arc(ex, -9, 4, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = palette.road;
    ctx.beginPath();
    ctx.arc(ex, -10, 2, 0, Math.PI * 2);
    ctx.fill();
  }
  ctx.restore();
}

/** La rana del jugador, interpolada entre origen y destino durante el salto. */
export function drawFrog(
  ctx: CanvasRenderingContext2D,
  palette: Palette,
  frog: Frog,
  sprites: SpriteSet,
) {
  let col = frog.col;
  let row = frog.row;
  if (frog.animating) {
    const t = Math.min(1, frog.animT / HOP_MS);
    col = frog.fromCol + (frog.targetCol - frog.fromCol) * t;
    row = frog.fromRow + (frog.targetRow - frog.fromRow) * t;
  }
  const key = `frog:${frog.facing}:${frog.animating ? "jump" : "rest"}`;
  blit(ctx, sprites.get(key, palette), col * CELL, row * CELL);
}
