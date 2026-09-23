// 행사 카테고리별 "포스터" 비주얼 테마.
//
// 실제 행사 포스터 사진은 갖고 있지 않다(공개 모집공고를 코딩한 텍스트
// 데이터일 뿐, 이미지 저작권도 없음 — 65번 원칙: 없는 데이터를 있는 것처럼
// 보여주지 않는다). 그래서 진짜 사진 대신, 카테고리마다 고정된 색·아이콘
// 조합의 그래픽 포스터를 만든다 — AI 이미지 생성 특유의 흐릿한 그라디언트
// 블롭이나 어색한 합성 사진 대신, 짙은 단색 배경 + 굵은 도형 + 모노라인
// 아이콘으로 잡지 화보 같은 느낌을 낸다(레퍼런스: land-book.com의
// Your Creative — 굵은 도형과 색 블록, Juliet Creative — 짙은 단색 배경 위
// 큰 아이콘 하나 + 스티커 배지).
//
// 대시보드의 CATEGORY_COLOR(src/app/dashboard/page.tsx)와는 목적이 다르다
// — 그쪽은 여러 막대를 한 화면에서 구분하는 카테고리컬 데이터 팔레트이고,
// 이쪽은 짙은 배경 위에 흰 아이콘이 선명히 보이도록 고른 "포스터"용
// 톤(다크 bg + 그 위에 올릴 밝은 pop 색)이다.
export type PosterIconKey =
  | "tote"
  | "flag"
  | "gift"
  | "moon"
  | "cap"
  | "palette"
  | "bowl"
  | "leaf"
  | "scissors"
  | "hanger"
  | "gem"
  | "tag"
  | "stall";

export interface PosterTheme {
  bg: string;
  pop: string;
  icon: PosterIconKey;
}

// 시딩 데이터(src/lib/data/seed-events.ts)에 실제 등장하는 category 값 +
// events/data.ts의 categoryFromItems() 폴백값을 모두 커버한다.
const THEME_BY_CATEGORY: Record<string, PosterTheme> = {
  플리마켓: { bg: "#1c3a34", pop: "#b6e34f", icon: "tote" },
  "축제 판매부스": { bg: "#6b2b1f", pop: "#ff8a4c", icon: "flag" },
  시즌마켓: { bg: "#3a2a5c", pop: "#c9a6ff", icon: "gift" },
  야시장: { bg: "#14213d", pop: "#ffd166", icon: "moon" },
  "대학 마켓": { bg: "#1f2937", pop: "#7dd3fc", icon: "cap" },
  아트마켓: { bg: "#4a1942", pop: "#ff6fae", icon: "palette" },
  음식: { bg: "#7a2e2e", pop: "#ffb703", icon: "bowl" },
  농산물: { bg: "#234d20", pop: "#a7d129", icon: "leaf" },
  수공예: { bg: "#5c4630", pop: "#f2c14e", icon: "scissors" },
  패션: { bg: "#241b2f", pop: "#e879f9", icon: "hanger" },
  액세서리: { bg: "#33261a", pop: "#f4b942", icon: "gem" },
  참고: { bg: "#33363b", pop: "#d4d4d4", icon: "tag" },
};

// 목록에 없는 카테고리(향후 새 카테고리, "기타" 등)를 위한 중립 톤.
const DEFAULT_THEME: PosterTheme = { bg: "#33363b", pop: "#d4d4d4", icon: "stall" };

export function getPosterTheme(category: string | null | undefined): PosterTheme {
  if (!category) return DEFAULT_THEME;
  return THEME_BY_CATEGORY[category] ?? DEFAULT_THEME;
}

/**
 * 문자열을 0~1 사이 안정적인 의사난수로 변환한다. 행사 id를 시드로 써서
 * 같은 행사는 새로고침해도 항상 같은 블롭 회전·위치를 갖게 한다(매번
 * 랜덤하게 흔들리면 "AI가 매번 새로 그린" 느낌이 나서 오히려 안 좋음).
 */
export function seededUnit(seed: string): number {
  let hash = 0;
  for (let i = 0; i < seed.length; i++) {
    hash = (hash << 5) - hash + seed.charCodeAt(i);
    hash |= 0;
  }
  return (Math.abs(hash) % 1000) / 1000;
}
