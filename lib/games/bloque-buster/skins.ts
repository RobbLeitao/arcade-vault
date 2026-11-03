import type { SkinId } from "../skins";
import type { Palette } from "./entities";

// Valores de respaldo iguales a los del tema (app/globals.css).
const FALLBACK_THEME = {
  cyan: "#00f5ff",
  yellow: "#f5ff00",
  magenta: "#ff006e",
  green: "#00ff88",
  ink: "#e6e9ff",
};

// NEÓN: el look original de BLOQUE BUSTER (variables CSS del tema con glow).
function readNeonPalette(): Palette {
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
    patterns: null,
    paddle: cyan,
    paddleCaps: null,
    ball: read("--ink", FALLBACK_THEME.ink),
    background: null,
    glow: 1,
    bevel: true,
    scanlines: 0,
    vignette: 0,
  };
}

// CLÁSICO: ladrillos planos de recreativa con biselado, sin glow, fondo negro.
// Magenta pasa a violeta para no confundirse con rojo y rosa.
const CLASICO: Palette = {
  blocks: {
    red: "#ff2a2a",
    yellow: "#ffd400",
    cyan: "#00c2ff",
    magenta: "#b44dff",
    hotpink: "#ff7ac8",
    green: "#2ee62e",
    gray: "#a8a8a8",
  },
  patterns: null,
  paddle: "#c8ccd8",
  paddleCaps: "#ff2a2a",
  ball: "#ffffff",
  background: "#000000",
  glow: 0,
  bevel: true,
  scanlines: 0,
  vignette: 0,
};

// RETRO: monitor de fósforo verde. Los 7 tipos de ladrillo se distinguen por
// brillo (alto, medio, bajo) y patrón (macizo, hueco, rayado): dos tipos que
// son vecinos en algún nivel nunca comparten ambos.
const RETRO: Palette = {
  blocks: {
    red: "#45dc6c",
    yellow: "#e4ff7a",
    cyan: "#b8ffc8",
    magenta: "#a6ffbc",
    hotpink: "#1fb34a",
    green: "#1fb34a",
    gray: "#45dc6c",
  },
  patterns: {
    red: "striped",
    yellow: "solid",
    cyan: "hollow",
    magenta: "striped",
    hotpink: "hollow",
    green: "solid",
    gray: "solid",
  },
  paddle: "#c6ffd2",
  paddleCaps: null,
  ball: "#eaffee",
  background: "#030b05",
  glow: 0.3,
  bevel: false,
  scanlines: 0.1,
  vignette: 0.3,
};

export const PALETTES: Record<SkinId, () => Palette> = {
  clasico: () => CLASICO,
  neon: readNeonPalette,
  retro: () => RETRO,
};
