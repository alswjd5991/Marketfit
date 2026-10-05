import type { ReactNode } from "react";
import { skyGradient } from "@/components/sky-page";
import { PageHeader } from "@/components/page-header";
import { Lightbulb } from "lucide-react";
import { ColumnChart } from "@/components/ui/column-chart";
import { ProductTrendChart } from "./product-trend-chart";
import { BAR_COLOR, SERIES_COLORS } from "@/components/ui/chart-colors";
import type { DashboardStats } from "@/features/dashboard/data";
import { EventRevenueChart } from "./event-revenue-chart";

// 퍼널 단계 색: 노을(관심) → 옅은 하늘(참가 예정) → 하늘(참가 완료). 배경 컨셉처럼 노을에서 하늘로 넘어간다.
const FUNNEL = {
  interested: { bg: "#FFD3B0", ink: "#8A4320" },
  planning_to_attend: { bg: "#A9D5F2", ink: "#1F4E73" },
  attended: { bg: SERIES_COLORS[0], ink: "#FFFFFF" },
};

const won = (n: number) => `${Math.round(n).toLocaleString()}원`;

export function DashboardView({ stats }: { stats: DashboardStats }) {
  const trend = stats.revenueTrend;
  const trendDiff = trend ? (trend.recentAvg - trend.earlierAvg) / trend.earlierAvg : null;

  return (
    <div className="min-h-screen" style={{ background: skyGradient(2) }}>
      <div className="mx-auto w-full max-w-6xl px-4 py-8 sm:px-6 lg:py-10">
        <PageHeader title="대시보드" />

        {stats.insights.length > 0 && (
          <section className="rounded-3xl border border-white/80 bg-[linear-gradient(135deg,#FFE9D6_0%,#FFF8F1_38%,#F1F8FF_70%,#DDEEFF_100%)] p-6 shadow-[0_12px_32px_rgba(40,80,120,0.08)] sm:p-7">
            <h2 className="flex items-center gap-2 text-sm font-bold text-brand-dark">
              <Lightbulb className="size-4" /> 종합 인사이트
            </h2>
            <ul className="mt-4 grid gap-x-8 gap-y-2.5 text-[15px] leading-6 md:grid-cols-2">
              {stats.insights.map((line) => (
                <li key={line} className="flex gap-2.5">
                  <span className="mt-2.5 size-1.5 shrink-0 rounded-full bg-[#F2836B]" />
                  <span className="text-neutral-700">{bold(line)}</span>
                </li>
              ))}
            </ul>
          </section>
        )}

        <section className="mt-5 grid grid-cols-2 gap-3 md:grid-cols-3 xl:grid-cols-6">
          <Kpi label={stats.revenueEntryCount ? `누적 매출 (${stats.revenueEntryCount}회)` : "누적 매출"} value={stats.totalRevenue != null ? won(stats.totalRevenue) : "기록 없음"} />
          <Kpi
            label={stats.netProfitEntryCount ? `누적 순이익 (${stats.netProfitEntryCount}회)` : "누적 순이익"}
            value={stats.totalNetProfit != null ? won(stats.totalNetProfit) : "기록 없음"}
            tone={stats.totalNetProfit != null && stats.totalNetProfit < 0 ? "bad" : undefined}
          />
          <Kpi
            label="행사당 평균 매출"
            value={stats.totalRevenue != null ? won(stats.totalRevenue / stats.revenueEntryCount) : "기록 없음"}
            badge={
              trendDiff != null && Math.abs(trendDiff) >= 0.05 // 인사이트 문장과 같은 기준
                ? { text: `최근 ${trend!.recentCount}회 ${trendDiff > 0 ? "▲" : "▼"} ${Math.round(Math.abs(trendDiff) * 100)}%`, good: trendDiff > 0 }
                : undefined
            }
          />
          <Kpi
            label="투자 대비 수익률"
            value={stats.returnOnCost ? `${Math.round(stats.returnOnCost.percent).toLocaleString()}%` : "기록 없음"}
            tone={stats.returnOnCost && stats.returnOnCost.percent < 0 ? "bad" : undefined}
            sub={stats.returnOnCost ? `비용 ${won(stats.returnOnCost.totalCost)}` : "비용 입력 시 표시"}
          />
          <Kpi
            label="목표 매출 달성률"
            value={stats.targetAchievement ? `${Math.round(stats.targetAchievement.percent)}%` : "기록 없음"}
            sub={stats.targetAchievement ? `${stats.targetAchievement.entryCount}회 기준` : "목표 매출 입력 시 표시"}
          />
          <Kpi
            label="평균 만족도"
            value={stats.averageSatisfaction != null ? `${stats.averageSatisfaction.toFixed(1)} / 5.0` : "기록 없음"}
            sub={stats.satisfactionEntryCount ? `${stats.satisfactionEntryCount}회 평가` : undefined}
          />
        </section>

        <section className="mt-5 grid gap-5 lg:grid-cols-3">
          <Panel title="행사별 매출·순이익" className="lg:col-span-2">
            {stats.eventRevenueTrend.length === 0 ? (
              <Empty>매출 기록 없음</Empty>
            ) : (
              <EventRevenueChart points={stats.eventRevenueTrend} groups={stats.groupPerformance} />
            )}
          </Panel>

          <Panel title="참가 전환 흐름">
            <Funnel stats={stats} />
          </Panel>
        </section>

        <section className="mt-5 grid gap-5 lg:grid-cols-3">
          <Panel title="품목별 판매 수량 추이" className="lg:col-span-2">
            {stats.productSalesByEvent.series.length === 0 ? (
              <Empty>상품별 판매 기록 없음</Empty>
            ) : (
              <ProductTrendChart data={stats.productSalesByEvent} />
            )}
          </Panel>

          <Panel title="품목별 매출·판매율">
            {stats.popularProducts.length === 0 ? <Empty>상품별 판매 기록 없음</Empty> : <ProductBars stats={stats} />}
          </Panel>
        </section>

        <section className="mt-5">
          <Panel title="월별 참가">
            <ColumnChart
              unit="건"
              barName="참가 행사 수"
              height={170}
              points={stats.monthlyParticipationCounts.map((m) => {
                const [y, mo] = m.monthKey.split("-");
                return { label: `${y.slice(2)}.${Number(mo)}`, value: m.count, title: `${y}년 ${Number(mo)}월` };
              })}
            />
          </Panel>
        </section>
      </div>
    </div>
  );
}

