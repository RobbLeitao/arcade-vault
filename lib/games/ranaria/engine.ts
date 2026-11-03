import {
  COLS,
  GOAL_COLS,
  H,
  HITBOX_MARGIN,
  HOP_MS,
  LANE_SPAN,
  POINTS_GOAL,
  POINTS_PER_SECOND_LEFT,
  POINTS_ROUND,
  POINTS_STEP,
  ROWS,
  ROW_GOALS,
  ROW_RIVER_BOT,
  ROW_RIVER_TOP,
  ROW_ROAD_BOT,
  ROW_ROAD_TOP,
  ROW_START,
  START_COL,
  START_LIVES,
  TURTLE_CYCLE_S,
  TURTLE_UP_S,
  W,
  buildLanes,
  drawBoard,
  drawFrog,
  drawLane,
  timeLimit,
  type Direction,
  type Entity,
  type Frog,
  type Lane,
  type Palette,
} from "./entities";
import type {
  CreateGameOptions,
  GameCallbacks,
  GameEngine,
  HudStat,
} from "../contract";
import { DEFAULT_SKIN, type SkinId } from "../skins";
import { PALETTES } from "./skins";
import { createSpriteSet } from "./sprites";

// Bucle de paso fijo (SPEC 12): la simulación avanza siempre en pasos de STEP,
// igual a 60, 120 o 144 Hz. MAX_FRAME acota lo simulado por frame: por debajo
// de 10 fps el juego va a cámara lenta en vez de teletransportar entidades.
const STEP = 1 / 240; // s de simulación por paso
const MAX_FRAME = 0.1; // s máximos simulados por frame

const DELTAS: Record<Direction, { col: number; row: number }> = {
  up: { col: 0, row: -1 },
  down: { col: 0, row: 1 },
  left: { col: -1, row: 0 },
  right: { col: 1, row: 0 },
};

const isRiver = (row: number) => row >= ROW_RIVER_TOP && row <= ROW_RIVER_BOT;
const isRoad = (row: number) => row >= ROW_ROAD_TOP && row <= ROW_ROAD_BOT;

const DIRECTION_KEYS: Record<string, Direction> = {
  ArrowUp: "up",
  KeyW: "up",
  ArrowDown: "down",
  KeyS: "down",
  ArrowLeft: "left",
  KeyA: "left",
  ArrowRight: "right",
  KeyD: "right",
};

function isTextField(target: EventTarget | null) {
  return (
    target instanceof HTMLElement &&
    (target.tagName === "INPUT" ||
      target.tagName === "TEXTAREA" ||
      target.isContentEditable)
  );
}

/** Canvas fuera de pantalla del tamaño del tablero. */
function createLayer(): HTMLCanvasElement {
  const layer = document.createElement("canvas");
  layer.width = W;
  layer.height = H;
  return layer;
}

/** Scanlines y viñeta del skin en una capa; null si el skin no tiene efectos. */
function paintEffects(palette: Palette): HTMLCanvasElement | null {
  if (palette.scanlines <= 0 && palette.vignette <= 0) return null;
  const layer = createLayer();
  const c = layer.getContext("2d");
  if (!c) return null;
  if (palette.scanlines > 0) {
    c.fillStyle = `rgba(0, 0, 0, ${palette.scanlines})`;
    for (let y = 0; y < H; y += 3) c.fillRect(0, y, W, 1);
  }
  if (palette.vignette > 0) {
    // Radios a partir de la semidiagonal: transición suave hasta las esquinas.
    const d = Math.hypot(W, H) / 2;
    const vignette = c.createRadialGradient(
      W / 2,
      H / 2,
      d * 0.6,
      W / 2,
      H / 2,
      d,
    );
    vignette.addColorStop(0, "rgba(0, 0, 0, 0)");
    vignette.addColorStop(1, `rgba(0, 0, 0, ${palette.vignette})`);
    c.fillStyle = vignette;
    c.fillRect(0, 0, W, H);
  }
  return layer;
}

