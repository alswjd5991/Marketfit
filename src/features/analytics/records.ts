import type { CategoryGroup } from "@/features/events/category-group";

/** 참가 완료 + 매출 기록이 있는 참가 1건(여러 가게의 기록을 모은 분석용 행). */
export interface AttendedRecord {
  storeId: string;
  eventId: string;
  revenue: number;
  startDate: string;
  endDate: string | null;
  group: CategoryGroup;
  weather: string | null;
  indoorOutdoor: string | null;
}

/** 이 기간보다 긴 행사(상설·장기 마켓)는 셀러가 실제로 며칠 나갔는지 기록이 없어 매출을 비교할 수 없다. */
export const MAX_EVENT_DAYS = 7;

export function eventDays(start: string, end: string | null): number {
  if (!end || end < start) return 1;
  return Math.round((Date.parse(end) - Date.parse(start)) / 86_400_000) + 1;
}

/** 행사 기간에 토·일요일이 하루라도 끼어 있는지. */
export function includesWeekend(start: string, end: string | null): boolean {
  const days = eventDays(start, end);
  if (days >= 7) return true;
  const first = new Date(`${start}T00:00:00Z`).getUTCDay();
  for (let i = 0; i < days; i++) {
    const d = (first + i) % 7;
    if (d === 0 || d === 6) return true;
  }
  return false;
}

export interface Exclusion {
  reason: string;
  count: number;
}

/** 조건을 통과하지 못한 행을 이유별로 세면서 거른다. */
export function filterWithReasons<T>(rows: T[], rules: [string, (r: T) => boolean][]): { kept: T[]; excluded: Exclusion[] } {
  const counts = new Map<string, number>();
  const kept = rows.filter((r) => {
    const failed = rules.find(([, ok]) => !ok(r));
    if (failed) counts.set(failed[0], (counts.get(failed[0]) ?? 0) + 1);
    return !failed;
  });
  return { kept, excluded: [...counts].map(([reason, count]) => ({ reason, count })) };
}

/** 기록이 minPerStore건 미만인 가게를 뺀다(가게 고정효과 모형에서 1건짜리 가게는 정보가 없다). */
export function dropSmallStores<T extends { storeId: string }>(rows: T[], minPerStore: number): { kept: T[]; dropped: number } {
  const counts = new Map<string, number>();
  for (const r of rows) counts.set(r.storeId, (counts.get(r.storeId) ?? 0) + 1);
  const kept = rows.filter((r) => counts.get(r.storeId)! >= minPerStore);
  return { kept, dropped: rows.length - kept.length };
}

/**
 * 행사 유형 범주 정하기: 기록이 충분하고(≥ minCount) 그 유형과 다른 유형을 모두 경험한 가게가
 * minStores곳 이상인 유형만 따로 추정한다. 나머지는 "기타 유형" 하나로 묶는다(따로 해석하지 않는 통제용 범주).
 * 기준 범주는 기록이 가장 많은 유형.
 */
export function groupLevels(rows: AttendedRecord[], minCount = 10, minStores = 3, minEvents = 5): { reference: CategoryGroup; own: CategoryGroup[]; levelOf: (g: CategoryGroup) => string } {
  const count = new Map<CategoryGroup, number>();
  const events = new Map<CategoryGroup, Set<string>>();
  const storeGroups = new Map<string, Set<CategoryGroup>>();
  for (const r of rows) {
    count.set(r.group, (count.get(r.group) ?? 0) + 1);
    events.set(r.group, (events.get(r.group) ?? new Set()).add(r.eventId));
    storeGroups.set(r.storeId, (storeGroups.get(r.storeId) ?? new Set()).add(r.group));
  }
  const sorted = [...count].sort((a, b) => b[1] - a[1]);
  const reference = sorted[0]?.[0] ?? "플리마켓";
  const mixedStores = (g: CategoryGroup) => [...storeGroups.values()].filter((s) => s.has(g) && s.size > 1).length;
  // 유형은 행사 단위 속성이라 행사 수도 따진다(행사 몇 곳뿐인 유형의 차이는 그 행사들의 특수성과 구분되지 않음).
  const own = sorted.slice(1).filter(([g, c]) => c >= minCount && mixedStores(g) >= minStores && events.get(g)!.size >= minEvents).map(([g]) => g);
  return { reference, own, levelOf: (g) => (g === reference ? "ref" : own.includes(g) ? g : "기타 유형") };
}
