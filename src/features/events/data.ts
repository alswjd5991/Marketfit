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

export interface EventFilters {
  region?: string;
  category?: string;
  status?: RecruitmentStatus;
  query?: string;
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

  // 마감 임박순: 모집중/예정을 먼저, 그 안에서 마감일이 가까운 순.
  // 모집종료는 뒤로 보내되 최신순으로.
  return items.sort((a, b) => {
    const rank = (s: RecruitmentStatus) => (s === "closed" ? 1 : 0);
    if (rank(a.status) !== rank(b.status)) return rank(a.status) - rank(b.status);
    const aEnd = a.recruitEnd ? new Date(a.recruitEnd).getTime() : Infinity;
    const bEnd = b.recruitEnd ? new Date(b.recruitEnd).getTime() : Infinity;
    return a.status === "closed" ? bEnd - aEnd : aEnd - bEnd;
  });
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
