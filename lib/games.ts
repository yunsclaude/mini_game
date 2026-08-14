/**
 * 미니게임 목록입니다.
 *
 * 메인 화면의 카드와 각 게임 화면의 제목이 모두 이 파일을 읽습니다.
 * 게임 이름이나 설명을 바꾸려면 여기만 고치면 됩니다.
 */

/** 게임이 내놓는 결과의 모양입니다. */
export type GameResultKind =
  /** 여러 명 중 한 명(또는 몇 명)을 뽑습니다. */
  | "pick"
  /** 참가자 전원에게 결과가 하나씩 돌아갑니다. */
  | "assign";

export type Game = {
  /** 주소에 쓰이는 이름입니다. /games/<slug> */
  slug: string;
  name: string;
  /** 카드에 한 줄로 보여 줄 설명입니다. */
  tagline: string;
  /** 게임 화면 위쪽에 보여 줄 설명입니다. */
  description: string;
  /** 카드 아이콘 (이미지 파일 없이 글자 하나로 표시합니다) */
  icon: string;
  resultKind: GameResultKind;
};

export const games: Game[] = [
  {
    slug: "draw",
    name: "제비 뽑기",
    tagline: "카드를 한 장씩 열어 당첨을 확인합니다",
    description:
      "참가자 수만큼 카드를 깔고 그중 정해진 수만큼 당첨을 숨깁니다. 카드를 눌러 한 장씩 열어 보세요.",
    icon: "🎫",
    resultKind: "pick",
  },
  {
    slug: "ladder",
    name: "사다리 타기",
    tagline: "참가자와 결과를 하나씩 짝지어 줍니다",
    description:
      "참가자마다 결과 항목이 하나씩 배정됩니다. 역할 분담이나 벌칙 종류까지 한 번에 정할 때 좋습니다.",
    icon: "🪜",
    resultKind: "assign",
  },
  {
    slug: "wheel",
    name: "원판 돌리기",
    tagline: "원판을 돌려 한 명을 고릅니다",
    description:
      "참가자 이름을 원판에 나눠 붙이고 돌립니다. 인원이 많아도 결과가 한눈에 보입니다.",
    icon: "🎯",
    resultKind: "pick",
  },
  {
    slug: "marble",
    name: "마블 룰렛",
    tagline: "공을 굴려 빠져나온 한 명이 당첨입니다",
    description:
      "이름이 적힌 공들이 통 안에서 굴러다니다가 하나가 빠져나옵니다. 가장 긴장감 있는 방식입니다.",
    icon: "🔮",
    resultKind: "pick",
  },
  {
    slug: "shuffle",
    name: "순서 · 팀 나누기",
    tagline: "발표 순서를 정하거나 팀을 나눕니다",
    description:
      "참가자 전원에게 순번을 매기거나, 원하는 팀 수로 고르게 나눕니다. 인원이 많을 때 가장 빠릅니다.",
    icon: "🔀",
    resultKind: "assign",
  },
];

/** 슬러그로 게임 하나를 찾습니다. 없으면 undefined 입니다. */
export function findGame(slug: string): Game | undefined {
  return games.find((game) => game.slug === slug);
}
