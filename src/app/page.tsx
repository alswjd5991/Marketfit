import Link from "next/link";
import { CalendarCheck, ChevronRight, TrendingUp } from "lucide-react";
import { BotIcon } from "@/components/bot-icon";
import { SiteFooter } from "@/components/site-footer";
import { getEvents } from "@/features/events/data";
import { EventCard } from "@/features/events/event-card";
import { Button } from "@/components/ui/button";
import { PosterFrame } from "@/components/ui/poster-frame";
import { SkyBackground } from "@/components/sky-background";
import { RecentPerformance } from "@/features/dashboard/recent-performance";
import { getMyParticipations } from "@/features/participations/data";
import { getDashboardStats } from "@/features/dashboard/data";
import { getCurrentUser } from "@/features/store/data";
import { STATUS_BADGE_CLASS, STATUS_LABEL } from "@/features/participations/status-labels";

export default async function HomePage() {
  const [events, user] = await Promise.all([getEvents(), getCurrentUser()]);
  const isLoggedIn = Boolean(user);
  // 로그인 사용자의 기록 두 가지는 서로 기다릴 필요가 없어 동시에 불러온다.
  const [participations, dashboardStats] = isLoggedIn
    ? await Promise.all([getMyParticipations(), getDashboardStats()])
    : [[], null];

  // '내 참가 예정 행사'에는 이미 끝났거나(참가 완료) 취소한 행사는 빼고 보여준다
  const upcomingParticipations = participations.filter(
    (p) => p.status !== "attended" && p.status !== "cancelled"
  );


  const closingSoon = events
    .filter((e) => e.status === "open")
    .slice(0, 4);

  const recentlyAdded = [...events]
    .reverse()
    .slice(0, 4);

  // 현재 모집 중인 행사
  const openEvents = events.filter((e) => e.status === "open");

  // 오른쪽 랜딩 카드에 표시할 대표 행사 — 모집 중인 행사 중 새로고침마다 무작위
  const featuredEvent = pickRandom(openEvents);

  // 현재 모집 중인 행사 수
  const openEventCount = openEvents.length;

  return (
    <main className="fixed inset-x-0 bottom-16 top-16 isolate overflow-y-auto overscroll-contain snap-y snap-mandatory scroll-smooth bg-[#F4F8FB] sm:bottom-0">

      <div className="relative snap-start snap-always">
      {/* 랜딩 / 히어로 영역 */}
      <section className="sticky top-0 z-0 h-[calc(100vh-64px)] overflow-hidden bg-[linear-gradient(135deg,#FFE8C2_0%,#F3F9FF_38%,#D6EEFF_72%,#EEF8FD_100%)]">

        <div className="mx-auto grid max-w-7xl items-center gap-10 px-6 pb-40 pt-20 lg:grid-cols-[1.35fr_0.65fr] lg:pb-44 lg:pt-24">

          {/* 왼쪽 메인 타이틀 — 얇은 꺽쇠 두 개가 문구 묶음만 감싼다 */}
          <div className="flex w-full justify-center lg:justify-start">
            <div className="relative inline-block px-10 py-12 sm:px-14 sm:py-14">
              <span className="pointer-events-none absolute left-0 top-0 size-10 rounded-tl-2xl border-l-[3px] border-t-[3px] border-[#1F2023]/75 sm:size-12" />
              <span className="pointer-events-none absolute bottom-0 right-0 size-10 rounded-br-2xl border-b-[3px] border-r-[3px] border-[#1F2023]/75 sm:size-12" />

              <span className="inline-block rounded-full bg-white/70 px-4 py-1.5 text-[13px] font-semibold text-brand shadow-sm backdrop-blur-sm">
                셀러를 위한 행사 지도
              </span>

              <h1 className="mt-6">
                <span className="block text-2xl font-semibold tracking-tight text-[#55585E] sm:text-[28px]">
                  어디에 나갈지 고민될 때,
                </span>
                <span className="mt-2 block font-logo text-7xl font-semibold leading-[0.95] tracking-[-0.02em] text-[#1F2023] sm:text-[112px]">
                  Marketfit<span className="text-brand">.</span>
                </span>
              </h1>

              <Button
                asChild
                size="lg"
                className="mt-9 h-12 rounded-xl bg-brand px-8 text-[15px] text-white shadow-sm transition-all hover:bg-brand-dark hover:shadow-md"
              >
                <Link href="/events">행사 찾아보기</Link>
              </Button>
            </div>
          </div>


          {/* 오른쪽 카드 UI */}
          <div className="relative hidden min-h-[440px] lg:block">

            {/* 뒤쪽 하늘빛 */}
            <div className="absolute left-1/2 top-1/2 h-72 w-72 -translate-x-1/2 -translate-y-1/2 rounded-full bg-[#BFE8FF]/50 blur-3xl" />


            {/* 실제 모집 중인 행사 카드 */}
            {featuredEvent && (
              <div className="group absolute left-0 top-4 z-10 h-[360px] w-[285px] hover:z-50">
                <a
                  href={featuredEvent.sourceUrl ?? "/events"}
                  target={featuredEvent.sourceUrl ? "_blank" : undefined}
                  rel={featuredEvent.sourceUrl ? "noreferrer" : undefined}
                  className="
                    absolute left-0 top-0 block w-[285px]
                    -rotate-3
                    rounded-[24px] border border-white/80 bg-white p-5
                    shadow-[0_20px_50px_rgba(10,120,174,0.14)]
                    transition-all duration-300 ease-out

                    group-hover:z-50
                    group-hover:translate-x-[50px]
                    group-hover:translate-y-[30px]
                    group-hover:rotate-0
                    group-hover:scale-[1.04]
                    group-hover:shadow-[0_28px_70px_rgba(10,120,174,0.22)]
                  "
                >
                  <div className="mb-4 flex items-center justify-between">
                    <span className="text-xs font-semibold text-brand">
                      지금 모집 중
                    </span>

                    <span className="rounded-full bg-[#FFEEDD] px-3 py-1 text-xs font-semibold text-[#B4530A]">
                      {featuredEvent.dday ?? "모집중"}
                    </span>
                  </div>

                  <div className="mb-4 aspect-[16/9] overflow-hidden rounded-2xl">
                    <PosterFrame
                      imageUrl={featuredEvent.posterImage}
                      alt={`${featuredEvent.name} 포스터`}
                      category={featuredEvent.category}
                      seed={featuredEvent.id}
                      size="card"
                    />
                  </div>

                  <h3 className="text-lg font-bold text-[#1F2023]">
                    {featuredEvent.name}
                  </h3>

                  <p className="mt-1 text-sm text-[#6B6E74]">
                    {[featuredEvent.region, featuredEvent.venue]
                      .filter(Boolean)
                      .join(" · ")}
                  </p>

                  {featuredEvent.category && (
                    <p className="mt-1 text-xs font-medium text-brand">
                      {featuredEvent.category}
                    </p>
                  )}
                </a>
              </div>
            )}


            {/* 현재 모집 중인 행사 수 */}
            <div className="group absolute right-[-10px] top-[205px] z-20 h-[150px] w-[220px] hover:z-50">

              <Link
                href="/events"
                className="
                  absolute inset-0 block
                  rotate-3
                  rounded-[22px] border border-white/80 bg-white p-5
                  shadow-[0_20px_50px_rgba(10,120,174,0.12)]
                  transition-all duration-300 ease-out

                  group-hover:-translate-x-[90px]
                  group-hover:-translate-y-[55px]
                  group-hover:rotate-0
                  group-hover:scale-[1.04]
                  group-hover:shadow-[0_28px_70px_rgba(10,120,174,0.22)]
                "
              >
                <p className="text-xs font-medium text-[#6B6E74]">
                  현재 모집 중인 행사
                </p>

                <div className="mt-2 flex items-end gap-2">
                  <span className="text-4xl font-bold tracking-tight text-[#1F2023]">
                    {openEventCount}
                  </span>

                  <span className="pb-1 text-sm text-[#6B6E74]">
                    개
                  </span>
                </div>

                <div className="mt-4 flex gap-1">
                  <div className="h-2 flex-1 rounded-full bg-brand" />
                  <div className="h-2 flex-1 rounded-full bg-[#5BB3DA]" />
                  <div className="h-2 flex-1 rounded-full bg-[#A9D8EC]" />
                  <div className="h-2 flex-1 rounded-full bg-[#D7EEF7]" />
                </div>
              </Link>

            </div>


            {/* AI 도우미 바로가기 카드 */}
            <div className="group absolute bottom-0 left-10 z-30 h-[120px] w-[230px] hover:z-50">

              <Link
                href="/ai"
                className="
                  absolute inset-0 flex flex-col justify-center
                  -rotate-2
                  rounded-[20px] border border-white/80 bg-white p-5
                  shadow-[0_18px_40px_rgba(10,120,174,0.10)]
                  transition-all duration-300 ease-out

                  group-hover:translate-x-[10px]
                  group-hover:-translate-y-[24px]
                  group-hover:rotate-0
                  group-hover:scale-[1.04]
                  group-hover:shadow-[0_28px_70px_rgba(10,120,174,0.22)]
                "
              >
                <p className="text-sm font-medium text-[#6B6E74]">
                  궁금한 건 바로 질문
                </p>

                <p className="mt-2 flex items-center gap-1.5 text-xl font-bold text-[#1F2023]">
                  <BotIcon className="size-6 text-[#1B8FCB]" />
                  AI 도우미 바로가기
                </p>
              </Link>

            </div>

          </div>
        </div>
      </section>


      {/* 아래 콘텐츠 전체를 감싸는 흰색 패널 */}
      <section
        className="
          relative z-20
          -mt-20
          min-h-screen
          snap-start snap-always
          rounded-t-[56px]
          bg-[#FCFDFE]
          shadow-[0_-24px_70px_rgba(40,80,120,0.12)]
        "
      >
        {/* 스크롤 위치에 따라 바뀌는 하늘 배경 */}
        <SkyBackground />

        <div className="relative z-10 mx-auto w-full max-w-7xl px-6 pb-24 pt-20 lg:px-8">


          {/* 2. 마감 임박 행사 */}
          <section data-sky="0" className="flex min-h-[calc(100vh-64px)] items-center">
            <div className="w-full">
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
            </div>
          </section>


          {/* 3. 최근 등록 행사 */}
          <section data-sky="1" className="flex min-h-[calc(100vh-64px)] snap-start snap-always items-center">
            <div className="w-full">
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
            </div>
          </section>


          {/* 4. 내 참가 예정 행사 */}
          <section data-sky="2" className="flex min-h-[calc(100vh-64px)] snap-start snap-always items-center">
            <div className="w-full">
              <HomeSection
                title="내 참가 예정 행사"
                href="/my-events"
              >
                {isLoggedIn ? (
                  <MyEventsPreview
                    participations={upcomingParticipations.slice(0, 4)}
                  />
                ) : (
                  <EmptyState
                    label="내 행사"
                    title="참가할 행사를 한곳에서 관리"
                    buttonText="로그인"
                    href="/login"
                    accent="blue"
                  />
                )}
              </HomeSection>
            </div>
          </section>


          {/* 5. 최근 성과 */}
          <section data-sky="3" className="flex min-h-[calc(100vh-64px)] snap-start snap-always items-center">
            <div className="w-full">
              <HomeSection
                title="최근 성과"
                href="/dashboard"
              >
                {isLoggedIn ? (
                  <DashboardPreview stats={dashboardStats} />
                ) : (
                  <EmptyState
                    label="참가 성과"
                    title="참가 결과 기록"
                    buttonText="로그인"
                    href="/login"
                    accent="green"
                  />
                )}
              </HomeSection>
            </div>
          </section>

        </div>
      </section>
      </div>

      <SiteFooter className="relative z-20 snap-end" />
    </main>
  );
}


/** 배열에서 하나를 무작위로 고른다(비어 있으면 undefined). 요청마다 다시 렌더링되는 페이지라 새로고침마다 달라진다. */
function pickRandom<T>(items: T[]): T | undefined {
  return items[Math.floor(Math.random() * items.length)];
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

      <div className="mb-6 flex items-center justify-between">

        <h2 className="text-2xl font-bold text-neutral-900">
          {title}
        </h2>

        <Link
          href={href}
          className="flex items-center gap-0.5 text-sm text-neutral-500 transition-colors hover:text-brand"
        >
          더보기
          <ChevronRight className="size-4" />
        </Link>

      </div>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {children}
      </div>

    </section>
  );
}


