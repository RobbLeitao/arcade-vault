import HallOfFame from "@/components/hall-of-fame";
import { getGames, getTopScores } from "@/lib/games-data";

export default async function HallOfFamePage() {
  const [games, scores] = await Promise.all([getGames(), getTopScores()]);
  return (
    <HallOfFame
      games={games.ok ? games.data : null}
      scores={scores.ok ? scores.data : null}
    />
  );
}
