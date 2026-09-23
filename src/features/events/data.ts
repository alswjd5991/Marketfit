import { seedEvents, type SeedEvent } from "@/lib/data/seed-events";
import { computeRecruitmentStatus, formatDday } from "./status";
import type { RecruitmentStatus } from "@/types/database";

export interface EventListItem {
  id: string;
  name: string;
  region: string | null;
  venue: string | null;
  category: string | null;
  organizer: string | null;
  startDate: string | null;
  endDate: string | null;
  recruitStart: string | null;
  recruitEnd: string | null;
  fee: number | null;
  status: RecruitmentStatus;
  dday: string | null;
  sourceName: string | null;
  sourceUrl: string | null;
  isSampleData: boolean;
}

// TODO(Supabase 연결 후): 아래 두 함수의 구현만 교체하면 나머지 화면 코드는
// 그대로 동작한다 — 이 파일이 events/participations 화면과 DB 사이의 유일한
// 경계선이다.

function toListItem(e: SeedEvent): EventListItem {
  const status = computeRecruitmentStatus({
    recruitEnd: e.recruitEnd,
    eventEndDate: e.endDate,
  });
  return {
    id: e.id,
    name: e.name,
    region: e.region,
    venue: e.venue,
    category: e.category ?? categoryFromItems(e.items),
    organizer: e.organizer,
    startDate: e.startDate,
    endDate: e.endDate,
    recruitStart: null,
    recruitEnd: e.recruitEnd,
    fee: typeof e.feeKrw === "number" ? e.feeKrw : null,
    status,
    dday: status === "open" || status === "upcoming" ? formatDday(e.recruitEnd) : null,
    sourceName: e.organizer,
    sourceUrl: e.sourceUrl,
    isSampleData: false, // 42건 전부 실제 공개 자료 — 6번 섹션 참고
  };
}

function categoryFromItems(items: string | null): string | null {
  if (!items) return null;
  if (/식품|디저트|베이커리|음식/.test(items)) return "음식";
  if (/농산물|로컬푸드/.test(items)) return "농산물";
  if (/수공예|핸드메이드|공예/.test(items)) return "수공예";
  if (/의류|패션/.test(items)) return "패션";
  if (/액세서리|주얼리/.test(items)) return "액세서리";
  return "기타";
}

export type EventPeriod = "this_week" | "this_month" | "next_month" | "past" | "custom";
export type EventSort = "deadline" | "start_date" | "recent";
// "인기순"(48번 필터 항목)은 조회수·참가등록 수 같은 실제 신호가 있어야
// 의미가 있다. 그 데이터가 없는 지금은 지어내지 않고 옵션 자체를 빼둔다
// (65번 원칙: 실제 데이터 또는 명확히 구분된 샘플 데이터만 쓴다).
// Phase 3~4에서 참가/조회 데이터가 쌓이면 여기에 추가한다.

export interface EventFilters {
  region?: string;
  category?: string;
  status?: RecruitmentStatus;
  query?: string;
  period?: EventPeriod;
  dateFrom?: string;
  dateTo?: string;
  sort?: EventSort;
}

export async function getEvents(filters: EventFilters = {}): Promise<EventListItem[]> {
  let items = seedEvents.map(toListItem);

  if (filters.region) items = items.filter((e) => e.region === filters.region);
  if (filters.category) items = items.filter((e) => e.category === filters.category);
  if (filters.status) items = items.filter((e) => e.status === filters.status);
  if (filters.query) {
    const q = filters.query.trim();
    items = items.filter((e) => e.name.includes(q) || (e.venue ?? "").includes(q));
  }
  if (filters.period) items = items.filter((e) => matchesPeriod(e, filters));

  return items.sort(compareBy(filters.sort ?? "deadline"));
}

function matchesPeriod(e: EventListItem, filters: EventFilters): boolean {
  if (!e.startDate) return false;
  const start = new Date(e.startDate);
  const { start: weekStart, end: weekEnd } = weekRange(new Date());
  const now = new Date();

  switch (filters.period) {
    case "this_week":
      return start >= weekStart && start <= weekEnd;
    case "this_month":
      return start.getFullYear() === now.getFullYear() && start.getMonth() === now.getMonth();
    case "next_month": {
      const next = new Date(now.getFullYear(), now.getMonth() + 1, 1);
      return start.getFullYear() === next.getFullYear() && start.getMonth() === next.getMonth();
    }
    case "past":
      return start < now;
    case "custom": {
      if (filters.dateFrom && start < new Date(filters.dateFrom)) return false;
      if (filters.dateTo && start > new Date(filters.dateTo)) return false;
      return true;
    }
    default:
      return true;
  }
}

function weekRange(d: Date) {
  const day = d.getDay(); // 0(일)~6(토)
  const start = new Date(d);
  start.setDate(d.getDate() - day);
  const end = new Date(start);
  end.setDate(start.getDate() + 6);
  return { start, end };
}

function compareBy(sort: EventSort) {
  return (a: EventListItem, b: EventListItem) => {
    const rank = (s: RecruitmentStatus) => (s === "closed" ? 1 : 0);

    if (sort === "start_date") {
      // 행사 시작일순: 상태와 무관하게 빠른 날짜부터.
      const aStart = a.startDate ? new Date(a.startDate).getTime() : Infinity;
      const bStart = b.startDate ? new Date(b.startDate).getTime() : Infinity;
      return aStart - bStart;
    }

    if (sort === "recent") {
      // 최신 등록순: 이 데이터셋엔 실제 "등록일시"가 없어 행사 시작일이 늦은
      // 순(=최근에 열리는/열린 행사)을 근사치로 쓴다. Supabase 연결 후
      // event_recruitments.collected_at으로 교체할 것.
      const aStart = a.startDate ? new Date(a.startDate).getTime() : -Infinity;
      const bStart = b.startDate ? new Date(b.startDate).getTime() : -Infinity;
      return bStart - aStart;
    }

    // deadline(기본, 마감 임박순): 모집중/예정을 먼저, 마감일이 가까운 순.
    // 모집종료는 뒤로 보내되 "과거 최신순"(가장 최근에 마감된 것부터).
    if (rank(a.status) !== rank(b.status)) return rank(a.status) - rank(b.status);
    const aEnd = a.recruitEnd ? new Date(a.recruitEnd).getTime() : Infinity;
    const bEnd = b.recruitEnd ? new Date(b.recruitEnd).getTime() : Infinity;
    return a.status === "closed" ? bEnd - aEnd : aEnd - bEnd;
  };
}

export async function getEventById(id: string): Promise<SeedEvent | null> {
  return seedEvents.find((e) => e.id === id) ?? null;
}

export async function getRegions(): Promise<string[]> {
  const set = new Set(seedEvents.map((e) => e.region).filter(Boolean) as string[]);
  return Array.from(set).sort();
}

export async function getCategories(): Promise<string[]> {
  const set = new Set(seedEvents.map((e) => toListItem(e).category).filter(Boolean) as string[]);
  return Array.from(set).sort();
}
