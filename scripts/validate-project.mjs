#!/usr/bin/env node
/**
 * project.json 검사 스크립트입니다.
 *
 * 실행: npm run validate:project
 * 규칙을 하나라도 어기면 종료 코드 1 로 실패합니다.
 */
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

const projectRoot = join(dirname(fileURLToPath(import.meta.url)), "..");
const projectFilePath = join(projectRoot, "project.json");

const REQUIRED_FIELDS = [
  "id",
  "name",
  "description",
  "owner",
  "department",
  "domain",
  "port",
  "database",
];

const ID_PATTERN = /^[a-z0-9][a-z0-9-]*$/;
const FIXED_PORT = 3000;

// 템플릿에 원래 들어 있는 예시 값입니다.
// 이 값을 그대로 두고 배포하면 다른 사람의 프로젝트와 주소가 겹칩니다.
// 여기서는 경고만 하고, 실제 차단은 배포 단계(.github/workflows/deploy.yml)에서 합니다.
// 템플릿 저장소 자신은 이 값으로 동작해야 하므로 실패로 처리하지 않습니다.
const TEMPLATE_DEFAULTS = {
  id: "lunch-roulette",
  owner: "yun",
};

const errors = [];
const warnings = [];

function fail(message) {
  errors.push(message);
}

function warn(message) {
  warnings.push(message);
}

/** 값이 있는 문자열인지 검사합니다. 항목 자체가 없으면 위에서 이미 알렸으므로 건너뜁니다. */
function requireNonEmptyString(project, field, label) {
  if (!Object.hasOwn(project, field)) {
    return false;
  }
  const value = project[field];
  if (typeof value !== "string") {
    fail(`${label}(${field}) 은(는) 문자열이어야 합니다. 현재 타입: ${typeof value}`);
    return false;
  }
  if (value.trim() === "") {
    fail(`${label}(${field}) 이(가) 비어 있습니다. project.json 에서 값을 채워 주세요.`);
    return false;
  }
  return true;
}

let raw;
try {
  raw = readFileSync(projectFilePath, "utf8");
} catch {
  console.error("[실패] project.json 파일을 찾을 수 없습니다.");
  console.error(`        찾은 위치: ${projectFilePath}`);
  process.exit(1);
}

let project;
try {
  project = JSON.parse(raw);
} catch (error) {
  console.error("[실패] project.json 이 올바른 JSON 형식이 아닙니다.");
  console.error(`        원인: ${error.message}`);
  console.error("        쉼표(,)나 큰따옴표(\")가 빠지지 않았는지 확인해 주세요.");
  process.exit(1);
}

if (project === null || typeof project !== "object" || Array.isArray(project)) {
  console.error("[실패] project.json 의 최상위는 { } 형태의 객체여야 합니다.");
  process.exit(1);
}

// 1. 필수 필드 존재 여부
for (const field of REQUIRED_FIELDS) {
  if (!Object.hasOwn(project, field)) {
    fail(`필수 항목 "${field}" 이(가) project.json 에 없습니다.`);
  }
}

// 2. id 규칙
if (typeof project.id !== "string") {
  if (Object.hasOwn(project, "id")) {
    fail(`id 는 문자열이어야 합니다. 현재 타입: ${typeof project.id}`);
  }
} else {
  const id = project.id;
  if (!ID_PATTERN.test(id)) {
    fail(
      'id 는 영문 소문자, 숫자, 하이픈(-)만 쓸 수 있고 영문 소문자 또는 숫자로 시작해야 합니다. ' +
        `현재 값: "${id}" (예: my-sales-report)`,
    );
  }
  if (id.length < 3 || id.length > 50) {
    fail(`id 길이는 3자 이상 50자 이하여야 합니다. 현재 길이: ${id.length}자`);
  }
}

// 3. 비어 있으면 안 되는 문자열 항목
requireNonEmptyString(project, "name", "프로젝트 이름");
requireNonEmptyString(project, "description", "프로젝트 설명");
requireNonEmptyString(project, "owner", "제작자");
requireNonEmptyString(project, "department", "부서");

// domain 은 비워 둬도 됩니다.
// 배포할 때 <id>.<BASE_DOMAIN> 으로 자동으로 채워지기 때문입니다.
// 직접 적어 두더라도 배포 시 실제 주소로 덮어써집니다.
// 다만 값이 있다면 문자열이어야 합니다.
if (Object.hasOwn(project, "domain") && typeof project.domain !== "string") {
  fail(
    `도메인(domain) 은 문자열이어야 합니다. 현재 타입: ${typeof project.domain} ` +
      '(값을 모르면 "" 로 비워 두세요. 배포할 때 자동으로 채워집니다)',
  );
}

// 3-1. 템플릿 예시 값이 그대로 남아 있는지
if (project.id === TEMPLATE_DEFAULTS.id) {
  warn(
    `id 가 템플릿 예시 값 "${TEMPLATE_DEFAULTS.id}" 그대로입니다. ` +
      "접속 주소가 id 로 정해지므로, 바꾸지 않으면 다른 사람의 프로젝트와 겹쳐 배포가 거부됩니다.",
  );
}
if (project.owner === TEMPLATE_DEFAULTS.owner) {
  warn(`owner 가 템플릿 예시 값 "${TEMPLATE_DEFAULTS.owner}" 그대로입니다. 본인 이름으로 바꿔 주세요.`);
}

// 4. port 는 3000 고정
if (project.port !== FIXED_PORT) {
  fail(
    `port 는 ${FIXED_PORT} 으로 고정되어 있습니다. 현재 값: ${JSON.stringify(project.port)} ` +
      "(배포 서버가 3000번 포트를 기준으로 동작합니다)",
  );
}

// 5. database 는 true / false 만 허용합니다.
//    true 면 배포할 때 서버가 이 프로젝트 전용 데이터베이스를 만들어 줍니다.
if (Object.hasOwn(project, "database") && typeof project.database !== "boolean") {
  fail(
    "database 는 true 또는 false 여야 합니다. 따옴표 없이 씁니다. " +
      `현재 값: ${JSON.stringify(project.database)} ` +
      '(올바른 예: "database": true)',
  );
}

if (errors.length > 0) {
  console.error("[실패] project.json 검사에서 문제가 발견되었습니다.\n");
  for (const [index, message] of errors.entries()) {
    console.error(`  ${index + 1}. ${message}`);
  }
  console.error("\n project.json 을 수정한 뒤 다시 실행해 주세요: npm run validate:project");
  process.exit(1);
}

if (warnings.length > 0) {
  console.warn("[주의] 고치지 않아도 검사는 통과하지만, 배포 전에 확인이 필요합니다.\n");
  for (const [index, message] of warnings.entries()) {
    console.warn(`  ${index + 1}. ${message}`);
  }
  console.warn("");
}

console.log("[성공] project.json 검사를 통과했습니다.");
console.log(`  - 프로젝트 ID : ${project.id}`);
console.log(`  - 이름        : ${project.name}`);
console.log(`  - 제작자      : ${project.owner} (${project.department})`);
console.log(`  - 포트        : ${project.port}`);
console.log(
  `  - 도메인      : ${project.domain ? project.domain : "(배포할 때 자동으로 정해집니다)"}`,
);
console.log(`  - 데이터베이스: ${project.database ? "사용함" : "사용 안 함"}`);
