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
import type { CreateGameOptions, GameCallbacks, GameEngine } from "../contract";
import { DEFAULT_SKIN, type SkinId } from "../skins";
import { PALETTES } from "./skins";
import { BLOCK_KEYS, GHOST_KEYS, createSpriteSet } from "./sprites";

const START_INTERVAL = 1000;
const MIN_INTERVAL = 100;
const INTERVAL_STEP = 90;
// Bucle de paso fijo (SPEC 12): la simulación avanza en pasos de 1/240 s y
// como mucho 0,1 s por frame (por debajo de 10 fps, cámara lenta).
const STEP = 1000 / 240; // ms de simulación por paso
const MAX_FRAME = 100; // ms máximos simulados por frame
const EPS = 1e-6; // tolerancia al sumar pasos (240 pasos = 1000 ms exactos)
const ARROW_KEYS = ["ArrowLeft", "ArrowRight", "ArrowUp", "ArrowDown"];

function isTextField(target: EventTarget | null) {
  return (
    target instanceof HTMLElement &&
    (target.tagName === "INPUT" ||
      target.tagName === "TEXTAREA" ||
      target.isContentEditable)
  );
}

/** Canvas fuera de pantalla del tamaño lógico del juego. */
function createLayer() {
  const canvas = document.createElement("canvas");
  canvas.width = W;
  canvas.height = H;
  return { canvas, ctx: canvas.getContext("2d")! };
}

