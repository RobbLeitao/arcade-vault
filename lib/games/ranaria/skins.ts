import type { SkinId } from "../skins";
import type { Palette } from "./entities";

// Valores de respaldo iguales a los del tema (app/globals.css).
const THEME = {
  bg: "#0a0a0f",
  bg3: "#15151f",
  ink: "#e6e9ff",
  cyan: "#00f5ff",
  magenta: "#ff006e",
  yellow: "#f5ff00",
  green: "#00ff88",
  gold: "#ffcf3a",
  silver: "#c7d0e0",
  bronze: "#d97a3a",
};

/** Oscurece un color `#rgb` o `#rrggbb` multiplicando sus canales por `f` (0..1). */
function darken(hex: string, f: number): string {
  const m = /^#?([0-9a-f]{3}|[0-9a-f]{6})$/i.exec(hex.trim());
  if (!m) return hex;
  // El CSS minificado puede devolver la forma corta (#0f8).
  const full = m[1].length === 3 ? m[1].replace(/./g, (d) => d + d) : m[1];
  const n = parseInt(full, 16);
  const ch = (shift: number) => Math.round(((n >> shift) & 255) * f);
  return `rgb(${ch(16)}, ${ch(8)}, ${ch(0)})`;
}

// NEÓN: el look original de RANARIA, leído de las variables CSS del tema.
function readNeonPalette(): Palette {
  const style = getComputedStyle(document.documentElement);
  const read = (name: string, fallback: string) =>
    style.getPropertyValue(name).trim() || fallback;
  const cyan = read("--cyan", THEME.cyan);
  const green = read("--green", THEME.green);
  return {
    road: read("--bg", THEME.bg),
    water: darken(cyan, 0.16),
    safe: darken(green, 0.16),
    hedge: darken(green, 0.3),
    goal: read("--bg-3", THEME.bg3),
    goalBorder: read("--gold", THEME.gold),
    cars: [
      read("--magenta", THEME.magenta),
      read("--yellow", THEME.yellow),
      cyan,
    ],
    truck: read("--silver", THEME.silver),
    log: read("--bronze", THEME.bronze),
    turtle: green,
    submerged: green,
    submergedAlpha: 0.3,
    submergedDash: [],
    frog: green,
    frogOutline: null,
    eye: read("--ink", THEME.ink),
    glow: 1,
    scanlines: 0,
    vignette: 0,
  };
}

// CLÁSICO: colores de la recreativa original (río azul marino, mediana
// violeta, troncos marrones, tortugas rojas, camiones blancos), planos y sin
// glow. La rana verde no comparte color con ningún apoyo del río.
const CLASICO: Palette = {
  road: "#000000",
  water: "#000a45",
  safe: "#26103e",
  hedge: "#0b4614",
  goal: "#000000",
  goalBorder: "#ffd400",
  cars: ["#ff4fd8", "#ffd400", "#00c2ff"],
  truck: "#e8e8e8",
  log: "#b0612a",
  turtle: "#e8231f",
  // Tortuga sumergida: anillo discontinuo (no se confunde con un apoyo).
  submerged: "#e8231f",
  submergedAlpha: 1,
  submergedDash: [4, 4],
  frog: "#5cff5c",
  frogOutline: null,
  eye: "#ffffff",
  glow: 0,
  scanlines: 0,
  vignette: 0,
};

// RETRO: monitor de fósforo verde. Zonas por brillo creciente (carretera,
// río, franjas seguras, seto); apoyos en verde medio y la rana casi blanca
// con un contorno oscuro que la separa de troncos y tortugas.
const RETRO: Palette = {
  road: "#030b05",
  water: "#04190b",
  safe: "#0a2c13",
  hedge: "#0f3d1a",
  goal: "#030b05",
  goalBorder: "#a6ffbc",
  cars: ["#45dc6c", "#a6ffbc", "#2fc85a"],
  truck: "#c6ffd2",
  log: "#2fc85a",
  turtle: "#2fc85a",
  submerged: "#2fc85a",
  submergedAlpha: 1,
  submergedDash: [3, 4],
  frog: "#eaffee",
  frogOutline: "#030b05",
  eye: "#eaffee",
  glow: 0.3,
  scanlines: 0.1,
  vignette: 0.3,
};

export const PALETTES: Record<SkinId, () => Palette> = {
  clasico: () => CLASICO,
  neon: readNeonPalette,
  retro: () => RETRO,
};
