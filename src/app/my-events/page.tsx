import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { getCurrentUser } from "@/features/store/data";
import { getMyParticipations } from "@/features/participations/data";
import type { ParticipationStatus } from "@/types/database";

const STATUS_LABEL: Record<ParticipationStatus, string> = {
  interested: "관심",
  planning_to_apply: "신청 예정",
  applied: "신청 완료",
  planning_to_attend: "참가 예정",
  attended: "참가 완료",
  cancelled: "참가 취소",
};

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
    <div className="mx-auto max-w-2xl px-4 py-8">
      <h1 className="text-xl font-bold text-neutral-950">내 행사</h1>
      <p className="mt-1 text-sm text-neutral-500">
        &ldquo;내 행사에 추가&rdquo;한 행사 목록이에요. 참가 전/후 준비 데이터 기록(체크리스트,
        매출 기록 등)은 다음 단계에서 지원할 예정입니다.
      </p>

      {participations.length === 0 ? (
        <p className="mt-10 text-center text-sm text-neutral-400">
          아직 추가한 행사가 없어요.{" "}
          <Link href="/events" className="underline underline-offset-2">
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
                      <Badge variant="secondary">{STATUS_LABEL[p.status] ?? p.status}</Badge>
                      {p.category && <Badge variant="outline">{p.category}</Badge>}
                    </div>
                    <p className="mt-2 font-medium text-neutral-900">{p.eventName}</p>
                    <p className="mt-0.5 text-sm text-neutral-500">
                      {[p.region, p.venue].filter(Boolean).join(" · ") || "지역 미기재"}
                      {p.startDate && ` · ${formatRange(p.startDate, p.endDate)}`}
                    </p>
                  </div>
                  {p.detailSeedId && (
                    <Button asChild variant="outline" size="sm">
                      <Link href={`/events/${p.detailSeedId}`}>행사 보기</Link>
                    </Button>
                  )}
                </CardContent>
              </Card>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

function formatRange(start: string, end: string | null) {
  if (!end || end === start) return start;
  return `${start} ~ ${end}`;
}
