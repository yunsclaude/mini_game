"use client";

import { useState } from "react";

import { ParticipantEditor } from "@/components/ParticipantEditor";
import { ResultPanel } from "@/components/ResultPanel";
import { buildLadder, tracePath, type Ladder, type LadderPath } from "@/lib/ladder";
import { MAX_PARTICIPANTS, parseItems } from "@/lib/participants";
import { useParticipants } from "@/lib/useParticipants";

/** 사다리를 그릴 때 쓰는 크기입니다. (SVG 안에서만 쓰는 단위) */
const COL_GAP = 64;
const MARGIN_X = 32;
const ROW_GAP = 24;

/** 결과 항목을 적지 않았을 때 채워 넣는 값입니다. */
const FILLER_ITEM = "꽝";

type Board = {
  ladder: Ladder;
  /** 사다리를 만든 시점의 참가자입니다. 명단이 바뀌면 다시 만들어야 합니다. */
  names: string[];
  /** 맨 아래 칸에 놓인 결과들입니다. 참가자 수와 길이가 같습니다. */
  items: string[];
  /** 참가자별로 미리 계산해 둔 길입니다. */
  paths: LadderPath[];
};

export function LadderGame() {
  const { names, countError } = useParticipants();
  const [itemsText, setItemsText] = useState("");
  const [winnerInput, setWinnerInput] = useState("1");
  const [board, setBoard] = useState<Board | null>(null);
  const [revealed, setRevealed] = useState<number[]>([]);
  const [tracing, setTracing] = useState<{ column: number; runId: number } | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  // 사다리를 만든 뒤 명단이 바뀌었으면 그 사다리는 더 이상 쓸 수 없습니다.
  const stale = board !== null && board.names.join("\n") !== names.join("\n");

  function fillWithWinners() {
    const requested = Number.parseInt(winnerInput, 10);
    const winners = Math.min(
      Math.max(Number.isFinite(requested) ? requested : 1, 1),
      Math.max(names.length - 1, 1),
    );
    const total = Math.max(names.length, winners + 1);
    setItemsText(
      Array.from({ length: total }, (_, index) =>
        index < winners ? "당첨" : FILLER_ITEM,
      ).join("\n"),
    );
  }

  function makeLadder() {
    if (countError !== null) {
      return;
    }

    const { items, message } = fitItems(parseItems(itemsText), names.length);
    const ladder = buildLadder(names.length);

    setBoard({
      ladder,
      names,
      items,
      paths: names.map((_, column) => tracePath(ladder, column)),
    });
    setRevealed([]);
    setTracing(null);
    setNotice(message);
  }

  function startTrace(column: number) {
    setTracing((previous) => ({
      column,
      runId: previous === null ? 1 : previous.runId + 1,
    }));
  }

  function finishTrace(column: number) {
    setRevealed((previous) =>
      previous.includes(column) ? previous : [...previous, column],
    );
    setTracing(null);
  }

  function revealAll() {
    if (board === null) {
      return;
    }
    setTracing(null);
    setRevealed(board.names.map((_, column) => column));
  }

  const usableBoard = board !== null && !stale ? board : null;
  const resultLines =
    usableBoard === null
      ? []
      : [...revealed]
          .sort((a, b) => a - b)
          .map(
            (column) =>
              `${usableBoard.names[column]} → ${usableBoard.items[usableBoard.paths[column].endColumn]}`,
          );

  return (
    <>
      <ParticipantEditor />

      <section className="card">
        <h2 className="card-title">결과 항목</h2>
        <p className="card-hint">
          사다리 아래에 놓을 항목입니다. 한 줄에 하나씩 적습니다. 참가자 수와 개수가 다르면
          자동으로 맞춥니다.
        </p>

        <label className="field-label" htmlFor="ladder-items">
          항목 (최대 {MAX_PARTICIPANTS}개)
        </label>
        <textarea
          className="name-input"
          id="ladder-items"
          rows={5}
          value={itemsText}
          placeholder={"당첨\n꽝\n꽝"}
          onChange={(event) => setItemsText(event.target.value)}
        />

        <div className="quick-fill">
          <label className="field-label" htmlFor="ladder-winner-count">
            간단히 채우기 — 당첨 몇 명?
          </label>
          <div className="button-row">
            <input
              className="count-input"
              id="ladder-winner-count"
              type="number"
              min={1}
              max={Math.max(names.length - 1, 1)}
              value={winnerInput}
              onChange={(event) => setWinnerInput(event.target.value)}
            />
            <button className="button button-quiet" type="button" onClick={fillWithWinners}>
              당첨 · 꽝으로 채우기
            </button>
          </div>
        </div>

        <div className="button-row">
          <button
            className="button button-wide"
            type="button"
            onClick={makeLadder}
            disabled={countError !== null}
          >
            {board === null ? "사다리 만들기" : "사다리 새로 만들기"}
          </button>
        </div>

        {countError !== null && <p className="warning-note">{countError}</p>}
        {notice !== null && <p className="warning-note">{notice}</p>}
        {stale && (
          <p className="warning-note">
            참가자 명단이 바뀌었습니다. 사다리를 새로 만들어 주세요.
          </p>
        )}
      </section>

      {usableBoard !== null && (
        <section className="card">
          <h2 className="card-title">사다리</h2>
          <p className="card-hint">
            위쪽 이름을 누르면 그 사람의 길을 따라갑니다. ({revealed.length} /{" "}
            {usableBoard.names.length}명 확인)
          </p>

          <LadderBoard
            board={usableBoard}
            revealed={revealed}
            tracing={tracing}
            onStartTrace={startTrace}
            onFinishTrace={finishTrace}
          />

          <div className="button-row">
            <button className="button button-quiet" type="button" onClick={revealAll}>
              전체 결과 보기
            </button>
          </div>
        </section>
      )}

      <ResultPanel lines={resultLines} placeholder="사다리를 만들고 이름을 눌러 보세요" />
    </>
  );
}

