/**
 * 마블 룰렛의 코스와 물리 계산입니다.
 *
 * 화면 그리기와 떼어 놓았습니다. 덕분에 브라우저 없이도
 * "공이 중간에 끼지 않고 반드시 끝까지 내려가는지" 를 수천 번 돌려 확인할 수 있습니다.
 *
 * ── 공정성 ────────────────────────────────────────────────
 * 코스를 굴러 내려가는 경주는 출발 자리에 따라 유불리가 생깁니다.
 * 그래서 **이름을 출발 자리에 무작위로 섞어 배정**합니다. (createMarbles 참고)
 * 어느 자리가 유리하든 그 자리에 누가 설지는 고르게 정해지므로,
 * 각 참가자가 1등을 할 확률은 정확히 1/인원 이 됩니다.
 * 덕분에 경주 자체는 손대지 않은 정직한 시뮬레이션으로 둘 수 있습니다.
 */

import { randomBetween, shuffle, wobble } from "@/lib/random";

/** 코스의 가로 폭입니다. */
export const COURSE_WIDTH = 420;
const CENTER = COURSE_WIDTH / 2;
/** 기본 통로의 반너비입니다. */
const HALF = 170;

const START_HEIGHT = 200;
const BAND_HEIGHT = 520;
const FINISH_HEIGHT = 520;
/** 벽을 잘게 나누는 간격입니다. 작을수록 곡선이 매끄럽습니다. */
const ROW_STEP = 40;

/**
 * 공이 지나갈 수 있는 가장 좁은 틈입니다.
 * 가장 큰 공의 지름(radiusFor 참고)보다 넉넉히 커야 공이 끼지 않습니다.
 */
const MIN_GAP = 44;

/** 바깥 벽 범위를 기록하는 간격입니다. */
const BOUND_STEP = 20;

/** 도착 직전 통로의 반너비입니다. */
const GATE_HALF_WIDTH = 50;
/** 회전 차단봉이 한 바퀴 도는 데 걸리는 시간(초)입니다. */
const GATE_PERIOD_SECONDS = 2;
/** 차단봉에 부딪혔을 때 튕기는 정도입니다. */
const GATE_BOUNCE = 0.4;

/** 물리 계산 값입니다. 한 프레임을 두 번에 나눠 계산해 벽을 뚫고 지나가는 것을 막습니다. */
const SUBSTEPS = 2;

/**
 * 시간이 흐르는 빠르기입니다. 0.5 면 절반 속도로 천천히 굴러갑니다.
 *
 * 중력과 이동 거리에 똑같이 곱하므로 공이 그리는 **경로는 그대로**이고
 * 지나가는 속도만 느려집니다. (중력만 줄이면 튀는 정도가 달라져 코스가 망가집니다.)
 */
const TIME_SCALE = 0.5;

const GRAVITY = 0.19;
const MAX_SPEED = 8.5;
const WALL_BOUNCE = 0.42;
const PEG_BOUNCE = 0.55;
const MARBLE_BOUNCE = 0.35;
/** 겹친 공을 한 번에 떼어 놓는 최대 거리입니다. */
const MAX_SEPARATION = 3;
const FRICTION = 0.99;

/** 벽이나 장애물을 이루는 선분입니다. minY/maxY 는 충돌 검사를 빨리 걸러내려고 미리 담아 둡니다. */
export type Segment = {
  ax: number;
  ay: number;
  bx: number;
  by: number;
  minY: number;
  maxY: number;
};

/** 공이 부딪히며 튀는 둥근 못입니다. */
export type Peg = {
  x: number;
  y: number;
  radius: number;
};

/**
 * 도착 직전을 막아서는 회전 차단봉입니다.
 *
 * 가로로 누우면 통로를 완전히 막고, 세로로 서면 양옆이 열립니다.
 * 그래서 앞서 오던 공도 막힌 타이밍에 도착하면 뒤로 밀립니다.
 */