function EmptyState({
  label,
  title,
  buttonText,
  href,
  accent,
}: {
  label: string;
  title: string;
  buttonText: string;
  href: string;
  accent: "blue" | "green";
}) {
  const isBlue = accent === "blue";

  return (
    <div className="col-span-full overflow-hidden rounded-[24px] border border-[#DEDFE3] bg-white shadow-[0_12px_35px_rgba(40,80,120,0.06)]">
      <div className="flex flex-col items-start justify-between gap-8 p-7 sm:flex-row sm:items-center sm:p-8">

        {/* 왼쪽 설명 */}
        <div className="flex items-start gap-5">

          {/* 작은 아이콘 영역 */}
          <div
            className={
              isBlue
                ? "flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-brand-light text-brand"
                : "flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-[#E0EFE8] text-[#3F7A64]"
            }
          >
            {isBlue ? <CalendarCheck className="size-5" /> : <TrendingUp className="size-5" />}
          </div>

          <div>
            <p
              className={
                isBlue
                  ? "text-xs font-semibold tracking-wide text-brand"
                  : "text-xs font-semibold tracking-wide text-[#3F7A64]"
              }
            >
              {label}
            </p>

            <h3 className="mt-2 text-lg font-bold text-[#1F2023]">
              {title}
            </h3>
          </div>

        </div>

        {/* 오른쪽 버튼 */}
        <Link
          href={href}
          className={
            isBlue
              ? "shrink-0 rounded-xl bg-brand px-5 py-3 text-sm font-semibold text-white shadow-sm transition-all hover:bg-brand-dark hover:shadow-md"
              : "shrink-0 rounded-xl bg-[#3F7A64] px-5 py-3 text-sm font-semibold text-white shadow-sm transition-all hover:bg-[#356452] hover:shadow-md"
          }
        >
          {buttonText}
        </Link>

      </div>
    </div>
  );
}

