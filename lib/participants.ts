/**
 * 참가자 명단을 검증하고 다듬는 공통 코드입니다.
 *
 * 사용자가 입력한 글자는 그대로 믿지 않고 항상 이 파일을 거쳐서 이름 목록이 됩니다.
 * 브라우저에 저장했다가 다시 읽어 온 값도 마찬가지입니다.
 * (저장은 lib/participantStore.ts 가 맡습니다.)
 */

/** 게임이 성립하려면 최소한 이 인원이 필요합니다. */
export const MIN_PARTICIPANTS = 2;
/** 원판·사다리가 화면에서 읽힐 수 있는 한계입니다. */
export const MAX_PARTICIPANTS = 30;
/** 이름 한 개의 최대 길이입니다. */
export const MAX_NAME_LENGTH = 20;

export type ParticipantResult = {
  /** 검증과 정리를 마친 이름 목록 */
  names: string[];
  /** 사용자에게 알려 줄 조정 내역 (잘림, 중복 처리, 인원 초과 등) */
  notices: string[];
};

/**
 * 이름 목록을 검증하고 다듬습니다.
 *
 * - 앞뒤 공백 제거, 빈 이름 제외
 * - 길이 상한을 넘으면 잘라 냄
 * - 같은 이름이 겹치면 뒤쪽에 "(2)", "(3)" 을 붙여 구분
 * - 인원 상한을 넘으면 앞에서부터 상한까지만 사용
 */
export function normalizeNames(rawNames: readonly string[]): ParticipantResult {
  const notices: string[] = [];
  const names: string[] = [];
  const seen = new Map<string, number>();

  let trimmedCount = 0;

  for (const rawName of rawNames) {
    if (typeof rawName !== "string") {
      continue;
    }

    const cleaned = rawName.trim().replace(/\s+/g, " ");
    if (cleaned === "") {
      continue;
    }

    let name = cleaned;
    if (name.length > MAX_NAME_LENGTH) {
      name = name.slice(0, MAX_NAME_LENGTH);
      trimmedCount += 1;
    }

    const previous = seen.get(name);
    if (previous === undefined) {
      seen.set(name, 1);
      names.push(name);
    } else {
      const next = previous + 1;
      seen.set(name, next);
      names.push(`${name} (${next})`);
    }

    if (names.length >= MAX_PARTICIPANTS) {
      break;
    }
  }

  if (trimmedCount > 0) {
    notices.push(`이름 ${trimmedCount}개가 ${MAX_NAME_LENGTH}자로 줄었습니다.`);
  }

  const usableCount = rawNames.filter(
    (name) => typeof name === "string" && name.trim() !== "",
  ).length;
  if (usableCount > MAX_PARTICIPANTS) {
    notices.push(`최대 ${MAX_PARTICIPANTS}명까지만 사용합니다. 뒤쪽 인원은 제외했습니다.`);
  }

  const duplicated = [...seen.values()].filter((count) => count > 1).length;
  if (duplicated > 0) {
    notices.push("같은 이름이 있어 뒤에 번호를 붙여 구분했습니다.");
  }

  return { names, notices };
}

/** 줄바꿈 또는 쉼표로 구분된 글자를 이름 목록으로 바꿉니다. */
export function parseParticipants(rawText: string): ParticipantResult {
  return normalizeNames(rawText.split(/[\n,]/));
}

/**
 * 참가자가 아닌 항목(사다리의 결과 칸 등)을 목록으로 바꿉니다.
 *
 * 이름과 달리 "꽝" 처럼 같은 값이 여러 번 나오는 것이 정상이므로 중복을 그대로 둡니다.
 */
export function parseItems(rawText: string): string[] {
  const items: string[] = [];

  for (const rawItem of rawText.split(/[\n,]/)) {
    const cleaned = rawItem.trim().replace(/\s+/g, " ");
    if (cleaned === "") {
      continue;
    }
    items.push(cleaned.slice(0, MAX_NAME_LENGTH));
    if (items.length >= MAX_PARTICIPANTS) {
      break;
    }
  }

  return items;
}

/** 게임을 시작할 수 있는 인원인지 확인합니다. 문제가 없으면 null 입니다. */
export function validateCount(names: readonly string[]): string | null {
  if (names.length < MIN_PARTICIPANTS) {
    return `최소 ${MIN_PARTICIPANTS}명이 필요합니다. 지금은 ${names.length}명입니다.`;
  }
  if (names.length > MAX_PARTICIPANTS) {
    return `최대 ${MAX_PARTICIPANTS}명까지 가능합니다.`;
  }
  return null;
}

/** 이름 대신 번호만 쓸 때 사용합니다. (1번, 2번 ...) */
export function numberedNames(count: number): string[] {
  const safeCount = Math.max(
    MIN_PARTICIPANTS,
    Math.min(Math.floor(count) || 0, MAX_PARTICIPANTS),
  );
  return Array.from({ length: safeCount }, (_, index) => `${index + 1}번`);
}
