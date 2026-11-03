import type { Sprite, SpriteSet } from "./sprites";

export const W = 800;
export const H = 600;

export const POWERUP_DROP_CHANCE = 0.15;
export const POWERUP_DURATION = 5;
export const POWERUP_TTL = 12;
export const TRIPLE_SPREAD = 0.18;

// Indexados por tamaño: 1 (pequeño), 2 (mediano), 3 (grande).
export const RADII = [0, 16, 30, 50];
export const SPEEDS = [0, 85, 55, 32];
export const POINTS = [0, 100, 50, 20];

// Radio del glow de cada forma (se multiplica por `palette.glow`).
export const BULLET_GLOW = 12;
export const ROCK_GLOW = 9;
export const POWERUP_GLOW = 10;
export const SHIP_GLOW = 16; // la nave es lo más brillante de la pantalla
export const FLAME_GLOW = 8;
export const SPARK_GLOW = 6;

export type AsteroidSize = 1 | 2 | 3;
export type Keys = Record<string, boolean | undefined>;

// Colores y efectos de un skin (ver ./skins.ts).
export interface Palette {
  ship: string;
  rock: string;
  bullet: string;
  powerUp: string; // marco y texto «3x»
  spark: string; // partículas de explosión
  flame: string; // llama del propulsor
  background: string | null; // null = canvas transparente (se ve el fondo de .crt-screen)
  glow: number; // multiplicador de shadowBlur; 0 = sin glow
  scanlines: number; // opacidad de las scanlines dibujadas en el canvas; 0 = ninguna
  vignette: number; // opacidad de la viñeta en las esquinas; 0 = ninguna
}

export const wrap = (v: number, max: number) => ((v % max) + max) % max;
export const dist = (
  a: { x: number; y: number },
  b: { x: number; y: number },
) => Math.hypot(a.x - b.x, a.y - b.y);
export const rand = (min: number, max: number) =>
  min + Math.random() * (max - min);
export const randInt = (min: number, max: number) =>
  Math.floor(rand(min, max + 1));

// ── Formas (SPEC 12) ──────────────────────────────────────────────────────────
// Trazan cada forma, sin sombra, con su origen en (0, 0). El glow se pinta una
// sola vez con estas mismas funciones en ./sprites.ts, y en cada frame se copia
// debajo de la forma, igual que hacía shadowBlur (sombra y después la forma).
// Sin giro es idéntico; al girar, el glow difiere unas unidades sobre 255.

export function bulletShape(ctx: CanvasRenderingContext2D, palette: Palette) {
  ctx.fillStyle = palette.bullet;
  ctx.beginPath();
  // Un poco más grande que el radio de colisión (2) para que se vea con el brillo.
  ctx.arc(0, 0, 2.75, 0, Math.PI * 2);
  ctx.fill();
}

export function rockShape(
  ctx: CanvasRenderingContext2D,
  palette: Palette,
  verts: [number, number][],
) {
  ctx.strokeStyle = palette.rock;
  ctx.lineWidth = 1.75;
  ctx.lineJoin = "round";
  ctx.beginPath();
  ctx.moveTo(verts[0][0], verts[0][1]);
  for (let i = 1; i < verts.length; i++) ctx.lineTo(verts[i][0], verts[i][1]);
  ctx.closePath();
  ctx.stroke();
}

/** Marco del power-up de semilado `r`, girado 45°. */
export function powerUpFrameShape(
  ctx: CanvasRenderingContext2D,
  palette: Palette,
  r: number,
) {
  ctx.save();
  ctx.rotate(Math.PI / 4);
  ctx.strokeStyle = palette.powerUp;
  ctx.lineWidth = 2;
  ctx.strokeRect(-r, -r, r * 2, r * 2);
  ctx.restore();
}

export function powerUpTextShape(
  ctx: CanvasRenderingContext2D,
  palette: Palette,
) {
  ctx.fillStyle = palette.powerUp;
  ctx.font = "bold 12px monospace";
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  ctx.fillText("3x", 0, 0);
}

