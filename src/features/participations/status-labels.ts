import type { ParticipationStatus } from "@/types/database";

// 참가 상태는 화면에서 관심 → 참가 예정 → 참가 완료 3단계와 '미참여'만 쓴다.
// '미참여'(DB의 cancelled)는 관심·참가 예정인 채로 행사 기간이 지나면 자동으로 바뀌는 상태다(status-rules.ts).
// DB enum에는 예전 상태(신청 예정·신청 완료)가 남아 있어서,
// 그 기록은 toDisplayStatus로 가까운 단계 하나로 보여준다.
export const STATUS_ORDER: ParticipationStatus[] = ["interested", "planning_to_attend", "attended", "cancelled"];

export function toDisplayStatus(status: ParticipationStatus): ParticipationStatus {
  if (status === "planning_to_apply" || status === "applied") return "planning_to_attend";
  return status;
}

export const STATUS_LABEL: Record<ParticipationStatus, string> = {
  interested: "관심",
  planning_to_apply: "참가 예정",
  applied: "참가 예정",
  planning_to_attend: "참가 예정",
  attended: "참가 완료",
  cancelled: "미참여",
};

// 참가 상태 고유 색: 관심=노랑, 참가 예정=초록, 참가 완료=빨강 — 배지·퍼널·대시보드 카드가 같이 쓴다.
// 예전 상태는 화면에서 합쳐지는 단계와 같은 색(신청 예정·신청 완료 → 초록). 미참여는 회색.
const YELLOW = "bg-[#FFF3B8] text-[#7A6100]";
const GREEN = "bg-[#DDF0E4] text-[#2B6A4C]";
const RED = "bg-[#FFE1DA] text-[#B8352A]";
const GRAY = "bg-[#E7ECF0] text-[#5B6E7E]";
export const STATUS_BADGE_CLASS: Record<ParticipationStatus, string> = {
  interested: YELLOW,
  planning_to_apply: GREEN,
  applied: GREEN,
  planning_to_attend: GREEN,
  attended: RED,
  cancelled: GRAY,
};

/** 면(퍼널 층·비율 막대)에 칠하는 파스텔 상태 색 + 그 위 글자색. 배지와 같은 색 계열. */
export const STATUS_FILL = {
  interested: { bg: "#FFF1B8", ink: "#7A6100" },
  planning_to_attend: { bg: "#CDEFD9", ink: "#2B6A4C" },
  attended: { bg: "#FBD5CD", ink: "#A8392C" },
  cancelled: { bg: "#E3E8EC", ink: "#5B6E7E" },
} as const;