/** "**굵게**" 표시만 지원하는 아주 작은 렌더러(인사이트 문장용). */
function bold(text: string): ReactNode[] {
  return text.split("**").map((part, i) => (i % 2 ? <strong key={i} className="font-bold text-neutral-950">{part}</strong> : part));
}

function Panel({ title, className = "", children }: { title: string; className?: string; children: ReactNode }) {
  return (
    <div className={`min-w-0 rounded-2xl border border-white/80 bg-white/85 shadow-[0_8px_24px_rgba(40,80,120,0.06)] backdrop-blur-sm p-5 sm:p-6 ${className}`}>
      <h2 className="mb-5 text-[15px] font-semibold text-neutral-900">{title}</h2>
      {children}
    </div>
  );
}

function Empty({ children }: { children: ReactNode }) {
  return <p className="py-8 text-center text-sm text-neutral-400">{children}</p>;
}

function Kpi({
  label,
  value,
  sub,
  tone,
  badge,
}: {
  label: string;
  value: string;
  sub?: string;
  tone?: "bad";
  badge?: { text: string; good: boolean };
}) {
  return (
    <div className="rounded-2xl border border-white/80 bg-white/85 shadow-[0_8px_24px_rgba(40,80,120,0.06)] backdrop-blur-sm p-4 sm:p-5">
      <p className="text-[13px] text-neutral-500">{label}</p>
      <p className={`mt-1.5 whitespace-nowrap text-xl font-bold tracking-tight tabular-nums xl:text-[19px] ${tone === "bad" ? "text-[#BE3A2A]" : "text-neutral-950"}`}>{value}</p>
      {badge ? (
        <span className={`mt-2 inline-block rounded-full px-2 py-0.5 text-xs font-semibold ${badge.good ? "bg-[#E0EFE8] text-[#2F5F4B]" : "bg-[#FFE4DE] text-[#BE3A2A]"}`}>
          {badge.text}
        </span>
      ) : (
        sub && <p className="mt-2 text-xs text-neutral-400">{sub}</p>
      )}
    </div>
  );
}

/** 참가 전환 퍼널: 각 단계까지 온 행사 수(지금 그 단계 이상인 기록). 아래로 갈수록 좁아진다. */
function Funnel({ stats }: { stats: DashboardStats }) {
  const c = stats.statusCounts;
  const steps = [
    { label: "관심", count: stats.totalParticipations, color: FUNNEL.interested.bg, ink: FUNNEL.interested.ink },
    { label: "참가 예정", count: c.planning_to_attend + c.attended, color: FUNNEL.planning_to_attend.bg, ink: FUNNEL.planning_to_attend.ink },
    { label: "참가 완료", count: c.attended, color: FUNNEL.attended.bg, ink: FUNNEL.attended.ink },
  ];
  const top = Math.max(steps[0].count, 1);
  return (
    <div>
      <ol>
        {steps.map((step, i) => {
          const prev = steps[i - 1];
          return (
            <li key={step.label}>
              {prev && (
                <p className="py-1.5 text-center text-xs text-neutral-400">
                  ↓ {prev.count > 0 ? `${Math.round((step.count / prev.count) * 100)}%` : "-"}
                </p>
              )}
              <div
                className="mx-auto flex h-14 items-center justify-center rounded-xl text-sm font-semibold"
                style={{ width: `${Math.max((step.count / top) * 100, 30)}%`, background: step.color, color: step.ink }}
                title={`${step.label} ${step.count}건`}
              >
                {step.label} <span className="ml-1.5 tabular-nums">{step.count}</span>
              </div>
            </li>
          );
        })}
      </ol>
      <p className="mt-5 text-center text-sm text-neutral-600">
        전체 참가율 <span className="font-bold text-neutral-950">{Math.round((c.attended / top) * 100)}%</span>
      </p>
    </div>
  );
}

function ProductBars({ stats }: { stats: DashboardStats }) {
  const max = Math.max(...stats.popularProducts.map((p) => p.totalRevenue), 1);
  return (
    <ul className="space-y-4">
      {stats.popularProducts.map((p) => (
        <li key={p.productName}>
          <div className="flex items-baseline justify-between gap-2 text-sm">
            <span className="truncate text-neutral-700" title={p.productName}>
              {p.productName}
            </span>
            <span className="shrink-0 tabular-nums">
              <span className="font-semibold text-neutral-900">{won(p.totalRevenue)}</span>
              <span className="ml-2 text-xs text-neutral-400">판매율 {p.sellThrough != null ? `${Math.round(p.sellThrough * 100)}%` : "-"}</span>
            </span>
          </div>
          <div className="mt-1.5 h-2 rounded-full bg-neutral-100">
            <div className="h-2 rounded-full" style={{ width: `${(p.totalRevenue / max) * 100}%`, background: BAR_COLOR }} />
          </div>
        </li>
      ))}
    </ul>
  );
}
