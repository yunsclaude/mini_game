#!/usr/bin/env node
/**
 * 소스에 API 키나 비밀번호가 직접 적혀 있는지 검사합니다.
 *
 *   전체 검사   : npm run check:secrets
 *   특정 파일만 : node scripts/check-secrets.mjs app/page.tsx
 *   커밋할 것만 : node scripts/check-secrets.mjs --staged
 *
 * 하나라도 찾으면 종료 코드 1 로 실패합니다.
 *
 * 이 파일이 검사 규칙의 원본입니다. 아래 네 곳이 모두 여기를 씁니다.
 *   1. npm run check          (직원이 직접, 그리고 배포 워크플로가)
 *   2. .github/workflows/     (GitHub 에 올라온 코드 전부)
 *   3. .githooks/pre-commit   (커밋 직전)
 *   4. .claude/hooks/         (Claude Code 가 파일을 쓰기 직전)
 *
 * 규칙을 고치려면 여기만 고치면 됩니다.
 *
 * Bash 가 아니라 Node 로 짠 이유:
 *   Windows 에서 개발하는 직원도 그대로 쓸 수 있어야 합니다.
 *   Node 는 이 프로젝트를 돌리는 데 어차피 필요합니다.
 */
import { readdirSync, readFileSync, statSync } from "node:fs";
import { execFileSync } from "node:child_process";
import { join, relative, sep } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import { dirname } from "node:path";

const projectRoot = join(dirname(fileURLToPath(import.meta.url)), "..");

// ---------------------------------------------------------------------------
// 검사 규칙
// ---------------------------------------------------------------------------
//
// 설계 원칙: 따옴표로 감싼 "실제 값" 만 잡고, 환경변수를 읽는 올바른 코드는 통과시킵니다.
//
//   잡힘 : const apiKey = "abc123def456";
//   통과 : const apiKey = process.env.OPENAI_API_KEY;
//
// [^"'$] 로 값의 시작을 제한해 `${...}` 같은 치환식도 통과시킵니다.

/** 특정 서비스의 키 형식입니다. 따옴표가 없어도 잡습니다. */
const VENDOR_RULES = [
  { re: /AKIA[0-9A-Z]{16}/, why: "AWS 액세스 키" },
  { re: /ASIA[0-9A-Z]{16}/, why: "AWS 임시 액세스 키" },
  { re: /-----BEGIN [A-Z ]*PRIVATE KEY-----/, why: "인증서 개인키" },
  { re: /sk-ant-[A-Za-z0-9_-]{20,}/, why: "Anthropic API 키" },
  { re: /sk-[A-Za-z0-9]{32,}/, why: "OpenAI API 키" },
  { re: /gh[pousr]_[A-Za-z0-9]{30,}/, why: "GitHub 토큰" },
  { re: /xox[baprs]-[A-Za-z0-9-]{10,}/, why: "Slack 토큰" },
  { re: /eyJ[A-Za-z0-9_-]{10,}\.eyJ[A-Za-z0-9_-]{10,}\./, why: "JWT 토큰" },
];

