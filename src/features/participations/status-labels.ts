import type { ParticipationStatus } from "@/types/database";

// 참가 상태는 화면에서 3단계(관심 → 참가 예정 → 참가 완료)만 쓴다.
// DB enum에는 예전 상태(신청 예정·신청 완료·참가 취소)가 남아 있어서,
// 그 기록은 toDisplayStatus로 가까운 3단계 중 하나로 보여준다.
export const STATUS_ORDER: ParticipationStatus[] = ["interested", "planning_to_attend", "attended"];

export function toDisplayStatus(status: ParticipationStatus): ParticipationStatus {
  if (status === "planning_to_apply" || status === "applied") return "planning_to_attend";
  if (status === "cancelled") return "interested";
  return status;
}

export const STATUS_LABEL: Record<ParticipationStatus, string> = {
  interested: "관심",
  planning_to_apply: "참가 예정",
  applied: "참가 예정",
  planning_to_attend: "참가 예정",
  attended: "참가 완료",
  cancelled: "관심",
};

// 참가 상태 고유 색: 관심=노랑, 참가 예정=초록, 참가 완료=빨강 — 배지·퍼널·대시보드 카드가 같이 쓴다.
// 예전 상태는 화면에서 합쳐지는 단계와 같은 색(신청 예정·신청 완료 → 초록, 취소 → 노랑).
const YELLOW = "bg-[#FFF3B8] text-[#7A6100]";
const GREEN = "bg-[#DDF0E4] text-[#2B6A4C]";
const RED = "bg-[#FFE1DA] text-[#B8352A]";
export const STATUS_BADGE_CLASS: Record<ParticipationStatus, string> = {
  interested: YELLOW,
  planning_to_apply: GREEN,
  applied: GREEN,
  planning_to_attend: GREEN,
  attended: RED,
  cancelled: YELLOW,
};

/** 면(퍼널 층·비율 막대)에 칠하는 파스텔 상태 색 + 그 위 글자색. 배지와 같은 색 계열. */
export const STATUS_FILL = {
  interested: { bg: "#FFF1B8", ink: "#7A6100" },
  planning_to_attend: { bg: "#CDEFD9", ink: "#2B6A4C" },
  attended: { bg: "#FBD5CD", ink: "#A8392C" },
} as const;