// Efectos de pantalla del skin (scanlines y viñeta), estáticos: sin parpadeo.
function renderEffects(palette: Palette): HTMLCanvasElement | null {
  if (palette.scanlines <= 0 && palette.vignette <= 0) return null;
  const { canvas, ctx } = createLayer();
  if (palette.scanlines > 0) {
    ctx.fillStyle = `rgba(0, 0, 0, ${palette.scanlines})`;
    for (let y = 0; y < H; y += 3) ctx.fillRect(0, y, W, 1);
  }
  if (palette.vignette > 0) {
    // Canvas estrecho (420×600): radios según la diagonal para que la viñeta
    // solo oscurezca las esquinas, con transición suave.
    const corner = Math.hypot(W / 2, H / 2);
    const vignette = ctx.createRadialGradient(
      W / 2,
      H / 2,
      corner * 0.6,
      W / 2,
      H / 2,
      corner,
    );
    vignette.addColorStop(0, "rgba(0, 0, 0, 0)");
    vignette.addColorStop(1, `rgba(0, 0, 0, ${palette.vignette})`);
    ctx.fillStyle = vignette;
    ctx.fillRect(0, 0, W, H);
  }
  return canvas;
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

  // ── Skin (paleta y efectos de pantalla) ─────────────────────────────────────
  let palette: Palette;
  const sprites = createSpriteSet(); // bloques de la pieza y de la fantasma

  // Capas cacheadas (SPEC 12). `boardLayer`: fondo, cuadrícula y bloques
  // fijados; `panelLayer`: separador y vista previa de la siguiente pieza. Se
  // rehacen solo al fijar una pieza, al empezar y al cambiar de skin.
  const boardLayer = createLayer();
  const panelLayer = createLayer();
  let boardDirty = true;
  // Scanlines y viñeta del skin, pintadas una vez al aplicar la paleta (null si
  // el skin no tiene efectos).
  let effects: HTMLCanvasElement | null = null;

  function applyPalette(skin: SkinId) {
    palette = PALETTES[skin]();
    sprites.clear();
    boardDirty = true;
    effects = renderEffects(palette);
  }
  applyPalette(options?.skin ?? DEFAULT_SKIN);

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
  let acc = 0; // ms pendientes de simular

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
    boardDirty = true; // cambian los bloques fijados y la siguiente pieza
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
    boardDirty = true;
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
  function drawGrid(g: CanvasRenderingContext2D) {
    g.strokeStyle = palette.grid;
    g.lineWidth = 1;
    g.beginPath();
    for (let c = 0; c <= COLS; c++) {
      g.moveTo(c * BLOCK + 0.5, 0);
      g.lineTo(c * BLOCK + 0.5, ROWS * BLOCK);
    }
    for (let r = 0; r <= ROWS; r++) {
      g.moveTo(0, r * BLOCK + 0.5);
      g.lineTo(BOARD_W, r * BLOCK + 0.5);
    }
    g.stroke();
  }

  // Pieza en juego y fantasma: bloques cacheados (sin shadowBlur por frame).
  function drawPieceSprites(piece: Piece, y: number, keys: string[]) {
    for (let r = 0; r < piece.shape.length; r++)
      for (let c = 0; c < piece.shape[r].length; c++) {
        const v = piece.shape[r][c];
        if (!v || !palette.colors[v]) continue;
        const sprite = sprites.get(keys[v], palette);
        ctx!.drawImage(
          sprite.canvas,
          (piece.x + c) * BLOCK - sprite.ox,
          (y + r) * BLOCK - sprite.oy,
        );
      }
  }

  // Etiqueta centrada en el panel de 120 px. Se pinta en el canvas visible en
  // cada frame (un solo fillText): rasterizado en una capa fuera de pantalla,
  // el antialiasing del texto sale distinto. No se solapa con la vista previa.
  function drawLabel() {
    ctx!.fillStyle = palette.label;
    ctx!.font = "11px ui-monospace, Consolas, monospace";
    ctx!.textAlign = "center";
    ctx!.textBaseline = "middle";
    ctx!.fillText("SIGUIENTE", BOARD_W + (W - BOARD_W) / 2, 28);
  }

  // Vista previa de la siguiente pieza, centrada en el panel.
  function drawNext(g: CanvasRenderingContext2D) {
    const shape = next.shape;
    g.save();
    g.translate(BOARD_W, 48);
    const offX = (4 - shape[0].length) / 2;
    const offY = (4 - shape.length) / 2;
    for (let r = 0; r < shape.length; r++)
      for (let c = 0; c < shape[r].length; c++)
        drawBlock(g, palette, offX + c, offY + r, shape[r][c]);
    g.restore();
  }

  // Rehace las capas cacheadas con el mismo orden de dibujo de siempre: fondo,
  // cuadrícula y bloques fijados debajo de la pieza; separador y vista previa
  // encima.
  function renderLayers() {
    boardDirty = false;
    const b = boardLayer.ctx;
    b.clearRect(0, 0, W, H);
    if (palette.background) {
      b.fillStyle = palette.background;
      b.fillRect(0, 0, W, H);
    }
    drawGrid(b);
    for (let r = 0; r < ROWS; r++)
      for (let c = 0; c < COLS; c++) drawBlock(b, palette, c, r, board[r][c]);

    const p = panelLayer.ctx;
    p.clearRect(0, 0, W, H);
    // Separador entre tablero y panel lateral
    p.strokeStyle = palette.separator;
    p.lineWidth = 1;
    p.beginPath();
    p.moveTo(BOARD_W + 0.5, 0);
    p.lineTo(BOARD_W + 0.5, H);
    p.stroke();
    drawNext(p);
  }

  function draw() {
    if (boardDirty) renderLayers();
    ctx!.clearRect(0, 0, W, H);
    ctx!.drawImage(boardLayer.canvas, 0, 0);
    drawPieceSprites(current, ghostY(), GHOST_KEYS);
    drawPieceSprites(current, current.y, BLOCK_KEYS);
    ctx!.drawImage(panelLayer.canvas, 0, 0);
    drawLabel();
    if (effects) ctx!.drawImage(effects, 0, 0);
  }

  // ── Bucle ───────────────────────────────────────────────────────────────────
  // Un paso de gravedad: el temporizador de caída avanza STEP ms. Como mucho
  // una fila por frame, igual que antes con MAX_DT: un frame largo no suelta
  // varias filas de golpe.
  function update(canDrop: boolean): boolean {
    dropAccum += STEP;
    if (!canDrop || dropAccum + EPS < dropInterval) return false;
    dropAccum = 0;
    if (!collide(board, current.shape, current.x, current.y + 1)) {
      current.y++;
    } else {
      lockPiece();
    }
    return true;
  }

  function loop(ts: number) {
    raf = null;
    const elapsed = lastTime === null ? 0 : Math.max(0, ts - lastTime);
    lastTime = ts;
    acc += Math.min(elapsed, MAX_FRAME);
    let dropped = false;
    while (acc >= STEP) {
      acc -= STEP;
      if (update(!dropped)) dropped = true;
      if (finished) break;
    }
    emit();
    draw();
    if (finished) return;
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
