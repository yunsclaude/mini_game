"use client";

import { useEffect, useRef, useState } from "react";

import { ParticipantEditor } from "@/components/ParticipantEditor";
import { ResultPanel } from "@/components/ResultPanel";
import {
  buildCourse,
  createMarbles,
  defaultMarbleColor,
  finishRemaining,
  rotorEnds,
  leadingMarble,
  stepMarbles,
  COURSE_WIDTH,
  type Course,
  type Marble,
} from "@/lib/marbleCourse";
import { useParticipants } from "@/lib/useParticipants";

/**
 * 세로로 긴 코스를 굴러 내려가는 경주입니다. 들어온 순서대로 순위가 정해집니다.
 *
 * 코스와 물리 계산은 lib/marbleCourse.ts 에 있습니다.
 * 이 파일은 그것을 화면에 그리고, 화면이 선두 공을 따라가게 하는 일만 합니다.
 */

/** 코스 좌우에 두는 여백입니다. */
const PADDING = 12;
const VIEW_WIDTH = COURSE_WIDTH + PADDING * 2;
/** 한 화면에 들어오도록 세로를 짧게 잡습니다. 화면은 어차피 선두 공을 따라갑니다. */
const VIEW_HEIGHT = 375;
/** 선두 공을 화면의 이 높이쯤에 두고 따라갑니다. */
const CAMERA_ANCHOR = 0.45;

/**
 * 물리는 화면 주사율과 상관없이 1초에 60걸음으로 고정합니다.
 * 이렇게 해야 120Hz 화면에서 경주가 두 배로 빨라지는 일이 없습니다.
 */
const STEP_MS = 1000 / 60;
/** 한 프레임에 몰아서 계산할 수 있는 최대 걸음 수입니다. (탭을 다시 열었을 때 대비) */
const MAX_STEPS_PER_FRAME = 5;
/** 제한 시간입니다. 이 시간이 지나면 남은 공은 도착선에 가까운 순서대로 순위를 받습니다. */
const TIME_LIMIT_MS = 20_000;

const WALL_COLOR = "rgba(150, 158, 172, 0.85)";
const PEG_COLOR = "rgba(150, 158, 172, 0.6)";
const FINISH_COLOR = "#22c55e";
const GATE_COLOR = "#22d3ee";

type Phase = "idle" | "running" | "done";

