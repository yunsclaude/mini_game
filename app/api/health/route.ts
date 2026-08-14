import { NextResponse } from "next/server";

import { project } from "@/lib/project";

/**
 * 배포 서버(EC2, Docker, 로드밸런서)가 앱의 정상 동작을 확인하는 주소입니다.
 *
 * 삭제하거나 응답 형식을 바꾸지 마세요. 배포 자동화가 이 응답에 의존합니다.
 * 환경변수 값, 서버 내부 경로 등 민감한 정보는 절대 응답에 넣지 마세요.
 */
export const dynamic = "force-dynamic";

export function GET() {
  return NextResponse.json({
    status: "ok",
    projectId: project.id,
    projectName: project.name,
    timestamp: new Date().toISOString(),
  });
}
