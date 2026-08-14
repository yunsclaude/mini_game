import { AppHeader } from "@/components/AppHeader";
import { DeployInfo } from "@/components/DeployInfo";
import { LunchPicker } from "@/components/LunchPicker";
import { ProjectInfo } from "@/components/ProjectInfo";
import { env } from "@/lib/env";
import { project } from "@/lib/project";

// 새로고침할 때마다 서버가 화면을 다시 만들게 합니다.
// 이렇게 해야 아래 "서버 시각" 이 매번 갱신되어 배포 상태를 눈으로 확인할 수 있습니다.
export const dynamic = "force-dynamic";

const menus: string[] = [
  "김치찌개",
  "된장찌개",
  "제육볶음",
  "돈가스",
  "비빔밥",
  "칼국수",
  "냉면",
  "짜장면",
  "짬뽕",
  "초밥",
  "라멘",
  "쌀국수",
  "샐러드",
  "햄버거",
  "카레",
];

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

      <LunchPicker menus={menus} />

      <section className="card">
        <h2 className="card-title">후보 메뉴 {menus.length}개</h2>
        <p className="card-hint">
          메뉴를 바꾸려면 <code>app/page.tsx</code> 의 <code>menus</code> 목록을 고치세요.
        </p>
        <ul className="menu-chips">
          {menus.map((menu) => (
            <li className="menu-chip" key={menu}>
              {menu}
            </li>
          ))}
        </ul>
      </section>

      <DeployInfo serverTime={serverTime} nodeEnv={env.nodeEnv} />

      <ProjectInfo project={project} />

      <footer className="footer">
        <p>
          동작 확인용 주소:{" "}
          <a className="link" href="/api/health">
            /api/health
          </a>
        </p>
        <p>
          작업을 끝내기 전에 터미널에서 <code>npm run check</code> 를 실행하세요.
        </p>
      </footer>
    </main>
  );
}
