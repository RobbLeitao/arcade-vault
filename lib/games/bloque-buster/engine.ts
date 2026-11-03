import {
  BASE_BALL_VX,
  BASE_BALL_VY,
  BLOCKS_ORIGIN_X,
  BLOCKS_ORIGIN_Y,
  BLOCK_H,
  BLOCK_W,
  EXPLOSION_DURATION,
  H,
  PADDLE_SPEED,
  POINTS_PER_BLOCK,
  START_LIVES,
  W,
  collideAABB,
  explosionStep,
  type Ball,
  type Block,
  type Explosion,
  type Paddle,
  type Palette,
} from "./entities";
import { LEVELS } from "./levels";
import type { CreateGameOptions, GameCallbacks, GameEngine } from "../contract";
import { DEFAULT_SKIN, type SkinId } from "../skins";
import { PALETTES } from "./skins";
import {
  BLOCK_KEYS,
  EXPLOSION_KEYS,
  PADDLE_SUBPX,
  createSpriteSet,
} from "./sprites";

// Bucle de paso fijo (SPEC 12): la simulación avanza siempre en pasos de STEP,
// igual a 60, 120 o 144 Hz. MAX_FRAME acota lo simulado por frame: por debajo
// de 10 fps el juego va a cámara lenta en vez de atravesar bloques o la paleta.
const STEP = 1 / 240; // s de simulación por paso
const STEP_MS = STEP * 1000; // update() trabaja en ms
const MAX_FRAME = 0.1; // s máximos simulados por frame
const LAST_LEVEL = LEVELS.length;

function createLayer(): HTMLCanvasElement {
  const layer = document.createElement("canvas");
  layer.width = W;
  layer.height = H;
  return layer;
}

// Efectos de pantalla del skin (scanlines y viñeta), estáticos: se pintan una
// vez por skin en su propia capa. null si el skin no tiene efectos.
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
  return layer;
}

function isTextField(target: EventTarget | null) {
  return (
    target instanceof HTMLElement &&
    (target.tagName === "INPUT" ||
      target.tagName === "TEXTAREA" ||
      target.isContentEditable)
  );
}