/** 비밀값처럼 생긴 이름에 문자열을 직접 넣은 경우입니다. */
const NAME_RULES = [
  {
    // apiKey, api_key, APIKEY, secret, password, token, credential ... (대소문자 무시)
    re: /(api[-_]?key|apikey|secret|password|passwd|token|credential)["']?\s*[:=]\s*["'][^"'$]{8,}["']/i,
    why: "비밀값 이름에 문자열을 직접 넣었습니다",
  },
  {
    // OPENAI_KEY, AWS_SECRET, SLACK_BOT_TOKEN ... (대문자 상수, 대소문자 구분)
    // 소문자 key 는 넣지 않았습니다. <li key="menu"> 같은 정상 코드가 걸립니다.
    re: /[A-Z][A-Z0-9_]*_(KEY|SECRET|TOKEN|PASSWORD|PASSWD)["']?\s*[:=]\s*["'][^"'$]{8,}["']/,
    why: "비밀값 이름에 문자열을 직접 넣었습니다",
  },
];

/**
 * 글 한 덩어리에서 비밀값을 찾습니다.
 * Claude Code 훅(.claude/hooks/block-secrets.mjs)도 이 함수를 가져다 씁니다.
 *
 * @returns 찾았으면 { line, text, why }, 못 찾았으면 null
 */
export function findSecret(text) {
  if (typeof text !== "string" || text === "") return null;

  const lines = text.split("\n");

  for (let i = 0; i < lines.length; i += 1) {
    for (const rule of [...VENDOR_RULES, ...NAME_RULES]) {
      if (rule.re.test(lines[i])) {
        return { line: i + 1, text: lines[i], why: rule.why };
      }
    }
  }
  return null;
}

/**
 * 이 표시가 있는 줄은 건너뜁니다.
 * 설명용 예시 코드처럼, 일부러 그렇게 적어야 하는 줄에 씁니다.
 *
 *   const apiKey = "예시값입니다";  // check-secrets:allow
 */
const ALLOW_MARK = /check-secrets:\s*allow/;

/**
 * 한 파일에서 걸리는 줄을 모두 찾습니다.
 *
 * @param isDoc 설명 문서(.md)인지 여부.
 *   문서에는 "이렇게 쓰면 안 됩니다" 같은 예시가 들어갑니다.
 *   그래서 문서에서는 실제 서비스의 키 형식만 검사하고,
 *   apiKey = "..." 같은 일반 예시는 통과시킵니다.
 *   문서에 진짜 OpenAI 키를 붙여넣는 것은 여전히 걸립니다.
 */
function findAllInFile(content, isDoc = false) {
  const found = [];
  const lines = content.split("\n");
  const rules = isDoc ? VENDOR_RULES : [...VENDOR_RULES, ...NAME_RULES];

  for (let i = 0; i < lines.length; i += 1) {
    if (ALLOW_MARK.test(lines[i])) continue;

    for (const rule of rules) {
      if (rule.re.test(lines[i])) {
        found.push({ line: i + 1, text: lines[i], why: rule.why });
        break; // 한 줄에 여러 규칙이 걸려도 한 번만 알립니다.
      }
    }
  }
  return found;
}

// ---------------------------------------------------------------------------
// 검사 대상 고르기
// ---------------------------------------------------------------------------
const SKIP_DIRS = new Set([
  "node_modules",
  ".git",
  ".next",
  "out",
  "build",
  "coverage",
  "dist",
]);

/** 규칙 문자열 자체를 담고 있어 항상 걸리는 파일들입니다. */
const SKIP_FILES = new Set([
  join("scripts", "check-secrets.mjs"),
  join("scripts", "pre-deploy-check.sh"),
  join(".claude", "hooks", "block-secrets.mjs"),
  "package-lock.json",
]);

/** 텍스트가 아닌 파일은 건너뜁니다. */
const SKIP_EXT =
  /\.(png|jpe?g|gif|webp|avif|ico|svg|woff2?|ttf|eot|pdf|zip|gz|tar|mp4|mp3|wasm)$/i;

function shouldSkip(relPath) {
  if (SKIP_FILES.has(relPath)) return true;
  if (SKIP_EXT.test(relPath)) return true;
  return relPath.split(sep).some((part) => SKIP_DIRS.has(part));
}

function walk(dir, acc = []) {
  let entries;
  try {
    entries = readdirSync(dir, { withFileTypes: true });
  } catch {
    return acc;
  }

  for (const entry of entries) {
    const full = join(dir, entry.name);
    const rel = relative(projectRoot, full);

    if (entry.isDirectory()) {
      if (!SKIP_DIRS.has(entry.name)) walk(full, acc);
    } else if (entry.isFile() && !shouldSkip(rel)) {
      acc.push(rel);
    }
  }
  return acc;
}

function stagedFiles() {
  try {
    const out = execFileSync(
      "git",
      ["diff", "--cached", "--name-only", "--diff-filter=ACM"],
      { cwd: projectRoot, encoding: "utf8" },
    );
    return out
      .split("\n")
      .map((f) => f.trim())
      .filter((f) => f !== "" && !shouldSkip(f))
      .filter((f) => {
        try {
          return statSync(join(projectRoot, f)).isFile();
        } catch {
          return false;
        }
      });
  } catch {
    return [];
  }
}

// ---------------------------------------------------------------------------
// 실행
// ---------------------------------------------------------------------------
//
// 아래는 이 파일을 "직접 실행" 했을 때만 돕니다.
// .claude/hooks/block-secrets.mjs 가 findSecret 만 가져다 쓸 때는
// 파일 전체를 훑거나 종료해 버리면 안 되기 때문입니다.
const isDirectRun =
  process.argv[1] !== undefined &&
  import.meta.url === pathToFileURL(process.argv[1]).href;

if (!isDirectRun) {
  // 모듈로 불러온 경우입니다. 여기서 끝냅니다.
} else {
  main();
}

function main() {
const args = process.argv.slice(2);

let targets;
if (args[0] === "--staged") {
  targets = stagedFiles();
} else if (args.length > 0) {
  targets = args.map((f) => relative(projectRoot, join(process.cwd(), f)));
} else {
  targets = walk(projectRoot);
}

const problems = [];

for (const rel of targets) {
  let content;
  try {
    content = readFileSync(join(projectRoot, rel), "utf8");
  } catch {
    continue; // 읽을 수 없으면 넘어갑니다.
  }
  // 널 바이트가 있으면 바이너리로 봅니다.
  if (content.includes("\u0000")) continue;

  const isDoc = /\.(md|markdown|mdx|txt)$/i.test(rel);

  for (const hit of findAllInFile(content, isDoc)) {
    problems.push({ file: rel, ...hit });
  }
}

if (problems.length > 0) {
  console.error("[실패] 소스에 비밀값으로 보이는 내용이 있습니다.\n");

  for (const p of problems) {
    // 진짜 키가 로그에 그대로 남지 않도록 긴 줄은 잘라서 보여 줍니다.
    const shown = p.text.trim();
    const safe = shown.length > 60 ? `${shown.slice(0, 40)}…(가림)` : shown;
    console.error(`  ${p.file}:${p.line}`);
    console.error(`    ${safe}`);
    console.error(`    → ${p.why}\n`);
  }

  console.error(`어떻게 고치나요

  1. 코드에서 값을 지우고 환경변수로 바꿉니다.

       나쁨:  const apiKey = "sk-실제키값";
       좋음:  const apiKey = process.env.OPENAI_API_KEY;

  2. 실제 값은 두 곳에 넣습니다. 형식이 같아 복사해 옮기면 됩니다.

       내 PC     : .env.local 파일        (git 에 올라가지 않습니다)
       배포 서버 : 저장소 Secret APP_ENV  (Settings > Secrets and variables > Actions)

       OPENAI_API_KEY=sk-실제키값

  3. 이미 커밋했거나 GitHub 에 올렸다면 그 키는 유출된 것으로 봐야 합니다.
     파일에서 지우는 것만으로는 부족합니다. 발급처에서 키를 폐기(revoke)하고
     새로 발급받으세요. 커밋 기록에 그대로 남아 있습니다.

정상 코드인데 잘못 걸렸다면 scripts/check-secrets.mjs 의 규칙을 확인하세요.`);

  process.exit(1);
}

console.log(`[통과] 소스에서 비밀값을 찾지 못했습니다. (검사한 파일 ${targets.length}개)`);
}
