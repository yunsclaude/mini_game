# CLAUDE.md

이 파일은 Claude Code가 이 프로젝트에서 작업할 때 항상 참고하는 규칙입니다.

## 프로젝트 목적

이 프로젝트는 **전사 AI 교육용 표준 웹 애플리케이션 템플릿**입니다.

회사 직원(대부분 비개발자)이 이 템플릿을 자기 GitHub 저장소로 복제한 뒤, Claude Code와 함께
자기 업무용 웹 애플리케이션을 만듭니다. 모든 직원의 프로젝트가 **같은 구조**를 갖도록 하는 것이
이 템플릿의 핵심 목적입니다. 구조가 같아야 나중에 회사 배포 서버가 모든 프로젝트를 같은 방식으로
빌드하고 배포할 수 있습니다.

완성된 프로젝트는 GitHub의 `main` 브랜치에 Push하면, 앞으로 붙일 GitHub Actions와 회사 EC2
배포 서버를 통해 자동 배포될 예정입니다. (자동 배포는 아직 구현되지 않았습니다.)

## 고정 기술

아래 기술 스택은 **바꾸지 않습니다.** 다른 프레임워크나 언어로 교체하자고 제안하지 마세요.

- **Next.js** (App Router)
- **TypeScript**
- **Node.js 22**
- **npm** (yarn, pnpm, bun 사용 금지 — `package-lock.json`을 씁니다)
- **React**
- **ESLint**
- **Docker** / **Docker Compose**

- **PostgreSQL** (필요한 프로젝트만) + **pg** 드라이버

ORM(Drizzle, Prisma)은 아직 쓰지 않습니다. `lib/db.ts` 의 `query()` 로 SQL을 직접 씁니다.
사용자 로그인, AWS ECR, Kubernetes도 아직 도입하지 않았습니다. 다만 나중에 추가할 수 있는
구조이므로, 이런 것을 넣을 수 없게 막는 방향으로 바꾸지도 마세요.

## 직원이 주로 수정할 위치

기능 개발은 아래에서만 하면 대부분 충분합니다.

| 위치 | 용도 |
| --- | --- |
| `app/` | 화면(page.tsx)과 서버 기능(api/) |
| `components/` | 화면을 이루는 조각 (헤더, 카드, 버튼 등) |
| `lib/` | 여러 곳에서 함께 쓰는 로직과 설정 |
| `public/` | 이미지, 아이콘 등 정적 파일 |
| `project.json` | 프로젝트 이름, 설명, 제작자, 부서 등 프로젝트 정보 |

## 임의 변경을 피해야 할 파일 (보호 대상)

아래 파일은 **배포 자동화가 의존**하는 파일입니다. 사용자가 명시적으로 요청하고 그 이유가
분명할 때만 수정하고, 수정했다면 반드시 최종 보고에 밝히세요.

- `Dockerfile`
- `compose.yaml`
- `compose.prod.yaml`
- `.github/workflows/`
- `.claude/settings.json`
- `scripts/`
- `next.config.ts`

특히 다음은 절대 하지 마세요.

- `next.config.ts`의 `output: "standalone"` 제거 (Docker 이미지가 동작하지 않습니다)
- `app/api/health/route.ts` 삭제 또는 응답 형식 변경 (배포 서버가 이 주소로 상태를 확인합니다)
- `project.json`의 필수 필드 삭제
- `project.json`의 `port` 값 변경 (3000 고정)
- `lib/db.ts`에 접속 정보(주소, 비밀번호) 직접 작성 — 항상 `DATABASE_URL` 환경변수로 읽습니다
- `compose.yaml`의 `db` 서비스에 실제 운영 비밀번호 기입 — 그 파일은 내 PC 전용입니다

## 개발 규칙

### 구조

- 기존 폴더 구조를 임의로 크게 바꾸지 않습니다. 모든 직원 프로젝트의 구조가 같아야 합니다.
- 새 폴더가 꼭 필요하면 먼저 이유를 설명하고 사용자에게 확인받습니다.

