import {
  BLOCK,
  BOARD_W,
  COLS,
  H,
  KICKS,
  LINE_SCORES,
  PIECES,
  ROWS,
  W,
  collide,
  createBoard,
  drawBlock,
  rotateCW,
  type Board,
  type Palette,
  type Piece,
} from "./entities";
import type { GameCallbacks, GameEngine } from "../contract";

const START_INTERVAL = 1000;
const MIN_INTERVAL = 100;
const INTERVAL_STEP = 90;
const MAX_DT = 50; // ms; evita soltar varias filas de golpe tras una pausa
const ARROW_KEYS = ["ArrowLeft", "ArrowRight", "ArrowUp", "ArrowDown"];

// Valores de respaldo iguales a los del tema (app/globals.css).
const FALLBACK_THEME = {
  cyan: "#00f5ff",
  yellow: "#f5ff00",
  magenta: "#ff006e",
  green: "#00ff88",
  dim: "#8a8fb5",
};

function readPalette(): Palette {
  const style = getComputedStyle(document.documentElement);
  const read = (name: string, fallback: string) =>
    style.getPropertyValue(name).trim() || fallback;
  return {
    colors: [
      null,
      read("--cyan", FALLBACK_THEME.cyan), // I
      read("--yellow", FALLBACK_THEME.yellow), // O
      read("--magenta", FALLBACK_THEME.magenta), // T
      read("--green", FALLBACK_THEME.green), // S
      "#ff6b6b", // Z
      "#7aa2ff", // J
      "#ff9f1c", // L
      "#9a9ab0", // N (tuerca)
    ],
    grid: "rgba(0, 245, 255, 0.08)",
    label: read("--ink-dim", FALLBACK_THEME.dim),
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

function randomPiece(): Piece {
  const type = Math.floor(Math.random() * 8) + 1;
  const shape = PIECES[type]!.map((row) => [...row]);
  return {
    type,
    shape,
    x: Math.floor(COLS / 2) - Math.floor(shape[0].length / 2),
    y: 0,
  };
}

export function createCaida(
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
  let board: Board;
  let current: Piece;
  let next: Piece;
  let score: number;
  let lines: number;
  let level: number;
  let dropInterval: number;
  let dropAccum: number;

  let paused = false;
  let finished = false; // partida terminada: el motor ya no captura teclas
  let destroyed = false;
  let raf: number | null = null;
  let lastTime: number | null = null;

  // ── Callbacks (solo al cambiar el valor) ────────────────────────────────────
  let sentScore = NaN;
  let sentLevel = NaN;
  let sentLines = NaN;

  function emit() {
    if (score !== sentScore) callbacks.onScore((sentScore = score));
    if (level !== sentLevel) callbacks.onLevel((sentLevel = level));
    if (lines !== sentLines) {
      sentLines = lines;
      callbacks.onStats([
        { key: "lines", label: "Líneas", value: String(lines) },
      ]);
    }
  }

  // ── Lógica ──────────────────────────────────────────────────────────────────
  function tryRotate() {
    const rotated = rotateCW(current.shape);
    for (const kick of KICKS) {
      if (!collide(board, rotated, current.x + kick, current.y)) {
        current.shape = rotated;
        current.x += kick;
        return;
      }
    }
  }

  function merge() {
    for (let r = 0; r < current.shape.length; r++)
      for (let c = 0; c < current.shape[r].length; c++)
        if (current.shape[r][c])
          board[current.y + r][current.x + c] = current.shape[r][c];
  }

  function clearLines() {
    let cleared = 0;
    for (let r = ROWS - 1; r >= 0; r--) {
      if (board[r].every((v) => v !== 0)) {
        board.splice(r, 1);
        board.unshift(new Array<number>(COLS).fill(0));
        cleared++;
        r++;
      }
    }
    if (cleared) {
      lines += cleared;
      score += (LINE_SCORES[cleared] || 0) * level;
      level = Math.floor(lines / 10) + 1;
      dropInterval = Math.max(
        MIN_INTERVAL,
        START_INTERVAL - (level - 1) * INTERVAL_STEP,
      );
    }
  }

  function ghostY() {
    let gy = current.y;
    while (!collide(board, current.shape, current.x, gy + 1)) gy++;
    return gy;
  }

  function spawn() {
    current = next;
    next = randomPiece();
    if (collide(board, current.shape, current.x, current.y)) finish();
  }

  function lockPiece() {
    merge();
    clearLines();
    spawn();
  }

  function hardDrop() {
    const gy = ghostY();
    score += (gy - current.y) * 2;
    current.y = gy;
    lockPiece();
  }

  function softDrop() {
    if (!collide(board, current.shape, current.x, current.y + 1)) {
      current.y++;
      score += 1;
    } else {
      lockPiece();
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
    board = createBoard();
    score = 0;
    lines = 0;
    level = 1;
    dropInterval = START_INTERVAL;
    dropAccum = 0;
    next = randomPiece();
    spawn();
    sentScore = sentLevel = sentLines = NaN;
    callbacks.onLives(null);
    emit();
  }

  // ── Entrada ─────────────────────────────────────────────────────────────────
  function onKeyDown(e: KeyboardEvent) {
    if (finished || isTextField(e.target)) return;

    if (e.code === "KeyP") {
      if (!e.repeat) callbacks.onPauseKey?.();
      return;
    }

    const isArrow = ARROW_KEYS.includes(e.code);
    const isSpace = e.code === "Space";
    // En pausa, Espacio queda libre para activar el botón enfocado.
    if (paused && isSpace) return;
    if (isArrow || isSpace) e.preventDefault();
    if (paused) return;

    switch (e.code) {
      case "ArrowLeft":
        if (!collide(board, current.shape, current.x - 1, current.y))
          current.x--;
        break;
      case "ArrowRight":
        if (!collide(board, current.shape, current.x + 1, current.y))
          current.x++;
        break;
      case "ArrowDown":
        softDrop();
        break;
      case "ArrowUp":
      case "KeyX":
        tryRotate();
        break;
      case "Space":
        hardDrop();
        break;
      default:
        return;
    }
    emit();
    if (!finished) draw();
  }

  window.addEventListener("keydown", onKeyDown);

  // ── Dibujo ──────────────────────────────────────────────────────────────────
  function drawGrid() {
    ctx!.strokeStyle = palette.grid;
    ctx!.lineWidth = 1;
    ctx!.beginPath();
    for (let c = 0; c <= COLS; c++) {
      ctx!.moveTo(c * BLOCK + 0.5, 0);
      ctx!.lineTo(c * BLOCK + 0.5, ROWS * BLOCK);
    }
    for (let r = 0; r <= ROWS; r++) {
      ctx!.moveTo(0, r * BLOCK + 0.5);
      ctx!.lineTo(BOARD_W, r * BLOCK + 0.5);
    }
    ctx!.stroke();
  }

  function drawPiece(piece: Piece, y: number, alpha = 1) {
    for (let r = 0; r < piece.shape.length; r++)
      for (let c = 0; c < piece.shape[r].length; c++)
        if (piece.shape[r][c])
          drawBlock(
            ctx!,
            palette,
            piece.x + c,
            y + r,
            piece.shape[r][c],
            alpha,
          );
  }

  function drawNext() {
    const shape = next.shape;
    // Etiqueta y vista previa centradas en el panel de 120 px.
    ctx!.save();
    ctx!.fillStyle = palette.label;
    ctx!.font = "11px ui-monospace, Consolas, monospace";
    ctx!.textAlign = "center";
    ctx!.textBaseline = "middle";
    ctx!.fillText("SIGUIENTE", BOARD_W + (W - BOARD_W) / 2, 28);
    ctx!.translate(BOARD_W, 48);
    const offX = (4 - shape[0].length) / 2;
    const offY = (4 - shape.length) / 2;
    for (let r = 0; r < shape.length; r++)
      for (let c = 0; c < shape[r].length; c++)
        drawBlock(ctx!, palette, offX + c, offY + r, shape[r][c]);
    ctx!.restore();
  }

  function draw() {
    ctx!.clearRect(0, 0, W, H);
    drawGrid();

    for (let r = 0; r < ROWS; r++)
      for (let c = 0; c < COLS; c++)
        drawBlock(ctx!, palette, c, r, board[r][c]);

    drawPiece(current, ghostY(), 0.2);
    drawPiece(current, current.y);

    // Separador entre tablero y panel lateral
    ctx!.strokeStyle = palette.grid;
    ctx!.beginPath();
    ctx!.moveTo(BOARD_W + 0.5, 0);
    ctx!.lineTo(BOARD_W + 0.5, H);
    ctx!.stroke();

    drawNext();
  }

  // ── Bucle ───────────────────────────────────────────────────────────────────
  function loop(ts: number) {
    raf = null;
    const dt = lastTime === null ? 0 : Math.min(ts - lastTime, MAX_DT);
    lastTime = ts;
    dropAccum += dt;
    if (dropAccum >= dropInterval) {
      dropAccum = 0;
      if (!collide(board, current.shape, current.x, current.y + 1)) {
        current.y++;
      } else {
        lockPiece();
      }
    }
    emit();
    draw();
    if (finished) return;
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
