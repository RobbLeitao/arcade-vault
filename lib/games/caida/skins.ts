import type { SkinId } from "../skins";
import type { Palette } from "./entities";

// Valores de respaldo iguales a los del tema (app/globals.css).
const FALLBACK_THEME = {
  cyan: "#00f5ff",
  yellow: "#f5ff00",
  magenta: "#ff006e",
  green: "#00ff88",
  dim: "#8a8fb5",
};

// NEÓN: el look original de CAÍDA (variables CSS del tema con glow).
function readNeonPalette(): Palette {
  const style = getComputedStyle(document.documentElement);
  const read = (name: string, fallback: string) =>
    style.getPropertyValue(name).trim() || fallback;
  const grid = "rgba(0, 245, 255, 0.08)";
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
    patterns: null,
    grid,
    separator: grid,
    label: read("--ink-dim", FALLBACK_THEME.dim),
    background: null,
    glow: 1,
    highlight: "rgba(255,255,255,0.14)",
    shade: null,
    ghost: "fill",
    ghostAlpha: 0.2,
    ghostColor: null,
    scanlines: 0,
    vignette: 0,
  };
}

// CLÁSICO: piezas planas de recreativa con biselado, sin glow, fondo negro.
// Azul y violeta aclarados para llegar a 3:1 sobre negro; la pieza fantasma
// pasa a contorno del color de la pieza para que se vea sin glow.
const CLASICO: Palette = {
  colors: [
    null,
    "#00e5ff", // I
    "#ffe600", // O
    "#b44dff", // T
    "#2ee62e", // S
    "#ff2a2a", // Z
    "#4d82ff", // J
    "#ff8c1a", // L
    "#a8a8a8", // N (tuerca)
  ],
  patterns: null,
  grid: "rgba(255, 255, 255, 0.06)",
  separator: "#6b7088",
  label: "#d9dce8",
  background: "#000000",
  glow: 0,
  highlight: "rgba(255,255,255,0.28)",
  shade: "rgba(0,0,0,0.25)",
  ghost: "outline",
  ghostAlpha: 0.85,
  ghostColor: null,
  scanlines: 0,
  vignette: 0,
};

// RETRO: monitor de fósforo verde. Cualquier pieza puede tocar a cualquier
// otra, así que las 8 usan una combinación única de brillo (alto, medio, bajo)
// y patrón (macizo, hueco, rayado). La fantasma es un contorno discontinuo
// para no confundirse con las piezas huecas.
const HIGH = "#c6ffd2";
const MID = "#45dc6c";
const LOW = "#1fb34a";
const RETRO: Palette = {
  colors: [null, HIGH, HIGH, MID, LOW, LOW, MID, MID, HIGH],
  patterns: [
    null,
    "hollow", // I: alto hueco
    "solid", // O: alto macizo
    "striped", // T: medio rayado
    "solid", // S: bajo macizo
    "striped", // Z: bajo rayado
    "hollow", // J: medio hueco
    "solid", // L: medio macizo
    "striped", // N: alto rayado
  ],
  grid: "rgba(69, 220, 108, 0.07)",
  separator: LOW,
  label: HIGH,
  background: "#030b05",
  glow: 0.3,
  highlight: null,
  shade: null,
  ghost: "dashed",
  ghostAlpha: 1,
  ghostColor: MID,
  scanlines: 0.1,
  vignette: 0.3,
};

export const PALETTES: Record<SkinId, () => Palette> = {
  clasico: () => CLASICO,
  neon: readNeonPalette,
  retro: () => RETRO,
};
