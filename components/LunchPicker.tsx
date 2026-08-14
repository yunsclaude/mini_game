"use client";

import { useState } from "react";

type LunchPickerProps = {
  menus: string[];
};

/**
 * 버튼을 누르면 메뉴 하나를 무작위로 고릅니다.
 *
 * "use client" 가 붙어 있으므로 이 부분은 브라우저에서 동작합니다.
 * 배포한 서버에서 버튼이 눌린다면 브라우저 쪽 코드도 정상이라는 뜻입니다.
 */
export function LunchPicker({ menus }: LunchPickerProps) {
  const [picked, setPicked] = useState<string | null>(null);
  const [tryCount, setTryCount] = useState(0);

  function handlePick() {
    if (menus.length === 0) {
      return;
    }
    const index = Math.floor(Math.random() * menus.length);
    setPicked(menus[index]);
    setTryCount((previous) => previous + 1);
  }

  return (
    <section className="card">
      <h2 className="card-title">메뉴 뽑기</h2>
      <p className="card-hint">
        고민되면 버튼을 누르세요. 마음에 안 들면 다시 눌러도 됩니다.
      </p>

      <p className="picker-result" aria-live="polite">
        {picked ?? "아직 뽑지 않았습니다"}
      </p>

      <button className="picker-button" type="button" onClick={handlePick}>
        {picked === null ? "메뉴 뽑기" : "다시 뽑기"}
      </button>

      {tryCount > 0 && <p className="picker-count">지금까지 {tryCount}번 뽑았습니다.</p>}
    </section>
  );
}
