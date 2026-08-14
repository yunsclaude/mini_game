"use client";

import { useMemo, useState } from "react";

import { ParticipantEditor } from "@/components/ParticipantEditor";
import { ResultPanel } from "@/components/ResultPanel";
import { shuffle } from "@/lib/random";
import { useParticipants } from "@/lib/useParticipants";

/** 카드 한 장의 상태입니다. */
type Slot = {
  /** 당첨 카드인지 여부입니다. 게임을 시작할 때 정해집니다. */
  isWinner: boolean;
  /** 이 카드를 연 사람입니다. 아직 안 열었으면 null 입니다. */
  openedBy: string | null;
};

export function DrawGame() {
  const { names, countError } = useParticipants();
  const [winnerInput, setWinnerInput] = useState("1");
  const [slots, setSlots] = useState<Slot[] | null>(null);
  const [turn, setTurn] = useState(0);

  const winnerCount = clampWinnerCount(winnerInput, names.length);

  const openedWinners = useMemo(
    () => (slots ?? []).filter((slot) => slot.isWinner && slot.openedBy !== null),
    [slots],
  );

  const finished =
    slots !== null && (turn >= names.length || openedWinners.length === winnerCount);

  function startGame() {
    if (countError !== null) {
      return;
    }
    // 당첨 카드를 섞어서 배치합니다. 이 순간 결과가 모두 정해집니다.
    const flags = shuffle(
      Array.from({ length: names.length }, (_, index) => index < winnerCount),
    );
    setSlots(flags.map((isWinner) => ({ isWinner, openedBy: null })));
    setTurn(0);
  }

  function openSlot(index: number) {
    if (slots === null || finished) {
      return;
    }
    const target = slots[index];
    if (target.openedBy !== null) {
      return;
    }

    const opener = names[turn];
    setSlots(
      slots.map((slot, slotIndex) =>
        slotIndex === index ? { ...slot, openedBy: opener } : slot,
      ),
    );
    setTurn(turn + 1);
  }

  function reset() {
    setSlots(null);
    setTurn(0);
  }

  const resultLines = finished
    ? openedWinners.map((slot) => `${slot.openedBy} — 당첨`)
    : [];

  return (
    <>
      <ParticipantEditor />

      <section className="card">
        <h2 className="card-title">뽑기 설정</h2>
        <p className="card-hint">
          참가자 수만큼 카드를 깔고 그중 당첨을 숨깁니다. 명단 순서대로 한 명씩 카드를 고릅니다.
        </p>

        <label className="field-label" htmlFor="draw-winner-count">
          당첨 인원 (1 ~ {Math.max(1, names.length - 1)}명)
        </label>
        <input
          className="count-input"
          id="draw-winner-count"
          type="number"
          min={1}
          max={Math.max(1, names.length - 1)}
          value={winnerInput}
          onChange={(event) => setWinnerInput(event.target.value)}
          disabled={slots !== null}
        />

        <div className="button-row">
          <button
            className="button"
            type="button"
            onClick={startGame}
            disabled={countError !== null || slots !== null}
          >
            카드 깔기
          </button>
          {slots !== null && (
            <button className="button button-quiet" type="button" onClick={reset}>
              다시 하기
            </button>
          )}
        </div>

        {countError !== null && <p className="warning-note">{countError}</p>}
      </section>

      {slots !== null && (
        <section className="card">
          <h2 className="card-title">
            {finished ? "모두 열었습니다" : `${names[turn]} 님 차례입니다`}
          </h2>
          <p className="card-hint">
            {finished
              ? "아래 결과를 확인하세요."
              : `카드를 한 장 고르세요. 남은 당첨 ${winnerCount - openedWinners.length}개`}
          </p>

          <div className="draw-grid">
            {slots.map((slot, index) => {
              const opened = slot.openedBy !== null;
              return (
                <button
                  className={`draw-card${opened ? " draw-card-open" : ""}${
                    opened && slot.isWinner ? " draw-card-win" : ""
                  }`}
                  key={index}
                  type="button"
                  onClick={() => openSlot(index)}
                  disabled={opened || finished}
                  aria-label={
                    opened
                      ? `${slot.openedBy} 님이 연 카드, ${slot.isWinner ? "당첨" : "꽝"}`
                      : `${index + 1}번 카드 열기`
                  }
                >
                  {opened ? (
                    <>
                      <span className="draw-mark">{slot.isWinner ? "당첨" : "꽝"}</span>
                      <span className="draw-owner">{slot.openedBy}</span>
                    </>
                  ) : (
                    <span className="draw-mark">{index + 1}</span>
                  )}
                </button>
              );
            })}
          </div>
        </section>
      )}

      <ResultPanel
        headline={
          finished && openedWinners.length === 1
            ? `${openedWinners[0].openedBy} 님 당첨!`
            : undefined
        }
        lines={finished && openedWinners.length !== 1 ? resultLines : []}
        placeholder="카드를 모두 열면 결과가 나옵니다"
      />
    </>
  );
}

/** 당첨 인원 입력값을 1명 이상, 전체 인원보다 적은 수로 맞춥니다. */
function clampWinnerCount(rawValue: string, participantCount: number): number {
  const upperBound = Math.max(1, participantCount - 1);
  const parsed = Number.parseInt(rawValue, 10);
  if (!Number.isFinite(parsed)) {
    return 1;
  }
  return Math.min(Math.max(parsed, 1), upperBound);
}
