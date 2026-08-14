import { notFound } from "next/navigation";

import { GameShell } from "@/components/GameShell";
import { WheelGame } from "@/components/games/WheelGame";
import { findGame } from "@/lib/games";

const game = findGame("wheel");

export const metadata = {
  title: game?.name,
  description: game?.description,
};

export default function WheelPage() {
  if (game === undefined) {
    notFound();
  }

  return (
    <GameShell game={game}>
      <WheelGame />
    </GameShell>
  );
}
