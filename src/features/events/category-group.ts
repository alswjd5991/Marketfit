// 필터·대시보드에 쓰는 대분류 6종. seed-events.ts의 category 원문(21종)은
// 카드·상세페이지 배지에 그대로 표시하고, 여기서는 그걸 필터링·통계용으로만
// 묶는다 — 원문 문구를 지우거나 바꾸지 않는다.
export type CategoryGroup = "플리마켓" | "축제 부스" | "시즌마켓" | "야시장" | "대학 마켓" | "아트·디자인 마켓";

export const CATEGORY_GROUPS: CategoryGroup[] = [
  "플리마켓",
  "축제 부스",
  "시즌마켓",
  "대학 마켓",
  "야시장",
  "아트·디자인 마켓",
];

const GROUP_BY_CATEGORY: Record<string, CategoryGroup> = {
  플리마켓: "플리마켓",
  "로컬 플리마켓": "플리마켓",
  로컬마켓: "플리마켓",
  브랜드마켓: "플리마켓",
  "가정셀러 플리마켓": "플리마켓",
  "자원순환 마켓": "플리마켓",
  "축제 판매부스": "축제 부스",
  "지역축제 장터": "축제 부스",
  "축제 판매·체험부스": "축제 부스",
  "축제 셀러": "축제 부스",
  지역축제: "축제 부스",
  "전시·체험부스": "축제 부스",
  "먹거리부스·푸드트럭": "축제 부스",
  시즌마켓: "시즌마켓",
  "관광기념품 박람회": "시즌마켓",
  "대학 마켓": "대학 마켓",
  "대학축제 플리마켓": "대학 마켓",
  야시장: "야시장",
  아트마켓: "아트·디자인 마켓",
  "디자인 마켓": "아트·디자인 마켓",
  "북마켓·콘텐츠 부스": "아트·디자인 마켓",
};

// category 원문이 없는 원공고는 행사명 문구로 추정한다. 순서가 중요하다 —
// "프리마켓"처럼 이름에 "마켓"이 들어가지만 실제론 야시장·박람회인 경우가
// 있어서, 더 구체적인 패턴을 먼저 본다.
function groupFromName(name: string): CategoryGroup {
  if (/야시장/.test(name)) return "야시장";
  if (/박람회/.test(name)) return "시즌마켓";
  if (/플리마켓|마켓/.test(name)) return "플리마켓";
  if (/축제|페스티벌/.test(name)) return "축제 부스";
  return "플리마켓";
}

export function getCategoryGroup(category: string | null, name: string): CategoryGroup {
  if (category && GROUP_BY_CATEGORY[category]) return GROUP_BY_CATEGORY[category];
  return groupFromName(name);
}