type LadderBoardProps = {
  board: Board;
  revealed: number[];
  tracing: { column: number; runId: number } | null;
  onStartTrace: (column: number) => void;
  onFinishTrace: (column: number) => void;
};

/** 사다리 그림입니다. 이름과 결과는 버튼·글자로, 줄만 SVG 로 그립니다. */
function LadderBoard({
  board,
  revealed,
  tracing,
  onStartTrace,
  onFinishTrace,
}: LadderBoardProps) {
  const { ladder, names, items, paths } = board;
  const width = MARGIN_X * 2 + (ladder.columnCount - 1) * COL_GAP;
  const height = (ladder.rowCount + 1) * ROW_GAP;

  /** 도착 칸별로, 그 칸에 도착한 사람이 밝혀졌는지 표시합니다. */
  const arrivedAt = new Set(revealed.map((column) => paths[column].endColumn));

  return (
    <div className="ladder-scroll">
      <div className="ladder-board" style={{ width: `${width}px` }}>
        <div className="ladder-labels">
          {names.map((name, column) => (
            <button
              className={`ladder-name${revealed.includes(column) ? " ladder-name-done" : ""}`}
              key={name}
              type="button"
              style={{ left: `${columnX(column)}px` }}
              onClick={() => onStartTrace(column)}
              title={name}
            >
              {name}
            </button>
          ))}
        </div>

        <svg
          className="ladder-svg"
          viewBox={`0 0 ${width} ${height}`}
          width={width}
          height={height}
          role="img"
          aria-label={`참가자 ${names.length}명이 내려가는 사다리`}
        >
          {/* 세로줄 — 참가자마다 색을 달리해 눈으로 따라가기 쉽게 합니다. */}
          {names.map((name, column) => (
            <line
              className="ladder-line-vertical"
              key={name}
              stroke={traceColor(column, ladder.columnCount)}
              x1={columnX(column)}
              y1={0}
              x2={columnX(column)}
              y2={height}
            />
          ))}

          {/* 가로줄 */}
          {ladder.rungs.map((row, rowIndex) =>
            row.map((connected, gap) =>
              connected ? (
                <line
                  className="ladder-line"
                  key={`${rowIndex}-${gap}`}
                  x1={columnX(gap)}
                  y1={rowY(rowIndex)}
                  x2={columnX(gap + 1)}
                  y2={rowY(rowIndex)}
                />
              ) : null,
            ),
          )}

          {/* 이미 확인한 길 */}
          {revealed.map((column) => (
            <path
              className="ladder-path-done"
              key={`done-${column}`}
              d={pathShape(paths[column], ladder.rowCount)}
              stroke={traceColor(column, ladder.columnCount)}
            />
          ))}

          {/* 지금 따라가는 중인 길 */}
          {tracing !== null && (
            <g key={`trace-${tracing.column}-${tracing.runId}`}>
              <path
                className="ladder-trace"
                d={pathShape(paths[tracing.column], ladder.rowCount)}
                pathLength={1}
                stroke={traceColor(tracing.column, ladder.columnCount)}
                onAnimationEnd={() => onFinishTrace(tracing.column)}
              />
              {/* 길을 따라 내려가는 구슬 */}
              <circle r={7} fill={traceColor(tracing.column, ladder.columnCount)}>
                <animateMotion
                  dur="1.4s"
                  fill="freeze"
                  path={pathShape(paths[tracing.column], ladder.rowCount)}
                />
              </circle>
            </g>
          )}
        </svg>

        <div className="ladder-labels">
          {items.map((item, column) => (
            <span
              className={`ladder-item${arrivedAt.has(column) ? " ladder-item-done" : ""}`}
              key={`${column}-${item}`}
              style={{ left: `${columnX(column)}px` }}
              title={item}
            >
              {item}
            </span>
          ))}
        </div>
      </div>
    </div>
  );
}

