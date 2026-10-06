import type { ReactNode } from "react";
import { skyGradient } from "@/components/sky-page";
import { PageHeader } from "@/components/page-header";
import { Lightbulb } from "lucide-react";
import { ProductTrendChart } from "./product-trend-chart";
import type { DashboardStats } from "@/features/dashboard/data";
import { ChartPanel, ProductRevenueComparison, RecentPerformance } from "./recent-performance";
import { Empty, Group, Panel } from "./panel";
import type { DashboardAnalytics } from "@/features/analytics/data";
import { analyticsInsights } from "@/features/analytics/insights";
import { EventFitPanel, PeerChart, PlanLine, PortfolioPanel, StockPanel, methodsInfo, peerInfo, planInfo } from "@/features/analytics/panels";
import { InfoTip } from "@/components/ui/info-tip";

const won = (n: number) => `${Math.round(n).toLocaleString()}원`;

export function DashboardView({ stats, analytics }: { stats: DashboardStats; analytics: DashboardAnalytics | null }) {
  const trend = stats.revenueTrend;
  const trendDiff = trend ? (trend.recentAvg - trend.earlierAvg) / trend.earlierAvg : null;
  // 준비 수량 진단이 있으면 판매율 문장(단순 비교)은 빼고 진단 문장을 쓴다.
  const superseded = new Set(analytics?.stock.items.length ? ["stock"] : []);
  const insights = [
    ...(analytics ? analyticsInsights(analytics) : []),
    ...stats.insights.filter((i) => !i.supersededBy || !superseded.has(i.supersededBy)).map((i) => i.text),
  ];
  const synthetic = analytics && analytics.data.records ? analytics.data.syntheticRecords / analytics.data.records : 0;

  return (
    <div className="min-h-screen" style={{ background: skyGradient(2) }}>
      <div className="mx-auto w-full max-w-7xl px-4 py-8 sm:px-6 lg:px-8 lg:py-10">
        <PageHeader title="대시보드" />

        {insights.length > 0 && (
          <section className="rounded-3xl border border-white/80 bg-[#FFF6EE] p-6 shadow-[0_12px_32px_rgba(40,80,120,0.08)] sm:p-7">
            <h2 className="flex items-center gap-2 text-sm font-bold text-brand-dark">
              <Lightbulb className="size-4" /> 한눈에 보기
              {analytics && (
                <span className="ml-auto flex items-center gap-1.5">
                  {synthetic > 0 && <span className="rounded-full bg-white/80 px-2.5 py-0.5 text-[11px] font-medium text-neutral-500">가상 셀러 데이터로 계산했어요</span>}
                  <InfoTip label="분석 안내" align="right">{methodsInfo(analytics)}</InfoTip>
                </span>
              )}
            </h2>
            <ul className="mt-4 grid gap-x-8 gap-y-2.5 text-[15px] leading-6 md:grid-cols-2">
              {insights.map((line) => (
                <li key={line} className="flex gap-2.5">
                  <span className="mt-2.5 size-1.5 shrink-0 rounded-full bg-[#F2836B]" />
                  <span className="text-neutral-700">{bold(line)}</span>
                </li>
              ))}
            </ul>
          </section>
        )}

        {analytics && (
          <Group title="다가올 행사" first>
            <EventFitPanel forecast={analytics.forecast} />
          </Group>
        )}

        <Group title="최근 성과" first={!analytics}>
          <RecentPerformance
            stats={stats}
            withTypeFilter
            layout="side"
            secondChart={analytics ? (
              <ChartPanel title="같은 업종 대비 매출" info={peerInfo}>
                <PeerChart peer={analytics.peer} />
              </ChartPanel>
            ) : undefined}
          />
        </Group>

        <Group title="수익성">
          <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
            <ProfitCard
              label="행사당 평균 매출"
              value={stats.totalRevenue != null ? won(stats.totalRevenue / stats.revenueEntryCount) : "기록 없음"}
            >
              {trendDiff != null && Math.abs(trendDiff) >= 0.05 ? ( // 인사이트 문장과 같은 기준
                <span className={`self-start rounded-full px-2.5 py-1 text-[13px] font-semibold ${trendDiff > 0 ? "bg-[#E0EFE8] text-[#2F5F4B]" : "bg-[#FFE4DE] text-[#BE3A2A]"}`}>
                  최근 {trend!.recentCount}회 {trendDiff > 0 ? "▲" : "▼"} {Math.round(Math.abs(trendDiff) * 100)}%
                </span>
              ) : (
                stats.revenueEntryCount > 0 && <span className="text-[13px] text-neutral-500">{stats.revenueEntryCount}회 평균</span>
              )}
            </ProfitCard>

            <ProfitCard
              label="행사당 평균 순이익"
              value={stats.totalNetProfit != null ? won(stats.totalNetProfit / stats.netProfitEntryCount) : "기록 없음"}
              tone={stats.totalNetProfit != null && stats.totalNetProfit < 0 ? "bad" : undefined}
            >
              {stats.totalNetProfit != null ? (
                <span className="text-[13px] text-neutral-500">{stats.netProfitEntryCount}회 평균</span>
              ) : (
                <span className="text-[13px] text-neutral-400">비용을 적으면 보여 드려요</span>
              )}
            </ProfitCard>

            <ProfitCard
              label="투자 대비 수익률"
              value={stats.returnOnCost ? `${Math.round(stats.returnOnCost.percent).toLocaleString()}%` : "기록 없음"}
              tone={stats.returnOnCost && stats.returnOnCost.percent < 0 ? "bad" : undefined}
            >
              {stats.returnOnCost ? (
                <CostVsProfit cost={stats.returnOnCost.totalCost} net={(stats.returnOnCost.percent / 100) * stats.returnOnCost.totalCost} />
              ) : (
                <span className="text-[13px] text-neutral-400">비용 입력 시 표시</span>
              )}
            </ProfitCard>

            <ProfitCard
              label="목표 매출 달성률"
              value={stats.targetAchievement ? `${Math.round(stats.targetAchievement.percent)}%` : "기록 없음"}
              info={analytics ? planInfo(analytics.plan) : undefined}
            >
              {stats.targetAchievement ? (
                <div>
                  <div className="h-2.5 overflow-hidden rounded-full bg-neutral-100">
                    <div
                      className="h-full rounded-full"
                      style={{
                        width: `${Math.min(stats.targetAchievement.percent, 100)}%`,
                        background: "linear-gradient(90deg, #F7A08C, #E5574A)", // 빨간 계열 게이지
                      }}
                    />
                  </div>
                  <p className="mt-1.5 text-[13px] text-neutral-500">
                    {stats.targetAchievement.percent >= 100 ? "목표 초과 달성" : `목표까지 ${Math.round(100 - stats.targetAchievement.percent)}%`} ·{" "}
                    {stats.targetAchievement.entryCount}회 기준
                  </p>
                </div>
              ) : (
                <span className="text-[13px] text-neutral-400">목표 매출 입력 시 표시</span>
              )}
              {analytics && <PlanLine plan={analytics.plan} />}
            </ProfitCard>
          </div>
        </Group>

        {/* 상품: Z 순서 — 1행 품목별 매출 비교 | 상품 포트폴리오(1:1), 2행 준비 수량 | 품목별 판매 수량 추이(3:7) */}
        <Group title="상품">
          <div className="grid gap-5">
            <div className={analytics ? "grid gap-5 lg:grid-cols-2" : ""}>
              <Panel title="품목별 매출 비교">
                <ProductRevenueComparison stats={stats} height={230} />
              </Panel>
              {analytics && <PortfolioPanel portfolio={analytics.portfolio} />}
            </div>
            <div className={analytics ? "grid gap-5 lg:grid-cols-[minmax(0,3fr)_minmax(0,7fr)]" : ""}>
              {analytics && <StockPanel stock={analytics.stock} />}
              <Panel title={stats.productSalesByEvent.series.length ? undefined : "품목별 판매 수량 추이"}>
                {stats.productSalesByEvent.series.length === 0 ? (
                  <Empty>상품별 판매 기록 없음</Empty>
                ) : (
                  <ProductTrendChart title="품목별 판매 수량 추이" data={stats.productSalesByEvent} />
                )}
              </Panel>
            </div>
          </div>
        </Group>
      </div>
    </div>
  );
}

