import { notFound } from "next/navigation";

import { GameShell } from "@/components/GameShell";
import { DrawGame } from "@/components/games/DrawGame";
import { findGame } from "@/lib/games";

const game = findGame("draw");

export const metadata = {
  title: game?.name,
  description: game?.description,
};

export default function DrawPage() {
  if (game === undefined) {
    notFound();
  }

  return (
    <GameShell game={game}>
      <DrawGame />
    </GameShell>
  );
}