type HomeParticipation =
  Awaited<ReturnType<typeof getMyParticipations>>[number];

type HomeDashboardStats =
  NonNullable<Awaited<ReturnType<typeof getDashboardStats>>>;

function MyEventsPreview({
  participations,
}: {
  participations: HomeParticipation[];
}) {
  if (participations.length === 0) {
    return (
      <div className="col-span-full rounded-[24px] border border-[#DEDFE3] bg-white p-8 text-center shadow-[0_12px_35px_rgba(40,80,120,0.05)]">
        <p className="text-sm font-medium text-[#6B6E74]">
          참가 예정인 행사 없음
        </p>

        <Link
          href="/events"
          className="mt-3 inline-block text-sm font-semibold text-brand hover:underline"
        >
          행사 찾기
        </Link>
      </div>
    );
  }

  return (
    <>
      {participations.map((p) => (
        <Link
          key={p.participationId}
          href={`/my-events/${p.participationId}`}
          className="
            rounded-[22px] border border-[#DEDFE3] bg-white p-5
            shadow-[0_12px_30px_rgba(40,80,120,0.06)]
            transition-all duration-200
            hover:-translate-y-1 hover:shadow-[0_18px_40px_rgba(40,80,120,0.10)]
          "
        >
          <div className="flex flex-wrap gap-2">
            <span className={`rounded-full px-3 py-1 text-xs font-semibold ${STATUS_BADGE_CLASS[p.status] ?? ""}`}>
              {STATUS_LABEL[p.status] ?? p.status}
            </span>

            {p.category && (
              <span className="rounded-full bg-[#EEEFF1] px-3 py-1 text-xs font-medium text-[#6B6E74]">
                {p.category}
              </span>
            )}
          </div>

          <h3 className="mt-4 line-clamp-2 text-base font-bold text-[#1F2023]">
            {p.eventName}
          </h3>

          <p className="mt-2 text-sm text-[#6B6E74]">
            {[p.region, p.venue].filter(Boolean).join(" · ")}
          </p>

          {p.startDate && (
            <p className="mt-2 text-xs text-[#8A8D93]">
              {p.endDate && p.endDate !== p.startDate
                ? `${p.startDate} ~ ${p.endDate}`
                : p.startDate}
            </p>
          )}
        </Link>
      ))}
    </>
  );
}
function DashboardPreview({
  stats,
}: {
  stats: HomeDashboardStats | null;
}) {
  if (!stats) {
    return (
      <div className="col-span-full rounded-[24px] border border-[#DEDFE3] bg-white p-8 text-center shadow-[0_12px_35px_rgba(40,80,120,0.05)]">
        <p className="text-sm font-medium text-[#6B6E74]">
          등록된 가게 없음
        </p>

        <Link
          href="/store"
          className="mt-3 inline-block text-sm font-semibold text-[#3F7A64] hover:underline"
        >
          가게 등록
        </Link>
      </div>
    );
  }

  if (stats.totalParticipations === 0) {
    return (
      <div className="col-span-full rounded-[24px] border border-[#DEDFE3] bg-white p-8 text-center shadow-[0_12px_35px_rgba(40,80,120,0.05)]">
        <p className="text-sm font-medium text-[#6B6E74]">
          참가 기록 없음
        </p>
      </div>
    );
  }

  return <RecentPerformance stats={stats} />;
}