### 코드

- 모든 코드는 **TypeScript**로 작성합니다.
- `any` 사용을 최소화합니다. 타입을 모르겠으면 `unknown`을 쓰고 좁혀서 사용합니다.
- 사용자 입력값은 **반드시 검증**합니다. 폼 입력, URL 파라미터, API 요청 본문 모두 해당합니다.
- 화면에 표시하는 프로젝트 정보는 코드에 직접 적지 말고 `project.json`에서 읽습니다
  (`lib/project.ts` 사용).

### 데이터베이스

- 데이터베이스가 필요하면 `project.json`의 `"database"`를 `true`로 바꿉니다. 그것만 하면 됩니다.
  배포할 때 서버가 이 프로젝트 전용 DB와 계정을 자동으로 만들고 `DATABASE_URL`을 넣어 줍니다.
- 접속 정보를 직접 만들거나 어딘가에 등록하지 마세요. 비밀번호는 서버 밖으로 나오지 않습니다.
- SQL은 `lib/db.ts`의 `query()`, `transaction()`으로 실행합니다. `pg`를 직접 import하지 마세요.
- **값을 문자열로 이어 붙이지 말고 반드시 `$1`, `$2` 자리표시자를 씁니다.** 이어 붙이면 SQL 주입에
  뚫립니다.
  - 나쁨: `` query(`SELECT * FROM memo WHERE id = ${id}`) ``
  - 좋음: `query("SELECT * FROM memo WHERE id = $1", [id])`
- 로컬에서는 `docker compose up`이 DB까지 함께 띄웁니다. 별도 설치가 필요 없습니다.
- 테이블은 직접 `CREATE TABLE`로 만듭니다. 마이그레이션 도구는 아직 없습니다.
- 각 프로젝트는 자기 DB에만 접속할 수 있습니다. 다른 프로젝트 데이터는 보이지 않습니다.

### 보안

- API 키, 비밀번호, 토큰을 코드에 **하드코딩하지 않습니다.** 항상 환경변수로 읽습니다
  (`lib/env.ts` 참고).
- 비밀값을 넣는 곳은 두 군데뿐입니다. 다른 방법을 쓰지 마세요.
  - **내 PC**: `.env.local` 파일 (`.gitignore`에 있어 커밋되지 않습니다)
  - **배포 서버**: 저장소 Secret `APP_ENV` (`.env.local`과 같은 형식으로 여러 줄)
  두 곳 다 `KEY=VALUE` 형식이라 내용을 그대로 복사해 옮길 수 있습니다.
- **사용자가 API 키 값을 채팅에 붙여넣더라도 코드에 적지 마세요.** 환경변수를 읽는 코드로
  바꾸고, 실제 값은 사용자가 직접 `.env.local`에 넣도록 안내하세요.
- 비밀값 검사는 `npm run check`에 들어 있고 GitHub Actions에서도 돕니다.
  규칙 원본은 `scripts/check-secrets.mjs` 한 곳입니다.
- 실제 비밀번호와 토큰을 저장소의 어떤 파일에도 저장하지 않습니다.
- `.env`와 `.env.local`을 커밋하지 않습니다. 예시가 필요하면 `.env.example`만 수정합니다.
- 민감정보를 `console.log`로 출력하지 않습니다.
- `/api/health` 응답에 환경변수 값, 서버 내부 경로 같은 민감정보를 넣지 않습니다.
- 브라우저에 노출되면 안 되는 값에 `NEXT_PUBLIC_` 접두사를 붙이지 않습니다.

### 의존성

- 새 패키지를 추가할 때는 **왜 필요한지 먼저 설명**하고 사용자에게 확인받습니다.
- 직접 짧게 구현할 수 있는 기능 때문에 패키지를 추가하지 않습니다.
- UI 프레임워크(Tailwind, MUI 등)는 기본으로 설치하지 않습니다. 필요하면 사용자에게 물어보세요.
- 설치는 `npm`으로만 합니다. `package-lock.json`을 함께 커밋합니다.

