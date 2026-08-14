# 작업 정리 · Traefik 리버스 프록시 + 와일드카드 HTTPS 도입

- 작업일: 2026-08-12
- 서버: EC2 (3.37.97.196, Elastic IP)
- 베이스 도메인: `yuns-portfolio.com`
- 목적: 한 대의 EC2에서 여러 직원 프로젝트를 **포트 충돌 없이** 돌리고,
  각각 `https://<project.json의 id>.<BASE_DOMAIN>` 으로 접속되게 만들기

---

## 1. 무엇이 달라졌나

### 이전

```
인터넷 ──▶ EC2:3000 ──▶ 프로젝트 컨테이너 1개
```

- 프로젝트를 하나밖에 못 띄움 (3000번 포트를 서로 뺏음)
- HTTPS 없음, 주소는 `IP:3000`
- 보안 그룹에서 3000번을 열어둬야 했음

### 이후

```
인터넷 ──▶ EC2:80/443 ──▶ Traefik ──┬──▶ lunch-roulette   (호스트 포트 없음)
                                    ├──▶ 다른-프로젝트    (호스트 포트 없음)
                                    └──▶ ...
```

- 프로젝트를 몇 개든 띄울 수 있음. 호스트 포트를 아예 안 씀
- 전부 HTTPS. 인증서는 Traefik이 자동 발급·자동 갱신
- 외부에 열리는 포트는 **80, 443 두 개뿐**

---

## 2. 만든 것 · 서버 전용 (`/srv/company-ai/traefik/`)

직원 저장소와 **완전히 분리**된 폴더입니다. 이 안의 파일은 GitHub에 올라가지 않습니다.

| 파일 | 내용 |
| --- | --- |
| `compose.yaml` | Traefik v3.3 서비스 정의. 80/443 게시, Docker 소켓 읽기전용 마운트 |
| `.env` | 실제 설정값 (권한 600, git 금지) |
| `.env.example` | 다른 서버에 다시 세팅할 때 쓰는 빈 양식 |
| `dynamic/tls.yml.template` | 기본 인증서 설정 양식 |
| `dynamic/tls.yml` | 위 양식에 도메인을 채워 생성된 실제 파일 |
| `iam-policy.json` | Route 53 권한 정책 (호스팅 영역 하나로 범위 제한) |
| `bootstrap.sh` | 최초 세팅 스크립트. 몇 번을 다시 돌려도 안전 |
| `README.md` | IAM 역할 만들기부터 문제 해결까지 전체 안내서 |
| `letsencrypt/acme.json` | 발급받은 인증서 저장소 (권한 600) |

### 핵심 설정 요약

```
--providers.docker.exposedbydefault=false     # 라벨 붙인 컨테이너만 외부 공개
--providers.docker.network=web
--entrypoints.web.http.redirections...        # 80으로 오면 443으로 영구 리다이렉트
--certificatesresolvers.le.acme.dnschallenge.provider=route53
--certificatesresolvers.le.acme.dnschallenge.resolvers=1.1.1.1:53,8.8.8.8:53
--ping=true                                   # 헬스체크용
```

`exposedbydefault=false`가 중요합니다. `true`면 실수로 띄운 컨테이너까지 인터넷에 공개됩니다.

### 인증서 방식

- **DNS-01 챌린지** + Route 53. 서버로 들어오는 트래픽 없이 DNS 레코드만으로 인증
- 덕분에 **와일드카드 인증서** 발급 가능: `*.yuns-portfolio.com` + `yuns-portfolio.com`
- 프로젝트가 새로 늘어나도 인증서를 다시 받을 필요가 없음
- 자격증명은 **EC2 인스턴스 IAM 역할**에서 자동으로 옴. 액세스 키를 어디에도 안 적음

---

## 3. 만든 것 · 템플릿 (`projects/template-one/`)

### 새 파일 — `compose.prod.yaml`

운영에서만 `compose.yaml` 위에 덮어씌우는 파일입니다.

```yaml
services:
  app:
    ports: !reset []          # 호스트 포트 게시 취소
    labels:
      - "traefik.enable=true"
      - "traefik.http.routers.${PROJECT_ID}.rule=Host(`${PROJECT_ID}.${BASE_DOMAIN}`)"
      - "traefik.http.routers.${PROJECT_ID}.entrypoints=websecure"
      - "traefik.http.routers.${PROJECT_ID}.tls=true"
      - "traefik.http.services.${PROJECT_ID}.loadbalancer.server.port=3000"
    networks: [web]
networks:
  web:
    external: true
```

