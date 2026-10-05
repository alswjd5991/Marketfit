import Link from "next/link";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { PosterFrame } from "@/components/ui/poster-frame";
import type { EventListItem } from "./data";

const STATUS_LABEL: Record<EventListItem["status"], string> = {
  upcoming: "모집 예정",
  open: "모집 중",
  closed: "모집 종료",
};

/**
 * 10번 항목: 마감 공고는 삭제하지 않고 "모집 종료" 배지로만 현재 공고와
 * 구분한다(흑백 처리 등 시각적으로 죽여 보이게 하지 않음 — 과거 참가 이력
 * 등록 등으로 계속 쓰이는 정보라 눈에 덜 띄게 만들 이유가 없음). 클릭·상세조회는
 * 항상 가능.
 */
export function EventCard({ event }: { event: EventListItem }) {
  const closed = event.status === "closed";

  return (
    <Link href={`/events/${event.id}`} className="group block h-full">
      <Card className="h-full overflow-hidden rounded-[22px] border border-[#DEDFE3] bg-white shadow-[0_8px_24px_rgba(40,80,120,0.06)] transition-all duration-200 group-hover:-translate-y-1 group-hover:border-[#BFE0EF] group-hover:shadow-[0_16px_36px_rgba(40,80,120,0.12)]">

        {/* 행사 포스터 */}
        <div className="aspect-[16/9] overflow-hidden bg-[#F4F9FC]">
          <PosterFrame
            imageUrl={event.posterImage}
            alt={`${event.name} 포스터`}
            category={event.category}
            seed={event.id}
            size="card"
          />
        </div>

        {/* 행사 정보 */}
        <CardContent className="flex flex-col gap-3 p-5">

          {/* 배지 */}
          <div className="flex flex-wrap items-center gap-2">
            {closed ? (
              <Badge variant="muted">모집 종료</Badge>
            ) : event.dday ? (
              <Badge variant="warning">{event.dday}</Badge>
            ) : (
              <Badge variant="outline">{STATUS_LABEL[event.status]}</Badge>
            )}

            {event.category && (
              <Badge variant="secondary">{event.category}</Badge>
            )}
          </div>

          {/* 행사명 */}
          <h3 className="line-clamp-2 break-keep text-[19px] font-bold leading-7 tracking-[-0.02em] text-[#1F2023] transition-colors group-hover:text-brand">
            {event.name}
          </h3>

          {/* 지역 · 기간 (없는 값은 숨김) */}
          {[event.region, event.venue].some(Boolean) && (
            <p className="text-sm text-[#657687]">{[event.region, event.venue].filter(Boolean).join(" · ")}</p>
          )}
          {event.startDate && <p className="mt-auto text-xs text-[#9AA8B5]">{formatRange(event.startDate, event.endDate)}</p>}

        </CardContent>
      </Card>
    </Link>
  );
}

function formatRange(start: string | null, end: string | null) {
  if (!start) return null;
  if (!end || end === start) return start;
  return `${start} ~ ${end}`;
}
