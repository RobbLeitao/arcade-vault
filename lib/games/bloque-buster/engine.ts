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
  drawBall,
  drawBlock,
  drawExplosion,
  drawPaddle,
  type Ball,
  type Block,
  type Explosion,
  type Paddle,
  type Palette,
} from "./entities";
import { LEVELS } from "./levels";
import type { GameCallbacks, GameEngine } from "../contract";

const MAX_DT = 50; // ms; evita atravesar bloques y soltar la pelota tras una pausa
const LAST_LEVEL = LEVELS.length;

// Valores de respaldo iguales a los del tema (app/globals.css).
const FALLBACK_THEME = {
  cyan: "#00f5ff",
  yellow: "#f5ff00",
  magenta: "#ff006e",
  green: "#00ff88",
  ink: "#e6e9ff",
};

function readPalette(): Palette {
  const style = getComputedStyle(document.documentElement);
  const read = (name: string, fallback: string) =>
    style.getPropertyValue(name).trim() || fallback;
  const cyan = read("--cyan", FALLBACK_THEME.cyan);
  return {
    blocks: {
      red: "#ff3b3b",
      yellow: read("--yellow", FALLBACK_THEME.yellow),
      cyan,
      magenta: read("--magenta", FALLBACK_THEME.magenta),
      hotpink: "#ff69b4",
      green: read("--green", FALLBACK_THEME.green),
      gray: "#9a9ab0",
    },
    paddle: cyan,
    ball: read("--ink", FALLBACK_THEME.ink),
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

export function createBloqueBuster(
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
      goToLevel: noop,
    };
  }

  const palette = readPalette();

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

    // Bloques: uno por fotograma y siempre se invierte vy
    for (const block of blocks) {
      if (!block.alive || !collideAABB(ball, block)) continue;
      block.alive = false;
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

    for (const exp of explosions) exp.elapsed += dt;
    explosions = explosions.filter((exp) => exp.elapsed < EXPLOSION_DURATION);

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
  function draw() {
    ctx!.clearRect(0, 0, W, H);
    for (const block of blocks) {
      if (block.alive) drawBlock(ctx!, block, palette);
    }
    for (const exp of explosions) drawExplosion(ctx!, exp, palette);
    drawPaddle(ctx!, paddle, palette);
    drawBall(ctx!, ball, palette);
  }

  // ── Bucle ───────────────────────────────────────────────────────────────────
  function loop(ts: number) {
    raf = null;
    const dt = lastTime === null ? 0 : Math.min(ts - lastTime, MAX_DT);
    lastTime = ts;
    update(dt);
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
    goToLevel(level: number) {
      if (destroyed || finished) return;
      if (!Number.isInteger(level) || level < 1 || level > LAST_LEVEL) return;
      loadLevel(level);
      emit();
      draw();
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
