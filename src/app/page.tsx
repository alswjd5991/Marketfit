import Link from "next/link";
import { getEvents } from "@/features/events/data";
import { EventCard } from "@/features/events/event-card";
import { Button } from "@/components/ui/button";

export default async function HomePage() {
  const events = await getEvents();
  const closingSoon = events.filter((e) => e.status === "open").slice(0, 4);
  const recentlyAdded = [...events].reverse().slice(0, 4);

  return (
    <div className="mx-auto max-w-6xl px-4 py-10">
      <section className="flex flex-col items-start gap-4 py-10 sm:py-16">
        <h1 className="text-3xl font-bold tracking-tight text-neutral-950 sm:text-4xl">
          어떤 마켓에 나가야 잘 팔릴까요?
        </h1>
        <p className="max-w-xl text-neutral-500">
          전국 행사 모집정보를 찾고, 참가 데이터를 쌓아 우리 가게에 맞는 마켓을
          찾아보세요.
        </p>
        <Button asChild size="lg">
          <Link href="/events">행사 찾아보기</Link>
        </Button>
      </section>

      <HomeSection title="마감 임박 행사" href="/events?sort=deadline">
        {closingSoon.map((e) => (
          <EventCard key={e.id} event={e} />
        ))}
      </HomeSection>

      <HomeSection title="최근 등록 행사" href="/events">
        {recentlyAdded.map((e) => (
          <EventCard key={e.id} event={e} />
        ))}
      </HomeSection>

      <HomeSection title="내 참가 예정 행사" href="/my-events">
        <EmptyPlaceholder text="로그인하면 참가 예정 행사가 여기에 표시됩니다." />
      </HomeSection>

      <HomeSection title="최근 성과" href="/dashboard">
        <EmptyPlaceholder text="참가 결과를 기록하면 매출·순이익 요약이 여기에 표시됩니다." />
      </HomeSection>
    </div>
  );
}

function HomeSection({
  title,
  href,
  children,
}: {
  title: string;
  href: string;
  children: React.ReactNode;
}) {
  return (
    <section className="py-8">
      <div className="mb-4 flex items-center justify-between">
        <h2 className="text-lg font-semibold text-neutral-900">{title}</h2>
        <Link href={href} className="text-sm text-neutral-500 hover:text-neutral-900">
          더보기
        </Link>
      </div>
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">{children}</div>
    </section>
  );
}

function EmptyPlaceholder({ text }: { text: string }) {
  return (
    <div className="col-span-full rounded-xl border border-dashed border-neutral-300 p-8 text-center text-sm text-neutral-400">
      {text}
    </div>
  );
}
