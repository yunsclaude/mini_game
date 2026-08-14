"use client";

import { useMemo, useRef, useState } from "react";

import { ParticipantEditor } from "@/components/ParticipantEditor";
import { ResultPanel } from "@/components/ResultPanel";
import { randomIndex } from "@/lib/random";
import { useParticipants } from "@/lib/useParticipants";

/** 원판을 그릴 때 쓰는 크기입니다. */
const SIZE = 260;
const CENTER = SIZE / 2;
const RADIUS = CENTER - 6;
/** 회전 애니메이션 시간(초)입니다. CSS 의 transition 시간과 같아야 합니다. */
const SPIN_SECONDS = 4;

export function WheelGame() {
  const { names, countError } = useParticipants();
  const [excluded, setExcluded] = useState<string[]>([]);
  const [removeWinner, setRemoveWinner] = useState(false);
  const [rotation, setRotation] = useState(0);
  const [spinning, setSpinning] = useState(false);
  const [winner, setWinner] = useState<string | null>(null);
  const [history, setHistory] = useState<string[]>([]);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  /** 이번 판에 실제로 원판에 올라가는 사람들입니다. */
  const pool = useMemo(
    () => names.filter((name) => !excluded.includes(name)),
    [names, excluded],
  );

  const segmentAngle = pool.length > 0 ? 360 / pool.length : 360;
  const canSpin = countError === null && pool.length >= 2 && !spinning;

  function spin() {
    if (!canSpin) {
      return;
    }

    // 결과를 먼저 정하고, 원판은 그 결과에 맞춰 멈추도록 각도를 계산합니다.
    const index = randomIndex(pool.length);
    const picked = pool[index];

    // 당첨 조각의 가운데가 위쪽 바늘에 오도록 만드는 각도입니다.
    const targetAngle = (360 - (index * segmentAngle + segmentAngle / 2)) % 360;
    const current = ((rotation % 360) + 360) % 360;
    const delta = (targetAngle - current + 360) % 360;
    const nextRotation = rotation + 360 * 5 + delta;

    setWinner(null);
    setSpinning(true);
    setRotation(nextRotation);

    if (timerRef.current !== null) {
      clearTimeout(timerRef.current);
    }
    timerRef.current = setTimeout(() => {
      setSpinning(false);
      setWinner(picked);
      setHistory((previous) => [...previous, picked]);
      if (removeWinner) {
        setExcluded((previous) => [...previous, picked]);
      }
    }, SPIN_SECONDS * 1000);
  }

  function reset() {
    if (timerRef.current !== null) {
      clearTimeout(timerRef.current);
    }
    setExcluded([]);
    setWinner(null);
    setHistory([]);
    setSpinning(false);
  }

  return (
    <>
      <ParticipantEditor />

      <section className="card">
        <h2 className="card-title">원판</h2>
        <p className="card-hint">
          원판을 돌려 위쪽 바늘이 가리키는 한 명을 뽑습니다. 지금 원판에 올라간 인원은{" "}
          {pool.length}명입니다.
        </p>

        <div className="wheel-stage">
          <span className="wheel-pointer" aria-hidden="true" />
          <svg
            className="wheel-svg"
            viewBox={`0 0 ${SIZE} ${SIZE}`}
            role="img"
            aria-label={`참가자 ${pool.length}명이 올라간 원판`}
            style={{
              transform: `rotate(${rotation}deg)`,
              transition: spinning
                ? `transform ${SPIN_SECONDS}s cubic-bezier(0.15, 0.85, 0.2, 1)`
                : "none",
            }}
          >
            {pool.length === 0 ? (
              <circle cx={CENTER} cy={CENTER} r={RADIUS} className="wheel-empty" />
            ) : (
              pool.map((name, index) => (
                <g key={name}>
                  <path
                    d={sectorPath(index, segmentAngle)}
                    fill={sectorColor(index, pool.length)}
                  />
                  <text
                    className="wheel-label"
                    x={CENTER + RADIUS * 0.62}
                    y={CENTER}
                    fontSize={labelFontSize(pool.length)}
                    textAnchor="middle"
                    dominantBaseline="middle"
                    transform={`rotate(${index * segmentAngle + segmentAngle / 2 - 90} ${CENTER} ${CENTER})`}
                  >
                    {shortenLabel(name, pool.length)}
                  </text>
                </g>
              ))
            )}
            <circle cx={CENTER} cy={CENTER} r={16} className="wheel-hub" />
          </svg>
        </div>

        <div className="button-row">
          <button className="button" type="button" onClick={spin} disabled={!canSpin}>
            {spinning ? "돌리는 중…" : "원판 돌리기"}
          </button>
          {(history.length > 0 || excluded.length > 0) && (
            <button
              className="button button-quiet"
              type="button"
              onClick={reset}
              disabled={spinning}
            >
              처음부터
            </button>
          )}
        </div>

        <label className="checkbox-row">
          <input
            type="checkbox"
            checked={removeWinner}
            onChange={(event) => setRemoveWinner(event.target.checked)}
            disabled={spinning}
          />
          뽑힌 사람은 원판에서 빼기 (여러 명을 순서대로 뽑을 때 사용)
        </label>

        {countError !== null && <p className="warning-note">{countError}</p>}
        {countError === null && pool.length < 2 && (
          <p className="warning-note">
            원판에 남은 인원이 {pool.length}명입니다. &quot;처음부터&quot; 를 눌러 다시 채우세요.
          </p>
        )}
      </section>

      <ResultPanel
        headline={winner !== null ? `${winner} 님 당첨!` : undefined}
        lines={
          history.length > 1 ? history.map((name, index) => `${index + 1}번째 — ${name}`) : []
        }
        placeholder="원판을 돌리면 결과가 나옵니다"
      />
    </>
  );
}

