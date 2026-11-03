import {
  Asteroid,
  Bullet,
  H,
  Particle,
  POINTS,
  POWERUP_DROP_CHANCE,
  POWERUP_DURATION,
  PowerUp,
  Ship,
  W,
  dist,
  rand,
  type Keys,
  type Palette,
} from "./entities";
import type { CreateGameOptions, GameCallbacks, GameEngine } from "../contract";
import { DEFAULT_SKIN, type SkinId } from "../skins";
import { PALETTES } from "./skins";
import { createSpriteSet } from "./sprites";

type State = "playing" | "dead" | "gameover";

const START_LIVES = 3;
const CONTROL_KEYS = ["ArrowLeft", "ArrowRight", "ArrowUp", "Space"];

// Bucle de paso fijo (SPEC 12): la simulación avanza siempre en pasos de STEP,
// igual a 60, 120 o 144 Hz. MAX_FRAME acota lo simulado por frame: por debajo
// de 10 fps el juego va a cámara lenta en vez de dar saltos.
const STEP = 1 / 240; // s de simulación por paso
const MAX_FRAME = 0.1; // s máximos simulados por frame

/** Quita en el sitio los elementos muertos, conservando el orden. */
function compact<T extends { dead: boolean }>(list: T[]) {
  let n = 0;
  for (const item of list) if (!item.dead) list[n++] = item;
  list.length = n;
}

