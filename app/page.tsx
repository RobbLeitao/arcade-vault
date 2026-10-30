import type { Metadata } from "next";
import HomePage from "@/components/home/home-page";
import { getGames } from "@/lib/games-data";

export const metadata: Metadata = {
  title: "Arcade Vault — El arcade clásico está de vuelta",
  description:
    "Juega los mejores clásicos en tu navegador, sin descargas y sin costo, y compite por el puntaje más alto.",
};

export default async function Home() {
  const games = await getGames();
  return <HomePage games={games.ok ? games.data : null} />;
}