export function MarbleGame() {
  const { names, countError } = useParticipants();
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const frameRef = useRef<number | null>(null);
  const [phase, setPhase] = useState<Phase>("idle");
  const [ranking, setRanking] = useState<string[]>([]);
  const [timedOut, setTimedOut] = useState(false);
  const [colorByName, setColorByName] = useState<Record<string, string>>({});

  // 화면을 떠날 때 애니메이션을 멈춥니다.
  useEffect(() => {
    return () => {
      if (frameRef.current !== null) {
        cancelAnimationFrame(frameRef.current);
      }
    };
  }, []);

  /** 이름에 정해진 공 색입니다. 고르지 않았으면 기본 색을 씁니다. */
  function colorOf(name: string, index: number): string {
    return colorByName[name] ?? defaultMarbleColor(index, names.length);
  }

  function start() {
    const maybeContext = canvasRef.current?.getContext("2d");
    if (maybeContext === null || maybeContext === undefined || countError !== null) {
      return;
    }
    const context: CanvasRenderingContext2D = maybeContext;

    const course = buildCourse();
    const marbles = createMarbles(
      names.map((name, index) => ({ name, color: colorOf(name, index) })),
      course,
    );

    let cameraY = 0;
    let finishedCount = 0;
    let accumulator = 0;
    let previousTime: number | null = null;
    let startedAt: number | null = null;

    setRanking([]);
    setTimedOut(false);
    setPhase("running");

    function step(now: number) {
      if (startedAt === null) {
        startedAt = now;
      }
      const elapsed = now - startedAt;

      // 지난 프레임과의 간격만큼만 물리를 진행시킵니다.
      const delta = previousTime === null ? STEP_MS : Math.min(now - previousTime, 200);
      previousTime = now;
      accumulator += delta;

      const arrivedNames: string[] = [];
      let steps = 0;
      while (
        accumulator >= STEP_MS &&
        steps < MAX_STEPS_PER_FRAME &&
        finishedCount < marbles.length
      ) {
        for (const index of stepMarbles(course, marbles)) {
          arrivedNames.push(marbles[index].name);
          finishedCount += 1;
        }
        accumulator -= STEP_MS;
        steps += 1;
      }

      // 제한 시간이 지나면 남은 공에 순위를 매기고 끝냅니다.
      let ranOutOfTime = false;
      if (finishedCount < marbles.length && elapsed >= TIME_LIMIT_MS) {
        for (const index of finishRemaining(marbles)) {
          arrivedNames.push(marbles[index].name);
          finishedCount += 1;
        }
        ranOutOfTime = true;
      }

      if (arrivedNames.length > 0) {
        setRanking((previous) => [...previous, ...arrivedNames]);
      }

      // 아직 도착하지 않은 공 중 가장 아래 공을 따라갑니다.
      const leader = leadingMarble(marbles);
      const followY = leader?.y ?? course.finishY;
      const targetCamera = Math.max(
        0,
        Math.min(followY - VIEW_HEIGHT * CAMERA_ANCHOR, course.height - VIEW_HEIGHT),
      );
      cameraY += (targetCamera - cameraY) * 0.12;

      const remainingMs = Math.max(0, TIME_LIMIT_MS - elapsed);
      draw(context, course, marbles, cameraY, leader, remainingMs);

      if (finishedCount >= marbles.length) {
        if (ranOutOfTime) {
          setTimedOut(true);
        }
        setPhase("done");
        frameRef.current = null;
        return;
      }

      frameRef.current = requestAnimationFrame(step);
    }

    if (frameRef.current !== null) {
      cancelAnimationFrame(frameRef.current);
    }
    frameRef.current = requestAnimationFrame(step);
  }

  function reset() {
    if (frameRef.current !== null) {
      cancelAnimationFrame(frameRef.current);
      frameRef.current = null;
    }
    setPhase("idle");
    setRanking([]);
    setTimedOut(false);

    const context = canvasRef.current?.getContext("2d");
    if (context) {
      context.clearRect(0, 0, VIEW_WIDTH, VIEW_HEIGHT);
    }
  }

  const running = phase === "running";

  return (
    <>
      <ParticipantEditor />

      <section className="card">
        <h2 className="card-title">공 굴리기</h2>
        <p className="card-hint">
          이름이 적힌 공 {names.length}개가 긴 코스를 굴러 내려갑니다. 도착 직전에는 회전
          차단봉이 있어서, 봉이 막고 있는 동안 도착한 공은 앞서 왔더라도 뒤로 밀립니다. 화면은
          가장 앞선 공을 따라가고, 제한 시간은 20초입니다.
        </p>

        <div className="button-row button-row-top">
          <button
            className="button"
            type="button"
            onClick={start}
            disabled={countError !== null || running}
          >
            {running ? "달리는 중…" : phase === "done" ? "다시 굴리기" : "공 굴리기"}
          </button>
          {phase === "done" && (
            <button className="button button-quiet" type="button" onClick={reset}>
              처음부터
            </button>
          )}
        </div>

        <div className="marble-stage">
          <canvas
            className="marble-canvas"
            ref={canvasRef}
            width={VIEW_WIDTH}
            height={VIEW_HEIGHT}
            aria-label={`참가자 ${names.length}명의 공이 코스를 내려가는 화면`}
            role="img"
          />
          {phase === "idle" && (
            <p className="marble-overlay">위 버튼을 누르면 경주가 시작됩니다</p>
          )}
        </div>

        <p className="fairness-note">
          출발 자리는 무작위로 섞어서 나눠 줍니다. 그래서 코스가 어떻게 생겼든 모든 사람이 1등을
          할 확률은 똑같습니다. 경주 자체에는 손대지 않습니다.
        </p>

        {countError !== null && <p className="warning-note">{countError}</p>}
      </section>

      <details className="details-card">
        <summary className="details-summary">공 색 바꾸기</summary>
        <div className="details-body">
          <p className="card-hint">
            기본 색은 자동으로 겹치지 않게 나눠 줍니다. 바꾸고 싶은 사람만 골라 주세요.
          </p>

          {names.length === 0 ? (
            <p className="result-placeholder">참가자를 먼저 입력해 주세요</p>
          ) : (
            <div className="color-grid">
              {names.map((name, index) => (
                <label className="color-item" key={name}>
                  <input
                    className="color-input"
                    type="color"
                    value={colorOf(name, index)}
                    disabled={running}
                    onChange={(event) =>
                      setColorByName((previous) => ({
                        ...previous,
                        [name]: event.target.value,
                      }))
                    }
                  />
                  <span className="color-name">{name}</span>
                </label>
              ))}
            </div>
          )}

          <div className="button-row">
            <button
              className="button button-quiet"
              type="button"
              disabled={running || Object.keys(colorByName).length === 0}
              onClick={() => setColorByName({})}
            >
              기본 색으로 되돌리기
            </button>
          </div>
        </div>
      </details>

      <ResultPanel
        headline={ranking.length > 0 ? `${ranking[0]} 님 1등!` : undefined}
        lines={ranking.map((name, index) => `${index + 1}등 — ${name}`)}
        placeholder="공을 굴리면 들어온 순서대로 순위가 쌓입니다"
      />

      {timedOut && (
        <p className="fairness-note">
          20초가 지나 경주를 마쳤습니다. 도착하지 못한 공은 도착선에 가까운 순서대로 순위를
          받았습니다.
        </p>
      )}
    </>
  );
}

