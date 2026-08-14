import { notFound } from "next/navigation";

import { GameShell } from "@/components/GameShell";
import { MarbleGame } from "@/components/games/MarbleGame";
import { findGame } from "@/lib/games";

const game = findGame("marble");

export const metadata = {
  title: game?.name,
  description: game?.description,
};

export default function MarblePage() {
  if (game === undefined) {
    notFound();
  }

  return (
    <GameShell game={game}>
      <MarbleGame />
    </GameShell>
  );
}
