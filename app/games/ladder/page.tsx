import { notFound } from "next/navigation";

import { GameShell } from "@/components/GameShell";
import { LadderGame } from "@/components/games/LadderGame";
import { findGame } from "@/lib/games";

const game = findGame("ladder");

export const metadata = {
  title: game?.name,
  description: game?.description,
};

export default function LadderPage() {
  if (game === undefined) {
    notFound();
  }

  return (
    <GameShell game={game}>
      <LadderGame />
    </GameShell>
  );
}
