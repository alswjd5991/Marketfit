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

export const STATUS_ORDER: ParticipationStatus[] = [
  "interested",
  "planning_to_apply",
  "applied",
  "planning_to_attend",
  "attended",
  "cancelled",
];
