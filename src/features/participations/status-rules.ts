import type { ParticipationStatus } from "@/types/database";

/** 아직 참가가 확정되지 않은 상태. 행사 기간이 지나도 이 상태면 '미참여'(cancelled)로 바뀐다. */
export const PENDING_STATUSES: ParticipationStatus[] = ["interested", "planning_to_apply", "applied", "planning_to_attend"];

interface EventDates {
  startDate: string | null;
  endDate: string | null;
}

/** 행사의 마지막 날(종료일, 없으면 시작일). 날짜 정보가 없으면 null. */
function lastDay({ startDate, endDate }: EventDates): string | null {
  return endDate ?? startDate;
}

/** 관심·참가 예정인데 행사 기간(마지막 날)이 오늘 이전에 끝났는지. today는 "YYYY-MM-DD". */
export function isMissed(status: ParticipationStatus, dates: EventDates, today: string): boolean {
  const last = lastDay(dates);
  return PENDING_STATUSES.includes(status) && last != null && last < today;
}

/**
 * 내 행사 정렬: 진행 중·다가오는 행사는 시작일이 가까운 순으로 위에,
 * 이미 끝난 행사는 최근에 끝난 순으로 아래에. 날짜가 없는 행사는 맨 아래.
 * 참가 완료·미참여는 모두 끝난 행사라 최근 날짜 순이 된다.
 */
export function sortByEventDate<T extends EventDates>(items: T[], today: string): T[] {
  const upcoming: T[] = [];
  const past: T[] = [];
  const undated: T[] = [];
  for (const item of items) {
    const last = lastDay(item);
    if (last == null) undated.push(item);
    else if (last >= today) upcoming.push(item);
    else past.push(item);
  }
  const start = (e: EventDates) => e.startDate ?? e.endDate ?? "";
  upcoming.sort((a, b) => start(a).localeCompare(start(b)));
  past.sort((a, b) => (lastDay(b) ?? "").localeCompare(lastDay(a) ?? "") || start(b).localeCompare(start(a)));
  return [...upcoming, ...past, ...undated];
}
