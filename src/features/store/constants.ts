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