/** 코스와 공을 그립니다. 화면은 cameraY 만큼 아래를 비춥니다. */
function draw(
  context: CanvasRenderingContext2D,
  course: Course,
  marbles: readonly Marble[],
  cameraY: number,
  leader: Marble | null,
  remainingMs: number,
): void {
  context.clearRect(0, 0, VIEW_WIDTH, VIEW_HEIGHT);
  context.save();
  context.translate(PADDING, -cameraY);

  const viewTop = cameraY - 40;
  const viewBottom = cameraY + VIEW_HEIGHT + 40;

  // 구간별 배경 — 어디까지가 한 구간인지 눈으로 구분되게 합니다.
  //
  // 캔버스는 CSS 변수를 읽을 수 없으므로 색을 직접 칠하면 밝은 테마에서 어색해집니다.
  // 그래서 옅은 반투명 색을 덧칠해 바탕(var(--bg))이 비치게 합니다.
  // 진하기와 밝기는 모든 구간이 같고 색상(hue)만 다르므로 화면 톤이 유지됩니다.
  for (const band of course.bands) {
    if (band.bottom < viewTop || band.top > viewBottom) {
      continue;
    }
    context.fillStyle = `hsl(${band.hue} 70% 50% / 0.13)`;
    context.fillRect(0, band.top, COURSE_WIDTH, band.bottom - band.top);
  }

  // 벽
  context.strokeStyle = WALL_COLOR;
  context.lineWidth = 3;
  context.lineCap = "round";
  context.beginPath();
  for (const segment of course.segments) {
    if (segment.maxY < viewTop || segment.minY > viewBottom) {
      continue;
    }
    context.moveTo(segment.ax, segment.ay);
    context.lineTo(segment.bx, segment.by);
  }
  context.stroke();

  // 못
  context.fillStyle = PEG_COLOR;
  for (const peg of course.pegs) {
    if (peg.y < viewTop || peg.y > viewBottom) {
      continue;
    }
    context.beginPath();
    context.arc(peg.x, peg.y, peg.radius, 0, Math.PI * 2);
    context.fill();
  }

  // 회전 막대 — 구간 안의 미니 회전봉과 도착 직전의 차단봉이 모두 여기에 들어갑니다.
  context.strokeStyle = GATE_COLOR;
  context.fillStyle = GATE_COLOR;
  context.lineCap = "round";
  for (const rotor of course.rotors) {
    if (rotor.y + rotor.halfLength < viewTop || rotor.y - rotor.halfLength > viewBottom) {
      continue;
    }

    const ends = rotorEnds(rotor);
    context.lineWidth = rotor.halfThickness * 2;
    context.beginPath();
    context.moveTo(ends.ax, ends.ay);
    context.lineTo(ends.bx, ends.by);
    context.stroke();

    context.beginPath();
    context.arc(rotor.x, rotor.y, 4.5, 0, Math.PI * 2);
    context.fill();
  }

  // 도착선
  if (course.finishY > viewTop && course.finishY < viewBottom) {
    context.strokeStyle = FINISH_COLOR;
    context.lineWidth = 3;
    context.setLineDash([10, 8]);
    context.beginPath();
    context.moveTo(0, course.finishY);
    context.lineTo(COURSE_WIDTH, course.finishY);
    context.stroke();
    context.setLineDash([]);

    context.fillStyle = FINISH_COLOR;
    context.font = "700 16px system-ui, sans-serif";
    context.textAlign = "center";
    context.textBaseline = "bottom";
    context.fillText("도착", COURSE_WIDTH / 2, course.finishY - 8);
  }

  // 공 — 이미 들어온 공은 흐리게 그려서 남은 공이 잘 보이게 합니다.
  for (const marble of marbles) {
    if (marble.y < viewTop || marble.y > viewBottom) {
      continue;
    }

    context.globalAlpha = marble.finished ? 0.3 : 1;

    context.beginPath();
    context.arc(marble.x, marble.y, marble.radius, 0, Math.PI * 2);
    context.fillStyle = marble.color;
    context.fill();

    if (marble === leader) {
      context.strokeStyle = "#ffffff";
      context.lineWidth = 2.5;
      context.stroke();
    }

    const label = shortenLabel(marble.name);
    const fontSize = labelFontSize(marble.radius, label.length);
    context.font = `700 ${fontSize}px system-ui, sans-serif`;
    context.textAlign = "center";
    context.textBaseline = "middle";
    // 테두리를 글자 크기에 맞춰 얇게 잡습니다. 굵으면 작은 글자가 뭉개집니다.
    context.lineWidth = Math.max(1.5, fontSize * 0.28);
    context.strokeStyle = "rgba(0, 0, 0, 0.35)";
    context.strokeText(label, marble.x, marble.y);
    context.fillStyle = "#ffffff";
    context.fillText(label, marble.x, marble.y);
  }

  context.globalAlpha = 1;
  context.restore();

  drawHud(context, course, cameraY, leader, remainingMs);
}

