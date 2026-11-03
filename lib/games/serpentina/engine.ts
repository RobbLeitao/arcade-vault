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
  CELL,
  drawBridge,
  drawGrid,
  drawHead,
  drawSegment,
  segmentInset,
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
import { createSpriteSet, type FruitArt } from "./sprites";

const FRUITS_SRC = "/games/serpentina/fruits.png";

// Bucle de paso fijo (SPEC 12): el tiempo se simula en pasos de STEP, igual a
// 60, 120 o 144 Hz. MAX_FRAME acota lo simulado por frame: por debajo de 10 fps
// el juego va a cámara lenta en vez de saltar. Como mucho se da un paso de la
// serpiente por frame (nunca una ráfaga) y solo queda pendiente uno.
const STEP = 1 / 240; // s de simulación por paso
const STEP_MS = STEP * 1000;
const MAX_FRAME = 0.1; // s máximos simulados por frame

// Claves de sprite precalculadas (sin crear cadenas en cada frame).
const SEG_KEYS: string[] = [];
const BRIDGE_H_KEYS: string[] = [];
const BRIDGE_V_KEYS: string[] = [];
for (let inset = 0; inset <= 8; inset++) {
  SEG_KEYS[inset] = `seg:${inset}`;
  BRIDGE_H_KEYS[inset] = `bridge:h:${inset}`;
  BRIDGE_V_KEYS[inset] = `bridge:v:${inset}`;
}
const HEAD_KEYS: Record<Direction, string> = {
  up: "head:up",
  down: "head:down",
  left: "head:left",
  right: "head:right",
};

// Scanlines y viñeta del skin, pintadas una sola vez; null si no tiene efectos.
function paintEffects(palette: Palette): HTMLCanvasElement | null {
  if (palette.scanlines <= 0 && palette.vignette <= 0) return null;
  const canvas = document.createElement("canvas");
  canvas.width = W;
  canvas.height = H;
  const c = canvas.getContext("2d");
  if (!c) return null;
  if (palette.scanlines > 0) {
    c.fillStyle = `rgba(0, 0, 0, ${palette.scanlines})`;
    for (let y = 0; y < H; y += 3) c.fillRect(0, y, W, 1);
  }
  if (palette.vignette > 0) {
    const vignette = c.createRadialGradient(
      W / 2,
      H / 2,
      H * 0.45,
      W / 2,
      H / 2,
      W * 0.65,
    );
    vignette.addColorStop(0, "rgba(0, 0, 0, 0)");
    vignette.addColorStop(1, `rgba(0, 0, 0, ${palette.vignette})`);
    c.fillStyle = vignette;
    c.fillRect(0, 0, W, H);
  }
  return canvas;
}

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

  // ── Skin (paleta, atlas, sprites, fondo y efectos cacheados) ───────────────
  let palette: Palette;
  let art: FruitArt;
  const sprites = createSpriteSet();
  const board = document.createElement("canvas"); // fondo y rejilla
  board.width = W;
  board.height = H;
  let boardDirty = true;
  let effects: HTMLCanvasElement | null = null; // scanlines + viñeta

  function applyPalette(skin: SkinId) {
    palette = PALETTES[skin]();
    art = fruitArt(skin, palette);
    sprites.clear();
    boardDirty = true;
    effects = paintEffects(palette);
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
  let stepAccum: number; // ms acumulados hacia el siguiente paso
  let fruitKey = ""; // clave del sprite de la fruta actual

  let paused = false;
  let finished = false; // partida terminada: el motor ya no captura teclas
  let destroyed = false;
  let raf: number | null = null;
  let lastTime: number | null = null;
  let acc = 0; // s pendientes de simular

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
    fruitKey = fruitImage ? `fruit:${sprite}` : "fruit:none";
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
    if (boardDirty) {
      const b = board.getContext("2d");
      if (b) {
        b.clearRect(0, 0, W, H);
        if (palette.background) {
          b.fillStyle = palette.background;
          b.fillRect(0, 0, W, H);
        }
        drawGrid(b, palette);
      }
      boardDirty = false;
    }
    // Con fondo opaco el tablero tapa el frame anterior; sin él (NEÓN) se limpia
    // para que se vea el negro de .crt-screen.
    if (!palette.background) c.clearRect(0, 0, W, H);
    c.drawImage(board, 0, 0);
    if (fruit) {
      const s = sprites.get(fruitKey, palette, art);
      c.drawImage(s.canvas, fruit.col * CELL - s.ox, fruit.row * CELL - s.oy);
    }
    drawSnake(c);
    if (effects) c.drawImage(effects, 0, 0);
  }

  // De la cola a la cabeza, cada pieza y su puente hacia la anterior, y la
  // cabeza al final. Con glow se copian sprites cacheados; sin glow (CLÁSICO) no
  // hay sombra que ahorrar y se dibuja directo: los ojos antialiasados en un
  // canvas aparte no salen idénticos al píxel (decisión del agente, a revisar).
  function drawSnake(c: CanvasRenderingContext2D) {
    const cached = palette.glow > 0;
    const n = snake.length;
    for (let i = n - 1; i >= 1; i--) {
      const { col, row } = snake[i];
      const inset = segmentInset(i, n);
      if (cached) {
        const seg = sprites.get(SEG_KEYS[inset], palette, art);
        c.drawImage(seg.canvas, col * CELL - seg.ox, row * CELL - seg.oy);
      } else {
        drawSegment(c, palette, col * CELL, row * CELL, inset);
      }

      // No se une a través del borde cuando la serpiente se envuelve.
      const prev = snake[i - 1];
      if (Math.abs(prev.col - col) + Math.abs(prev.row - row) === 1) {
        const horizontal = prev.row === row;
        const x = Math.min(col, prev.col) * CELL;
        const y = Math.min(row, prev.row) * CELL;
        if (cached) {
          const k = horizontal ? BRIDGE_H_KEYS[inset] : BRIDGE_V_KEYS[inset];
          const br = sprites.get(k, palette, art);
          c.drawImage(br.canvas, x - br.ox, y - br.oy);
        } else {
          drawBridge(c, palette, x, y, inset, horizontal);
        }
      }
    }
    const hx = snake[0].col * CELL;
    const hy = snake[0].row * CELL;
    if (cached) {
      const head = sprites.get(HEAD_KEYS[dir], palette, art);
      c.drawImage(head.canvas, hx - head.ox, hy - head.oy);
    } else {
      drawHead(c, palette, hx, hy, dir);
    }
  }

  // ── Bucle ───────────────────────────────────────────────────────────────────
  function loop(ts: number) {
    raf = null;
    const elapsed = lastTime === null ? 0 : (ts - lastTime) / 1000;
    lastTime = ts;
    acc += Math.min(elapsed, MAX_FRAME);
    while (acc >= STEP) {
      stepAccum += STEP_MS;
      acc -= STEP;
    }
    const interval = stepMs(level);
    if (stepAccum >= interval) {
      stepAccum -= interval;
      step();
      // Un frame largo no suelta varios pasos: como mucho queda uno pendiente.
      if (stepAccum > interval) stepAccum = interval;
    }
    if (finished) return;
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