export type Gate = {
  x: number;
  y: number;
  /** 봉의 절반 길이입니다. 통로 반너비보다 조금 길어야 확실히 닫힙니다. */
  halfLength: number;
  /** 봉의 굵기(절반)입니다. */
  halfThickness: number;
  /** 지금 각도(라디안)입니다. 경주가 진행되면서 stepMarbles 가 돌립니다. */
  angle: number;
  /** 한 걸음마다 돌아가는 각도입니다. */
  speed: number;
};

export type Course = {
  width: number;
  height: number;
  /** 이 높이를 넘어서면 도착입니다. */
  finishY: number;
  /** 공이 처음 놓이는 구간입니다. */
  spawnTop: number;
  spawnBottom: number;
  segments: Segment[];
  pegs: Peg[];
  gate: Gate;
  /**
   * 높이별 바깥 벽의 범위입니다. (BOUND_STEP 간격)
   *
   * 공이 서로 심하게 밀칠 때 벽 밖으로 밀려나는 일이 아주 드물게 있었습니다.
   * 한 번 밖으로 나가면 벽에서 멀어져 다시는 돌아오지 못하므로,
   * 마지막에 이 범위로 눌러 담아 확실히 가둡니다.
   */
  boundLeft: number[];
  boundRight: number[];
};

export type Marble = {
  name: string;
  x: number;
  y: number;
  vx: number;
  vy: number;
  radius: number;
  color: string;
  finished: boolean;
};

/** 구간의 종류입니다. 매번 순서를 섞어서 코스가 늘 달라지게 합니다. */
const BAND_KINDS = ["zigzag", "plinko", "fork", "ramps", "funnel"] as const;
type BandKind = (typeof BAND_KINDS)[number];

/** 한 코스에 넣을 구간의 수입니다. 종류보다 적게 골라야 매번 조합이 달라집니다. */
const BANDS_PER_COURSE = 4;

/**
 * 구간별 통로의 모양입니다.
 * t 는 구간 안에서의 진행도(0~1)이고, 양 끝에서는 기본 폭으로 돌아와 구간끼리 이어집니다.
 */
function profileAt(kind: BandKind, t: number): { center: number; half: number } {
  if (kind === "zigzag") {
    return {
      center: CENTER + 90 * Math.sin(t * Math.PI * 3) * Math.sin(t * Math.PI),
      half: HALF - 78 * Math.sin(t * Math.PI),
    };
  }
  if (kind === "funnel") {
    return { center: CENTER, half: HALF - 105 * Math.sin(t * Math.PI) };
  }
  return { center: CENTER, half: HALF };
}

function addSegment(
  segments: Segment[],
  ax: number,
  ay: number,
  bx: number,
  by: number,
): void {
  segments.push({
    ax,
    ay,
    bx,
    by,
    minY: Math.min(ay, by),
    maxY: Math.max(ay, by),
  });
}

/** 바깥 벽 하나가 걸치는 높이 구간에 그 벽의 위치를 기록합니다. */
function recordBounds(bounds: Bounds, ax: number, ay: number, bx: number, by: number): void {
  const from = Math.floor(Math.min(ay, by) / BOUND_STEP);
  const to = Math.ceil(Math.max(ay, by) / BOUND_STEP);
  const low = Math.min(ax, bx);
  const high = Math.max(ax, bx);

  for (let cell = from; cell <= to; cell += 1) {
    if (cell < 0) {
      continue;
    }
    bounds.left[cell] = Math.min(bounds.left[cell] ?? Infinity, low);
    bounds.right[cell] = Math.max(bounds.right[cell] ?? -Infinity, high);
  }
}

type Bounds = { left: number[]; right: number[] };

/** 좌우 벽을 잘게 나눠서 이어 붙입니다. */
function addWalls(
  segments: Segment[],
  bounds: Bounds,
  yTop: number,
  height: number,
  kind: BandKind,
): void {
  const rows = Math.max(2, Math.round(height / ROW_STEP));
  let previous: { left: number; right: number; y: number } | null = null;

  for (let row = 0; row <= rows; row += 1) {
    const t = row / rows;
    const { center, half } = profileAt(kind, t);
    const point = { left: center - half, right: center + half, y: yTop + t * height };

    if (previous !== null) {
      addSegment(segments, previous.left, previous.y, point.left, point.y);
      addSegment(segments, previous.right, previous.y, point.right, point.y);
      recordBounds(bounds, previous.left, previous.y, point.left, point.y);
      recordBounds(bounds, previous.right, previous.y, point.right, point.y);
    }
    previous = point;
  }
}

