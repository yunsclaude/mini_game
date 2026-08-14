import { notFound } from "next/navigation";

import { GameShell } from "@/components/GameShell";
import { ShuffleGame } from "@/components/games/ShuffleGame";
import { findGame } from "@/lib/games";

const game = findGame("shuffle");

export const metadata = {
  title: game?.name,
  description: game?.description,
};

export default function ShufflePage() {
  if (game === undefined) {
    notFound();
  }

  return (
    <GameShell game={game}>
      <ShuffleGame />
    </GameShell>
  );
}
