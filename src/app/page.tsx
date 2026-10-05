import Link from "next/link";
import { CalendarCheck, ChevronRight, Sparkles, TrendingUp } from "lucide-react";
import { getEvents } from "@/features/events/data";
import { EventCard } from "@/features/events/event-card";
import { Button } from "@/components/ui/button";
import { createClient } from "@/lib/supabase/server";
import { PosterFrame } from "@/components/ui/poster-frame";
import { SkyBackground } from "@/components/sky-background";
import { InteractiveLineChart } from "@/components/ui/interactive-line-chart";
import { ProductRevenueAreaChart } from "@/components/ui/product-revenue-area-chart";
import { getMyParticipations } from "@/features/participations/data";
import { getDashboardStats } from "@/features/dashboard/data";
import { STATUS_BADGE_CLASS, STATUS_LABEL } from "@/features/participations/status-labels";

export default async function HomePage() {
  const events = await getEvents();
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  const isLoggedIn = Boolean(user);
  const participations = isLoggedIn
  ? await getMyParticipations()
  : [];

  // '내 참가 예정 행사'에는 이미 끝났거나(참가 완료) 취소한 행사는 빼고 보여준다
  const upcomingParticipations = participations.filter(
    (p) => p.status !== "attended" && p.status !== "cancelled"
  );

const dashboardStats = isLoggedIn
  ? await getDashboardStats()
  : null;

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

          {/* 왼쪽 메인 타이틀 영역 */}
          <div className="relative w-full px-4 py-10 sm:px-8 sm:py-14">

            {/* 왼쪽 위 코너 */}
            <div className="pointer-events-none absolute left-[-24px] top-0 h-14 w-14 border-l-[8px] border-t-[8px] border-[#465563]" />

            {/* 오른쪽 아래 코너 */}
            <div className="pointer-events-none absolute bottom-0 right-0 h-14 w-14 border-b-[8px] border-r-[8px] border-[#465563]" />

            <span className="inline-block rounded-full bg-white/65 px-4 py-2 text-xs font-semibold text-brand shadow-sm backdrop-blur-sm">
              셀러를 위한 행사 지도
            </span>

            <h1 className="mt-7 tracking-tight">
              <span className="block text-xl font-medium leading-tight text-[#6B6E74] sm:text-2xl">
                어디에 나갈지 고민될 때,
              </span>

              <span className="mt-3 block font-logo text-6xl font-semibold leading-none text-[#1F2023] sm:text-8xl">
                Marketfit<span className="text-brand">.</span>
              </span>
            </h1>

            <Button
              asChild
              size="lg"
              className="mt-6 rounded-xl bg-brand px-7 text-white shadow-sm transition-all hover:bg-brand-dark hover:shadow-md"
            >
              <Link href="/events">행사 찾아보기</Link>
            </Button>
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
                      .join(" · ") || "지역 미기재"}
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

                  group-hover:translate-x-[55px]
                  group-hover:-translate-y-[150px]
                  group-hover:rotate-0
                  group-hover:scale-[1.04]
                  group-hover:shadow-[0_28px_70px_rgba(10,120,174,0.22)]
                "
              >
                <p className="text-sm font-medium text-[#6B6E74]">
                  궁금한 건 바로 질문
                </p>

                <p className="mt-2 flex items-center gap-1.5 text-xl font-bold text-[#1F2023]">
                  <Sparkles className="size-5 text-brand" />
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
                    description="로그인하면 저장하거나 참가 예정으로 등록한 행사를 바로 확인"
                    buttonText="로그인하고 확인하기"
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
                    description="로그인하면 행사별 매출·순이익 기록과 성과 확인 가능"
                    buttonText="로그인하고 확인하기"
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
  description,
  buttonText,
  href,
  accent,
}: {
  label: string;
  title: string;
  description: string;
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

            <p className="mt-2 max-w-xl text-sm leading-6 text-[#6B6E74]">
              {description}
            </p>
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
          참가할 행사 찾아보기
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
            {[p.region, p.venue].filter(Boolean).join(" · ") ||
              "지역 미기재"}
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
          가게 등록 후 참가 성과 확인 가능
        </p>

        <Link
          href="/store"
          className="mt-3 inline-block text-sm font-semibold text-[#3F7A64] hover:underline"
        >
          가게 등록하기
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

        <p className="mt-1 text-xs text-[#8A8D93]">
          참가 기록을 추가하면 성과 표시
        </p>
      </div>
    );
  }

  return (
    <div className="col-span-full rounded-[24px] border border-[#DEDFE3] bg-white p-6 shadow-[0_12px_35px_rgba(40,80,120,0.06)]">
      <div className="grid grid-cols-2 gap-4 lg:grid-cols-5">

        <PerformanceTile
          label="총 참가 행사"
          value={`${stats.totalParticipations}건`}
        />

        <PerformanceTile
          label="참가 완료"
          value={`${stats.statusCounts.attended}건`}
        />

        <PerformanceTile
          label="총 매출"
          value={
            stats.totalRevenue != null
              ? `${stats.totalRevenue.toLocaleString()}원`
              : "기록 없음"
          }
        />

        <PerformanceTile
          label="총 순이익"
          value={
            stats.totalNetProfit != null
              ? `${stats.totalNetProfit.toLocaleString()}원`
              : "기록 없음"
          }
        />

        <PerformanceTile
          label="평균 만족도"
          value={
            stats.averageSatisfaction != null
              ? `${stats.averageSatisfaction.toFixed(1)} / 5`
              : "기록 없음"
          }
        />

      </div>

      {/* 대시보드 그래프 미리보기 */}
      <div className="mt-5 grid gap-5 lg:grid-cols-2">

        <ChartPanel title="행사별 매출 추이">
          {stats.eventRevenueTrend.length === 0 ? (
            <ChartEmpty text="매출 기록 없음" />
          ) : (
            <InteractiveLineChart
              color="#F2542D"
              format="currency"
              height={200}
              points={stats.eventRevenueTrend.map((e) => ({
                label:
                  e.eventName.length > 6
                    ? `${e.eventName.slice(0, 6)}…`
                    : e.eventName,
                value: e.revenue,
                title: e.eventName,
                meta: e.startDate,
                sublabel:
                  e.netProfit != null
                    ? `순이익 ${e.netProfit.toLocaleString()}원`
                    : undefined,
              }))}
            />
          )}
        </ChartPanel>

        <ChartPanel title="품목별 매출 비교">
          {stats.popularProducts.length === 0 ? (
            <ChartEmpty text="상품별 판매 실적 없음" />
          ) : (
            <ProductRevenueAreaChart
              height={200}
              items={stats.popularProducts.map((p) => ({
                label: p.productName,
                value: p.totalRevenue,
              }))}
            />
          )}
        </ChartPanel>

      </div>
    </div>
  );
}

function ChartPanel({
  title,
  children,
}: {
  title: string;
  children: React.ReactNode;
}) {
  return (
    <div className="min-w-0 overflow-hidden rounded-2xl bg-[#F8FBFD] p-4">
      <p className="mb-3 text-sm font-semibold text-[#1F2023]">
        {title}
      </p>

      {children}
    </div>
  );
}

function ChartEmpty({ text }: { text: string }) {
  return (
    <p className="flex h-[200px] items-center justify-center text-sm text-[#8A8D93]">
      {text}
    </p>
  );
}

function PerformanceTile({
  label,
  value,
}: {
  label: string;
  value: string;
}) {
  return (
    <div className="rounded-2xl bg-[#F8FBFD] px-5 py-4">
      <p className="text-xs font-medium text-[#6B6E74]">
        {label}
      </p>

      <p className="mt-2 text-xl font-bold tracking-tight text-[#1F2023]">
        {value}
      </p>
    </div>
  );
}
