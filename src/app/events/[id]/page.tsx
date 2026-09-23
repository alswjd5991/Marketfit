import { notFound } from "next/navigation";
import Link from "next/link";
import { getEventById } from "@/features/events/data";
import { computeRecruitmentStatus, formatDday } from "@/features/events/status";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";

export default async function EventDetailPage(props: PageProps<"/events/[id]">) {
  const { id } = await props.params;
  const event = await getEventById(id);
  if (!event) notFound();

  const status = computeRecruitmentStatus({
    recruitEnd: event.recruitEnd,
    eventEndDate: event.endDate,
  });
  const closed = status === "closed";
  const dday = !closed ? formatDday(event.recruitEnd) : null;

  return (
    <div className="mx-auto max-w-3xl px-4 py-8">
      <Link href="/events" className="text-sm text-neutral-500 hover:text-neutral-900">
        ← 행사 찾기로 돌아가기
      </Link>

      {closed && (
        <div className="mt-4 rounded-lg bg-neutral-900 px-4 py-3 text-sm text-white">
          이 모집공고는 종료되었습니다. 아래 정보는 계속 확인할 수 있고, 과거
          참가 이력으로 등록할 수 있습니다.
        </div>
      )}

      <div className="mt-4 flex items-center gap-2">
        {closed ? (
          <Badge variant="muted">모집 종료</Badge>
        ) : dday ? (
          <Badge variant="warning">{dday}</Badge>
        ) : null}
        {event.category && <Badge variant="secondary">{event.category}</Badge>}
        {event.orgType && <Badge variant="outline">{event.orgType}</Badge>}
      </div>

      <h1 className="mt-3 text-2xl font-bold text-neutral-950">{event.name}</h1>
      <p className="mt-1 text-sm text-neutral-500">
        {[event.region, event.gu, event.venue].filter(Boolean).join(" · ") || "지역 미기재"}
      </p>

      <div className="mt-6 grid grid-cols-1 gap-4 sm:grid-cols-2">
        <InfoRow label="행사기간" value={formatRange(event.startDate, event.endDate)} />
        <InfoRow label="영업시간" value={event.hours?.filter(Boolean).join(" ~ ") || null} />
        <InfoRow label="모집마감일" value={event.recruitEnd} />
        <InfoRow label="참가비" value={event.feeKrw != null ? `${event.feeKrw.toLocaleString()}원` : "미기재"} />
        <InfoRow label="주최기관" value={event.organizer} />
        <InfoRow label="모집대상" value={event.eligibility} />
        <InfoRow label="판매 품목" value={event.items} />
        <InfoRow label="준비물/지급품" value={event.equipment} />
        <InfoRow label="선정방식" value={event.selection} />
      </div>

      <Card className="mt-6">
        <CardContent className="flex flex-wrap items-center justify-between gap-3 pt-5">
          <div className="text-sm text-neutral-500">
            출처: {event.organizer ?? event.sourceType ?? "확인 필요"}
            {event.sourceUrl && (
              <>
                {" · "}
                <a
                  href={event.sourceUrl}
                  target="_blank"
                  rel="noreferrer"
                  className="underline underline-offset-2"
                >
                  원본 모집공고 보기
                </a>
              </>
            )}
          </div>
          <Button variant="outline" disabled>
            내 행사에 추가 (로그인 연동 후 이용 가능)
          </Button>
        </CardContent>
      </Card>

      <p className="mt-6 text-xs text-neutral-400">
        이 정보는 공개된 모집공고를 1차 코딩한 실제 자료입니다. 발표·의사결정
        전에는 원문 대조를 권장합니다.
      </p>
    </div>
  );
}

function InfoRow({ label, value }: { label: string; value: string | null | undefined }) {
  return (
    <div className="rounded-lg border border-neutral-200 bg-white px-4 py-3">
      <dt className="text-xs text-neutral-400">{label}</dt>
      <dd className="mt-0.5 text-sm text-neutral-800">{value || "미기재"}</dd>
    </div>
  );
}

function formatRange(start: string | null, end: string | null) {
  if (!start) return null;
  if (!end || end === start) return start;
  return `${start} ~ ${end}`;
}
