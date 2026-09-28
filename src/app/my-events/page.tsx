import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { getCurrentUser } from "@/features/store/data";
import { getMyParticipations } from "@/features/participations/data";
import { STATUS_LABEL } from "@/features/participations/status-labels";

export default async function MyEventsPage() {
  const user = await getCurrentUser();

  if (!user) {
    return (
      <div className="mx-auto max-w-md px-4 py-20 text-center">
        <h1 className="text-xl font-semibold text-neutral-900">내 행사</h1>
        <p className="mt-3 text-sm text-neutral-500">
          참가할 행사를 관리하려면 먼저 로그인해 주세요.
        </p>
        <Button asChild className="mt-6">
          <Link href="/login">로그인하러 가기</Link>
        </Button>
      </div>
    );
  }

  const participations = await getMyParticipations();

  return (
    <div className="min-h-screen bg-fixed bg-[linear-gradient(135deg,#FFECD0_0%,#F4F9FD_30%,#DCEEFF_68%,#F6FAFD_100%)]">
    <div className="mx-auto w-full max-w-6xl px-6 py-10 lg:px-8">
      <div className="mx-auto max-w-4xl">

        <h1 className="text-xl font-bold text-neutral-950">
          내 행사
        </h1>

        <p className="mt-1 text-sm text-neutral-500">
          &ldquo;내 행사에 추가&rdquo;한 행사 목록이에요. 각 항목의
          &ldquo;관리하기&rdquo;에서 참가 상태·체크리스트·참가 결과를 기록할 수 있어요.
        </p>

        {participations.length === 0 ? (
          <p className="mt-10 text-center text-sm text-neutral-400">
            아직 추가한 행사가 없어요.{" "}
            <Link
              href="/events"
              className="underline underline-offset-2"
            >
              행사 찾기
            </Link>
            에서 마음에 드는 행사를 추가해보세요.
          </p>
        ) : (
          <ul className="mt-6 flex flex-col gap-3">
            {participations.map((p) => (
              <li key={p.participationId}>
                <Card>
                  <CardContent className="flex flex-wrap items-center justify-between gap-3 pt-5">

                    <div>
                      <div className="flex flex-wrap items-center gap-2">
                        <Badge variant="secondary">
                          {STATUS_LABEL[p.status] ?? p.status}
                        </Badge>

                        {p.category && (
                          <Badge variant="outline">
                            {p.category}
                          </Badge>
                        )}
                      </div>

                      <p className="mt-2 font-medium text-neutral-900">
                        {p.eventName}
                      </p>

                      <p className="mt-0.5 text-sm text-neutral-500">
                        {[p.region, p.venue]
                          .filter(Boolean)
                          .join(" · ") || "지역 미기재"}

                        {p.startDate &&
                          ` · ${formatRange(
                            p.startDate,
                            p.endDate
                          )}`}
                      </p>
                    </div>

                    <div className="flex gap-2">
                      {p.detailSeedId && (
                        <Button
                          asChild
                          variant="outline"
                          size="sm"
                        >
                          <Link
                            href={`/events/${p.detailSeedId}`}
                          >
                            행사 보기
                          </Link>
                        </Button>
                      )}

                      <Button asChild size="sm">
                        <Link
                          href={`/my-events/${p.participationId}`}
                        >
                          관리하기
                        </Link>
                      </Button>
                    </div>

                  </CardContent>
                </Card>
              </li>
            ))}
          </ul>
        )}

      </div>
    </div>
    </div>
  );
}

function formatRange(start: string, end: string | null) {
  if (!end || end === start) return start;
  return `${start} ~ ${end}`;
}
