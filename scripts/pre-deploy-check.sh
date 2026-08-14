#!/usr/bin/env bash
#
# 배포 전 점검 스크립트입니다.
#
#   실행: bash scripts/pre-deploy-check.sh
#
# 이 스크립트는 파일을 읽기만 하며, 아무것도 삭제하거나 변경하지 않습니다.
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(cd "${SCRIPT_DIR}/.." && pwd)"
cd "${PROJECT_ROOT}"

FAILED=0
STEP=0

step() {
  STEP=$((STEP + 1))
  echo ""
  echo "── [${STEP}] $1 ──────────────────────────────"
}

ok() {
  echo "  [통과] $1"
}

fail() {
  echo "  [실패] $1"
  FAILED=1
}

# ---------------------------------------------------------------------------
step "필수 파일이 있는지 확인"
# ---------------------------------------------------------------------------
REQUIRED_FILES=(
  "package.json"
  "package-lock.json"
  "project.json"
  "next.config.ts"
  "tsconfig.json"
  "Dockerfile"
  "compose.yaml"
  ".dockerignore"
  ".gitignore"
  ".env.example"
  "CLAUDE.md"
  "README.md"
  "app/layout.tsx"
  "app/page.tsx"
  "app/globals.css"
  "app/api/health/route.ts"
  "lib/env.ts"
  "lib/project.ts"
  "scripts/validate-project.mjs"
)

MISSING_FILES=0
for file in "${REQUIRED_FILES[@]}"; do
  if [ ! -f "${file}" ]; then
    fail "필수 파일이 없습니다: ${file}"
    MISSING_FILES=1
  fi
done
if [ "${MISSING_FILES}" -eq 0 ]; then
  ok "필수 파일 ${#REQUIRED_FILES[@]}개가 모두 있습니다."
fi

# ---------------------------------------------------------------------------
step "project.json 내용 확인"
# ---------------------------------------------------------------------------
if node scripts/validate-project.mjs; then
  ok "project.json 이 규칙에 맞습니다."
else
  fail "project.json 에 문제가 있습니다. 위에 표시된 내용을 고쳐 주세요."
fi

# ---------------------------------------------------------------------------
step ".env 파일이 Git 에 올라가고 있는지 확인"
# ---------------------------------------------------------------------------
if git rev-parse --is-inside-work-tree >/dev/null 2>&1; then
  TRACKED_ENV="$(git ls-files -- '.env' '.env.*' ':!:.env.example' || true)"
  if [ -n "${TRACKED_ENV}" ]; then
    fail "환경변수 파일이 Git 추적 대상입니다. 비밀값이 GitHub 에 올라갈 수 있습니다:"
    echo "${TRACKED_ENV}" | sed 's/^/         - /'
    echo "         해결 방법: git rm --cached <파일명> 을 실행한 뒤 다시 커밋하세요."
  else
    ok "추적되는 .env 파일이 없습니다."
  fi
else
  echo "  [건너뜀] Git 저장소가 아니라서 확인할 수 없습니다."
fi

# ---------------------------------------------------------------------------
step "소스에 API 키 같은 비밀값이 들어 있는지 확인"
# ---------------------------------------------------------------------------
# 검사 대상에서 제외: 의존성, 빌드 결과, Git 내부 파일
# 이 스크립트 자신은 검사 패턴을 문자열로 갖고 있어 항상 걸리므로 제외합니다.
SECRET_PATTERNS=(
  'AKIA[0-9A-Z]{16}'                                  # AWS 액세스 키 ID
  'ASIA[0-9A-Z]{16}'                                  # AWS 임시 액세스 키 ID
  '-----BEGIN [A-Z ]*PRIVATE KEY-----'                # 인증서 개인키
  'sk-ant-[A-Za-z0-9_-]{20,}'                         # Anthropic API 키
  'sk-[A-Za-z0-9]{32,}'                               # OpenAI 형식 API 키
  'gh[pousr]_[A-Za-z0-9]{30,}'                        # GitHub 토큰
  'xox[baprs]-[A-Za-z0-9-]{10,}'                      # Slack 토큰
  'eyJ[A-Za-z0-9_-]{10,}\.eyJ[A-Za-z0-9_-]{10,}\.'    # JWT 토큰
  '(api[_-]?key|secret|password|passwd|token)[[:space:]]*[:=][[:space:]]*.{12,}' # 하드코딩된 비밀값
)

SECRET_HITS=0
for pattern in "${SECRET_PATTERNS[@]}"; do
  # 패턴이 "-" 로 시작할 수 있으므로 반드시 -e 로 넘깁니다.
  MATCHES="$(grep -rEnI -e "${pattern}" . \
    --exclude-dir=node_modules \
    --exclude-dir=.git \
    --exclude-dir=.next \
    --exclude-dir=out \
    --exclude-dir=dist \
    --exclude-dir=build \
    --exclude-dir=coverage \
    --exclude='pre-deploy-check.sh' \
    --exclude='package-lock.json' \
    || true)"
  if [ -n "${MATCHES}" ]; then
    fail "비밀값으로 의심되는 내용을 찾았습니다 (패턴: ${pattern})"
    echo "${MATCHES}" | head -10 | sed 's/^/         /'
    SECRET_HITS=1
  fi
done
if [ "${SECRET_HITS}" -eq 0 ]; then
  ok "비밀값으로 의심되는 내용을 찾지 못했습니다."
else
  echo "         API 키와 비밀번호는 코드에 적지 말고 환경변수로 주입하세요."
  echo "         이미 커밋했다면 해당 키를 즉시 폐기(revoke)하고 새로 발급받으세요."
fi

# ---------------------------------------------------------------------------
step "ESLint 검사 (npm run lint)"
# ---------------------------------------------------------------------------
if npm run lint; then
  ok "ESLint 검사를 통과했습니다."
else
  fail "ESLint 검사에 실패했습니다. 위 오류 메시지를 확인해 주세요."
fi

# ---------------------------------------------------------------------------
step "TypeScript 타입 검사 (npm run typecheck)"
# ---------------------------------------------------------------------------
if npm run typecheck; then
  ok "타입 검사를 통과했습니다."
else
  fail "타입 오류가 있습니다. 위 오류 메시지의 파일과 줄 번호를 확인해 주세요."
fi

# ---------------------------------------------------------------------------
step "Next.js 빌드 (npm run build)"
# ---------------------------------------------------------------------------
if npm run build; then
  ok "빌드에 성공했습니다."
else
  fail "빌드에 실패했습니다. 위 오류 메시지를 확인해 주세요."
fi

# ---------------------------------------------------------------------------
echo ""
echo "════════════════════════════════════════════════"
if [ "${FAILED}" -eq 0 ]; then
  echo " 배포 전 점검을 모두 통과했습니다."
  echo " 이제 GitHub 에 Push 해도 좋습니다."
  echo "════════════════════════════════════════════════"
  exit 0
else
  echo " 배포 전 점검에서 문제가 발견되었습니다."
  echo " 위에서 [실패] 로 표시된 항목을 고친 뒤 다시 실행해 주세요."
  echo "   bash scripts/pre-deploy-check.sh"
  echo "════════════════════════════════════════════════"
  exit 1
fi
