import { AppHeader } from "@/components/AppHeader";
import { DeployInfo } from "@/components/DeployInfo";
import { GameCard } from "@/components/GameCard";
import { ProjectInfo } from "@/components/ProjectInfo";
import { env } from "@/lib/env";
import { games } from "@/lib/games";
import { project } from "@/lib/project";

// 새로고침할 때마다 서버가 화면을 다시 만들게 합니다.
// 이렇게 해야 아래 "서버 시각" 이 매번 갱신되어 배포 상태를 눈으로 확인할 수 있습니다.
export const dynamic = "force-dynamic";

export default function Home() {
  const serverTime = new Intl.DateTimeFormat("ko-KR", {
    dateStyle: "long",
    timeStyle: "medium",
    timeZone: "Asia/Seoul",
  }).format(new Date());

  return (
    <main className="page">
      <AppHeader
        name={project.name}
        description={project.description}
        status={`실행 중 · ${env.nodeEnv}`}
      />

      <section className="card">
        <h2 className="card-title">게임 고르기</h2>
        <p className="card-hint">
          참가자 명단은 한 번만 입력하면 모든 게임에서 그대로 쓰입니다.
        </p>
        <div className="game-grid">
          {games.map((game) => (
            <GameCard game={game} key={game.slug} />
          ))}
        </div>
      </section>

      <details className="details-card">
        <summary className="details-summary">배포 · 프로젝트 정보</summary>
        <div className="details-body">
          <DeployInfo serverTime={serverTime} nodeEnv={env.nodeEnv} />
          <ProjectInfo project={project} />
        </div>
      </details>

      <footer className="footer">
        <p>
          동작 확인용 주소:{" "}
          <a className="link" href="/api/health">
            /api/health
          </a>
        </p>
      </footer>
    </main>
  );
}
