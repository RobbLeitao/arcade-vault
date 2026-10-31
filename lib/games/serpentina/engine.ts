import {
  COLS,
  FRUITS_PER_LEVEL,
  FRUIT_NAMES,
  H,
  MAX_QUEUED_TURNS,
  POINTS_PER_FRUIT,
  ROWS,
  START_COL,
  START_LENGTH,
  START_ROW,
  W,
  drawFruit,
  drawGrid,
  drawSnake,
  stepMs,
  type Cell,
  type Direction,
  type Fruit,
  type Palette,
} from "./entities";
import type { GameCallbacks, GameEngine } from "../contract";

const FRUITS_SRC = "/games/serpentina/fruits.png";
const MAX_DT = 50; // ms; menor que el paso mínimo, evita ráfagas de pasos tras una pausa

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

const DELTAS: Record<Direction, Cell> = {
  up: { col: 0, row: -1 },
  down: { col: 0, row: 1 },
  left: { col: -1, row: 0 },
  right: { col: 1, row: 0 },
};

const OPPOSITE: Record<Direction, Direction> = {
  up: "down",
  down: "up",
  left: "right",
  right: "left",
};

// Valores de respaldo iguales a los del tema (app/globals.css).
const FALLBACK_THEME = {
  green: "#00ff88",
  magenta: "#ff006e",
  ink: "#e8ecff",
};

// Imagen precargada: solo se escribe una vez al cargar y después es de solo
// lectura, así que es seguro compartirla entre instancias del motor.
let fruitImage: HTMLImageElement | null = null;

// Precarga fruits.png. Nunca rechaza: si falla, el motor dibuja el círculo de respaldo.
export function loadFruitSprites(): Promise<void> {
  if (fruitImage) return Promise.resolve();
  return new Promise((resolve) => {
    const img = new Image();
    img.onload = () => {
      fruitImage = img;
      resolve();
    };
    img.onerror = () => resolve();
    img.src = FRUITS_SRC;
  });
}

function readPalette(): Palette {
  const style = getComputedStyle(document.documentElement);
  const read = (name: string, fallback: string) =>
    style.getPropertyValue(name).trim() || fallback;
  return {
    snake: read("--green", FALLBACK_THEME.green),
    head: "#7dffc0",
    grid: "rgba(232, 236, 255, 0.05)",
    fallback: read("--magenta", FALLBACK_THEME.magenta),
  };
}

function isTextField(target: EventTarget | null) {
  return (
    target instanceof HTMLElement &&
    (target.tagName === "INPUT" ||
      target.tagName === "TEXTAREA" ||
      target.isContentEditable)
  );
}

const key = (c: Cell) => `${c.col},${c.row}`;

