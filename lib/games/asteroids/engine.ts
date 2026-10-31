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
import type { GameCallbacks, GameEngine } from "../contract";

type State = "playing" | "dead" | "gameover";

const START_LIVES = 3;
const CONTROL_KEYS = ["ArrowLeft", "ArrowRight", "ArrowUp", "Space"];

// Valores de respaldo iguales a los del tema (app/globals.css).
const FALLBACK_PALETTE: Palette = {
  ship: "#00f5ff",
  rock: "#f5ff00",
  bullet: "#e6e9ff",
  powerUp: "#ff006e",
  spark: "#f5ff00",
};

function readPalette(): Palette {
  const style = getComputedStyle(document.documentElement);
  const read = (name: string, fallback: string) =>
    style.getPropertyValue(name).trim() || fallback;
  return {
    ship: read("--cyan", FALLBACK_PALETTE.ship),
    rock: read("--yellow", FALLBACK_PALETTE.rock),
    bullet: read("--ink", FALLBACK_PALETTE.bullet),
    powerUp: read("--magenta", FALLBACK_PALETTE.powerUp),
    spark: read("--yellow", FALLBACK_PALETTE.spark),
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

export function createAsteroids(
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
    particles.forEach((p) => p.update(dt));
    particles = particles.filter((p) => !p.dead);
  }

  function update(dt: number) {
    if (state === "gameover") {
      updateParticles(dt);
      return;
    }

    if (state === "dead") {
      deadTimer -= dt;
      updateParticles(dt);
      asteroids.forEach((a) => a.update(dt));
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
    bullets.forEach((b) => b.update(dt));
    asteroids.forEach((a) => a.update(dt));
    particles.forEach((p) => p.update(dt));
    powerUps.forEach((p) => p.update(dt));

    bullets = bullets.filter((b) => !b.dead);
    particles = particles.filter((p) => !p.dead);
    powerUps = powerUps.filter((p) => !p.dead);

    for (const p of powerUps) {
      if (!p.dead && dist(ship, p) < ship.radius + p.radius) {
        p.dead = true;
        ship.tripleShot = POWERUP_DURATION;
      }
    }

    // Bala vs asteroide
    const newAsteroids: Asteroid[] = [];
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
    asteroids = asteroids.filter((a) => !a.dead).concat(newAsteroids);
    bullets = bullets.filter((b) => !b.dead);

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

    emit();
  }

  function draw() {
    ctx!.clearRect(0, 0, W, H);
    particles.forEach((p) => p.draw(ctx!, palette));
    asteroids.forEach((a) => a.draw(ctx!, palette));
    powerUps.forEach((p) => p.draw(ctx!, palette));
    bullets.forEach((b) => b.draw(ctx!, palette));
    ship.draw(ctx!, palette);
  }

  // ── Bucle ───────────────────────────────────────────────────────────────────
  function loop(ts: number) {
    raf = null;
    const dt = lastTime === null ? 0 : Math.min((ts - lastTime) / 1000, 0.05);
    lastTime = ts;
    update(dt);
    draw();
    // Tras el fin de la partida el bucle se detiene cuando se apagan las partículas.
    if (state === "gameover" && particles.length === 0) return;
    raf = requestAnimationFrame(loop);
  }

  function startLoop() {
    if (raf !== null || destroyed) return;
    lastTime = null;
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
    destroy() {
      destroyed = true;
      stopLoop();
      window.removeEventListener("keydown", onKeyDown);
      window.removeEventListener("keyup", onKeyUp);
      window.removeEventListener("blur", onBlur);
    },
  };
}