export function createBloqueBuster(
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
      goToLevel: noop,
    };
  }

  // ── Capas cacheadas (SPEC 12) ───────────────────────────────────────────────
  // Fondo + ladrillos vivos: solo se repinta al romper un ladrillo, al cargar un
  // nivel o al cambiar el skin.
  const board = createLayer();
  let boardDirty = true;
  // Scanlines + viñeta del skin, pintadas una vez; null si el skin no tiene.
  let effects: HTMLCanvasElement | null = null;
  // Formas con su glow (ladrillos, destellos, paleta y pelota), al primer uso.
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

  // Cada reproducción usa un clon para que los sonidos puedan solaparse.
  const bounceSound = new Audio("/games/bloque-buster/ball-bounce.mp3");
  const breakSound = new Audio("/games/bloque-buster/break-sound.mp3");
  bounceSound.preload = "auto";
  breakSound.preload = "auto";

  function play(sound: HTMLAudioElement) {
    (sound.cloneNode() as HTMLAudioElement).play().catch(() => {});
  }

  // ── Estado ──────────────────────────────────────────────────────────────────
  const paddle: Paddle = { x: 0, y: 560, w: 81, h: 14 };
  const ball: Ball = { x: 0, y: 0, w: 16, h: 16, vx: 0, vy: 0 };
  let blocks: Block[] = [];
  let explosions: Explosion[] = [];
  let lives = START_LIVES;
  let score = 0;
  let currentLevel = 1;
  const keys = { ArrowLeft: false, ArrowRight: false };

  let paused = false;
  let finished = false; // partida terminada: el motor ya no captura teclas
  let destroyed = false;
  let raf: number | null = null;
  let lastTime: number | null = null;
  let acc = 0; // s pendientes de simular
  const paddleKeys = Array.from(
    { length: PADDLE_SUBPX },
    (_, q) => `paddle:${paddle.w}:${paddle.h}:${q}`,
  );
  const ballKey = `ball:${ball.w}:${ball.h}`;

  // ── Callbacks (solo al cambiar el valor) ────────────────────────────────────
  let sentScore = NaN;
  let sentLives = NaN;
  let sentLevel = NaN;

  function emit() {
    if (score !== sentScore) callbacks.onScore((sentScore = score));
    if (lives !== sentLives) callbacks.onLives((sentLives = lives));
    if (currentLevel !== sentLevel)
      callbacks.onLevel((sentLevel = currentLevel));
  }

  // ── Lógica ──────────────────────────────────────────────────────────────────
  function placeBall() {
    const speed = LEVELS[currentLevel - 1].speed;
    ball.x = paddle.x + (paddle.w - ball.w) / 2;
    ball.y = paddle.y - ball.h;
    ball.vx = BASE_BALL_VX * speed;
    ball.vy = BASE_BALL_VY * speed;
  }

  function loadLevel(n: number) {
    currentLevel = n;
    blocks = LEVELS[n - 1].blocks.map((b) => ({
      x: BLOCKS_ORIGIN_X + b.col * BLOCK_W,
      y: BLOCKS_ORIGIN_Y + b.row * BLOCK_H,
      w: BLOCK_W,
      h: BLOCK_H,
      color: b.color,
      alive: true,
    }));
    explosions = [];
    boardDirty = true;
    placeBall();
  }

  function resetKeys() {
    keys.ArrowLeft = false;
    keys.ArrowRight = false;
  }

  function init() {
    paddle.x = (W - paddle.w) / 2;
    lives = START_LIVES;
    score = 0;
    resetKeys();
    loadLevel(1);
    sentScore = sentLives = sentLevel = NaN;
    callbacks.onStats([]);
    emit();
  }

  function finish() {
    if (finished) return;
    emit();
    finished = true;
    resetKeys();
    stopLoop();
    draw();
    callbacks.onGameOver(score);
  }

  function update(dt: number) {
    const sec = dt / 1000;

    if (keys.ArrowLeft) paddle.x = Math.max(0, paddle.x - PADDLE_SPEED * sec);
    if (keys.ArrowRight)
      paddle.x = Math.min(W - paddle.w, paddle.x + PADDLE_SPEED * sec);

    ball.x += ball.vx * sec;
    ball.y += ball.vy * sec;

    // Paredes y techo
    if (ball.x <= 0) {
      ball.x = 0;
      ball.vx = Math.abs(ball.vx);
      play(bounceSound);
    }
    if (ball.x + ball.w >= W) {
      ball.x = W - ball.w;
      ball.vx = -Math.abs(ball.vx);
      play(bounceSound);
    }
    if (ball.y <= 0) {
      ball.y = 0;
      ball.vy = Math.abs(ball.vy);
      play(bounceSound);
    }

    // Paleta (sin ángulo según el punto de impacto)
    if (
      ball.vy > 0 &&
      ball.x + ball.w > paddle.x &&
      ball.x < paddle.x + paddle.w &&
      ball.y + ball.h >= paddle.y &&
      ball.y + ball.h <= paddle.y + paddle.h + 8
    ) {
      ball.y = paddle.y - ball.h;
      ball.vy = -Math.abs(ball.vy);
      play(bounceSound);
    }

    // Bloques: uno por paso y siempre se invierte vy
    for (const block of blocks) {
      if (!block.alive || !collideAABB(ball, block)) continue;
      block.alive = false;
      boardDirty = true;
      explosions.push({
        x: block.x,
        y: block.y,
        w: block.w,
        h: block.h,
        color: block.color,
        elapsed: 0,
      });
      score += POINTS_PER_BLOCK;
      ball.vy = -ball.vy;
      play(breakSound);
      if (blocks.every((b) => !b.alive)) {
        if (currentLevel < LAST_LEVEL) {
          loadLevel(currentLevel + 1);
        } else {
          finish();
          return;
        }
      }
      break;
    }

    // Destellos: avanzan y se descartan en el sitio, sin crear arrays por paso.
    let kept = 0;
    for (const exp of explosions) {
      exp.elapsed += dt;
      if (exp.elapsed < EXPLOSION_DURATION) explosions[kept++] = exp;
    }
    explosions.length = kept;

    // Pelota perdida
    if (ball.y > H) {
      lives--;
      if (lives <= 0) {
        lives = 0;
        finish();
      } else {
        placeBall();
      }
    }
  }

  // ── Entrada ─────────────────────────────────────────────────────────────────
  function onKeyDown(e: KeyboardEvent) {
    if (finished || isTextField(e.target)) return;

    if (e.code === "KeyP" || e.code === "Escape") {
      if (!e.repeat) callbacks.onPauseKey?.();
      return;
    }

    if (e.code === "ArrowLeft" || e.code === "ArrowRight") {
      e.preventDefault();
      keys[e.code] = true;
    }
  }

  function onKeyUp(e: KeyboardEvent) {
    if (e.code === "ArrowLeft" || e.code === "ArrowRight") keys[e.code] = false;
  }

  window.addEventListener("keydown", onKeyDown);
  window.addEventListener("keyup", onKeyUp);

  // ── Dibujo ──────────────────────────────────────────────────────────────────
  function paintBoard() {
    const b = board.getContext("2d");
    if (!b) return;
    b.clearRect(0, 0, W, H);
    if (palette.background) {
      b.fillStyle = palette.background;
      b.fillRect(0, 0, W, H);
    }
    // Mismo orden que antes: el glow de cada ladrillo cae sobre los anteriores.
    for (const block of blocks) {
      if (!block.alive) continue;
      const s = sprites.get(BLOCK_KEYS[block.color], palette);
      b.drawImage(s.canvas, block.x - s.ox, block.y - s.oy);
    }
  }

  function draw() {
    const c = ctx!;
    if (boardDirty) {
      paintBoard();
      boardDirty = false;
    }
    // Con fondo opaco la capa cubre todo el canvas; sin él (NEÓN) hay que limpiar.
    if (!palette.background) c.clearRect(0, 0, W, H);
    c.drawImage(board, 0, 0);
    // Los destellos parten de la esquina del bloque, siempre entera.
    for (const exp of explosions) {
      const s = sprites.get(
        EXPLOSION_KEYS[exp.color][explosionStep(exp.elapsed)],
        palette,
      );
      c.drawImage(s.canvas, exp.x - s.ox, exp.y - s.oy);
    }
    // Paleta: sprite ya desplazado a su fracción de x (ver PADDLE_SUBPX), copiado
    // en un píxel entero. Conserva el antialias exacto de su posición con
    // decimales, como cuando se pintaba con fillRect.
    let px = Math.floor(paddle.x);
    let q = Math.round((paddle.x - px) * PADDLE_SUBPX);
    if (q === PADDLE_SUBPX) {
      px++;
      q = 0;
    }
    const p = sprites.get(paddleKeys[q], palette);
    c.drawImage(p.canvas, px - p.ox, paddle.y - p.oy);
    // Pelota sin redondear: el filtrado de drawImage aproxima su antialias.
    const s = sprites.get(ballKey, palette);
    c.drawImage(s.canvas, ball.x - s.ox, ball.y - s.oy);
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
      update(STEP_MS);
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
    goToLevel(level: number) {
      if (destroyed || finished) return;
      if (!Number.isInteger(level) || level < 1 || level > LAST_LEVEL) return;
      loadLevel(level);
      emit();
      draw();
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
      resetKeys();
      window.removeEventListener("keydown", onKeyDown);
      window.removeEventListener("keyup", onKeyUp);
    },
  };
}