/** Scanlines y viñeta del skin en un canvas propio; null si no tiene. */
function paintEffects(palette: Palette): HTMLCanvasElement | null {
  if (palette.scanlines <= 0 && palette.vignette <= 0) return null;
  const layer = document.createElement("canvas");
  layer.width = W;
  layer.height = H;
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

export function createAsteroids(
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
  // Glow de cada forma, pintado al primer uso.
  const sprites = createSpriteSet();
  // Scanlines + viñeta del skin, pintadas una vez; null si el skin no tiene.
  let effects: HTMLCanvasElement | null = null;

  // ── Skin (paleta y efectos de pantalla) ─────────────────────────────────────
  let palette: Palette;

  function applyPalette(skin: SkinId) {
    palette = PALETTES[skin]();
    sprites.clear();
    effects = paintEffects(palette);
  }
  applyPalette(options?.skin ?? DEFAULT_SKIN);

  // ── Estado ──────────────────────────────────────────────────────────────────
  let ship: Ship;
  let bullets: Bullet[];
  let asteroids: Asteroid[];
  let particles: Particle[];
  let powerUps: PowerUp[];
  let score: number;
  let lives: number;
  let level: number;
  let state: State;
  let deadTimer = 0;
  let powerUpSpawned: boolean;
  let killsSinceSpawn: number;

  let paused = false;
  let finished = false; // partida terminada: el motor ya no captura teclas
  let destroyed = false;
  let raf: number | null = null;
  let lastTime: number | null = null;
  let acc = 0; // s pendientes de simular
  const newAsteroids: Asteroid[] = []; // fragmentos de cada paso (reutilizado)

  // ── Callbacks (solo al cambiar el valor) ────────────────────────────────────
  let sentScore = NaN;
  let sentLives = NaN;
  let sentLevel = NaN;
  let sentPowerUp = NaN;

  function emit() {
    if (score !== sentScore) callbacks.onScore((sentScore = score));
    if (lives !== sentLives) callbacks.onLives((sentLives = lives));
    if (level !== sentLevel) callbacks.onLevel((sentLevel = level));
    // Paso de 0.1 s; 0 = sin power-up.
    const left = ship.tripleShot > 0 ? Math.ceil(ship.tripleShot * 10) / 10 : 0;
    if (left !== sentPowerUp) {
      sentPowerUp = left;
      callbacks.onStats(
        left > 0
          ? [
              {
                key: "triple",
                label: "Triple",
                value: `3x ${left.toFixed(1)}s`,
                color: "magenta",
              },
            ]
          : [],
      );
    }
  }

  // ── Entrada ─────────────────────────────────────────────────────────────────
  const keys: Keys = {};
  const justPressed: Keys = {};

  function pressed(code: string) {
    const val = justPressed[code];
    justPressed[code] = false;
    return !!val;
  }

  function onKeyDown(e: KeyboardEvent) {
    if (finished || isTextField(e.target)) return;
    if (!CONTROL_KEYS.includes(e.code)) return;
    // En pausa, Espacio queda libre para activar el botón enfocado.
    if (paused && e.code === "Space") return;
    e.preventDefault();
    if (!keys[e.code] && !paused) justPressed[e.code] = true;
    keys[e.code] = true;
  }

  function onKeyUp(e: KeyboardEvent) {
    keys[e.code] = false;
    if (finished || isTextField(e.target)) return;
    if (paused && e.code === "Space") return;
    if (CONTROL_KEYS.includes(e.code)) e.preventDefault();
  }

  function onBlur() {
    for (const code of CONTROL_KEYS) {
      keys[code] = false;
      justPressed[code] = false;
    }
  }

  window.addEventListener("keydown", onKeyDown);
  window.addEventListener("keyup", onKeyUp);
  window.addEventListener("blur", onBlur);

  // ── Lógica ──────────────────────────────────────────────────────────────────
  function spawnAsteroids(count: number) {
    const SAFE_DIST = 130;
    for (let i = 0; i < count; i++) {
      let x: number;
      let y: number;
      do {
        x = rand(0, W);
        y = rand(0, H);
      } while (Math.hypot(x - W / 2, y - H / 2) < SAFE_DIST);
      asteroids.push(new Asteroid(x, y, 3));
    }
  }

  function initGame() {
    ship = new Ship();
    bullets = [];
    asteroids = [];
    particles = [];
    powerUps = [];
    powerUpSpawned = false;
    killsSinceSpawn = 0;
    score = 0;
    lives = START_LIVES;
    level = 1;
    state = "playing";
    spawnAsteroids(4);
    sentScore = sentLives = sentLevel = sentPowerUp = NaN;
    emit();
  }

  function nextLevel() {
    level++;
    bullets = [];
    particles = [];
    powerUps = [];
    powerUpSpawned = false;
    killsSinceSpawn = 0;
    ship.reset();
    spawnAsteroids(3 + level);
  }

  function explode(x: number, y: number, count = 8) {
    for (let i = 0; i < count; i++) particles.push(new Particle(x, y));
  }

  function finish() {
    finished = true;
    state = "gameover";
    callbacks.onGameOver(score);
  }

  function killShip() {
    explode(ship.x, ship.y, 14);
    ship.dead = true;
    lives--;
    if (lives <= 0) {
      emit();
      finish();
    } else {
      state = "dead";
      deadTimer = 2;
    }
  }

  function updateParticles(dt: number) {
    for (const p of particles) p.update(dt);
    compact(particles);
  }

  function update(dt: number) {
    if (state === "gameover") {
      updateParticles(dt);
      return;
    }

    if (state === "dead") {
      deadTimer -= dt;
      updateParticles(dt);
      for (const a of asteroids) a.update(dt);
      if (deadTimer <= 0) {
        state = "playing";
        ship.reset();
      }
      return;
    }

    // Disparar
    if (pressed("Space")) {
      bullets.push(...ship.tryShoot());
    }

    ship.update(dt, keys);
    for (const b of bullets) b.update(dt);
    for (const a of asteroids) a.update(dt);
    for (const p of particles) p.update(dt);
    for (const p of powerUps) p.update(dt);

    compact(bullets);
    compact(particles);
    compact(powerUps);

    for (const p of powerUps) {
      if (!p.dead && dist(ship, p) < ship.radius + p.radius) {
        p.dead = true;
        ship.tripleShot = POWERUP_DURATION;
      }
    }

    // Bala vs asteroide
    newAsteroids.length = 0;
    for (const b of bullets) {
      for (const a of asteroids) {
        if (!a.dead && !b.dead && dist(b, a) < a.radius) {
          b.dead = true;
          a.dead = true;
          score += POINTS[a.size];
          explode(a.x, a.y, a.size * 5);
          newAsteroids.push(...a.split());
          if (!powerUpSpawned) {
            killsSinceSpawn++;
            const guaranteed = killsSinceSpawn >= 5;
            if (guaranteed || Math.random() < POWERUP_DROP_CHANCE) {
              powerUps.push(new PowerUp(a.x, a.y));
              powerUpSpawned = true;
            }
          }
        }
      }
    }
    compact(asteroids);
    for (const a of newAsteroids) asteroids.push(a);
    newAsteroids.length = 0;
    compact(bullets);

    // Nave vs asteroide
    if (ship.invincible <= 0) {
      for (const a of asteroids) {
        if (dist(ship, a) < ship.radius + a.radius * 0.82) {
          killShip();
          break;
        }
      }
    }

    // Nivel completado
    if (asteroids.length === 0) nextLevel();
  }

  function draw() {
    const c = ctx!;
    if (palette.background) {
      c.fillStyle = palette.background;
      c.fillRect(0, 0, W, H);
    } else {
      c.clearRect(0, 0, W, H);
    }
    for (const p of particles) p.draw(c, palette, sprites);
    for (const a of asteroids) a.draw(c, palette, sprites);
    for (const p of powerUps) p.draw(c, palette, sprites);
    for (const b of bullets) b.draw(c, palette, sprites);
    ship.draw(c, palette, sprites);
    // Efectos de pantalla del skin, estáticos: sin parpadeo.
    if (effects) c.drawImage(effects, 0, 0);
  }

  // ── Bucle ───────────────────────────────────────────────────────────────────
  function loop(ts: number) {
    raf = null;
    const elapsed = lastTime === null ? 0 : (ts - lastTime) / 1000;
    lastTime = ts;
    acc += Math.min(elapsed, MAX_FRAME);
    // Tras el fin solo se siguen animando las partículas (update lo acota).
    while (acc >= STEP) {
      update(STEP);
      acc -= STEP;
    }
    emit();
    draw();
    // Tras el fin de la partida el bucle se detiene cuando se apagan las partículas.
    if (state === "gameover" && particles.length === 0) return;
    raf = requestAnimationFrame(loop);
  }

  function startLoop() {
    if (raf !== null || destroyed) return;
    lastTime = null;
    acc = 0;
    raf = requestAnimationFrame(loop);
  }

  function stopLoop() {
    if (raf !== null) cancelAnimationFrame(raf);
    raf = null;
  }

  // ── API ─────────────────────────────────────────────────────────────────────
  initGame();
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
      justPressed["Space"] = false;
      startLoop();
    },
    restart() {
      if (destroyed) return;
      stopLoop();
      paused = false;
      finished = false;
      for (const code of CONTROL_KEYS) justPressed[code] = false;
      initGame();
      draw();
      startLoop();
    },
    end() {
      if (destroyed || finished) return;
      explode(ship.x, ship.y, 14);
      ship.dead = true;
      finish();
      if (paused) {
        // Pausada: se dibuja el último fotograma y el bucle sigue parado.
        paused = false;
        draw();
      }
      startLoop();
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
      window.removeEventListener("keyup", onKeyUp);
      window.removeEventListener("blur", onBlur);
    },
  };
}
