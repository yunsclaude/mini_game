#!/usr/bin/env node
/**
 * Claude Code 가 파일을 쓰기 직전에 실행됩니다.
 * 쓰려는 내용에 API 키가 들어 있으면 작업을 막습니다.
 *
 * 설정 위치: .claude/settings.json 의 hooks.PreToolUse
 *
 * 동작 방식
 *   - Claude Code 가 이 파일을 실행하고 표준입력으로 JSON 을 넘깁니다.
 *   - 종료 코드 0 이면 그대로 진행하고, 2 면 막습니다.
 *   - 2 로 막으면 표준오류에 적은 내용이 Claude 에게 전달돼 스스로 고치게 됩니다.
 *
 * 검사 규칙은 scripts/check-secrets.mjs 에서 그대로 가져다 씁니다.
 * 규칙을 두 벌 관리하면 반드시 어긋나므로, 원본은 한 곳뿐입니다.
 *
 * 한계 (알고 계셔야 합니다)
 *   이 훅은 Claude 가 파일을 쓸 때만 동작합니다.
 *   직원이 VS Code 에서 직접 타이핑하거나 붙여넣으면 여기서는 막지 못합니다.
 *   그래서 git 커밋 훅(.githooks/pre-commit)과 GitHub Actions 검사가 따로 있습니다.
 */
import { readFileSync } from "node:fs";
import { findSecret } from "../../scripts/check-secrets.mjs";

function readStdin() {
  try {
    // 0 은 표준입력입니다. Claude Code 가 여기로 JSON 을 넘겨 줍니다.
    return readFileSync(0, "utf8");
  } catch {
    return "";
  }
}

let payload;
try {
  payload = JSON.parse(readStdin());
} catch {
  // 입력을 이해하지 못하면 막지 않습니다.
  // 훅이 오작동해서 작업이 멈추는 쪽이 더 나쁩니다.
  process.exit(0);
}

const input = payload?.tool_input ?? {};

// Write 는 content, Edit 는 new_string 에 쓸 내용이 들어 있습니다.
const candidates = [input.content, input.new_string].filter(
  (v) => typeof v === "string",
);

for (const text of candidates) {
  const found = findSecret(text);

  if (found) {
    const target = input.file_path ?? "(파일 이름 없음)";

    process.stderr.write(
      [
        `비밀값이 들어 있어 파일 쓰기를 막았습니다: ${target}`,
        `${found.line}번째 줄 — ${found.why}`,
        "",
        "이렇게 고치세요.",
        "",
        '  나쁨:  const apiKey = "sk-실제키값";',
        "  좋음:  const apiKey = process.env.OPENAI_API_KEY;",
        "",
        "실제 값은 코드가 아니라 아래 두 곳에 넣습니다.",
        "  내 PC     : .env.local 파일",
        "  배포 서버 : 저장소 Secret APP_ENV",
        "",
        "사용자에게 키 값을 알려 달라고 하지 마세요.",
        "환경변수를 읽는 코드로 바꾸고, 값은 직접 .env.local 에 넣도록 안내하세요.",
      ].join("\n"),
    );

    process.exit(2);
  }
}

process.exit(0);
