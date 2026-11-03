import type { SkinId } from "../skins";
import type { Palette } from "./entities";

// Valores de respaldo iguales a los del tema (app/globals.css).
const NEON_FALLBACK: Palette = {
  ship: "#00f5ff",
  rock: "#f5ff00",
  bullet: "#e6e9ff",
  powerUp: "#ff006e",
  spark: "#f5ff00",
  flame: "rgba(255, 130, 0, 0.85)",
  background: null,
  glow: 1,
  scanlines: 0,
  vignette: 0,
};

// NEÓN: el look original de ROCAS (variables CSS del tema con glow).
function readNeonPalette(): Palette {
  const style = getComputedStyle(document.documentElement);
  const read = (name: string, fallback: string) =>
    style.getPropertyValue(name).trim() || fallback;
  return {
    ...NEON_FALLBACK,
    ship: read("--cyan", NEON_FALLBACK.ship),
    rock: read("--yellow", NEON_FALLBACK.rock),
    bullet: read("--ink", NEON_FALLBACK.bullet),
    powerUp: read("--magenta", NEON_FALLBACK.powerUp),
    spark: read("--yellow", NEON_FALLBACK.spark),
  };
}

// CLÁSICO: vectores planos de recreativa, sin glow, fondo negro.
const CLASICO: Palette = {
  ship: "#ffffff",
  rock: "#4da6ff",
  bullet: "#ffff00",
  powerUp: "#ff3b3b",
  spark: "#ffd000",
  flame: "#ff7a00",
  background: "#000000",
  glow: 0,
  scanlines: 0,
  vignette: 0,
};

// RETRO: monitor de fósforo verde. Rocas en verde medio; nave, balas y
// power-up en los tonos más brillantes para distinguirlos por luminancia.
const RETRO: Palette = {
  ship: "#c6ffd2",
  rock: "#1fb34a",
  bullet: "#eaffee",
  powerUp: "#e4ff7a",
  spark: "#7dff9c",
  flame: "#7dff9c",
  background: "#030b05",
  glow: 0.3,
  scanlines: 0.1,
  vignette: 0.3,
};

export const PALETTES: Record<SkinId, () => Palette> = {
  clasico: () => CLASICO,
  neon: readNeonPalette,
  retro: () => RETRO,
};
