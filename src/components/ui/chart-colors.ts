// 차트 공통 색. 노을(코랄·피치)·하늘(스카이 블루)·민트·햇살 톤으로 사이트 배경과 어울리게 고르고,
// dataviz 스킬의 validate_palette.js로 색약 구분·밝기 검사를 통과한 순서다 — 섞거나 건너뛰지 않는다.
// (앞쪽 몇 색은 배경 대비가 3:1 미만이라 범례·툴팁·값 표시와 함께 쓴다.)
export const SERIES_COLORS = ["#3F9BD3", "#F2836B", "#8A7FD6", "#2E9C83", "#E0A82E", "#D57BA8", "#2F6FB8", "#B9783E"];

/** 단일 막대 차트 색 — 차트마다 다르게 둬서 한눈에 구분되게: 기본=하늘, 참가 수=민트. */
export const BAR_COLOR = "#7DBFE8";
export const COUNT_BAR_COLOR = "#7FCBB2";
/** 매출 막대와 함께 그리는 순이익 선(노을 코랄). */
export const LINE_COLOR = "#F2836B";

/** 손익처럼 좋음/나쁨을 뜻할 때만 쓰는 상태 색(사이트의 민트·자몽 계열). */
export const STATUS_COLORS = { good: "#3F7A64", critical: "#BE3A2A" };
