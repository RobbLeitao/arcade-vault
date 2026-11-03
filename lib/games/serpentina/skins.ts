import type { SkinId } from "../skins";
import type { Palette } from "./entities";

// Valores de respaldo iguales a los del tema (app/globals.css).
const NEON_FALLBACK: Palette = {
  snake: "#00ff88",
  head: "#7dffc0",
  eyeWhite: "#ffffff",
  pupil: "#06130a",
  grid: "rgba(232, 236, 255, 0.05)",
  fallback: "#ff006e",
  background: null,
  glow: 1,
  fruitHalo: { rgb: "255, 255, 255", alpha: 0.16 },
  fruitTint: null,
  fruitOutline: null,
  scanlines: 0,
  vignette: 0,
};

// NEÓN: el look original de SERPENTINA (variables CSS del tema con glow).
function readNeonPalette(): Palette {
  const style = getComputedStyle(document.documentElement);
  const read = (name: string, fallback: string) =>
    style.getPropertyValue(name).trim() || fallback;
  return {
    ...NEON_FALLBACK,
    snake: read("--green", NEON_FALLBACK.snake),
    fallback: read("--magenta", NEON_FALLBACK.fallback),
  };
}

// CLÁSICO: serpiente plana de recreativa, sin glow ni halo, fondo negro. Las
// frutas conservan sus colores del atlas y llevan un contorno claro plano para
// que las más oscuras (la morada) se lean sobre el negro.
const CLASICO: Palette = {
  snake: "#1ec31e",
  head: "#c8ff3c",
  eyeWhite: "#ffffff",
  pupil: "#000000",
  grid: "rgba(255, 255, 255, 0.06)",
  fallback: "#ff2a2a",
  background: "#000000",
  glow: 0,
  fruitHalo: null,
  fruitTint: null,
  fruitOutline: "#d9dce8",
  scanlines: 0,
  vignette: 0,
};

// RETRO: monitor de fósforo verde. Cuerpo en verde medio, cabeza casi blanca;
// las frutas se tintan en una rampa verde según su brillo (siguen reconocibles
// por silueta y sombreado) y llevan un halo mínimo de fósforo.
const RETRO: Palette = {
  snake: "#1fb34a",
  head: "#c6ffd2",
  eyeWhite: "#eaffee",
  pupil: "#030b05",
  grid: "rgba(125, 255, 156, 0.06)",
  fallback: "#eaffee",
  background: "#030b05",
  glow: 0.25,
  fruitHalo: { rgb: "125, 255, 156", alpha: 0.1 },
  fruitTint: { dark: [31, 140, 62], light: [240, 255, 242] },
  fruitOutline: null,
  scanlines: 0.1,
  vignette: 0.3,
};

export const PALETTES: Record<SkinId, () => Palette> = {
  clasico: () => CLASICO,
  neon: readNeonPalette,
  retro: () => RETRO,
};