/** 조각 하나의 부채꼴 경로를 만듭니다. 0번 조각은 12시 방향에서 시작합니다. */
function sectorPath(index: number, segmentAngle: number): string {
  if (segmentAngle >= 360) {
    // 한 명뿐이면 부채꼴이 아니라 원 전체입니다.
    return `M ${CENTER} ${CENTER - RADIUS} A ${RADIUS} ${RADIUS} 0 1 1 ${CENTER - 0.01} ${CENTER - RADIUS} Z`;
  }

  const start = toPoint(index * segmentAngle);
  const end = toPoint((index + 1) * segmentAngle);
  const largeArc = segmentAngle > 180 ? 1 : 0;
  return `M ${CENTER} ${CENTER} L ${start.x} ${start.y} A ${RADIUS} ${RADIUS} 0 ${largeArc} 1 ${end.x} ${end.y} Z`;
}

/** 12시 방향을 0도로 두고, 시계 방향 각도를 좌표로 바꿉니다. */
function toPoint(degrees: number): { x: number; y: number } {
  const radians = ((degrees - 90) * Math.PI) / 180;
  return {
    x: CENTER + RADIUS * Math.cos(radians),
    y: CENTER + RADIUS * Math.sin(radians),
  };
}

/** 조각 색을 고르게 나눕니다. 밝기를 고정해 두어 어두운 화면에서도 글씨가 보입니다. */
function sectorColor(index: number, total: number): string {
  const hue = Math.round((360 / total) * index);
  const lightness = index % 2 === 0 ? 52 : 44;
  return `hsl(${hue} 58% ${lightness}%)`;
}

function labelFontSize(total: number): number {
  if (total <= 8) {
    return 13;
  }
  if (total <= 16) {
    return 10;
  }
  return 7;
}

/** 인원이 많으면 원판에 이름을 다 넣을 수 없어 줄여서 표시합니다. */
function shortenLabel(name: string, total: number): string {
  const limit = total <= 8 ? 8 : total <= 16 ? 5 : 3;
  return name.length > limit ? `${name.slice(0, limit)}…` : name;
}