// Silueta clásica: triángulo con muesca trasera.
export function shipShape(ctx: CanvasRenderingContext2D, palette: Palette) {
  ctx.strokeStyle = palette.ship;
  ctx.lineWidth = 2;
  ctx.lineJoin = "round";
  ctx.beginPath();
  ctx.moveTo(20, 0); // nariz
  ctx.lineTo(-12, -9); // ala izquierda
  ctx.lineTo(-7, 0); // muesca trasera
  ctx.lineTo(-12, 9); // ala derecha
  ctx.closePath();
  ctx.stroke();
}

/** Llama del propulsor, con la punta a `len` px de la tobera. */
export function flameShape(
  ctx: CanvasRenderingContext2D,
  palette: Palette,
  len: number,
) {
  ctx.strokeStyle = palette.flame;
  ctx.lineWidth = 2;
  ctx.lineJoin = "round";
  ctx.beginPath();
  ctx.moveTo(-8, -4);
  ctx.lineTo(-8 - len, 0);
  ctx.lineTo(-8, 4);
  ctx.stroke();
}

/** Chispa: segmento desde el origen hasta (-len, 0). */
export function sparkShape(
  ctx: CanvasRenderingContext2D,
  palette: Palette,
  len: number,
) {
  ctx.strokeStyle = palette.spark;
  ctx.lineWidth = 1.25;
  ctx.beginPath();
  ctx.moveTo(0, 0);
  ctx.lineTo(-len, 0);
  ctx.stroke();
}

/** Copia un glow cacheado con su origen en el origen del sistema actual. */
function drawGlow(ctx: CanvasRenderingContext2D, sprite: Sprite) {
  ctx.drawImage(sprite.canvas, -sprite.ox, -sprite.oy);
}

// ── Bullet ────────────────────────────────────────────────────────────────────
export class Bullet {
  x: number;
  y: number;
  vx: number;
  vy: number;
  ttl = 1.1;
  radius = 2;
  dead = false;

  constructor(x: number, y: number, angle: number) {
    const SPEED = 520;
    this.x = x;
    this.y = y;
    this.vx = Math.cos(angle) * SPEED;
    this.vy = Math.sin(angle) * SPEED;
  }

  update(dt: number) {
    this.x = wrap(this.x + this.vx * dt, W);
    this.y = wrap(this.y + this.vy * dt, H);
    this.ttl -= dt;
    if (this.ttl <= 0) this.dead = true;
  }

  draw(ctx: CanvasRenderingContext2D, palette: Palette, sprites: SpriteSet) {
    ctx.save();
    ctx.translate(this.x, this.y);
    if (palette.glow > 0) drawGlow(ctx, sprites.get("bullet", palette));
    bulletShape(ctx, palette);
    ctx.restore();
  }
}

// ── Asteroid ──────────────────────────────────────────────────────────────────
export class Asteroid {
  x: number;
  y: number;
  size: AsteroidSize;
  radius: number;
  dead = false;
  vx: number;
  vy: number;
  rotSpeed: number;
  rot: number;
  verts: [number, number][] = [];

  constructor(x: number, y: number, size: AsteroidSize = 3) {
    this.x = x;
    this.y = y;
    this.size = size;
    this.radius = RADII[size];

    const angle = rand(0, Math.PI * 2);
    const speed = SPEEDS[size] + rand(-15, 15);
    this.vx = Math.cos(angle) * speed;
    this.vy = Math.sin(angle) * speed;
    this.rotSpeed = rand(-1.2, 1.2);
    this.rot = rand(0, Math.PI * 2);

    // Polígono irregular
    const n = randInt(8, 13);
    for (let i = 0; i < n; i++) {
      const a = (i / n) * Math.PI * 2;
      const r = this.radius * rand(0.6, 1.0);
      this.verts.push([Math.cos(a) * r, Math.sin(a) * r]);
    }
  }

