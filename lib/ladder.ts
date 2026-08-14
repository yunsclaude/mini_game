/**
 * 사다리 타기의 사다리를 만들고, 길을 따라가는 계산입니다.
 *
 * 화면 그리기와 분리해 두어서, 규칙이 맞는지 이 파일만 보고 확인할 수 있습니다.
 *
 * ── 왜 이렇게 만드나 ──────────────────────────────────────
 * 가로줄을 아무 데나 무작위로 뿌리면 사다리가 충분히 섞이지 않습니다.
 * 층수가 열 개 남짓이면 출발한 자리 근처에 도착할 확률이 훨씬 높아져서,
 * 다른 게임과 달리 결과가 고르지 않게 됩니다. (실제로 재어 보면 편차가 100%를 넘습니다.)
 *
 * 그래서 순서를 뒤집었습니다.
 *   1. 누가 어디에 도착할지를 먼저 고르게 섞어서 정합니다.
 *   2. 그 결과가 나오도록 가로줄을 놓습니다.
 *
 * 2번은 옆자리끼리만 자리를 바꿔 가며 정렬하는 방식(홀짝 교환 정렬)으로 만듭니다.
 * 한 층에서 서로 떨어진 자리들을 동시에 바꾸므로, 가로줄이 붙어 버리는 일도 없습니다.
 */

import { randomIndex, shuffle } from "@/lib/random";

/** 사다리가 너무 짧으면 밋밋해 보여서, 이 층수는 채웁니다. */
const MIN_ROWS = 8;

export type Ladder = {
  /** 세로줄 개수 (= 참가자 수) */
  columnCount: number;
  /** 가로줄을 놓을 수 있는 층의 수 */
  rowCount: number;
  /**
   * rungs[층][칸] 이 true 면 그 층에서 왼쪽 세로줄과 오른쪽 세로줄이 이어져 있습니다.
   * 칸 번호는 0 부터 columnCount - 2 까지입니다.
   */
  rungs: boolean[][];
};

/** 사다리를 새로 만듭니다. 참가자마다 도착 지점이 하나씩, 고르게 정해집니다. */
export function buildLadder(columnCount: number): Ladder {
  const gapCount = Math.max(columnCount - 1, 0);

  // 1) 도착 지점을 먼저 정합니다. destinations[i] 는 i번 참가자가 도착할 칸입니다.
  const destinations = shuffle(Array.from({ length: columnCount }, (_, index) => index));

  // 2) 그 결과가 나오도록 옆자리끼리 바꿔 갑니다.
  //    positions[c] 는 지금 c번 세로줄에 있는 사람이 가야 할 칸입니다.
  //    이 값이 0, 1, 2 ... 순서로 정렬되면 모두 제자리를 찾은 것입니다.
  const positions = [...destinations];
  const rungs: boolean[][] = [];

  // 홀짝 교환 정렬은 참가자 수만큼의 층이면 반드시 끝납니다.
  // 혹시 모를 무한 반복을 막기 위해 넉넉한 상한을 둡니다.
  const maxRows = columnCount * 2 + 4;
  for (let round = 0; round < maxRows && !isSorted(positions); round += 1) {
    const row = Array.from({ length: gapCount }, () => false);

    // 한 층에서는 한 칸씩 건너뛴 자리만 다룹니다. 그래서 가로줄이 서로 붙지 않습니다.
    for (let gap = round % 2; gap < gapCount; gap += 2) {
      if (positions[gap] > positions[gap + 1]) {
        [positions[gap], positions[gap + 1]] = [positions[gap + 1], positions[gap]];
        row[gap] = true;
      }
    }

    rungs.push(row);
  }

  // 3) 층수가 모자라면 빈 층을 끼워 넣습니다. 빈 층은 결과를 바꾸지 않습니다.
  while (rungs.length < MIN_ROWS) {
    rungs.splice(
      randomIndex(rungs.length + 1),
      0,
      Array.from({ length: gapCount }, () => false),
    );
  }

  return { columnCount, rowCount: rungs.length, rungs };
}

/** 모든 사람이 제자리를 찾았는지 봅니다. */
function isSorted(positions: readonly number[]): boolean {
  for (let index = 1; index < positions.length; index += 1) {
    if (positions[index - 1] > positions[index]) {
      return false;
    }
  }
  return true;
}

/** 길을 따라가며 지나간 지점입니다. 층 -1 은 맨 위, rowCount 는 맨 아래입니다. */
export type LadderStep = {
  column: number;
  row: number;
};

export type LadderPath = {
  startColumn: number;
  /** 마지막에 도착한 세로줄 번호입니다. */
  endColumn: number;
  steps: LadderStep[];
};

/** 한 참가자가 내려가는 길을 계산합니다. */
export function tracePath(ladder: Ladder, startColumn: number): LadderPath {
  const steps: LadderStep[] = [{ column: startColumn, row: -1 }];
  let column = startColumn;

  for (let row = 0; row < ladder.rowCount; row += 1) {
    const goesRight = column < ladder.columnCount - 1 && ladder.rungs[row][column];
    const goesLeft = column > 0 && ladder.rungs[row][column - 1];

    if (!goesRight && !goesLeft) {
      continue;
    }

    // 가로줄을 만난 층까지 내려온 뒤 옆으로 건너갑니다.
    steps.push({ column, row });
    column = goesRight ? column + 1 : column - 1;
    steps.push({ column, row });
  }

  steps.push({ column, row: ladder.rowCount });

  return { startColumn, endColumn: column, steps };
}