/** 구간 안에 놓이는 장애물입니다. */
function addObstacles(
  segments: Segment[],
  pegs: Peg[],
  yTop: number,
  kind: BandKind,
): void {
  if (kind === "plinko") {
    // 못밭 — 공이 튀면서 좌우로 흩어집니다.
    //
    // 못과 벽 사이, 못과 못 사이의 틈은 반드시 MIN_GAP 보다 넓어야 합니다.
    // 가장 큰 공의 지름(32)보다 좁으면 공이 그 사이에 영구히 끼어서
    // 경주가 끝나지 않습니다. 실제로 그렇게 막히는 것을 확인하고 넓혔습니다.
    const pegRadius = 11;
    const firstX = CENTER - HALF + MIN_GAP + pegRadius;
    const lastX = CENTER + HALF - MIN_GAP - pegRadius;
    const spacing = MIN_GAP + pegRadius * 2;

    for (let row = 0; row < 6; row += 1) {
      const y = yTop + 90 + row * 70;
      const offset = row % 2 === 0 ? 0 : spacing / 2;
      for (let x = firstX + offset; x <= lastX; x += spacing) {
        pegs.push({ x, y, radius: pegRadius });
      }
    }
    return;
  }

  if (kind === "fork") {
    // 가운데 섬 — 왼쪽 길과 오른쪽 길로 갈립니다. 안쪽이 뚫리지 않게 닫아 둡니다.
    const apexY = yTop + 140;
    const wideY = yTop + 260;
    const bottomY = yTop + 420;
    const halfWidth = 72;
    addSegment(segments, CENTER, apexY, CENTER - halfWidth, wideY);
    addSegment(segments, CENTER - halfWidth, wideY, CENTER - halfWidth, bottomY);
    addSegment(segments, CENTER - halfWidth, bottomY, CENTER + halfWidth, bottomY);
    addSegment(segments, CENTER + halfWidth, bottomY, CENTER + halfWidth, wideY);
    addSegment(segments, CENTER + halfWidth, wideY, CENTER, apexY);
    return;
  }

  if (kind === "ramps") {
    // 미끄럼틀 — 한쪽 벽에서 뻗어 나와 반대쪽에 틈을 남깁니다.
    addSegment(segments, CENTER - HALF, yTop + 110, CENTER + 90, yTop + 180);
    addSegment(segments, CENTER + HALF, yTop + 250, CENTER - 90, yTop + 320);
    addSegment(segments, CENTER - HALF, yTop + 390, CENTER + 90, yTop + 460);
  }
}

/**
 * 마지막 깔때기와 통로입니다. 좁아지는 지점에 회전 차단봉이 있습니다.
 * 여기를 빠져나온 순서대로 순위가 정해집니다.
 */
function addFinish(
  segments: Segment[],
  bounds: Bounds,
  yTop: number,
): { finishY: number; gate: Gate } {
  const gateY = yTop + 240;
  const chuteEndY = gateY + 130;

  const walls: [number, number, number, number][] = [
    [CENTER - HALF, yTop, CENTER - GATE_HALF_WIDTH, gateY],
    [CENTER + HALF, yTop, CENTER + GATE_HALF_WIDTH, gateY],
    [CENTER - GATE_HALF_WIDTH, gateY, CENTER - GATE_HALF_WIDTH, chuteEndY],
    [CENTER + GATE_HALF_WIDTH, gateY, CENTER + GATE_HALF_WIDTH, chuteEndY],
  ];

  for (const [ax, ay, bx, by] of walls) {
    addSegment(segments, ax, ay, bx, by);
    recordBounds(bounds, ax, ay, bx, by);
  }

  const gate: Gate = {
    x: CENTER,
    y: gateY,
    // 통로보다 조금 길게 만들어야 가로로 누웠을 때 빈틈 없이 막힙니다.
    halfLength: GATE_HALF_WIDTH + 5,
    halfThickness: 5,
    // 시작 각도를 매번 달리해서 첫 판부터 결과가 갈리게 합니다.
    angle: randomBetween(0, Math.PI * 2),
    speed: (Math.PI * 2) / (GATE_PERIOD_SECONDS * 60 * SUBSTEPS * TIME_SCALE),
  };

  return { finishY: chuteEndY + 24, gate };
}