/** 왼쪽 위에 선두와 남은 시간을, 오른쪽 가장자리에 진행도를 표시합니다. */
function drawHud(
  context: CanvasRenderingContext2D,
  course: Course,
  cameraY: number,
  leader: Marble | null,
  remainingMs: number,
): void {
  const trackTop = 16;
  const trackHeight = VIEW_HEIGHT - 32;
  const x = VIEW_WIDTH - 6;

  context.strokeStyle = "rgba(150, 158, 172, 0.3)";
  context.lineWidth = 4;
  context.lineCap = "round";
  context.beginPath();
  context.moveTo(x, trackTop);
  context.lineTo(x, trackTop + trackHeight);
  context.stroke();

  const progress = Math.max(0, Math.min(1, (leader?.y ?? cameraY) / course.finishY));
  context.strokeStyle = FINISH_COLOR;
  context.beginPath();
  context.moveTo(x, trackTop);
  context.lineTo(x, trackTop + trackHeight * progress);
  context.stroke();

  context.fillStyle = "rgba(150, 158, 172, 0.95)";
  context.font = "700 13px system-ui, sans-serif";
  context.textAlign = "left";
  context.textBaseline = "top";
  if (leader !== null) {
    context.fillText(`선두 ${leader.name}`, 10, 10);
    context.fillText(`남은 시간 ${(remainingMs / 1000).toFixed(1)}초`, 10, 28);
  }
}

/** 공에 적을 수 있는 글자 수입니다. */
const LABEL_MAX_LENGTH = 3;

/** 공에 적을 이름입니다. 앞 세 글자까지만 씁니다. */
function shortenLabel(name: string): string {
  return name.length > LABEL_MAX_LENGTH ? name.slice(0, LABEL_MAX_LENGTH) : name;
}

/**
 * 글자 수에 맞춰 크기를 줄여, 세 글자도 공 안에 들어가게 합니다.
 *
 * 한글은 글자 하나의 폭이 글자 크기와 거의 같습니다.
 * 그래서 "글자 크기 × 글자 수" 가 공 안쪽 폭을 넘지 않도록 잡으면 됩니다.
 */
function labelFontSize(radius: number, length: number): number {
  const insideWidth = radius * 1.75;
  const fitted = Math.min(radius * 0.62, insideWidth / Math.max(length, 1));
  return Math.max(6, Math.round(fitted));
}
