// Skins de los motores (sin dependencias de framework).
// Cada juego con `skins: true` en el registro define sus paletas en
// `lib/games/<carpeta>/skins.ts` como `Record<SkinId, …>`.

export type SkinId = "clasico" | "neon" | "retro";

export const SKIN_IDS: readonly SkinId[] = ["clasico", "neon", "retro"];

export const DEFAULT_SKIN: SkinId = "clasico";

export const SKIN_LABELS: Record<SkinId, string> = {
  clasico: "CLÁSICO",
  neon: "NEÓN",
  retro: "RETRO",
};

export function isSkinId(value: unknown): value is SkinId {
  return (
    typeof value === "string" && (SKIN_IDS as readonly string[]).includes(value)
  );
}

const storageKey = (gameId: string) => `av:skin:${gameId}`;

// Skin guardado del juego; ausente, inválido o sin localStorage ⇒ DEFAULT_SKIN.
export function loadSkin(gameId: string): SkinId {
  try {
    const value = localStorage.getItem(storageKey(gameId));
    return isSkinId(value) ? value : DEFAULT_SKIN;
  } catch {
    return DEFAULT_SKIN;
  }
}

export function saveSkin(gameId: string, skin: SkinId) {
  try {
    localStorage.setItem(storageKey(gameId), skin);
  } catch {
    // Sin almacenamiento (modo privado, cuota): el skin vale solo esta sesión.
  }
}
