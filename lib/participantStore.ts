"use client";

/**
 * 참가자 명단을 브라우저에 저장해 두는 곳입니다.
 *
 * 한 게임에서 명단을 고치면 다른 게임에 들어가도 그대로 남아 있고,
 * 창을 여러 개 띄워 두었으면 그쪽 화면에도 함께 반영됩니다.
 *
 * 저장하는 값은 **사용자가 입력한 글자 그대로**입니다.
 * 이름 목록으로 바꾸고 검증하는 일은 lib/participants.ts 가 맡습니다.
 * 이렇게 나눠 두면 글자를 치는 도중에 이름이 멋대로 고쳐지지 않습니다.
 */

/** localStorage 에 저장할 때 쓰는 이름표입니다. */
const STORAGE_ID = "mini-game:participants";

const listeners = new Set<() => void>();

function notifyListeners(): void {
  for (const listener of listeners) {
    listener();
  }
}

/**
 * 저장된 글자를 읽습니다.
 *
 * useSyncExternalStore 는 값이 바뀌었는지 Object.is 로 비교하는데,
 * 문자열은 내용이 같으면 같은 값으로 취급되므로 따로 캐시할 필요가 없습니다.
 */
export function getParticipantsText(): string {
  try {
    return window.localStorage.getItem(STORAGE_ID) ?? "";
  } catch {
    // 사생활 보호 모드 등으로 접근이 막힌 경우입니다.
    return "";
  }
}

/** 서버에서 화면을 처음 만들 때는 저장소를 볼 수 없으므로 빈 값에서 시작합니다. */
export function getServerParticipantsText(): string {
  return "";
}

/** 명단을 저장하고, 이 값을 보고 있는 화면들에 알립니다. */
export function setParticipantsText(text: string): void {
  try {
    window.localStorage.setItem(STORAGE_ID, text);
  } catch {
    // 저장이 막혀도 이번 판은 계속할 수 있어야 하므로 알림만 보냅니다.
  }
  notifyListeners();
}

/** 값이 바뀔 때 알림을 받습니다. 돌려받은 함수를 부르면 구독이 끝납니다. */
export function subscribeParticipants(listener: () => void): () => void {
  listeners.add(listener);

  // 다른 탭에서 명단을 고친 경우입니다.
  function handleStorage(event: StorageEvent): void {
    if (event.key === null || event.key === STORAGE_ID) {
      listener();
    }
  }

  window.addEventListener("storage", handleStorage);

  return () => {
    listeners.delete(listener);
    window.removeEventListener("storage", handleStorage);
  };
}
