import Link from "next/link";

import type { Game } from "@/lib/games";

type GameCardProps = {
  game: Game;
};

/** 메인 화면에서 게임 하나를 소개하는 카드입니다. */
export function GameCard({ game }: GameCardProps) {
  return (
    <Link className="game-card" href={`/games/${game.slug}`}>
      <span className="game-icon" aria-hidden="true">
        {game.icon}
      </span>
      <span className="game-body">
        <span className="game-name">{game.name}</span>
        <span className="game-tagline">{game.tagline}</span>
      </span>
      <span className="game-kind">
        {game.resultKind === "pick" ? "한 명 뽑기" : "전원 배정"}
      </span>
    </Link>
  );
}
