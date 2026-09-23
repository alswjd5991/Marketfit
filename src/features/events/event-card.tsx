import Link from "next/link";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import type { EventListItem } from "./data";

const STATUS_LABEL: Record<EventListItem["status"], string> = {
  upcoming: "모집 예정",
  open: "모집 중",
  closed: "모집 종료",
};

/**
 * 10번 항목: 마감 공고는 삭제하지 않고, 흑백 처리·opacity·"모집 종료" 배지·
 * "마감" 표기로 현재 공고와 시각적으로만 구분한다. 클릭·상세조회는 항상 가능.
 */
export function EventCard({ event }: { event: EventListItem }) {
  const closed = event.status === "closed";

  return (
    <Link href={`/events/${event.id}`}>
      <Card
        className={cn(
          "h-full transition-shadow hover:shadow-md",
          closed && "opacity-60 grayscale"
        )}
      >
        <div className="flex aspect-[16/9] items-center justify-center rounded-t-xl bg-neutral-100 text-xs text-neutral-400">
          {/* 대표 이미지가 없는 실제 공고가 많아 텍스트 플레이스홀더로 대체 */}
          {event.category ?? "행사 이미지"}
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
          <h3 className="line-clamp-2 font-medium text-neutral-900">{event.name}</h3>
          <p className="text-xs text-neutral-500">
            {[event.region, event.venue].filter(Boolean).join(" · ") || "지역 미기재"}
          </p>
          <p className={cn("text-xs", closed ? "text-neutral-300" : "text-neutral-400")}>
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
