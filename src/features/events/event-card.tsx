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
      <Card className="h-full overflow-hidden transition-all duration-200 group-hover:-translate-y-0.5 group-hover:shadow-md group-hover:shadow-neutral-900/10">
        <div className="aspect-[16/9] overflow-hidden">
          {/* 실제 포스터 사진이 있으면(event-poster-manifest.json) 그걸,
              없으면 카테고리별 생성 그래픽 포스터를 보여준다(poster-frame.tsx 참고). */}
          <PosterFrame
            imageUrl={event.posterImage}
            alt={`${event.name} 포스터`}
            category={event.category}
            seed={event.id}
            size="card"
          />
        </div>
        <CardContent className="flex flex-col gap-2 pt-4">
          <div className="flex items-center gap-2">
            {closed ? (
              <Badge variant="muted">모집 종료</Badge>
            ) : event.dday ? (
              <Badge variant="warning">{event.dday}</Badge>
            ) : (
              <Badge variant="outline">{STATUS_LABEL[event.status]}</Badge>
            )}
            {event.category && <Badge variant="secondary">{event.category}</Badge>}
          </div>
          <h3 className="line-clamp-2 font-medium text-neutral-900 transition-colors group-hover:text-brand">
            {event.name}
          </h3>
          <p className="text-xs text-neutral-500">
            {[event.region, event.venue].filter(Boolean).join(" · ") || "지역 미기재"}
          </p>
          <p className="text-xs text-neutral-400">
            {formatRange(event.startDate, event.endDate) ?? "행사 기간 미기재"}
          </p>
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
