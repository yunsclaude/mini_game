# 전사 AI 프로젝트 템플릿 - 운영 배포용 다단계 Dockerfile
# 특별한 이유 없이 수정하지 마세요. 배포 자동화가 이 파일에 의존합니다.

# 1단계: 의존성 설치 (package-lock.json 기준으로 정확히 설치)
FROM node:22-alpine AS deps
WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci

# 2단계: Next.js 빌드 (.next/standalone 출력 생성)
FROM node:22-alpine AS builder
WORKDIR /app
ENV NEXT_TELEMETRY_DISABLED=1
COPY --from=deps /app/node_modules ./node_modules
COPY . .
RUN npm run build

# 3단계: 실행 (빌드 결과물만 담은 가벼운 이미지)
FROM node:22-alpine AS runner
WORKDIR /app

ENV NODE_ENV=production
ENV NEXT_TELEMETRY_DISABLED=1
ENV PORT=3000
# 컨테이너 밖에서 접속하려면 0.0.0.0 으로 열어야 합니다.
ENV HOSTNAME=0.0.0.0

# root 가 아닌 전용 사용자로 실행합니다.
RUN addgroup --system --gid 1001 nodejs \
  && adduser --system --uid 1001 --ingroup nodejs nextjs

# standalone 출력에는 실행에 필요한 최소한의 node_modules 만 들어 있습니다.
COPY --from=builder --chown=nextjs:nodejs /app/.next/standalone ./
COPY --from=builder --chown=nextjs:nodejs /app/.next/static ./.next/static
COPY --from=builder --chown=nextjs:nodejs /app/public ./public

USER nextjs

EXPOSE 3000

# 배포 서버가 확인하는 주소: http://<호스트>:3000/api/health
CMD ["node", "server.js"]