/** 코스를 새로 만듭니다. 구간 순서가 매번 달라집니다. */
export function buildCourse(): Course {
  const segments: Segment[] = [];
  const pegs: Peg[] = [];
  const bounds: Bounds = { left: [], right: [] };

  // 출발 구간 — 장애물 없이 공이 놓일 자리입니다.
  addWalls(segments, bounds, 0, START_HEIGHT, "plinko");

  // 다섯 종류 중 네 개를 골라 씁니다. 매번 종류도 순서도 달라집니다.
  // (다섯 개를 다 쓰면 뒤쪽 공들이 차단봉 앞에 줄 서는 시간까지 더해져 제한 시간을 넘깁니다.)
  let y = START_HEIGHT;
  for (const kind of shuffle(BAND_KINDS).slice(0, BANDS_PER_COURSE)) {
    addWalls(segments, bounds, y, BAND_HEIGHT, kind);
    addObstacles(segments, pegs, y, kind);
    y += BAND_HEIGHT;
  }

  const { finishY, gate } = addFinish(segments, bounds, y);

  return {
    width: COURSE_WIDTH,
    height: y + FINISH_HEIGHT,
    finishY,
    spawnTop: 30,
    spawnBottom: START_HEIGHT - 40,
    segments,
    pegs,
    gate,
    boundLeft: bounds.left,
    boundRight: bounds.right,
  };
}

/** 회전 차단봉의 양 끝 좌표입니다. 그리기와 충돌 계산이 같은 값을 씁니다. */
export function gateEnds(gate: Gate): { ax: number; ay: number; bx: number; by: number } {
  const cos = Math.cos(gate.angle);
  const sin = Math.sin(gate.angle);
  return {
    ax: gate.x - cos * gate.halfLength,
    ay: gate.y - sin * gate.halfLength,
    bx: gate.x + cos * gate.halfLength,
    by: gate.y + sin * gate.halfLength,
  };
}

/** 인원에 맞는 공 크기입니다. 많을수록 작아집니다. */
function radiusFor(count: number): number {
  if (count <= 6) {
    return 16;
  }
  if (count <= 12) {
    return 14;
  }
  if (count <= 20) {
    return 12;
  }
  return 10;
}

/** 참가자 한 명과 그 사람의 공 색입니다. */
export type MarbleEntry = {
  name: string;
  color: string;
};

/** hsl 값을 컬러피커가 쓸 수 있는 #rrggbb 로 바꿉니다. */
function hslToHex(hue: number, saturation: number, lightness: number): string {
  const chroma = saturation * Math.min(lightness, 1 - lightness);
  const channel = (offset: number): string => {
    const k = (offset + hue / 30) % 12;
    const value = lightness - chroma * Math.max(-1, Math.min(k - 3, 9 - k, 1));
    return Math.round(255 * value)
      .toString(16)
      .padStart(2, "0");
  };
  return `#${channel(0)}${channel(8)}${channel(4)}`;
}

/** 색을 따로 고르지 않았을 때 쓰는 기본 색입니다. 서로 잘 구분되게 고르게 나눕니다. */
export function defaultMarbleColor(index: number, total: number): string {
  return hslToHex(Math.round((360 / Math.max(total, 1)) * index), 0.68, 0.55);
}

/**
 * 공을 만들어 출발 자리에 놓습니다.
 *
 * **출발 자리는 여기서 무작위로 섞여 배정됩니다.** 어느 자리가 유리하든
 * 그 자리에 설 사람이 고르게 정해지므로 결과가 공평해집니다.
 */
