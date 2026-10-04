import { notFound } from "next/navigation";
import Link from "next/link";
import { getEventById } from "@/features/events/data";
import { computeRecruitmentStatus, formatDday } from "@/features/events/status";
import { getMyParticipationStatus } from "@/features/participations/data";
import { addParticipation } from "@/features/participations/actions";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { PosterFrame } from "@/components/ui/poster-frame";
import { getPosterImage } from "@/features/events/data";
import { getCategoryGroup } from "@/features/events/category-group";

export default async function EventDetailPage(props: PageProps<"/events/[id]">) {
  const { id } = await props.params;
  const sp = await props.searchParams;
  const error = typeof sp.error === "string" ? sp.error : null;
  const notice = typeof sp.notice === "string" ? sp.notice : null;

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

  return (
    <div className="mx-auto max-w-3xl px-4 py-8">
      <Link href="/events" className="text-sm text-neutral-500 hover:text-neutral-900">
        ← 행사 찾기로 돌아가기
      </Link>

      <div className="mt-4 aspect-[16/7] overflow-hidden rounded-2xl shadow-sm">
        {/* 실제 포스터 사진이 있으면(event-poster-manifest.json) 그걸, 없으면
            카테고리별 생성 그래픽 포스터를 보여준다(poster-frame.tsx 참고). */}
        <PosterFrame
          imageUrl={getPosterImage(event.id)}
          alt={`${event.name} 포스터`}
          category={group}
          seed={event.id}
          size="hero"
          badgeLabel={group}
        />
      </div>

      {closed && (
        <div className="mt-4 rounded-xl bg-neutral-900 px-4 py-3 text-sm text-white">
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
        <Badge variant="secondary">{group}</Badge>
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
        <InfoRow label="참가비" value={event.feeKrw === 0 ? "무료" : event.feeKrw != null ? `${event.feeKrw.toLocaleString()}원` : "미기재"} />
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
          {participationStatus ? (
            <Button asChild variant="secondary">
              <Link href="/my-events">내 행사에 추가됨 · 내 행사에서 보기</Link>
            </Button>
          ) : (
            <form action={addParticipation}>
              <input type="hidden" name="source_dataset" value={event.sourceDataset} />
              <input type="hidden" name="seed_id" value={event.id} />
              <input type="hidden" name="back_to" value={`/events/${event.id}`} />
              <Button type="submit">내 행사에 추가</Button>
            </form>
          )}
        </CardContent>
      </Card>

      {notice && (
        <p className="mt-4 rounded-lg bg-emerald-50 px-3 py-2 text-sm text-emerald-700">{notice}</p>
      )}
      {error && (
        <p className="mt-4 rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">{error}</p>
      )}

      <p className="mt-6 text-xs text-neutral-400">
        이 정보는 공개된 모집공고를 1차 코딩한 실제 자료입니다. 발표·의사결정
        전에는 원문 대조를 권장합니다.
      </p>
    </div>
  );
}

function InfoRow({ label, value }: { label: string; value: string | null | undefined }) {
  return (
    <div className="rounded-xl border border-neutral-200/80 bg-white px-4 py-3">
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
