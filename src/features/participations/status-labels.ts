import type { ParticipationStatus } from "@/types/database";

// 세 화면(my-events 목록, 참가 상세, 대시보드)에서 공유하는 상태 라벨/순서.
// 여기서만 바꾸면 세 곳 다 같이 바뀐다(master-plan 원칙: 코드 재사용).
export const STATUS_LABEL: Record<ParticipationStatus, string> = {
  interested: "관심",
  planning_to_apply: "신청 예정",
  applied: "신청 완료",
  planning_to_attend: "참가 예정",
  attended: "참가 완료",
  cancelled: "참가 취소",
};

export const STATUS_ORDER: ParticipationStatus[] = [
  "interested",
  "planning_to_apply",
  "applied",
  "planning_to_attend",
  "attended",
  "cancelled",
];