export function createMarbles(entries: readonly MarbleEntry[], course: Course): Marble[] {
  const radius = radiusFor(entries.length);
  const spacing = radius * 2 + 6;
  const usableWidth = HALF * 2 - spacing;
  const perRow = Math.max(1, Math.floor(usableWidth / spacing));
  const mixedEntries = shuffle(entries);

  return mixedEntries.map((entry, slot) => {
    const column = slot % perRow;
    const row = Math.floor(slot / perRow);
    const rowWidth = spacing * perRow;

    return {
      name: entry.name,
      x: CENTER - rowWidth / 2 + spacing * (column + 0.5) + wobble(3),
      y: course.spawnTop + row * spacing + randomBetween(0, 6),
      vx: randomBetween(-1.2, 1.2),
      vy: 0,
      radius,
      color: entry.color,
      finished: false,
    };
  });
}

/** 공이 선분에 닿으면 밀어내고 튕깁니다. */
function collideSegment(marble: Marble, segment: Segment): void {
  const dx = segment.bx - segment.ax;
  const dy = segment.by - segment.ay;
  const lengthSquared = dx * dx + dy * dy;

  // 선분 위에서 공과 가장 가까운 지점을 찾습니다.
  let t =
    lengthSquared === 0
      ? 0
      : ((marble.x - segment.ax) * dx + (marble.y - segment.ay) * dy) / lengthSquared;
  t = Math.max(0, Math.min(1, t));

  const closestX = segment.ax + t * dx;
  const closestY = segment.ay + t * dy;

  let nx = marble.x - closestX;
  let ny = marble.y - closestY;
  const distance = Math.hypot(nx, ny);
  if (distance >= marble.radius) {
    return;
  }

  if (distance < 0.0001) {
    // 선분 위에 정확히 겹친 경우입니다. 위쪽으로 밀어냅니다.
    nx = 0;
    ny = -1;
  } else {
    nx /= distance;
    ny /= distance;
  }

  marble.x = closestX + nx * marble.radius;
  marble.y = closestY + ny * marble.radius;

  const intoWall = marble.vx * nx + marble.vy * ny;
  if (intoWall < 0) {
    marble.vx -= (1 + WALL_BOUNCE) * intoWall * nx;
    marble.vy -= (1 + WALL_BOUNCE) * intoWall * ny;
    marble.vx *= FRICTION;
    marble.vy *= FRICTION;
  }
}

/** 공이 못에 닿으면 튕깁니다. */
function collidePeg(marble: Marble, peg: Peg): void {
  const dx = marble.x - peg.x;
  const dy = marble.y - peg.y;
  const minimum = marble.radius + peg.radius;
  const distance = Math.hypot(dx, dy);
  if (distance >= minimum) {
    return;
  }

  const nx = distance < 0.0001 ? 0 : dx / distance;
  const ny = distance < 0.0001 ? -1 : dy / distance;
  marble.x = peg.x + nx * minimum;
  marble.y = peg.y + ny * minimum;

  const intoPeg = marble.vx * nx + marble.vy * ny;
  if (intoPeg < 0) {
    marble.vx -= (1 + PEG_BOUNCE) * intoPeg * nx;
    marble.vy -= (1 + PEG_BOUNCE) * intoPeg * ny;
  }
}

/**
 * 회전 차단봉에 부딪힌 것을 처리합니다.
 *
 * 봉은 공에 밀리지 않고 제 속도로 계속 돕니다.
 * 그래서 닿은 지점에서 봉이 움직이는 속도를 기준으로 튕겨 내야
 * 공이 봉에 얹혀 끌려가거나 옆으로 튕겨 나갑니다.
 */