function columnX(column: number): number {
  return MARGIN_X + column * COL_GAP;
}

/** 층 번호를 세로 위치로 바꿉니다. -1 은 맨 위, rowCount 는 맨 아래입니다. */
function rowY(row: number): number {
  return (row + 1) * ROW_GAP;
}

function pathShape(path: LadderPath, rowCount: number): string {
  return path.steps
    .map((step, index) => {
      const y = step.row === -1 ? 0 : step.row === rowCount ? (rowCount + 1) * ROW_GAP : rowY(step.row);
      return `${index === 0 ? "M" : "L"} ${columnX(step.column)} ${y}`;
    })
    .join(" ");
}

function traceColor(column: number, total: number): string {
  return `hsl(${Math.round((360 / total) * column)} 72% 52%)`;
}

/**
 * 결과 항목 수를 참가자 수에 맞춥니다.
 * 모자라면 "꽝" 으로 채우고, 많으면 뒤쪽을 잘라 냅니다.
 */
function fitItems(
  items: readonly string[],
  participantCount: number,
): { items: string[]; message: string | null } {
  if (items.length === participantCount) {
    return { items: [...items], message: null };
  }

  if (items.length > participantCount) {
    return {
      items: items.slice(0, participantCount),
      message: `결과 항목이 참가자보다 많아 뒤쪽 ${items.length - participantCount}개를 뺐습니다.`,
    };
  }

  const filled = [
    ...items,
    ...Array.from({ length: participantCount - items.length }, () => FILLER_ITEM),
  ];
  return {
    items: filled,
    message:
      items.length === 0
        ? `결과 항목이 없어서 모두 "${FILLER_ITEM}" 으로 채웠습니다.`
        : `결과 항목이 모자라 ${participantCount - items.length}개를 "${FILLER_ITEM}" 으로 채웠습니다.`,
  };
}
