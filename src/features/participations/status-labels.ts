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

// 참가 상태 배지 색. 진행(관심→참가 예정)은 차분한 민트가 점점 진해지고,
// 곧 참가할 '참가 예정'만 꽉 찬 색. 참가 완료는 자몽, 취소는 테두리만 남긴다.
export const STATUS_BADGE_CLASS: Record<ParticipationStatus, string> = {
  interested: "bg-[#EEF6F2] text-[#41725F]",
  planning_to_apply: "bg-[#D9EDE3] text-[#2F5F4B]",
  applied: "bg-[#B9DDCB] text-[#1F4A3A]",
  planning_to_attend: "bg-[#3F7A64] text-white",
  attended: "bg-[#FFE4DE] text-[#BE3A2A]",
  cancelled: "border border-[#DEDFE3] bg-transparent text-[#8A8D93]",
};