> **원래 계획과 다르게 간 부분입니다.** 처음 계획은 `compose.yaml`에서 `ports`를 지우는
> 것이었는데, 그러면 직원들이 로컬에서 `docker compose up` 했을 때 `localhost:3000`이
> 안 열립니다. 그래서 `compose.yaml`은 손대지 않고 운영 전용 덮어쓰기 파일을 따로 뒀습니다.
> 로컬 개발 경험은 그대로입니다.

### 수정 — `.github/workflows/deploy.yml`

1. `BASE_DOMAIN`을 **Variable**로 읽도록 문서화 (Secret 아님)
2. 새 단계 **"접속 주소 결정 및 project.json 갱신"**
   - `BASE_DOMAIN`이 비었거나 예시 도메인이면 중단
   - `project.json`의 `id` 형식 검증 (`^[a-z0-9][a-z0-9-]*$`)
   - `project.json`의 `domain` 값을 실제 주소로 **덮어씀** → 화면 표시가 실제와 어긋나지 않음
   - 이 작업은 **GitHub 러너에서** 함. EC2에는 node가 없음
3. 실행 단계: `docker compose -f compose.yaml -f compose.prod.yaml` 사용,
   `web` 네트워크 존재 여부 확인 후 없으면 bootstrap 안내와 함께 실패
4. Health Check를 **2단계**로 교체
   - ① 컨테이너 안에서 `127.0.0.1:3000/api/health`
   - ② 밖에서 `https://<주소>/api/health` + 인증서 발급자·유효기간 로그 출력
   - 실패하면 로그 200줄 자동 출력

### 수정 — `components/ProjectInfo.tsx`

`"도메인(예정)"` → `"도메인"` (한 줄)

### 수정 — `README.md`, `CLAUDE.md`

- "자동 배포 없음" → "값 등록하면 동작"
- Secret 3개 + **Variable 1개(`BASE_DOMAIN`)** 안내 추가
- 접속 주소를 `https://<프로젝트 ID>.<BASE_DOMAIN>` 으로 설명
- "3000번 포트를 열어야 합니다", "프로젝트 한 개만 실행 가능" 문구 삭제
- `CLAUDE.md` 보호 대상 목록에 `compose.prod.yaml` 추가
- `CLAUDE.md`에 "참고: 배포와 주소" 절 신설

### 손대지 않은 파일

`compose.yaml`, `Dockerfile`, `next.config.ts`, `project.json`, `scripts/`

---

## 4. 검증 결과

| 항목 | 결과 |
| --- | --- |
| `npm run check` (validate/lint/typecheck/build) | 전부 통과 (node:22-alpine 컨테이너에서 실행) |
| `docker compose -f compose.yaml -f compose.prod.yaml config` | `ports` 사라짐, 라벨 치환 정상 |
| 스테이징 인증서 발급 | 성공 (`(STAGING) Dastardly Durum YR1`) |
| 운영 인증서 발급 | 성공 |
| 인증서 발급자 | `C=US, O=Let's Encrypt, CN=YR2` |
| 인증서 대상 | `*.yuns-portfolio.com`, `yuns-portfolio.com` |
| 유효기간 | 2026-08-12 ~ 2026-11-10 |
| TLS 검증 | `Verify return code: 0 (ok)` |
| `/api/health` | `200 OK` `{"status":"ok","projectId":"lunch-roulette",...}` |
| 80번 포트 | `301` → HTTPS 리다이렉트 |
| 앱 컨테이너 포트 | `3000/tcp` (미게시). `web` 네트워크에만 연결 |
| 컨테이너 상태 | traefik, app 둘 다 `healthy` |

### 기존 서비스 영향 확인

Route 53 영역을 확인해 보니 `*.yuns-portfolio.com` 과 apex가 **이미 이 서버(3.37.97.196)를
가리키고** 있었습니다. DNS 작업이 따로 필요 없었습니다.

다른 서브도메인들은 **명시적 A 레코드**가 있어 와일드카드보다 우선합니다. 영향 없습니다.

- `n8n`, `su`, `hch`, `ajin117`, `bori0211`, `10h_g11` → 98.82.126.177
- `soomwith` → 13.125.231.193
- `web` → 별도 호스팅 영역으로 위임됨

---

## 5. 작업 중 막혔던 것과 해결

