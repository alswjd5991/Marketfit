import Link from "next/link";
import { skyGradient } from "@/components/sky-page";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { getCurrentUser } from "@/features/store/data";
import { getMyParticipations } from "@/features/participations/data";
import { STATUS_BADGE_CLASS, STATUS_LABEL, STATUS_ORDER, toDisplayStatus } from "@/features/participations/status-labels";
import { CenteredNotice, PageHeader } from "@/components/page-header";
import { ChevronRight } from "lucide-react";

export default async function MyEventsPage(props: PageProps<"/my-events">) {
  const user = await getCurrentUser();

  if (!user) {
    return <CenteredNotice level={1} title="내 행사" text="로그인 후 이용 가능" href="/login" cta="로그인" />;
  }

  const participations = await getMyParticipations();

  // 상태 필터: ?status=interested | planning_to_attend | attended | cancelled (없으면 전체)
  const sp = await props.searchParams;
  const statusParam = typeof sp.status === "string" ? sp.status : undefined;
  const filter = STATUS_ORDER.find((s) => s === statusParam);
  const visible = filter ? participations.filter((p) => toDisplayStatus(p.status) === filter) : participations;
  const chipBase = "flex items-baseline gap-2 rounded-xl px-4 py-2 transition-shadow";
  const activeRing = "ring-2 ring-neutral-700/60";

  return (
    <div className="min-h-screen" style={{ background: skyGradient(1) }}>
      <div className="mx-auto w-full max-w-7xl px-4 py-8 sm:px-6 lg:px-8 lg:py-10">
        <PageHeader
          title="내 행사"
          actions={
            participations.length > 0 && (
              <ul className="flex flex-wrap gap-2">
                <li>
                  <Link
                    href="/my-events"
                    aria-current={!filter ? "true" : undefined}
                    className={`${chipBase} bg-white/85 text-neutral-700 ${!filter ? activeRing : ""}`}
                  >
                    <span className="text-[13px] font-semibold">전체</span>
                    <span className="text-xl font-extrabold tabular-nums">{participations.length}</span>
                  </Link>
                </li>
                {STATUS_ORDER.map((s) => (
                  <li key={s}>
                    <Link
                      href={`/my-events?status=${s}`}
                      aria-current={filter === s ? "true" : undefined}
                      className={`${chipBase} ${STATUS_BADGE_CLASS[s]} ${filter === s ? activeRing : ""}`}
                    >
                      <span className="text-[13px] font-semibold">{STATUS_LABEL[s]}</span>
                      <span className="text-xl font-extrabold tabular-nums">
                        {participations.filter((p) => toDisplayStatus(p.status) === s).length}
                      </span>
                    </Link>
                  </li>
                ))}
              </ul>
            )
          }
        />

        {participations.length > 0 && visible.length === 0 ? (
          <div className="rounded-2xl border border-white/70 bg-white/80 px-6 py-14 text-center shadow-sm backdrop-blur-sm">
            <p className="text-sm text-neutral-500">{filter ? `${STATUS_LABEL[filter]} 행사 없음` : "추가한 행사 없음"}</p>
            <Link href="/my-events" className="mt-3 inline-block text-sm font-medium text-brand transition-colors hover:text-brand-dark">
              전체 보기
            </Link>
          </div>
        ) : participations.length === 0 ? (
          <div className="rounded-2xl border border-white/70 bg-white/80 px-6 py-14 text-center shadow-sm backdrop-blur-sm">
            <p className="text-sm text-neutral-500">
              추가한 행사 없음
            </p>

            <Link
              href="/events"
              className="mt-3 inline-block text-sm font-medium text-brand transition-colors hover:text-brand-dark"
            >
              행사 찾기
            </Link>
          </div>
        ) : (
          <ul className="grid gap-3 lg:grid-cols-2">
            {visible.map((p) => (
              <li key={p.participationId}>
                <Link href={`/my-events/${p.participationId}`} className="block">
                <Card className="group overflow-hidden border-white/70 bg-white/90 shadow-sm transition-all duration-200 hover:-translate-y-0.5 hover:shadow-md">
                  <CardContent className="flex flex-col gap-4 px-5 py-5 sm:flex-row sm:items-center sm:justify-between">

                    {/* 행사 정보 */}
                    <div className="min-w-0">
                      <div className="flex flex-wrap items-center gap-2">
                        <span
                          className={`rounded-full px-3 py-1 text-xs font-medium ${
                            STATUS_BADGE_CLASS[toDisplayStatus(p.status)]
                          }`}
                        >
                          {STATUS_LABEL[p.status] ?? p.status}
                        </span>

                        {p.category && (
                          <Badge variant="secondary">{p.category}</Badge>
                        )}
                      </div>

                      <p className="mt-3 truncate text-[17px] font-semibold text-neutral-950">
                        {p.eventName}
                      </p>

                      <p className="mt-1 text-sm text-neutral-500">
                        {[p.region, p.venue, p.startDate && formatRange(p.startDate, p.endDate)].filter(Boolean).join(" · ")}
                      </p>
                    </div>

                    <ChevronRight className="hidden size-5 shrink-0 text-neutral-300 transition-colors group-hover:text-brand sm:block" />
                  </CardContent>
                </Card>
                </Link>
              </li>
            ))}
          </ul>
        )}

      </div>
    </div>
  );
}

function formatRange(start: string, end: string | null) {
  if (!end || end === start) return start;
  return `${start} ~ ${end}`;
}
