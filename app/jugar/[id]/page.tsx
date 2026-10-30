import { notFound } from "next/navigation";
import GamePlayer from "@/components/game-player";
import { getGame, getGames } from "@/lib/games-data";

export async function generateStaticParams() {
  const games = await getGames();
  // Sin catálogo no hay nada que prerenderizar: que el build falle a la vista.
  if (!games.ok) throw new Error("No se pudo leer el catálogo de juegos.");
  return games.data.map((g) => ({ id: g.id }));
}

export default async function PlayPage({ params }: PageProps<"/jugar/[id]">) {
  const { id } = await params;
  const loaded = await getGame(id);
  if (!loaded.ok) {
    return (
      <div
        role="alert"
        className="fade-in"
        style={{ textAlign: "center", padding: 80, color: "var(--ink-faint)" }}
      >
        <div
          className="pixel"
          style={{ fontSize: 14, color: "var(--magenta)" }}
        >
          NO PUDIMOS CARGAR LOS JUEGOS.
        </div>
      </div>
    );
  }
  if (!loaded.data) notFound();

  return <GamePlayer game={loaded.data} />;
}
