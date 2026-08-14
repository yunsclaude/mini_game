"use client";

import { useMemo, useSyncExternalStore } from "react";

import {
  getParticipantsText,
  getServerParticipantsText,
  setParticipantsText,
  subscribeParticipants,
} from "@/lib/participantStore";
import { parseParticipants, validateCount } from "@/lib/participants";

/**
 * 참가자 명단을 다섯 게임이 함께 쓰기 위한 훅입니다.
 *
 * 저장소에는 사용자가 입력한 글자를 그대로 두고,
 * 검증을 마친 이름 목록(names)은 그때그때 계산해서 씁니다.
 */
export function useParticipants() {
  const text = useSyncExternalStore(
    subscribeParticipants,
    getParticipantsText,
    getServerParticipantsText,
  );

  const parsed = useMemo(() => parseParticipants(text), [text]);

  return {
    /** 입력칸에 보여 줄 글자입니다. */
    text,
    /** 입력칸의 글자를 바꿉니다. 모든 화면에 함께 반영됩니다. */
    setText: setParticipantsText,
    /** 검증을 마친 이름 목록입니다. 게임은 이 값만 씁니다. */
    names: parsed.names,
    /** 이름이 잘렸거나 중복을 정리한 경우의 안내입니다. */
    notices: parsed.notices,
    /** 인원이 모자라거나 넘치면 안내 문구, 문제가 없으면 null 입니다. */
    countError: validateCount(parsed.names),
  };
}
