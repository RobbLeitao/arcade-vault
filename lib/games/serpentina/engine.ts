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
  silhouetteAtlas,
  tintAtlas,
  type Cell,
  type Direction,
  type Fruit,
  type Palette,
} from "./entities";
import type { CreateGameOptions, GameCallbacks, GameEngine } from "../contract";
import { DEFAULT_SKIN, type SkinId } from "../skins";
import { PALETTES } from "./skins";

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

// Imagen precargada: solo se escribe una vez al cargar y después es de solo
// lectura, así que es seguro compartirla entre instancias del motor.
let fruitImage: HTMLImageElement | null = null;

// Variantes del atlas por skin (tintado y silueta del contorno). Se generan una
// sola vez a partir de la imagen precargada y se reutilizan.
interface FruitArt {
  image: CanvasImageSource | null;
  outline: CanvasImageSource | null;
}
const fruitArtCache = new Map<SkinId, FruitArt>();

function fruitArt(skin: SkinId, palette: Palette): FruitArt {
  if (!fruitImage) return { image: null, outline: null };
  let art = fruitArtCache.get(skin);
  if (!art) {
    art = {
      // Si no se pudo tintar, se usa la imagen original.
      image:
        (palette.fruitTint && tintAtlas(fruitImage, palette.fruitTint)) ||
        fruitImage,
      outline: palette.fruitOutline
        ? silhouetteAtlas(fruitImage, palette.fruitOutline)
        : null,
    };
    fruitArtCache.set(skin, art);
  }
  return art;
}

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

  // ── Skin (paleta, atlas y efectos de pantalla) ─────────────────────────────
  let palette: Palette;
  let art: FruitArt;
  let vignette: CanvasGradient | null = null;

  function applyPalette(skin: SkinId) {
    palette = PALETTES[skin]();
    art = fruitArt(skin, palette);
    vignette = null;
    if (palette.vignette > 0) {
      vignette = ctx!.createRadialGradient(
        W / 2,
        H / 2,
        H * 0.45,
        W / 2,
        H / 2,
        W * 0.65,
      );
      vignette.addColorStop(0, "rgba(0, 0, 0, 0)");
      vignette.addColorStop(1, `rgba(0, 0, 0, ${palette.vignette})`);
    }
  }
  applyPalette(options?.skin ?? DEFAULT_SKIN);

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
    const c = ctx!;
    if (palette.background) {
      c.fillStyle = palette.background;
      c.fillRect(0, 0, W, H);
    } else {
      c.clearRect(0, 0, W, H);
    }
    drawGrid(c, palette);
    if (fruit) drawFruit(c, palette, fruit, art.image, art.outline);
    drawSnake(c, palette, snake, dir);
    drawScreenEffects(c);
  }

  // Efectos de pantalla del skin (scanlines y viñeta), estáticos: sin parpadeo.
  function drawScreenEffects(c: CanvasRenderingContext2D) {
    if (palette.scanlines > 0) {
      c.fillStyle = `rgba(0, 0, 0, ${palette.scanlines})`;
      for (let y = 0; y < H; y += 3) c.fillRect(0, y, W, 1);
    }
    if (vignette) {
      c.fillStyle = vignette;
      c.fillRect(0, 0, W, H);
    }
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