/** "**굵게**" 표시만 지원하는 아주 작은 렌더러(인사이트 문장용). */
function bold(text: string): ReactNode[] {
  return text.split("**").map((part, i) => (i % 2 ? <strong key={i} className="font-bold text-neutral-950">{part}</strong> : part));
}

/** 투자 대비 수익률 아래 줄: 비용이 순이익보다 크면 비용을 빨간색, 순이익이 더 크면 순이익을 파란색으로. */
function CostVsProfit({ cost, net }: { cost: number; net: number }) {
  return (
    <p className="flex flex-wrap items-center gap-1.5 text-[13px] text-neutral-500">
      비용 <span className={`font-semibold tabular-nums ${cost > net ? "text-[#BE3A2A]" : "text-neutral-800"}`}>{won(cost)}</span>
      <span className="font-semibold text-neutral-500">{cost > net ? ">" : cost < net ? "<" : "="}</span>
      순이익 <span className={`font-semibold tabular-nums ${net > cost ? "text-[#2F6FB8]" : "text-neutral-800"}`}>{won(net)}</span>
    </p>
  );
}

/** 수익성 카드: 큰 숫자 + 아래 보조 표시(추세 배지·비용 흐름·달성 막대). info를 주면 제목 옆 물음표에 설명. */
function ProfitCard({ label, value, tone, info, children }: { label: string; value: string; tone?: "bad"; info?: ReactNode; children?: ReactNode }) {
  return (
    <div className="flex flex-col gap-2.5 rounded-2xl border border-white/80 bg-white/85 px-5 py-4 shadow-[0_8px_24px_rgba(40,80,120,0.06)] backdrop-blur-sm sm:px-6">
      <div>
        <p className="flex items-center gap-1.5 text-sm font-medium text-neutral-500">
          {label}
          {info && <InfoTip label={`${label} 설명`}>{info}</InfoTip>}
        </p>
        <p className={`mt-1 whitespace-nowrap text-[30px] font-extrabold leading-tight tracking-tight tabular-nums ${tone === "bad" ? "text-[#BE3A2A]" : "text-neutral-950"}`}>
          {value}
        </p>
      </div>
      {children}
    </div>
  );
}
