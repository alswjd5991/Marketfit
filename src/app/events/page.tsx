import { getCategories, getEvents, getRegions } from "@/features/events/data";
import type { EventPeriod, EventSort } from "@/features/events/data";
import { EventCard } from "@/features/events/event-card";
import { EventFiltersBar } from "@/features/events/filters-bar";
import type { RecruitmentStatus } from "@/types/database";

export default async function EventsPage(props: PageProps<"/events">) {
  const sp = await props.searchParams;
  const region = firstParam(sp.region);
  const category = firstParam(sp.category);
  const status = firstParam(sp.status) as RecruitmentStatus | undefined;
  const query = firstParam(sp.q);
  const period = firstParam(sp.period) as EventPeriod | undefined;
  const sort = firstParam(sp.sort) as EventSort | undefined;
  const dateFrom = firstParam(sp.from);
  const dateTo = firstParam(sp.to);

  const [events, regions, categories] = await Promise.all([
    getEvents({ region, category, status, query, period, sort, dateFrom, dateTo }),
    getRegions(),
    getCategories(),
  ]);

  return (
    <div className="min-h-screen bg-[linear-gradient(135deg,#FFECD0_0%,#F4F9FD_30%,#DCEEFF_68%,#F6FAFD_100%)]">
    <div className="mx-auto w-full max-w-6xl px-6 py-10 lg:px-8">
      <div className="mb-6 flex flex-wrap items-baseline gap-x-3 gap-y-1">
        <h1 className="text-2xl font-bold text-neutral-950">행사 찾기</h1>
        <p className="text-sm text-neutral-500">
          전국 소상공인·셀러 모집 공고 {events.length}건 · 마감된 공고도 검색 가능
        </p>
      </div>

      <EventFiltersBar regions={regions} categories={categories} />

      {events.length === 0 ? (
        <p className="py-16 text-center text-sm text-neutral-400">
          조건에 맞는 행사 없음 · 필터 조정 필요
        </p>
      ) : (
        <div className="mt-8 grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-3 lg:gap-8">
          {events.map((e) => (
            <EventCard key={e.id} event={e} />
          ))}
        </div>
      )}
    </div>
    </div>
  );
}

function firstParam(v: string | string[] | undefined) {
  if (Array.isArray(v)) return v[0];
  return v || undefined;
}
