import type { ReactNode } from "react";
import { skyGradient } from "@/components/sky-page";
import { PageHeader } from "@/components/page-header";
import { Lightbulb } from "lucide-react";
import { ProductTrendChart } from "./product-trend-chart";
import type { DashboardStats } from "@/features/dashboard/data";
import { RecentPerformance } from "./recent-performance";
import { Empty, Group, Panel } from "./panel";
import type { DashboardAnalytics } from "@/features/analytics/data";
import { analyticsInsights } from "@/features/analytics/insights";
import { FactorPanel, ForecastPanel, MethodsNote, PeerLine, PlanLine, StockPanel } from "@/features/analytics/panels";

const won = (n: number) => `${Math.round(n).toLocaleString()}원`;

export function DashboardView({ stats, analytics }: { stats: DashboardStats; analytics: DashboardAnalytics | null }) {
  const trend = stats.revenueTrend;
  const trendDiff = trend ? (trend.recentAvg - trend.earlierAvg) / trend.earlierAvg : null;
  // 통계 분석 결과가 있으면 같은 주제의 단순 평균 비교 문장은 빼고 분석 문장을 앞에 둔다.
  const superseded = new Set([
    ...(analytics?.factors.status === "ok" ? ["factors"] : []),
    ...(analytics?.stock.applicable && analytics.stock.items.length ? ["stock"] : []),
  ]);
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
              <Lightbulb className="size-4" /> 종합 인사이트
              {synthetic > 0 && (
                <span className="ml-auto rounded-full bg-white/80 px-2.5 py-0.5 text-[11px] font-medium text-neutral-500">
                  분석 데이터의 {Math.round(synthetic * 100)}%는 검증용 합성 데이터
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
            <ForecastPanel forecast={analytics.forecast} />
          </Group>
        )}

        <Group title="최근 성과" first={!analytics}>
          <RecentPerformance stats={stats} withTypeFilter layout="side" />
        </Group>

        <Group title="수익성">
          <div className="grid gap-3 sm:grid-cols-3">
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
              {analytics && <PeerLine peer={analytics.peer} />}
            </ProfitCard>

            <ProfitCard
              label="투자 대비 수익률"
              value={stats.returnOnCost ? `${Math.round(stats.returnOnCost.percent).toLocaleString()}%` : "기록 없음"}
              tone={stats.returnOnCost && stats.returnOnCost.percent < 0 ? "bad" : undefined}
            >
              {stats.returnOnCost ? (
                <p className="flex flex-wrap items-center gap-1.5 text-[13px] text-neutral-500">
                  비용 <span className="font-semibold tabular-nums text-neutral-800">{won(stats.returnOnCost.totalCost)}</span>
                  <span className="text-neutral-300">→</span>
                  순이익{" "}
                  <span className="font-semibold tabular-nums text-neutral-800">
                    {won((stats.returnOnCost.percent / 100) * stats.returnOnCost.totalCost)}
                  </span>
                </p>
              ) : (
                <span className="text-[13px] text-neutral-400">비용 입력 시 표시</span>
              )}
            </ProfitCard>

            <ProfitCard
              label="목표 매출 달성률"
              value={stats.targetAchievement ? `${Math.round(stats.targetAchievement.percent)}%` : "기록 없음"}
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

        {analytics && (
          <Group title="매출이 달랐던 조건">
            <FactorPanel factors={analytics.factors} />
          </Group>
        )}

        <Group title="상품 판매">
          <div className={analytics ? "grid gap-5 xl:grid-cols-2" : ""}>
            {analytics && <StockPanel stock={analytics.stock} />}
            <Panel title={stats.productSalesByEvent.series.length ? undefined : "품목별 판매 수량 추이"}>
              {stats.productSalesByEvent.series.length === 0 ? (
                <Empty>상품별 판매 기록 없음</Empty>
              ) : (
                <ProductTrendChart title="품목별 판매 수량 추이" data={stats.productSalesByEvent} />
              )}
            </Panel>
          </div>
        </Group>

        {analytics && <MethodsNote analytics={analytics} />}
      </div>
    </div>
  );
}

/** "**굵게**" 표시만 지원하는 아주 작은 렌더러(인사이트 문장용). */
function bold(text: string): ReactNode[] {
  return text.split("**").map((part, i) => (i % 2 ? <strong key={i} className="font-bold text-neutral-950">{part}</strong> : part));
}

/** 수익성 카드: 큰 숫자 + 아래 보조 표시(추세 배지·비용 흐름·달성 막대). */
function ProfitCard({ label, value, tone, children }: { label: string; value: string; tone?: "bad"; children?: ReactNode }) {
  return (
    <div className="flex flex-col justify-between gap-4 rounded-2xl border border-white/80 bg-white/85 p-5 shadow-[0_8px_24px_rgba(40,80,120,0.06)] backdrop-blur-sm sm:p-6">
      <div>
        <p className="text-sm font-medium text-neutral-500">{label}</p>
        <p className={`mt-1 whitespace-nowrap text-[30px] font-extrabold leading-tight tracking-tight tabular-nums ${tone === "bad" ? "text-[#BE3A2A]" : "text-neutral-950"}`}>
          {value}
        </p>
      </div>
      {children}
    </div>
  );
}