function collideGate(marble: Marble, gate: Gate): void {
  const { ax, ay, bx, by } = gateEnds(gate);
  const dx = bx - ax;
  const dy = by - ay;
  const lengthSquared = dx * dx + dy * dy;

  let t = lengthSquared === 0 ? 0 : ((marble.x - ax) * dx + (marble.y - ay) * dy) / lengthSquared;
  t = Math.max(0, Math.min(1, t));

  const closestX = ax + t * dx;
  const closestY = ay + t * dy;

  let nx = marble.x - closestX;
  let ny = marble.y - closestY;
  const distance = Math.hypot(nx, ny);
  const minimum = marble.radius + gate.halfThickness;
  if (distance >= minimum) {
    return;
  }

  if (distance < 0.0001) {
    nx = 0;
    ny = -1;
  } else {
    nx /= distance;
    ny /= distance;
  }

  marble.x = closestX + nx * minimum;
  marble.y = closestY + ny * minimum;

  // 닿은 지점에서 봉이 움직이는 속도입니다. (회전축에서의 거리 × 각속도)
  const armX = closestX - gate.x;
  const armY = closestY - gate.y;
  const surfaceVx = -gate.speed * armY;
  const surfaceVy = gate.speed * armX;

  const approaching = (marble.vx - surfaceVx) * nx + (marble.vy - surfaceVy) * ny;
  if (approaching < 0) {
    marble.vx -= (1 + GATE_BOUNCE) * approaching * nx;
    marble.vy -= (1 + GATE_BOUNCE) * approaching * ny;
  }
}

/** 공끼리 겹치면 서로 밀어냅니다. */
function collideMarbles(marbles: readonly Marble[]): void {
  for (let i = 0; i < marbles.length; i += 1) {
    const a = marbles[i];
    if (a.finished) {
      continue;
    }
    for (let j = i + 1; j < marbles.length; j += 1) {
      const b = marbles[j];
      if (b.finished) {
        continue;
      }

      const dx = b.x - a.x;
      const dy = b.y - a.y;
      const distance = Math.hypot(dx, dy);
      const overlap = a.radius + b.radius - distance;
      if (overlap <= 0 || distance < 0.0001) {
        continue;
      }

      const nx = dx / distance;
      const ny = dy / distance;
      // 한 번에 크게 밀면 공이 벽을 넘어가 버립니다. 조금씩만 떼어 놓습니다.
      const push = Math.min(overlap, MAX_SEPARATION) / 2;
      a.x -= nx * push;
      a.y -= ny * push;
      b.x += nx * push;
      b.y += ny * push;

      const closing = (b.vx - a.vx) * nx + (b.vy - a.vy) * ny;
      if (closing > 0) {
        continue;
      }
      const impulse = -closing * MARBLE_BOUNCE;
      a.vx -= impulse * nx;
      a.vy -= impulse * ny;
      b.vx += impulse * nx;
      b.vy += impulse * ny;
    }
  }
}

/** 벽과 못에 부딪힌 것을 정리합니다. */
function resolveWorld(course: Course, marbles: readonly Marble[]): void {
  for (const marble of marbles) {
    // 도착선 아래는 벽이 없습니다. 그대로 떨어지게 둡니다.
    if (marble.finished || marble.y > course.finishY) {
      continue;
    }

    for (const segment of course.segments) {
      if (marble.y + marble.radius < segment.minY || marble.y - marble.radius > segment.maxY) {
        continue;
      }
      collideSegment(marble, segment);
    }

    for (const peg of course.pegs) {
      if (Math.abs(marble.y - peg.y) > marble.radius + peg.radius) {
        continue;
      }
      collidePeg(marble, peg);
    }

    const gate = course.gate;
    if (Math.abs(marble.y - gate.y) <= gate.halfLength + marble.radius + gate.halfThickness) {
      collideGate(marble, gate);
    }
  }
}

/**
 * 공을 바깥 벽 안쪽으로 눌러 담습니다.
 *
 * 벽 판정은 공이 벽 가까이 있을 때만 동작합니다. 공끼리 세게 밀쳐서
 * 한 번에 벽 밖으로 넘어가 버리면 다시 돌아올 방법이 없기 때문에,
 * 마지막에 이 검사로 확실히 막습니다.
 */
