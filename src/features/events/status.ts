import type { RecruitmentStatus } from "@/types/database";

/**
 * 50번 항목: 모집 상태는 사람이 입력하지 않고 날짜로 자동 계산한다.
 *   today < recruitStart            -> upcoming (모집 예정)
 *   recruitStart <= today <= recruitEnd -> open (모집 중)
 *   today > recruitEnd              -> closed (모집 종료)
 * recruitStart가 없으면 recruitEnd만으로 판단하고, 그마저 없으면 행사
 * 종료일(endDate) 기준으로 대체한다. `statusOverride`가 있으면(원본 공고의
 * 조기마감 등) 날짜 계산보다 우선한다.
 */
export function computeRecruitmentStatus(params: {
  recruitStart?: string | null;
  recruitEnd?: string | null;
  eventEndDate?: string | null;
  statusOverride?: RecruitmentStatus | null;
  now?: Date;
}): RecruitmentStatus {
  if (params.statusOverride) return params.statusOverride;

  const now = params.now ?? new Date();
  const today = new Date(now.toISOString().slice(0, 10));

  const start = params.recruitStart ? new Date(params.recruitStart) : null;
  const end = params.recruitEnd ? new Date(params.recruitEnd) : null;
  const eventEnd = params.eventEndDate ? new Date(params.eventEndDate) : null;

  if (start && today < start) return "upcoming";
  if (end) return today > end ? "closed" : "open";
  if (eventEnd) return today > eventEnd ? "closed" : "open";

  // 날짜 정보가 전혀 없으면 안전하게 "모집 중"으로 두지 않고 종료 취급하지도
  // 않는다 — 표시할 근거가 없다는 뜻이므로 open으로 두되, 화면에서 D-Day 대신
  // "미기재"를 보여주도록 한다(호출부 책임).
  return "open";
}

export function formatDday(recruitEnd?: string | null, now = new Date()): string | null {
  if (!recruitEnd) return null;
  const today = new Date(now.toISOString().slice(0, 10));
  const end = new Date(recruitEnd);
  const diffDays = Math.round((end.getTime() - today.getTime()) / 86_400_000);
  if (diffDays < 0) return null; // 마감 후엔 D-Day 대신 "마감" 배지를 쓴다
  if (diffDays === 0) return "D-Day";
  return `D-${diffDays}`;
}
