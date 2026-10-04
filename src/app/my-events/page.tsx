import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { getCurrentUser } from "@/features/store/data";
import { getMyParticipations } from "@/features/participations/data";
import { STATUS_BADGE_CLASS, STATUS_LABEL } from "@/features/participations/status-labels";

export default async function MyEventsPage() {
  const user = await getCurrentUser();

  if (!user) {
    return (
      <div className="mx-auto max-w-md px-4 py-20 text-center">
        <h1 className="text-2xl font-bold text-neutral-950">내 행사</h1>
        <p className="mt-3 text-sm text-neutral-500">
          로그인 후 이용 가능
        </p>
        <Button asChild className="mt-6">
          <Link href="/login">로그인하러 가기</Link>
        </Button>
      </div>
    );
  }

  const participations = await getMyParticipations();

  return (
    <div className="min-h-screen bg-[linear-gradient(135deg,#FFE8C2_0%,#F3F9FF_32%,#D6EEFF_68%,#EEF8FD_100%)]">
      <div className="mx-auto w-full max-w-4xl px-6 py-10 lg:px-8">
        <div className="mb-6 flex flex-wrap items-baseline justify-between gap-3">
          <div className="flex flex-wrap items-baseline gap-x-3 gap-y-1">
            <h1 className="text-2xl font-bold text-neutral-950">내 행사</h1>
            <p className="text-sm text-neutral-500">내 행사에 추가한 행사 관리</p>
          </div>

          <span className="text-sm text-neutral-400">
            총 {participations.length}개
          </span>
        </div>

        {participations.length === 0 ? (
          <div className="rounded-2xl border border-white/70 bg-white/80 px-6 py-14 text-center shadow-sm backdrop-blur-sm">
            <p className="text-sm text-neutral-500">
              추가한 행사 없음
            </p>

            <Link
              href="/events"
              className="mt-3 inline-block text-sm font-medium text-brand transition-colors hover:text-brand-dark"
            >
              행사 찾아보기 →
            </Link>
          </div>
        ) : (
          <ul className="flex flex-col gap-3">
            {participations.map((p) => (
              <li key={p.participationId}>
                <Card className="group overflow-hidden border-white/70 bg-white/90 shadow-sm transition-all duration-200 hover:-translate-y-0.5 hover:shadow-md">
                  <CardContent className="flex flex-col gap-4 px-5 py-5 sm:flex-row sm:items-center sm:justify-between">

                    {/* 행사 정보 */}
                    <div className="min-w-0">
                      <div className="flex flex-wrap items-center gap-2">
                        <span
                          className={`rounded-full px-3 py-1 text-xs font-medium ${
                            STATUS_BADGE_CLASS[p.status] ?? "bg-neutral-100 text-neutral-600"
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
                        {[p.region, p.venue].filter(Boolean).join(" · ") ||
                          "지역 미기재"}

                        {p.startDate &&
                          ` · ${formatRange(p.startDate, p.endDate)}`}
                      </p>
                    </div>

                    {/* 버튼 */}
                    <div className="flex shrink-0 items-center gap-2 sm:ml-6">
                      {p.detailSeedId && (
                        <Button
                          asChild
                          variant="outline"
                          size="sm"
                          className="bg-white"
                        >
                          <Link href={`/events/${p.detailSeedId}`}>
                            행사 보기
                          </Link>
                        </Button>
                      )}

                      <Button
                        asChild
                        size="sm"
                        className="bg-brand-light px-4 text-brand-dark shadow-none hover:bg-[#CDEAF6] hover:shadow-none"
                      >
                        <Link href={`/my-events/${p.participationId}`}>
                          관리하기 →
                        </Link>
                      </Button>
                    </div>
                  </CardContent>
                </Card>
              </li>
            ))}
          </ul>
        )}

        {participations.length > 0 && (
          <div className="mt-8 text-center">
            <p className="text-sm text-neutral-400">
              다른 마켓도 둘러보기
            </p>

            <Link
              href="/events"
              className="mt-2 inline-block text-sm font-medium text-brand transition-colors hover:text-brand-dark"
            >
              행사 찾아보기 →
            </Link>
          </div>
        )}
      </div>
    </div>
  );
}

function formatRange(start: string, end: string | null) {
  if (!end || end === start) return start;
  return `${start} ~ ${end}`;
}
