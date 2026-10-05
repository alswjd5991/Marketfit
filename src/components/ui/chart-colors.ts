// 차트 공통 색. 사이트 팔레트(브랜드 블루·자몽·민트·햇살·핑크…)에서 골라
// dataviz 스킬의 validate_palette.js로 색약 구분·밝기 검사를 통과한 순서다 — 섞거나 건너뛰지 않는다.
// (노랑 #E0A100은 배경 대비가 3:1 미만이라 항상 값 라벨과 함께 쓴다.)
export const SERIES_COLORS = ["#0A78AE", "#F2542D", "#2E9C83", "#E0A100", "#E06A92", "#8C5FD0", "#B4530A", "#3A57B8"];

/** 손익처럼 좋음/나쁨을 뜻할 때만 쓰는 상태 색(사이트의 민트·자몽 계열). */
export const STATUS_COLORS = { good: "#3F7A64", critical: "#BE3A2A" };