export function createRanaria(
  canvas: HTMLCanvasElement,
  callbacks: GameCallbacks,
  options?: CreateGameOptions,
): GameEngine {
  const ctx = canvas.getContext("2d");
  if (!ctx) {
    const noop = () => {};
    return {
      pause: noop,
      resume: noop,
      restart: noop,
      end: noop,
      destroy: noop,
    };
  }

  // ── Capas cacheadas (SPEC 12) ───────────────────────────────────────────────
  // Fondo del tablero: solo se repinta al cambiar el skin o las bocas ocupadas.
  const board = createLayer();
  let boardDirty = true;
  // Scanlines + viñeta del skin, pintadas una vez; null si el skin no tiene.
  let effects: HTMLCanvasElement | null = null;
  // Formas de entidades y rana con su glow, creadas al primer uso.
  const sprites = createSpriteSet();

  // ── Skin (paleta y efectos de pantalla) ─────────────────────────────────────
  let palette: Palette;

  function applyPalette(skin: SkinId) {
    palette = PALETTES[skin]();
    sprites.clear();
    boardDirty = true;
    effects = paintEffects(palette);
  }
  applyPalette(options?.skin ?? DEFAULT_SKIN);

  // ── Estado ──────────────────────────────────────────────────────────────────
  let lanes: Lane[];
  let frog: Frog;
  let goals: boolean[];
  let score: number;
  let lives: number;
  let level: number;
  let timeLeft: number; // s
  let bestRow: number; // fila más alta alcanzada por la rana actual
  let pendingDir: Direction | null; // búfer de 1 dirección

  let paused = false;
  let finished = false; // partida terminada: el motor ya no captura teclas
  let destroyed = false;
  let raf: number | null = null;
  let lastTime: number | null = null;
  let acc = 0; // s pendientes de simular

  // ── Callbacks (solo al cambiar el valor) ────────────────────────────────────
  let sentScore = NaN;
  let sentLives = NaN;
  let sentLevel = NaN;
  let sentStats = "";

  function stats(): HudStat[] {
    const ratio = timeLeft / timeLimit(level);
    return [
      {
        key: "time",
        label: "Tiempo",
        value: (Math.ceil(timeLeft * 10) / 10).toFixed(1),
        color: ratio > 0.5 ? "green" : ratio > 0.25 ? "yellow" : "magenta",
      },
      {
        key: "goals",
        label: "Bocas",
        value: `${goals.filter(Boolean).length}/5`,
        color: "cyan",
      },
    ];
  }

  function emit() {
    if (score !== sentScore) callbacks.onScore((sentScore = score));
    if (lives !== sentLives) callbacks.onLives((sentLives = lives));
    if (level !== sentLevel) callbacks.onLevel((sentLevel = level));
    const s = stats();
    const sig = s.map((x) => `${x.value}|${x.color}`).join(";");
    if (sig !== sentStats) {
      sentStats = sig;
      callbacks.onStats(s);
    }
  }

  // ── Lógica ──────────────────────────────────────────────────────────────────
  function newFrog(): Frog {
    return {
      col: START_COL,
      row: ROW_START,
      animating: false,
      animT: 0,
      fromCol: START_COL,
      fromRow: ROW_START,
      targetCol: START_COL,
      targetRow: ROW_START,
      facing: "up",
    };
  }

  function moveLanes(dt: number) {
    for (const lane of lanes) {
      for (const e of lane.entities) {
        e.col += lane.speed * lane.dir * dt;
        // Mismo LANE_SPAN en todo el carril: los huecos se conservan.
        if (lane.dir === 1 && e.col >= COLS) e.col -= LANE_SPAN;
        else if (lane.dir === -1 && e.col + e.width <= 0) e.col += LANE_SPAN;
        if (e.type === "turtle") {
          e.diveT = ((e.diveT ?? 0) + dt) % TURTLE_CYCLE_S;
          e.submerged = e.diveT >= TURTLE_UP_S;
        }
      }
    }
  }

  function laneAt(row: number): Lane | undefined {
    return lanes.find((l) => l.row === row);
  }

  // Tronco o tortugas a flote bajo el centro de la rana, o null.
  function getSupport(lane: Lane): Entity | null {
    const center = frog.col + 0.5;
    for (const e of lane.entities) {
      if (center >= e.col && center < e.col + e.width)
        return e.type === "turtle" && e.submerged ? null : e;
    }
    return null;
  }

  function hitsVehicle(lane: Lane): boolean {
    const a = frog.col + HITBOX_MARGIN;
    const b = frog.col + 1 - HITBOX_MARGIN;
    return lane.entities.some((e) => a < e.col + e.width && b > e.col);
  }

  // Rana nueva en la salida: tras ocupar una boca o tras morir.
  function respawn() {
    frog = newFrog();
    bestRow = ROW_START;
    pendingDir = null;
    timeLeft = timeLimit(level);
  }

  function killFrog() {
    lives = Math.max(0, lives - 1);
    if (lives === 0) {
      finish(); // emite onLives(0) antes de onGameOver
      return;
    }
    respawn();
  }

  function startHop(dir: Direction) {
    const d = DELTAS[dir];
    const targetCol = frog.col + d.col;
    const targetRow = frog.row + d.row;
    frog.facing = dir;
    if (targetCol < 0 || targetCol > COLS - 1) return; // bordes laterales
    if (targetRow < 0 || targetRow > ROWS - 1) return;
    frog.animating = true;
    frog.animT = 0;
    frog.fromCol = frog.col;
    frog.fromRow = frog.row;
    frog.targetCol = targetCol;
    frog.targetRow = targetRow;
  }

  // Resuelve la celda de aterrizaje. Devuelve false si la rana murió o salió una nueva.
  function land(): boolean {
    frog.animating = false;
    frog.col = frog.targetCol;
    frog.row = frog.targetRow;
    if (!isRiver(frog.row)) frog.col = Math.round(frog.col);

    if (frog.row === ROW_GOALS) {
      const col = frog.col;
      const i = GOAL_COLS.findIndex((g) => col === g || col === g + 1);
      if (i === -1 || goals[i]) {
        killFrog(); // seto o boca ocupada
        return false;
      }
      goals[i] = true;
      boardDirty = true; // la boca muestra su rana
      score +=
        POINTS_STEP +
        POINTS_GOAL +
        Math.floor(timeLeft) * POINTS_PER_SECOND_LEFT;
      if (goals.every(Boolean)) completeRound();
      respawn();
      return false;
    }

    if (frog.row < bestRow) {
      bestRow = frog.row;
      score += POINTS_STEP;
    }
    return true;
  }

  function completeRound() {
    score += POINTS_ROUND;
    goals = [false, false, false, false, false];
    boardDirty = true; // bocas vacías
    level++;
    lanes = buildLanes(level);
  }

  // Apoyo y deriva en el río, atropello en la carretera. False si la rana murió.
  function checkCell(dt: number): boolean {
    const lane = laneAt(frog.row);
    if (!lane) return true; // filas seguras
    if (isRiver(frog.row)) {
      const support = getSupport(lane);
      if (!support) {
        killFrog(); // agua o tortuga sumergida
        return false;
      }
      frog.col += lane.speed * lane.dir * dt;
      if (frog.col < 0 || frog.col > COLS - 1) {
        killFrog(); // arrastrada fuera por un borde
        return false;
      }
    } else if (isRoad(frog.row) && hitsVehicle(lane)) {
      killFrog();
      return false;
    }
    return true;
  }

  function update(dt: number) {
    moveLanes(dt);

    if (frog.animating) {
      frog.animT += dt * 1000;
      if (frog.animT >= HOP_MS && !land()) return;
    } else if (pendingDir) {
      const dir = pendingDir;
      pendingDir = null;
      startHop(dir);
    }

    // Durante el salto la rana no deriva ni colisiona.
    if (!frog.animating && !checkCell(dt)) return;

    timeLeft = Math.max(0, timeLeft - dt);
    if (timeLeft === 0) killFrog();
  }

  function init() {
    level = 1;
    lanes = buildLanes(level);
    goals = [false, false, false, false, false];
    boardDirty = true;
    score = 0;
    lives = START_LIVES;
    respawn();
    sentScore = sentLives = sentLevel = NaN;
    sentStats = "";
    emit();
  }

  function finish() {
    if (finished) return;
    emit();
    finished = true;
    stopLoop();
    draw();
    callbacks.onGameOver(score);
  }

  // ── Entrada ─────────────────────────────────────────────────────────────────
  function onKeyDown(e: KeyboardEvent) {
    if (finished || isTextField(e.target)) return;

    if (e.code === "KeyP" || e.code === "Escape") {
      if (!e.repeat) callbacks.onPauseKey?.();
      return;
    }

    const dir = DIRECTION_KEYS[e.code];
    if (!dir) return;
    // Solo las flechas hacen scroll; también en pausa, para no mover la página
    // ni activar el botón enfocado.
    if (e.code.startsWith("Arrow")) e.preventDefault();
    if (paused || e.repeat) return; // un salto por pulsación
    pendingDir = dir; // gana la última
  }

  window.addEventListener("keydown", onKeyDown);

  // ── Dibujo ──────────────────────────────────────────────────────────────────
  function draw() {
    const c = ctx!;
    if (boardDirty) {
      const b = board.getContext("2d");
      if (b) {
        b.clearRect(0, 0, W, H);
        drawBoard(b, palette, goals);
      }
      boardDirty = false;
    }
    // El fondo es opaco y cubre todo el canvas: no hace falta clearRect.
    c.drawImage(board, 0, 0);
    for (const lane of lanes) drawLane(c, palette, lane, sprites);
    drawFrog(c, palette, frog, sprites);
    // Efectos de pantalla del skin, estáticos: sin parpadeo.
    if (effects) c.drawImage(effects, 0, 0);
  }

  // ── Bucle ───────────────────────────────────────────────────────────────────
  function loop(ts: number) {
    raf = null;
    const elapsed = lastTime === null ? 0 : (ts - lastTime) / 1000;
    lastTime = ts;
    acc += Math.min(elapsed, MAX_FRAME);
    while (acc >= STEP) {
      update(STEP);
      acc -= STEP;
      if (finished) return; // finish() ya dibujó el último frame
    }
    emit();
    draw();
    raf = requestAnimationFrame(loop);
  }

  function startLoop() {
    if (raf !== null || destroyed || finished) return;
    lastTime = null;
    acc = 0;
    raf = requestAnimationFrame(loop);
  }

  function stopLoop() {
    if (raf !== null) cancelAnimationFrame(raf);
    raf = null;
  }

  // ── API ─────────────────────────────────────────────────────────────────────
  init();
  draw();
  startLoop();

  return {
    pause() {
      if (destroyed || finished || paused) return;
      paused = true;
      stopLoop();
    },
    resume() {
      if (destroyed || finished || !paused) return;
      paused = false;
      startLoop();
    },
    restart() {
      if (destroyed) return;
      stopLoop();
      paused = false;
      finished = false;
      init();
      draw();
      startLoop();
    },
    end() {
      if (destroyed || finished) return;
      paused = false;
      finish();
    },
    setSkin(skin) {
      if (destroyed) return;
      applyPalette(skin);
      // Con el bucle parado (pausa o fin) se redibuja para mostrar el cambio.
      if (raf === null) draw();
    },
    destroy() {
      destroyed = true;
      stopLoop();
      window.removeEventListener("keydown", onKeyDown);
    },
  };
}
