import Library from "@/components/library";
import { getGames } from "@/lib/games-data";

export default async function BibliotecaPage() {
  const games = await getGames();
  return <Library games={games.ok ? games.data : null} />;
}
