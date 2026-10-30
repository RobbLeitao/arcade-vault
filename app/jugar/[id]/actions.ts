"use server";

import { updateTag } from "next/cache";
import { createClient } from "@/lib/supabase/server";

export type SubmitScoreResult =
  { ok: true } | { ok: false; error: "AUTH" | "INVALID" | "FAILED" };

// Máximo de una columna `integer` de Postgres.
const MAX_INT = 2147483647;

// Guarda la puntuación de la sesión actual. Las reglas de fondo (juego jugable,
// tope por juego, user_id propio) las impone la RLS de `scores`.
export async function submitScore(
  gameId: string,
  score: number,
): Promise<SubmitScoreResult> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { ok: false, error: "AUTH" };

  if (
    typeof gameId !== "string" ||
    gameId.length === 0 ||
    !Number.isSafeInteger(score) ||
    score < 0 ||
    score > MAX_INT
  ) {
    return { ok: false, error: "INVALID" };
  }

  const { error } = await supabase
    .from("scores")
    .insert({ game_id: gameId, user_id: user.id, score });
  if (error) return { ok: false, error: "FAILED" };

  // El ranking y las estadísticas se muestran ya con la nueva marca.
  updateTag("scores");
  return { ok: true };
}