| 문제 | 원인 | 해결 |
| --- | --- | --- |
| Traefik 컨테이너가 계속 `unhealthy` | 헬스체크가 `--ping` 엔드포인트를 쓰는데 그 옵션을 안 켬 | `--ping=true` 추가 |
| 첫 라우팅 테스트 404 | 설정 오류 아님. Traefik 설정 리로드(08:10:45)보다 요청(08:10:38)이 빨랐음 | 재시도 → 200 |
| 컨테이너에서 `Cannot find module './project.json'` | 임시 폴더가 root 소유인데 이미지는 uid 1001로 실행 | 권한 조정 후 정상. 로직 문제 아님 |
| EC2에 node/npm 없음 | 호스트에 런타임 미설치 | `node:22-alpine` 컨테이너로 검사 실행. `project.json` 갱신은 러너에서 하도록 설계 |
| IAM 역할을 붙였는데 컨테이너가 자격증명을 못 읽음 | IMDSv2 홉 제한 기본값 1 | **홉 제한 2로 변경** (이거 놓치면 조용히 실패합니다) |

---

## 6. 아직 남은 일 (사용자가 직접)

### ① 템플릿 파일 5개를 GitHub 저장소에 반영 — **가장 중요**

이 서버의 `projects/template-one/` 은 **rsync 대상**이라 git 저장소가 아닙니다.
반영하지 않으면 **다음 배포 때 여기서 한 수정이 전부 지워집니다.**

- `compose.prod.yaml` (신규)
- `.github/workflows/deploy.yml`
- `components/ProjectInfo.tsx`
- `README.md`
- `CLAUDE.md`

묶어둔 파일: `/tmp/traefik-template-changes.tar.gz` (15K)

```bash
# 내 PC의 저장소 폴더에서
scp -i ~/.ssh/<키> ec2-user@3.37.97.196:/tmp/traefik-template-changes.tar.gz .
tar xzf traefik-template-changes.tar.gz && rm traefik-template-changes.tar.gz
git status && git diff        # 먼저 확인
git add compose.prod.yaml .github/workflows/deploy.yml components/ProjectInfo.tsx README.md CLAUDE.md
git commit -m "Traefik 리버스 프록시 연동 및 HTTPS 도메인 배포"
git push origin main
```

### ② GitHub 저장소 Variable 등록

Settings → Secrets and variables → Actions → **Variables** 탭

| 이름 | 값 |
| --- | --- |
| `BASE_DOMAIN` | `yuns-portfolio.com` |

**Secret이 아니라 Variable입니다.** ①보다 먼저 해야 합니다. 안 하면 Push 직후 배포가 실패합니다.

### ③ EC2 보안 그룹에서 3000번 포트 규칙 삭제

80, 443만 남기면 됩니다. 이제 3000번은 외부에서 쓰지 않습니다.

### 권장 순서

```
② Variable 등록  →  ① Push  →  Actions 초록불 확인  →  ③ 보안 그룹 정리
```

---

## 7. 알아둘 것

- 지금 도는 이미지는 아직 `lunch-roulette.ai.example.com` 을 화면에 표시합니다.
  실제 배포가 한 번 돌면서 다시 빌드되면 진짜 주소로 바뀝니다.
- apex(`yuns-portfolio.com`)는 이제 Traefik이 받아서 404를 냅니다.
  (전에는 연결 거부였습니다.) 필요하면 나중에 안내 페이지를 붙일 수 있습니다.
- `node_modules` + `.next` 가 668MB 남아 있습니다. 지워도 됩니다.
  ```bash
  sudo rm -rf /srv/company-ai/projects/template-one/node_modules \
              /srv/company-ai/projects/template-one/.next
  ```
- Docker 소켓을 읽기 전용으로 마운트했지만, 사실상 호스트 root 권한과 같습니다.
  더 조이려면 `docker-socket-proxy` 를 한 겹 두는 방법이 있습니다. (traefik/README.md 참고)
- 인증서 CA를 바꿀 때(스테이징 ↔ 운영)는 `letsencrypt/acme.json` 을 **비우고** 재시작해야 합니다.
  비우지 않으면 기존 인증서를 그대로 씁니다.

---

## 8. 새 프로젝트를 추가할 때

인프라 쪽에서 할 일은 **없습니다.**

1. 직원이 템플릿을 자기 저장소로 복제
2. `project.json` 의 `id` 를 원하는 값으로 변경
3. Secret 3개(`DEPLOY_HOST`, `DEPLOY_USER`, `DEPLOY_SSH_KEY`) + Variable 1개(`BASE_DOMAIN`) 등록
4. `main` 에 Push

→ `https://<id>.yuns-portfolio.com` 으로 자동 접속됩니다.
와일드카드 인증서라 인증서 발급도 필요 없고, 포트도 열 필요 없습니다.
주소를 바꾸고 싶으면 `id` 만 바꾸면 됩니다.
