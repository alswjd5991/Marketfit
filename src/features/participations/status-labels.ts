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
