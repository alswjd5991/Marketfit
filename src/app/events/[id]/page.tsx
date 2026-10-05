import { notFound } from "next/navigation";
import Link from "next/link";
import type { ReactNode } from "react";
import { Building2, CalendarDays, ChevronLeft, Clock, ExternalLink, MapPin } from "lucide-react";
import { getEventById, getPosterImage } from "@/features/events/data";
import { computeRecruitmentStatus, formatDday } from "@/features/events/status";
import { getMyParticipationStatus } from "@/features/participations/data";
import { addParticipation } from "@/features/participations/actions";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { PosterFrame } from "@/components/ui/poster-frame";
import { getCategoryGroup } from "@/features/events/category-group";

export default async function EventDetailPage(props: PageProps<"/events/[id]">) {
  const { id } = await props.params;
  const sp = await props.searchParams;
  const error = typeof sp.error === "string" ? sp.error : null;

  const event = await getEventById(id);
  if (!event) notFound();

  const status = computeRecruitmentStatus({
    recruitEnd: event.recruitEnd,
    eventEndDate: event.endDate,
  });
  const closed = status === "closed";
  const group = getCategoryGroup(event.category, event.name);
  const dday = !closed ? formatDday(event.recruitEnd, event.endDate) : null;
  const participationStatus = await getMyParticipationStatus(event.sourceDataset, event.id);
  const place = [event.region, event.gu, event.venue].filter(Boolean).join(" · ");
  const hours = event.hours?.filter(Boolean).join(" ~ ");
  const fee = event.feeKrw === 0 ? "무료" : event.feeKrw != null ? `${event.feeKrw.toLocaleString()}원` : null;

  const conditions: [string, string | null][] = [
    ["모집 대상", event.eligibility],
    ["판매 품목", event.items],
    ["준비물·지급품", event.equipment],
    ["선정 방식", event.selection],
  ];

  return (
    <div className="min-h-screen bg-[linear-gradient(135deg,#FFECD0_0%,#F4F9FD_30%,#DCEEFF_68%,#F6FAFD_100%)]">
    <div className="mx-auto max-w-6xl px-4 py-6 sm:px-6 lg:py-8">
      <Link
        href="/events"
        aria-label="행사 찾기"
        className="inline-flex size-10 items-center justify-center rounded-full bg-white text-neutral-800 shadow-sm ring-1 ring-neutral-200 transition hover:bg-neutral-50"
      >
        <ChevronLeft className="size-6" strokeWidth={2.25} />
      </Link>

      <div className="mt-5 grid gap-8 lg:grid-cols-[minmax(0,1fr)_340px] lg:gap-12">
        <div className="min-w-0">
          <div className="aspect-[16/9] overflow-hidden rounded-3xl shadow-sm">
            <PosterFrame
              imageUrl={getPosterImage(event.id)}
              alt={`${event.name} 포스터`}
              category={group}
              seed={event.id}
              size="hero"
            />
          </div>

          <div className="mt-6 flex items-center gap-2">
            {closed ? <Badge variant="muted">모집 종료</Badge> : dday ? <Badge variant="warning">{dday}</Badge> : null}
            <Badge variant="secondary">{group}</Badge>
          </div>
          <h1 className="mt-3 break-keep text-[26px] font-extrabold leading-tight tracking-[-0.03em] text-neutral-950 sm:text-[32px]">
            {event.name}
          </h1>

          <dl className="mt-6 grid gap-4 sm:grid-cols-2">
            <Fact icon={<CalendarDays />} label="행사 기간" value={formatRange(event.startDate, event.endDate)} />
            <Fact icon={<Clock />} label="운영 시간" value={hours} />
            <Fact icon={<MapPin />} label="장소" value={place} />
            <Fact icon={<Building2 />} label="주최" value={event.organizer} />
          </dl>

          {conditions.some(([, v]) => v) && (
            <section className="mt-10">
              <h2 className="text-lg font-bold text-neutral-950">모집 조건</h2>
              <dl className="mt-3 divide-y divide-neutral-200/80 border-y border-neutral-200/80">
                {conditions
                  .filter(([, v]) => v)
                  .map(([label, value]) => (
                    <div key={label} className="grid gap-1 py-4 sm:grid-cols-[8rem_1fr] sm:gap-4">
                      <dt className="text-sm font-semibold text-neutral-500">{label}</dt>
                      <dd className="text-[15px] leading-relaxed text-neutral-900">{value}</dd>
                    </div>
                  ))}
              </dl>
            </section>
          )}
        </div>

        <aside className="lg:sticky lg:top-24 lg:self-start">
          <div className="rounded-3xl bg-white p-6 shadow-[0_1px_3px_rgba(15,23,42,0.06),0_12px_32px_-12px_rgba(15,23,42,0.18)]">
            <dl className="space-y-4">
              <div>
                <dt className="text-sm text-neutral-500">모집 마감</dt>
                <dd className="mt-1 flex items-baseline gap-2">
                  <span className="text-2xl font-bold tracking-tight text-neutral-950">{event.recruitEnd ?? "공고 확인"}</span>
                  {closed ? (
                    <span className="text-sm font-semibold text-neutral-400">종료</span>
                  ) : (
                    event.recruitEnd && dday && <span className="text-sm font-semibold text-amber-600">{dday}</span>
                  )}
                </dd>
              </div>
              <div>
                <dt className="text-sm text-neutral-500">참가비</dt>
                <dd className="mt-1 text-2xl font-bold tracking-tight text-neutral-950">{fee ?? "공고 확인"}</dd>
              </div>
            </dl>

            <div className="mt-6">
              {participationStatus ? (
                <Button asChild variant="secondary" className="h-12 w-full text-[15px]">
                  <Link href="/my-events">내 행사에서 보기</Link>
                </Button>
              ) : (
                <form action={addParticipation}>
                  <input type="hidden" name="source_dataset" value={event.sourceDataset} />
                  <input type="hidden" name="seed_id" value={event.id} />
                  <input type="hidden" name="back_to" value={`/events/${event.id}`} />
                  <Button type="submit" className="h-12 w-full text-[15px]">
                    내 행사에 추가
                  </Button>
                </form>
              )}
            </div>

            {error && <p className="mt-3 rounded-lg bg-[#FFE4DE] px-3 py-2 text-sm text-[#BE3A2A]">{error}</p>}

            {event.sourceUrl && (
              <a
                href={event.sourceUrl}
                target="_blank"
                rel="noreferrer"
                className="mt-4 flex items-center justify-center gap-1.5 text-sm font-medium text-neutral-500 transition-colors hover:text-neutral-900"
              >
                원본 공고 <ExternalLink className="size-3.5" />
              </a>
            )}
          </div>
        </aside>
      </div>
    </div>
    </div>
  );
}

function Fact({ icon, label, value }: { icon: ReactNode; label: string; value: string | null | undefined }) {
  if (!value) return null;
  return (
    <div className="flex gap-3">
      <span className="flex size-10 shrink-0 items-center justify-center rounded-xl bg-brand-light text-brand [&>svg]:size-5">{icon}</span>
      <div className="min-w-0">
        <dt className="text-xs font-medium text-neutral-500">{label}</dt>
        <dd className="mt-0.5 break-keep text-[15px] font-semibold text-neutral-900">{value}</dd>
      </div>
    </div>
  );
}

function formatRange(start: string | null, end: string | null) {
  if (!start) return null;
  if (!end || end === start) return start;
  return `${start} ~ ${end}`;
}
