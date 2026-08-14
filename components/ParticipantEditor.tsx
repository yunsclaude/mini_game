"use client";

import { useId, useState } from "react";

import {
  MAX_NAME_LENGTH,
  MAX_PARTICIPANTS,
  MIN_PARTICIPANTS,
  numberedNames,
} from "@/lib/participants";
import { useParticipants } from "@/lib/useParticipants";

/**
 * 참가자 이름을 입력받는 칸입니다. 다섯 게임이 모두 이 컴포넌트를 씁니다.
 *
 * 입력칸에는 사용자가 친 글자를 그대로 보여 주고,
 * 이름을 다듬는 일(공백 정리, 중복 구분, 인원 제한)은 게임이 쓰는 목록에만 적용합니다.
 * 그래서 글자를 치는 도중에 입력한 내용이 바뀌지 않습니다.
 */
export function ParticipantEditor() {
  const { text, setText, names, notices } = useParticipants();
  const [countInput, setCountInput] = useState("6");
  const textareaId = useId();
  const countInputId = useId();

  function fillWithNumbers() {
    const requested = Number.parseInt(countInput, 10);
    const generated = numberedNames(Number.isFinite(requested) ? requested : 0);
    setText(generated.join("\n"));
  }

  return (
    <section className="card">
      <h2 className="card-title">참가자 명단</h2>
      <p className="card-hint">
        한 줄에 한 명씩 적습니다. 쉼표로 구분해도 됩니다. 여기서 정한 명단은 다른 게임에서도
        그대로 쓰입니다.
      </p>

      <label className="field-label" htmlFor={textareaId}>
        이름 ({MIN_PARTICIPANTS}~{MAX_PARTICIPANTS}명, 한 명당 {MAX_NAME_LENGTH}자까지)
      </label>
      <textarea
        className="name-input"
        id={textareaId}
        rows={6}
        value={text}
        placeholder={"김서연\n박지훈\n이수민"}
        onChange={(event) => setText(event.target.value)}
      />

      <div className="quick-fill">
        <label className="field-label" htmlFor={countInputId}>
          이름 대신 번호로 채우기
        </label>
        <div className="button-row">
          <input
            className="count-input"
            id={countInputId}
            type="number"
            min={MIN_PARTICIPANTS}
            max={MAX_PARTICIPANTS}
            value={countInput}
            onChange={(event) => setCountInput(event.target.value)}
          />
          <button className="button button-quiet" type="button" onClick={fillWithNumbers}>
            1번 ~ N번 만들기
          </button>
          <button
            className="button button-quiet"
            type="button"
            onClick={() => setText("")}
          >
            비우기
          </button>
        </div>
      </div>

      <p className="participant-count" aria-live="polite">
        현재 {names.length}명
      </p>

      {notices.length > 0 && (
        <ul className="notice-list">
          {notices.map((notice) => (
            <li key={notice}>{notice}</li>
          ))}
        </ul>
      )}
    </section>
  );
}