export function createSerpentina(
  canvas: HTMLCanvasElement,
  callbacks: GameCallbacks,
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

  const palette = readPalette();

  // ── Estado ──────────────────────────────────────────────────────────────────
  let snake: Cell[]; // cabeza en el índice 0
  let occupied: Set<string>; // claves "col,row" de la serpiente
  let fruit: Fruit | null;
  let dir: Direction;
  let turns: Direction[]; // giros pendientes
  let score: number;
  let fruitsEaten: number;
  let level: number;
  let stepAccum: number;

  let paused = false;
  let finished = false; // partida terminada: el motor ya no captura teclas
  let destroyed = false;
  let raf: number | null = null;
  let lastTime: number | null = null;

  // ── Callbacks (solo al cambiar el valor) ────────────────────────────────────
  let sentScore = NaN;
  let sentLevel = NaN;

  function emit() {
    if (score !== sentScore) callbacks.onScore((sentScore = score));
    if (level !== sentLevel) callbacks.onLevel((sentLevel = level));
  }

  // ── Lógica ──────────────────────────────────────────────────────────────────
  // Devuelve false si no queda ninguna celda libre (tablero lleno).
  function spawnFruit(): boolean {
    const free: Cell[] = [];
    for (let row = 0; row < ROWS; row++)
      for (let col = 0; col < COLS; col++)
        if (!occupied.has(`${col},${row}`)) free.push({ col, row });
    if (free.length === 0) {
      fruit = null;
      return false;
    }
    const cell = free[Math.floor(Math.random() * free.length)];
    const sprite = FRUIT_NAMES[Math.floor(Math.random() * FRUIT_NAMES.length)];
    fruit = { ...cell, sprite };
    return true;
  }

  function step() {
    // (1) Siguiente giro de la cola, si no invierte la dirección actual
    const turn = turns.shift();
    if (turn && turn !== OPPOSITE[dir]) dir = turn;

    // (2) Nueva cabeza con envoltura por los bordes
    const d = DELTAS[dir];
    const head: Cell = {
      col: (snake[0].col + d.col + COLS) % COLS,
      row: (snake[0].row + d.row + ROWS) % ROWS,
    };
    const eats =
      fruit !== null && head.col === fruit.col && head.row === fruit.row;

    // (3) Mordida: la celda que la cola abandona cuenta como libre salvo que coma
    const tail = snake[snake.length - 1];
    const headKey = key(head);
    if (occupied.has(headKey) && (eats || headKey !== key(tail))) {
      finish();
      return;
    }

    // (4) Avance, con o sin crecimiento
    if (!eats) {
      snake.pop();
      occupied.delete(key(tail));
    }
    snake.unshift(head);
    occupied.add(headKey);

    if (eats) {
      score += POINTS_PER_FRUIT;
      fruitsEaten++;
      level = 1 + Math.floor(fruitsEaten / FRUITS_PER_LEVEL);
      if (!spawnFruit()) finish(); // tablero lleno
    }
  }

  function finish() {
    if (finished) return;
    emit();
    finished = true;
    stopLoop();
    draw();
    callbacks.onGameOver(score);
  }

  function init() {
    snake = [];
    occupied = new Set();
    for (let i = 0; i < START_LENGTH; i++) {
      const cell = { col: START_COL - i, row: START_ROW };
      snake.push(cell);
      occupied.add(key(cell));
    }
    dir = "right";
    turns = [];
    score = 0;
    fruitsEaten = 0;
    level = 1;
    stepAccum = 0;
    spawnFruit();
    sentScore = sentLevel = NaN;
    callbacks.onLives(null);
    callbacks.onStats([]);
    emit();
  }

  // ── Entrada ─────────────────────────────────────────────────────────────────
  function onKeyDown(e: KeyboardEvent) {
    if (finished || isTextField(e.target)) return;

    if (e.code === "KeyP" || e.code === "Escape") {
      if (!e.repeat) callbacks.onPauseKey?.();
      return;
    }

    const next = DIRECTION_KEYS[e.code];
    if (!next) return;
    // Solo las flechas se bloquean (WASD no hace scroll); también en pausa, para
    // que no desplacen la página ni activen el botón enfocado.
    if (e.code.startsWith("Arrow")) e.preventDefault();
    if (paused) return;

    const last = turns.length > 0 ? turns[turns.length - 1] : dir;
    if (next === last || next === OPPOSITE[last]) return;
    if (turns.length < MAX_QUEUED_TURNS) turns.push(next);
  }

  window.addEventListener("keydown", onKeyDown);

  // ── Dibujo ──────────────────────────────────────────────────────────────────
  function draw() {
    ctx!.clearRect(0, 0, W, H);
    drawGrid(ctx!, palette);
    if (fruit) drawFruit(ctx!, palette, fruit, fruitImage);
    drawSnake(ctx!, palette, snake, dir);
  }

  // ── Bucle ───────────────────────────────────────────────────────────────────
  function loop(ts: number) {
    raf = null;
    const dt = lastTime === null ? 0 : Math.min(ts - lastTime, MAX_DT);
    lastTime = ts;
    stepAccum += dt;
    const interval = stepMs(level);
    if (stepAccum >= interval) {
      stepAccum -= interval;
      step();
    }
    if (finished) return;
    emit();
    draw();
    raf = requestAnimationFrame(loop);
  }

  function startLoop() {
    if (raf !== null || destroyed || finished) return;
    lastTime = null;
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
    destroy() {
      destroyed = true;
      stopLoop();
      window.removeEventListener("keydown", onKeyDown);
    },
  };
}
