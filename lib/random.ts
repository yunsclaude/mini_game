/**
 * 모든 미니게임이 함께 쓰는 난수 도구입니다.
 *
 * 게임마다 따로 Math.random() 을 부르지 않고 이 파일만 사용합니다.
 * 이렇게 해야 "어떤 게임은 확률이 이상하다" 는 일이 생기지 않습니다.
 *
 * 각 게임의 애니메이션(원판 회전, 공 튀기기 등)은 여기서 정해진 결과를
 * 보여 주는 연출일 뿐이고, 결과 자체는 항상 이 파일에서 먼저 정해집니다.
 */

/**
 * 0 이상 max 미만의 정수를 고르게 뽑습니다.
 *
 * crypto 를 쓰되, 나머지 연산으로 생기는 미세한 치우침(modulo bias)까지 제거합니다.
 * crypto 를 쓸 수 없는 환경에서는 Math.random() 으로 물러납니다.
 */
export function randomIndex(max: number): number {
  if (!Number.isInteger(max) || max <= 0) {
    throw new Error(`randomIndex 의 max 는 1 이상의 정수여야 합니다. 받은 값: ${max}`);
  }
  if (max === 1) {
    return 0;
  }

  const crypto = globalThis.crypto;
  if (typeof crypto?.getRandomValues !== "function") {
    return Math.floor(Math.random() * max);
  }

  // 2^32 를 max 로 나눈 나머지 구간을 버려서 모든 값이 정확히 같은 확률이 되게 합니다.
  const limit = Math.floor(0xffffffff / max) * max;
  const buffer = new Uint32Array(1);
  for (let attempt = 0; attempt < 64; attempt += 1) {
    crypto.getRandomValues(buffer);
    if (buffer[0] < limit) {
      return buffer[0] % max;
    }
  }
  // 64번 연속으로 버려지는 값이 나올 확률은 사실상 0 이지만, 무한 반복은 막아 둡니다.
  return buffer[0] % max;
}

/** 배열에서 항목 하나를 고르게 뽑습니다. 빈 배열이면 null 입니다. */
export function pickOne<T>(items: readonly T[]): T | null {
  if (items.length === 0) {
    return null;
  }
  return items[randomIndex(items.length)];
}

/**
 * 배열을 무작위로 섞은 **새 배열**을 돌려줍니다. (Fisher-Yates)
 * 원본 배열은 바뀌지 않습니다.
 */
export function shuffle<T>(items: readonly T[]): T[] {
  const result = [...items];
  for (let i = result.length - 1; i > 0; i -= 1) {
    const j = randomIndex(i + 1);
    [result[i], result[j]] = [result[j], result[i]];
  }
  return result;
}

/** 배열에서 서로 다른 항목 count 개를 뽑습니다. count 가 길이보다 크면 전부 돌려줍니다. */
export function pickMany<T>(items: readonly T[], count: number): T[] {
  const safeCount = Math.max(0, Math.min(Math.floor(count), items.length));
  return shuffle(items).slice(0, safeCount);
}

/** min 이상 max 미만의 실수를 뽑습니다. (연출용 — 결과 판정에는 쓰지 않습니다) */
export function randomBetween(min: number, max: number): number {
  return min + (randomIndex(1_000_000) / 1_000_000) * (max - min);
}

/**
 * -amount 에서 +amount 사이의 아주 작은 흔들림입니다.
 *
 * 공이 벽 사이에 딱 끼어서 멈추는 것을 막는 연출용 값이라 1초에 수천 번 필요합니다.
 * 결과를 정하는 데는 전혀 쓰이지 않으므로, 빠른 Math.random 을 씁니다.
 */
export function wobble(amount: number): number {
  return (Math.random() - 0.5) * 2 * amount;
}