function containMarbles(course: Course, marbles: readonly Marble[]): void {
  const lastCell = course.boundLeft.length - 1;

  for (const marble of marbles) {
    if (marble.finished || marble.y > course.finishY) {
      continue;
    }

    const cell = Math.max(0, Math.min(lastCell, Math.floor(marble.y / BOUND_STEP)));
    const left = course.boundLeft[cell];
    const right = course.boundRight[cell];
    if (left === undefined || right === undefined) {
      continue;
    }

    const minX = left + marble.radius;
    const maxX = right - marble.radius;
    if (minX >= maxX) {
      continue;
    }

    if (marble.x < minX) {
      marble.x = minX;
      marble.vx = Math.abs(marble.vx) * 0.3;
    } else if (marble.x > maxX) {
      marble.x = maxX;
      marble.vx = -Math.abs(marble.vx) * 0.3;
    }
  }
}

/**
 * 한 걸음 만큼 공을 움직입니다.
 * 이번 걸음에 도착선을 넘은 공들의 번호를 **들어온 순서대로** 돌려줍니다.
 */
export function stepMarbles(course: Course, marbles: Marble[]): number[] {
  for (let sub = 0; sub < SUBSTEPS; sub += 1) {
    // 차단봉은 공과 상관없이 제 속도로 계속 돕니다.
    course.gate.angle += course.gate.speed * TIME_SCALE;

    for (const marble of marbles) {
      if (marble.finished) {
        continue;
      }

      marble.vy += GRAVITY * TIME_SCALE;
      // 벽 사이에 딱 끼어 멈추는 것을 막는 아주 작은 흔들림입니다.
      marble.vx += wobble(0.06) * TIME_SCALE;

      const speed = Math.hypot(marble.vx, marble.vy);
      if (speed > MAX_SPEED) {
        marble.vx = (marble.vx / speed) * MAX_SPEED;
        marble.vy = (marble.vy / speed) * MAX_SPEED;
      }

      marble.x += marble.vx * TIME_SCALE;
      marble.y += marble.vy * TIME_SCALE;
    }

    // 좁은 구간에서 공끼리 밀치다 보면 벽 밖으로 밀려날 수 있습니다.
    // 그래서 공끼리 먼저 정리하고, 벽이 마지막에 결정하도록 순서를 둡니다.
    collideMarbles(marbles);
    resolveWorld(course, marbles);
    resolveWorld(course, marbles);
    containMarbles(course, marbles);
  }

  // 도착선을 지난 공을 골라냅니다. 더 깊이 내려간 공이 앞 순위입니다.
  const arrived: number[] = [];
  for (let index = 0; index < marbles.length; index += 1) {
    if (!marbles[index].finished && marbles[index].y > course.finishY) {
      arrived.push(index);
    }
  }
  arrived.sort((a, b) => marbles[b].y - marbles[a].y);

  for (const index of arrived) {
    marbles[index].finished = true;
  }

  return arrived;
}

/** 화면이 따라갈 공입니다 — 아직 도착하지 않은 공 중 가장 아래에 있는 공. */
export function leadingMarble(marbles: readonly Marble[]): Marble | null {
  let leader: Marble | null = null;
  for (const marble of marbles) {
    if (marble.finished) {
      continue;
    }
    if (leader === null || marble.y > leader.y) {
      leader = marble;
    }
  }
  return leader;
}

/**
 * 제한 시간이 다 되면 남은 공에 순위를 매기고 경주를 끝냅니다.
 *
 * 도착선에 가까운(= 더 아래로 내려간) 공부터 앞 순위를 받습니다.
 * 이름은 이미 무작위로 배정되어 있으므로 이렇게 끝내도 확률은 공평합니다.
 */
export function finishRemaining(marbles: Marble[]): number[] {
  const remaining: number[] = [];
  for (let index = 0; index < marbles.length; index += 1) {
    if (!marbles[index].finished) {
      remaining.push(index);
    }
  }
  remaining.sort((a, b) => marbles[b].y - marbles[a].y);

  for (const index of remaining) {
    marbles[index].finished = true;
  }

  return remaining;
}

/** 한 코스에 들어가는 구간의 개수입니다. */
export const BAND_COUNT = BANDS_PER_COURSE;