  update(dt: number) {
    this.x = wrap(this.x + this.vx * dt, W);
    this.y = wrap(this.y + this.vy * dt, H);
    this.rot += this.rotSpeed * dt;
  }

  split(): Asteroid[] {
    if (this.size <= 1) return [];
    const size = (this.size - 1) as AsteroidSize;
    return [
      new Asteroid(this.x, this.y, size),
      new Asteroid(this.x, this.y, size),
    ];
  }

  draw(ctx: CanvasRenderingContext2D, palette: Palette, sprites: SpriteSet) {
    ctx.save();
    ctx.translate(this.x, this.y);
    ctx.rotate(this.rot);
    // El glow se cachea sin girar y gira con la roca (la sombra es isótropa).
    if (palette.glow > 0) drawGlow(ctx, sprites.rock(this, palette));
    rockShape(ctx, palette, this.verts);
    ctx.restore();
  }
}

// ── PowerUp ───────────────────────────────────────────────────────────────────
export class PowerUp {
  x: number;
  y: number;
  vx: number;
  vy: number;
  radius = 12;
  ttl = POWERUP_TTL;
  dead = false;

  constructor(x: number, y: number) {
    this.x = x;
    this.y = y;
    const angle = rand(0, Math.PI * 2);
    const speed = rand(20, 40);
    this.vx = Math.cos(angle) * speed;
    this.vy = Math.sin(angle) * speed;
  }

  update(dt: number) {
    this.x = wrap(this.x + this.vx * dt, W);
    this.y = wrap(this.y + this.vy * dt, H);
    this.ttl -= dt;
    if (this.ttl <= 0) this.dead = true;
  }

  draw(ctx: CanvasRenderingContext2D, palette: Palette, sprites: SpriteSet) {
    // Parpadeo durante los últimos 2 s de vida
    if (this.ttl < 2 && Math.floor(this.ttl * 8) % 2 === 0) return;
    const pulse = 0.85 + Math.sin(performance.now() / 150) * 0.15;
    const r = this.radius * pulse;
    ctx.save();
    ctx.translate(this.x, this.y);
    // Glow del marco por tamaño redondeado a 1/4 px; el trazo usa el exacto.
    if (palette.glow > 0)
      drawGlow(ctx, sprites.get(`pu:${Math.round(r * 4)}`, palette));
    powerUpFrameShape(ctx, palette, r);
    if (palette.glow > 0) drawGlow(ctx, sprites.get("pu-text", palette));
    powerUpTextShape(ctx, palette);
    ctx.restore();
  }
}

// ── Ship ──────────────────────────────────────────────────────────────────────
export class Ship {
  x = W / 2;
  y = H / 2;
  angle = -Math.PI / 2;
  vx = 0;
  vy = 0;
  radius = 12;
  thrusting = false;
  invincible = 3;
  shootCooldown = 0;
  tripleShot = 0;
  dead = false;

  reset() {
    this.x = W / 2;
    this.y = H / 2;
    this.angle = -Math.PI / 2;
    this.vx = 0;
    this.vy = 0;
    this.radius = 12;
    this.thrusting = false;
    this.invincible = 3;
    this.shootCooldown = 0;
    this.dead = false;
  }

  update(dt: number, keys: Keys) {
    if (this.dead) return;
    if (this.invincible > 0) this.invincible -= dt;
    if (this.shootCooldown > 0) this.shootCooldown -= dt;
    if (this.tripleShot > 0) this.tripleShot -= dt;

    const ROT = 3.5; // rad/s
    const THRUST = 260; // px/s²
    const DRAG = 0.987; // factor por frame de 60 Hz

    if (keys["ArrowLeft"]) this.angle -= ROT * dt;
    if (keys["ArrowRight"]) this.angle += ROT * dt;

    this.thrusting = !!keys["ArrowUp"];
    if (this.thrusting) {
      this.vx += Math.cos(this.angle) * THRUST * dt;
      this.vy += Math.sin(this.angle) * THRUST * dt;
    }

    // Con paso fijo (SPEC 12) el rozamiento se escala al paso: en 1/60 s
    // frena lo mismo que antes un frame a 60 Hz, a cualquier frecuencia.
    const drag = DRAG ** (dt * 60);
    this.vx *= drag;
    this.vy *= drag;
    this.x = wrap(this.x + this.vx * dt, W);
    this.y = wrap(this.y + this.vy * dt, H);
  }

