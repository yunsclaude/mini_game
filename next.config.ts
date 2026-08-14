import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Docker 운영 이미지를 작게 만들기 위한 설정입니다.
  // 빌드하면 .next/standalone 안에 실행에 필요한 파일만 모입니다.
  // Dockerfile 이 이 출력에 의존하므로 지우지 마세요.
  output: "standalone",
};

export default nextConfig;
