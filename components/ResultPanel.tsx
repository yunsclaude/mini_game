"use client";

import { useState } from "react";

type ResultPanelProps = {
  /** 크게 보여 줄 한 줄입니다. 없으면 표시하지 않습니다. */
  headline?: string;
  /** 목록으로 보여 줄 줄들입니다. */
  lines?: string[];
  /** 아직 결과가 없을 때 보여 줄 문구입니다. */
  placeholder?: string;
};

/** 복사를 시도한 내용과 그 성공 여부입니다. */
type CopyAttempt = {
  text: string;
  ok: boolean;
};

/**
 * 게임 결과를 보여 주고, 채팅에 붙여 넣을 수 있게 복사해 주는 칸입니다.
 * 다섯 게임이 모두 이 컴포넌트를 씁니다.
 */
export function ResultPanel({
  headline,
  lines = [],
  placeholder = "아직 결과가 없습니다",
}: ResultPanelProps) {
  const [attempt, setAttempt] = useState<CopyAttempt | null>(null);

  const hasResult = headline !== undefined || lines.length > 0;
  const resultText = [headline, ...lines]
    .filter((line): line is string => line !== undefined)
    .join("\n");

  // 결과가 새로 나오면 이전 복사 안내는 저절로 사라집니다.
  const copyNote =
    attempt !== null && attempt.text === resultText
      ? attempt.ok
        ? "복사했습니다"
        : "복사할 수 없어 직접 선택해 주세요"
      : null;

  async function copyResult() {
    try {
      await navigator.clipboard.writeText(resultText);
      setAttempt({ text: resultText, ok: true });
    } catch {
      // HTTPS 가 아니거나 브라우저가 막은 경우입니다. 직접 복사하도록 안내합니다.
      setAttempt({ text: resultText, ok: false });
    }
  }

  return (
    <section className="card">
      <h2 className="card-title">결과</h2>

      <div aria-live="polite">
        {!hasResult && <p className="result-placeholder">{placeholder}</p>}

        {headline !== undefined && <p className="result-headline">{headline}</p>}

        {lines.length > 0 && (
          // 줄 앞의 번호는 게임마다 형식이 달라서 각 게임이 직접 붙입니다.
          <ul className="result-list">
            {lines.map((line, index) => (
              <li className="result-line" key={`${index}-${line}`}>
                {line}
              </li>
            ))}
          </ul>
        )}
      </div>

      {hasResult && (
        <div className="button-row">
          <button className="button button-quiet" type="button" onClick={copyResult}>
            결과 복사
          </button>
          {copyNote !== null && <span className="copy-note">{copyNote}</span>}
        </div>
      )}
    </section>
  );
}
