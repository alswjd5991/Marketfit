// "use server" 파일(actions.ts)은 async 함수만 export할 수 있으므로
// 상수는 별도 파일로 분리한다.
export const STORE_CATEGORIES = [
  "음식",
  "디저트",
  "농산물",
  "수공예",
  "패션",
  "액세서리",
  "생활용품",
  "반려동물",
  "기타",
] as const;

/** 위생교육 이수 여부를 물어볼 카테고리(식품위생법상 실제로 관련 있는 범주만) */
export const HYGIENE_RELEVANT_CATEGORIES: readonly string[] = ["음식", "디저트", "농산물"];

// 2026-09-24 추가: 다른 마켓 신청서·판매자 프로필 조사 결과 반영(0002 마이그레이션).
// 가게가 "지원하는" 결제수단과, 행사 현장에서 "실제 쓴" 결제수단(participations)이
// 다를 수 있어 두 곳에서 같은 상수를 공유해 선택지를 통일한다.
export const PAYMENT_METHODS = ["현금", "카드", "계좌이체", "모바일결제(제로페이 등)"] as const;

export const BOOTH_PROVIDED_OPTIONS = [
  { value: "organizer", label: "주최측 제공" },
  { value: "self", label: "자비 지참" },
] as const;