  tryShoot(): Bullet[] {
    if (this.shootCooldown > 0 || this.dead) return [];
    this.shootCooldown = 0.2;
    const NOSE = 21;
    const ox = this.x + Math.cos(this.angle) * NOSE;
    const oy = this.y + Math.sin(this.angle) * NOSE;
    if (this.tripleShot > 0) {
      return [
        new Bullet(ox, oy, this.angle - TRIPLE_SPREAD),
        new Bullet(ox, oy, this.angle),
        new Bullet(ox, oy, this.angle + TRIPLE_SPREAD),
      ];
    }
    return [new Bullet(ox, oy, this.angle)];
  }

  draw(ctx: CanvasRenderingContext2D, palette: Palette, sprites: SpriteSet) {
    if (this.dead) return;
    // Parpadeo durante invencibilidad de reaparición
    if (this.invincible > 0 && Math.floor(this.invincible * 8) % 2 === 0)
      return;

    ctx.save();
    ctx.translate(this.x, this.y);
    ctx.rotate(this.angle);
    if (palette.glow > 0) drawGlow(ctx, sprites.get("ship", palette));
    shipShape(ctx, palette);

    // Llama del propulsor
    if (this.thrusting && Math.random() > 0.35) {
      const len = rand(6, 14);
      // Glow por longitud redondeada a 1/2 px; el trazo usa la exacta.
      if (palette.glow > 0)
        drawGlow(ctx, sprites.get(`flame:${Math.round(len * 2)}`, palette));
      flameShape(ctx, palette, len);
    }

    ctx.restore();
  }
}

// ── Partículas (explosión) ────────────────────────────────────────────────────
export class Particle {
  x: number;
  y: number;
  vx: number;
  vy: number;
  life: number;
  ttl: number;
  dead = false;
  // Estela de dibujo: (vx, vy) × 0,05 s, en polares para girar el glow.
  heading: number;
  trail: number;

  constructor(x: number, y: number) {
    this.x = x;
    this.y = y;
    const angle = rand(0, Math.PI * 2);
    const speed = rand(30, 130);
    this.vx = Math.cos(angle) * speed;
    this.vy = Math.sin(angle) * speed;
    this.heading = angle;
    this.trail = speed * 0.05;
    this.life = rand(0.4, 1.1);
    this.ttl = this.life;
  }

  update(dt: number) {
    this.x += this.vx * dt;
    this.y += this.vy * dt;
    this.ttl -= dt;
    if (this.ttl <= 0) this.dead = true;
  }

  draw(ctx: CanvasRenderingContext2D, palette: Palette, sprites: SpriteSet) {
    ctx.save();
    // El alfa se aplica al glow y al trazo por separado, como con la sombra.
    ctx.globalAlpha = Math.max(this.ttl / this.life, 0);
    ctx.translate(this.x, this.y);
    // Girado según la velocidad, el segmento (0,0)→(-trail,0) es el de
    // (0,0)→(-vx·0,05, -vy·0,05). Así el glow se comparte entre chispas por
    // longitud redondeada a 1/2 px (11 sprites); el trazo usa la exacta.
    ctx.rotate(this.heading);
    if (palette.glow > 0)
      drawGlow(
        ctx,
        sprites.get(`spark:${Math.round(this.trail * 2)}`, palette),
      );
    sparkShape(ctx, palette, this.trail);
    ctx.restore();
  }
}
