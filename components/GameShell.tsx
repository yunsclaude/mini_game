import Link from "next/link";
import type { ReactNode } from "react";

import type { Game } from "@/lib/games";

type GameShellProps = {
  game: Game;
  children: ReactNode;
};

/**
 * 게임 화면의 공통 틀입니다. 제목, 목록으로 돌아가는 링크, 공정성 안내를 담습니다.
 * 게임마다 이 부분을 다시 만들지 않도록 여기서 한 번만 정의합니다.
 */
export function GameShell({ game, children }: GameShellProps) {
  return (
    <main className="page">
      <Link className="back-link" href="/">
        ← 미니게임 목록
      </Link>

      <header className="header">
        <h1 className="header-title">
          <span aria-hidden="true">{game.icon}</span> {game.name}
        </h1>
        <p className="header-description">{game.description}</p>
      </header>

      {children}

      <p className="fairness-note">
        결과는 게임을 시작하는 순간 정해집니다. 화면의 움직임은 그 결과를 보여 주는 연출이며,
        모든 게임이 같은 방식으로 고르게 뽑습니다.
      </p>
    </main>
  );
}
