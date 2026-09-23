import { getCategories, getEvents, getRegions } from "@/features/events/data";
import { EventCard } from "@/features/events/event-card";
import { EventFiltersBar } from "@/features/events/filters-bar";
import type { RecruitmentStatus } from "@/types/database";

export default async function EventsPage(props: PageProps<"/events">) {
  const sp = await props.searchParams;
  const region = firstParam(sp.region);
  const category = firstParam(sp.category);
  const status = firstParam(sp.status) as RecruitmentStatus | undefined;
  const query = firstParam(sp.q);

  const [events, regions, categories] = await Promise.all([
    getEvents({ region, category, status, query }),
    getRegions(),
    getCategories(),
  ]);

  return (
    <div className="mx-auto max-w-6xl px-4 py-8">
      <h1 className="mb-1 text-2xl font-bold text-neutral-950">행사 찾기</h1>
      <p className="mb-6 text-sm text-neutral-500">
        전국 소상공인·셀러 모집 공고 {events.length}건 (마감된 공고도 계속
        검색할 수 있습니다)
      </p>

      <EventFiltersBar regions={regions} categories={categories} />

      {events.length === 0 ? (
        <p className="py-16 text-center text-sm text-neutral-400">
          조건에 맞는 행사가 없습니다. 필터를 조정해 보세요.
        </p>
      ) : (
        <div className="mt-6 grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {events.map((e) => (
            <EventCard key={e.id} event={e} />
          ))}
        </div>
      )}
    </div>
  );
}

function firstParam(v: string | string[] | undefined) {
  if (Array.isArray(v)) return v[0];
  return v || undefined;
}