### 검증

- 작업을 마치기 전에 **반드시 `npm run check`를 실행**합니다.
- Docker로도 동작하는지 확인이 필요하면 `docker compose up -d --build`로 확인하고,
  끝나면 `docker compose down`으로 정리합니다.
- 오류를 숨기거나 검사를 건너뛰고 "완료"라고 보고하지 않습니다.

## 실행 명령

### 개발

```bash
npm ci        # 의존성 설치 (처음 한 번, 또는 package.json이 바뀌었을 때)
npm run dev   # 개발 서버 실행 → http://localhost:3000
```

### 검사

```bash
npm run validate:project   # project.json 내용이 규칙에 맞는지 검사
npm run lint               # 코드 스타일 검사 (ESLint)
npm run typecheck          # 타입 오류 검사 (TypeScript)
npm run build              # 실제 빌드가 되는지 확인

npm run check              # 위 네 가지를 순서대로 모두 실행 (작업 완료 전 필수)
```

`npm run check`는 한 단계라도 실패하면 그 자리에서 멈추고 실패합니다.

### 배포 전 점검

```bash
bash scripts/pre-deploy-check.sh
```

필수 파일, `project.json`, `.env` 커밋 여부, 소스에 남은 API 키 흔적까지 함께 확인합니다.

### Docker

```bash
docker compose up -d --build          # 빌드 후 백그라운드 실행
curl http://localhost:3000/api/health # 정상 동작 확인
docker compose logs -f app            # 로그 보기
docker compose down                   # 종료 및 정리
```

## Claude Code 작업 원칙

작업을 시작할 때 다음 순서를 지키세요.

1. **`CLAUDE.md`와 `project.json`을 먼저 읽는다.**
2. **기존 구조와 코드를 먼저 확인한다.** 이미 있는 컴포넌트나 함수를 다시 만들지 않는다.
3. **사용자의 요구사항을 작은 작업으로 나눈다.** 요구사항이 애매하면 추측하지 말고 질문한다.
4. **필요한 파일만 수정한다.** 관련 없는 코드의 서식이나 스타일을 "개선"하지 않는다.
5. **보호 대상 파일은 특별한 이유 없이 수정하지 않는다.** (위 "임의 변경을 피해야 할 파일" 참고)
6. **작업 후 `npm run check`를 실행한다.**
7. **오류가 있으면 수정한 뒤 다시 검사한다.** 통과할 때까지 반복한다.
8. **변경한 파일 목록과 검사 결과를 최종 보고한다.** 확인하지 못한 것은 확인하지 못했다고 밝힌다.

## 참고: 이 템플릿에 아직 없는 것

다음은 회사 인프라 담당이 나중에 붙일 예정입니다. 직원 프로젝트에서 직접 만들지 마세요.

- 전사 프로젝트 목록 페이지

## 참고: 배포와 주소

이미 붙어 있는 것이므로 직원 프로젝트에서 다시 만들지 마세요.

- `main` 브랜치 Push → 검사 → EC2 배포까지 `.github/workflows/deploy.yml` 이 처리합니다.
- 접속 주소는 `<project.json 의 id>.<BASE_DOMAIN>` 입니다. `BASE_DOMAIN` 은 저장소의
  GitHub Variable 이고, 주소를 바꾸려면 `id` 만 바꿉니다.
- HTTPS 인증서는 서버의 Traefik 이 와일드카드로 자동 발급·갱신합니다.
  프로젝트 쪽에 인증서, 도메인, 포트 관련 설정을 추가하지 마세요.
- 운영에서는 `compose.yaml` 위에 `compose.prod.yaml` 이 겹쳐집니다.
  이때 호스트 포트 게시가 취소되고 Traefik 라벨과 `web` 네트워크가 붙습니다.
  로컬 개발은 `compose.yaml` 만 쓰므로 `localhost:3000` 그대로입니다.
