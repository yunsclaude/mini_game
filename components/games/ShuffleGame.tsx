"use client";

import { useState } from "react";

import { ParticipantEditor } from "@/components/ParticipantEditor";
import { ResultPanel } from "@/components/ResultPanel";
import { shuffle } from "@/lib/random";
import { useParticipants } from "@/lib/useParticipants";

/** 순서를 정할지, 팀을 나눌지 고릅니다. */
type Mode = "order" | "team";

export function ShuffleGame() {
  const { names, countError } = useParticipants();
  const [mode, setMode] = useState<Mode>("order");
  const [teamInput, setTeamInput] = useState("2");
  const [lines, setLines] = useState<string[]>([]);

  const maxTeams = Math.max(2, names.length);
  const teamCount = clampTeamCount(teamInput, names.length);

  function run() {
    if (countError !== null) {
      return;
    }

    const mixed = shuffle(names);
    setLines(mode === "order" ? buildOrderLines(mixed) : buildTeamLines(mixed, teamCount));
  }

  return (
    <>
      <ParticipantEditor />

      <section className="card">
        <h2 className="card-title">무엇을 정할까요</h2>
        <p className="card-hint">
          참가자 전원에게 결과가 하나씩 돌아갑니다. 인원이 많을 때 가장 빠른 방법입니다.
        </p>

        <div className="mode-row" role="radiogroup" aria-label="정할 내용">
          <label className="mode-option">
            <input
              type="radio"
              name="shuffle-mode"
              value="order"
              checked={mode === "order"}
              onChange={() => setMode("order")}
            />
            순서 정하기
          </label>
          <label className="mode-option">
            <input
              type="radio"
              name="shuffle-mode"
              value="team"
              checked={mode === "team"}
              onChange={() => setMode("team")}
            />
            팀 나누기
          </label>
        </div>

        {mode === "team" && (
          <div className="quick-fill">
            <label className="field-label" htmlFor="shuffle-team-count">
              팀 수 (2 ~ {maxTeams}개)
            </label>
            <input
              className="count-input"
              id="shuffle-team-count"
              type="number"
              min={2}
              max={maxTeams}
              value={teamInput}
              onChange={(event) => setTeamInput(event.target.value)}
            />
            <p className="participant-count">
              {names.length}명을 {teamCount}팀으로 나눕니다. 인원이 나누어떨어지지 않으면 한 명씩
              차이가 납니다.
            </p>
          </div>
        )}

        <div className="button-row">
          <button
            className="button button-wide"
            type="button"
            onClick={run}
            disabled={countError !== null}
          >
            {lines.length === 0 ? "섞기" : "다시 섞기"}
          </button>
        </div>

        {countError !== null && <p className="warning-note">{countError}</p>}
      </section>

      <ResultPanel
        lines={lines}
        placeholder="섞기를 누르면 결과가 나옵니다"
      />
    </>
  );
}

/** 발표 순서처럼 한 줄에 한 명씩 번호를 붙입니다. */
function buildOrderLines(mixedNames: readonly string[]): string[] {
  return mixedNames.map((name, index) => `${index + 1}번째 — ${name}`);
}

/**
 * 섞은 명단을 앞에서부터 한 명씩 돌아가며 각 팀에 넣습니다.
 * 이렇게 하면 팀 인원 차이가 최대 한 명을 넘지 않습니다.
 */
function buildTeamLines(mixedNames: readonly string[], teamCount: number): string[] {
  const teams: string[][] = Array.from({ length: teamCount }, () => []);
  mixedNames.forEach((name, index) => {
    teams[index % teamCount].push(name);
  });

  return teams.map(
    (members, index) => `${index + 1}팀 (${members.length}명) — ${members.join(", ")}`,
  );
}

/** 팀 수 입력값을 2 이상, 참가자 수 이하로 맞춥니다. */
function clampTeamCount(rawValue: string, participantCount: number): number {
  const upperBound = Math.max(2, participantCount);
  const parsed = Number.parseInt(rawValue, 10);
  if (!Number.isFinite(parsed)) {
    return 2;
  }
  return Math.min(Math.max(parsed, 2), upperBound);
}
