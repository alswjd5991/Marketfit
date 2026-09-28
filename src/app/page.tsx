import Link from "next/link";
import { getEvents } from "@/features/events/data";
import { EventCard } from "@/features/events/event-card";
import { Button } from "@/components/ui/button";

export default async function HomePage() {
  const events = await getEvents();

  const closingSoon = events
    .filter((e) => e.status === "open")
    .slice(0, 4);

  const recentlyAdded = [...events]
    .reverse()
    .slice(0, 4);

  // 현재 모집 중인 행사
  const openEvents = events.filter((e) => e.status === "open");

  // 오른쪽 랜딩 카드에 표시할 대표 행사
  const featuredEvent = openEvents[0];

  // 현재 모집 중인 행사 수
  const openEventCount = openEvents.length;

  // 현재 모집 중인 행사에서 카테고리 최대 3개 추출
  const topCategories = Array.from(
    new Set(
      openEvents
        .map((event) => event.category)
        .filter((category): category is string => Boolean(category))
    )
  ).slice(0, 3);

  return (
    <main className="min-h-screen bg-[#F8FBFD]">

      {/* 랜딩 / 히어로 영역 */}
      <section className="relative overflow-hidden bg-[linear-gradient(135deg,#FFF4DE_0%,#F7FBFF_35%,#E5F5FF_70%,#F8FBFD_100%)]">

        <div className="mx-auto grid max-w-7xl items-center gap-10 px-6 py-20 lg:grid-cols-[1.35fr_0.65fr] lg:py-24">

          {/* 왼쪽 메인 타이틀 카드 */}
          <div className="w-full rounded-[30px] border border-white/80 bg-white/70 p-8 shadow-[0_20px_60px_rgba(47,128,237,0.10)] backdrop-blur-md sm:p-12">

            <span className="inline-block rounded-full bg-brand-light px-4 py-2 text-xs font-semibold text-brand">
              소상공인 마켓 참가 데이터 플랫폼
            </span>

            <h1 className="mt-6 text-4xl font-bold leading-[1.15] tracking-tight text-[#15202B] sm:text-6xl">
              어떤 마켓에 나가야
              <br />
              잘 팔릴까요?
            </h1>

            <p className="mt-6 max-w-2xl text-base leading-7 text-[#607080] sm:text-lg">
              전국 행사 모집정보를 찾고, 참가 데이터를 쌓아 우리 가게에 맞는 마켓을
              찾아보세요.
            </p>

            <Button
              asChild
              size="lg"
              className="mt-8 rounded-xl bg-brand px-7 text-white shadow-sm transition-all hover:bg-brand-dark hover:shadow-md"
            >
              <Link href="/events">
                행사 찾아보기
              </Link>
            </Button>

          </div>


          {/* 오른쪽 카드 UI */}
          <div className="relative hidden min-h-[440px] lg:block">

            {/* 뒤쪽 하늘빛 */}
            <div className="absolute left-1/2 top-1/2 h-72 w-72 -translate-x-1/2 -translate-y-1/2 rounded-full bg-[#BFE8FF]/50 blur-3xl" />


            {/* 실제 모집 중인 행사 카드 */}
            {featuredEvent && (
              <a
                href={featuredEvent.sourceUrl ?? "/events"}
                target={featuredEvent.sourceUrl ? "_blank" : undefined}
                rel={featuredEvent.sourceUrl ? "noreferrer" : undefined}
                className="absolute left-0 top-8 z-10 block w-[285px] rounded-[24px] border border-white/80 bg-white p-5 shadow-[0_20px_50px_rgba(47,128,237,0.14)] transition-shadow duration-200 hover:z-50 hover:shadow-[0_24px_60px_rgba(47,128,237,0.22)]"
              >

                <div className="mb-4 flex items-center justify-between">

                  <span className="text-xs font-semibold text-brand">
                    지금 모집 중
                  </span>

                  <span className="rounded-full bg-[#E8F7EF] px-3 py-1 text-xs font-semibold text-[#279566]">
                    {featuredEvent.dday ?? "모집중"}
                  </span>

                </div>


                {/* 행사 이미지 영역 */}
                <div className="mb-4 h-28 rounded-2xl bg-gradient-to-br from-[#DDF3FF] via-[#EEF9FF] to-[#FFF1D8]" />


                {/* 실제 행사명 자동 출력 */}
                <h3 className="text-lg font-bold text-[#15202B]">
                  {featuredEvent.name}
                </h3>


                {/* 실제 지역 + 카테고리 자동 출력 */}
                <p className="mt-1 text-sm text-[#728090]">
                  {featuredEvent.region ?? "지역 미정"}
                  {" · "}
                  {featuredEvent.category ?? "카테고리 미정"}
                </p>

              </a>
            )}


            {/* 현재 모집 중인 행사 수 */}
            <Link
              href="/events"
              className="absolute right-[-10px] top-[205px] z-20 block w-[220px] rounded-[22px] border border-white/80 bg-white p-5 shadow-[0_20px_50px_rgba(47,128,237,0.12)] transition-shadow duration-200 hover:z-50 hover:shadow-[0_24px_60px_rgba(47,128,237,0.22)]"
            >

              <p className="text-xs font-medium text-[#728090]">
                현재 모집 중인 행사
              </p>

              <div className="mt-2 flex items-end gap-2">

                <span className="text-4xl font-bold tracking-tight text-[#15202B]">
                  {openEventCount}
                </span>

                <span className="pb-1 text-sm text-[#728090]">
                  개
                </span>

              </div>

              <div className="mt-4 flex gap-1">
                <div className="h-2 flex-1 rounded-full bg-brand" />
                <div className="h-2 flex-1 rounded-full bg-[#82CFFF]" />
                <div className="h-2 flex-1 rounded-full bg-[#BDE7FF]" />
                <div className="h-2 flex-1 rounded-full bg-[#E0F3FF]" />
              </div>

            </Link>


            {/* 카테고리 탐색 카드 */}
            <Link
              href="/events"
              className="absolute bottom-0 left-10 z-30 block w-[230px] rounded-[20px] border border-white/80 bg-white p-5 shadow-[0_18px_40px_rgba(47,128,237,0.10)] transition-shadow duration-200 hover:z-50 hover:shadow-[0_24px_60px_rgba(47,128,237,0.22)]"
            >

              <p className="text-xs font-medium text-[#728090]">
                다양한 마켓을 한눈에
              </p>

              <p className="mt-2 text-lg font-bold text-[#15202B]">
                지역 · 카테고리별 탐색
              </p>


              <div className="mt-3 flex flex-wrap gap-2">

                {topCategories.length > 0 ? (
                  topCategories.map((category, index) => (
                    <span
                      key={category}
                      className={
                        index === 0
                          ? "rounded-full bg-brand-light px-2.5 py-1 text-xs font-medium text-brand"
                          : index === 1
                          ? "rounded-full bg-[#E8F7EF] px-2.5 py-1 text-xs font-medium text-[#279566]"
                          : "rounded-full bg-[#FFF3DF] px-2.5 py-1 text-xs font-medium text-[#C47A16]"
                      }
                    >
                      {category}
                    </span>
                  ))
                ) : (
                  <span className="rounded-full bg-brand-light px-2.5 py-1 text-xs font-medium text-brand">
                    행사 찾아보기
                  </span>
                )}

              </div>

            </Link>

          </div>

        </div>


        {/* 아래 콘텐츠 영역과 자연스럽게 연결 */}
        <div className="pointer-events-none absolute inset-x-0 bottom-0 h-24 bg-gradient-to-b from-transparent to-[#F8FBFD]" />

      </section>


      {/* 메인 콘텐츠 영역 */}
      <div className="mx-auto max-w-6xl px-4 py-10">

        <HomeSection
          title="마감 임박 행사"
          href="/events?sort=deadline"
        >
          {closingSoon.map((event) => (
            <EventCard
              key={event.id}
              event={event}
            />
          ))}
        </HomeSection>


        <HomeSection
          title="최근 등록 행사"
          href="/events"
        >
          {recentlyAdded.map((event) => (
            <EventCard
              key={event.id}
              event={event}
            />
          ))}
        </HomeSection>


        <HomeSection
          title="내 참가 예정 행사"
          href="/my-events"
        >
          <EmptyPlaceholder text="로그인하면 참가 예정 행사가 여기에 표시됩니다." />
        </HomeSection>


        <HomeSection
          title="최근 성과"
          href="/dashboard"
        >
          <EmptyPlaceholder text="참가 결과를 기록하면 매출·순이익 요약이 여기에 표시됩니다." />
        </HomeSection>

      </div>

    </main>
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

        <h2 className="text-lg font-semibold text-neutral-900">
          {title}
        </h2>

        <Link
          href={href}
          className="text-sm text-neutral-500 transition-colors hover:text-brand"
        >
          더보기 →
        </Link>

      </div>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {children}
      </div>

    </section>
  );
}


function EmptyPlaceholder({
  text,
}: {
  text: string;
}) {
  return (
    <div className="col-span-full rounded-2xl border border-dashed border-neutral-300 bg-white/60 p-8 text-center text-sm text-neutral-400">
      {text}
    </div>
  );
}