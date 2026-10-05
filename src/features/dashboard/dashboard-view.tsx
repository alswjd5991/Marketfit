import type { ReactNode } from "react";
import { skyGradient } from "@/components/sky-page";
import { PageHeader } from "@/components/page-header";
import { Lightbulb } from "lucide-react";
import { ColumnChart } from "@/components/ui/column-chart";
import { ProductQuantityDonutChart } from "@/components/ui/product-quantity-donut-chart";
import { SERIES_COLORS, STATUS_COLORS } from "@/components/ui/chart-colors";
import type { DashboardStats } from "@/features/dashboard/data";
import { STATUS_LABEL, STATUS_ORDER } from "@/features/participations/status-labels";
import type { ParticipationStatus } from "@/types/database";

// 관심→참가 예정은 파란 순서 램프, 참가 완료는 good 상태 색. 예전 상태는 toDisplayStatus로 합쳐져 여기 오지 않는다.
const STATUS_COLOR: Partial<Record<ParticipationStatus, string>> = {
  interested: "#9FD0B8", // 사이트 상태 배지와 같은 민트→진한 민트→자몽
  planning_to_attend: STATUS_COLORS.good,
  attended: SERIES_COLORS[1],
};

const won = (n: number) => `${Math.round(n).toLocaleString()}원`;

export function DashboardView({ stats }: { stats: DashboardStats }) {
  const trend = stats.revenueTrend;
  const trendDiff = trend ? (trend.recentAvg - trend.earlierAvg) / trend.earlierAvg : null;
  const statuses = STATUS_ORDER.filter((s) => stats.statusCounts[s] > 0);

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
                  <span className="mt-2.5 size-1.5 shrink-0 rounded-full bg-[#F2542D]/70" />
                  <span className="text-neutral-700">{bold(line)}</span>
                </li>
              ))}
            </ul>
          </section>
        )}

        <section className="mt-5 grid grid-cols-2 gap-3 lg:grid-cols-5">
          <Kpi label="참가 완료" value={`${stats.statusCounts.attended}회`} sub={`전체 기록 ${stats.totalParticipations}건`} />
          <Kpi label="누적 매출" value={stats.totalRevenue != null ? won(stats.totalRevenue) : "기록 없음"} sub={stats.revenueEntryCount ? `${stats.revenueEntryCount}회 합계` : undefined} />
          <Kpi
            label="누적 순이익"
            value={stats.totalNetProfit != null ? won(stats.totalNetProfit) : "기록 없음"}
            tone={stats.totalNetProfit != null && stats.totalNetProfit < 0 ? "bad" : undefined}
            sub={stats.netProfitEntryCount ? `${stats.netProfitEntryCount}회 합계` : undefined}
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
            label="평균 만족도"
            value={stats.averageSatisfaction != null ? `${stats.averageSatisfaction.toFixed(1)} / 5` : "기록 없음"}
            sub={stats.satisfactionEntryCount ? `${stats.satisfactionEntryCount}회 평가` : undefined}
          />
        </section>

        <section className="mt-5 grid gap-5 lg:grid-cols-3">
          <Panel title="행사별 매출·순이익" className="lg:col-span-2">
            {stats.eventRevenueTrend.length === 0 ? (
              <Empty>매출 기록 없음</Empty>
            ) : (
              <ColumnChart
                unit="원"
                height={330}
                barName="매출"
                lineName="순이익"
                points={stats.eventRevenueTrend.map((e) => ({
                  label: e.startDate.slice(2, 7).replace("-", "."),
                  value: e.revenue,
                  line: e.netProfit,
                  title: e.eventName,
                  meta: e.startDate,
                }))}
              />
            )}
          </Panel>

          <div className="flex flex-col gap-5">
            <Panel title="참가 현황">
            <div className="flex h-3 w-full gap-0.5 overflow-hidden rounded-full">
              {statuses.map((s) => (
                <div key={s} style={{ flex: stats.statusCounts[s], background: STATUS_COLOR[s] }} title={`${STATUS_LABEL[s]} ${stats.statusCounts[s]}건`} />
              ))}
            </div>
            <ul className="mt-5 space-y-3">
              {statuses.map((s) => (
                <li key={s} className="flex items-center justify-between text-sm">
                  <span className="flex items-center gap-2 text-neutral-700">
                    <span className="size-2.5 rounded-full" style={{ background: STATUS_COLOR[s] }} />
                    {STATUS_LABEL[s]}
                  </span>
                  <span className="tabular-nums font-semibold text-neutral-900">{stats.statusCounts[s]}건</span>
                </li>
              ))}
            </ul>
          </Panel>
            <Panel title="행사 유형별 평균 순이익">
            {stats.groupPerformance.some((g) => g.avgNetProfit != null) ? (
              <MetricBars
                rows={stats.groupPerformance
                  .filter((g) => g.avgNetProfit != null)
                  .map((g) => ({ label: g.group, sub: `${g.profitCount}회`, value: g.avgNetProfit! }))}
              />
            ) : (
              <Empty>순이익 기록 없음</Empty>
            )}
          </Panel>
          </div>
        </section>

        <section className="mt-5 grid gap-5 lg:grid-cols-3">
          <Panel title="월별 참가" className="lg:col-span-2">
            <ColumnChart
              unit="건"
              barName="참가 행사 수"
              height={200}
              points={stats.monthlyParticipationCounts.map((m) => {
                const [y, mo] = m.monthKey.split("-");
                return { label: mo === "01" || m === stats.monthlyParticipationCounts[0] ? `${y.slice(2)}.${Number(mo)}` : `${Number(mo)}월`, value: m.count, title: `${y}년 ${Number(mo)}월` };
              })}
            />
          </Panel>

          <Panel title="조건별 평균 매출">
            {stats.weatherPerformance.length || stats.venuePerformance.length ? (
              <div className="space-y-5">
                {[stats.weatherPerformance, stats.venuePerformance]
                  .filter((rows) => rows.length)
                  .map((rows, i) => (
                    <MetricBars key={i} rows={rows.map((r) => ({ label: r.label, sub: `${r.count}회`, value: r.avgRevenue }))} />
                  ))}
              </div>
            ) : (
              <Empty>날씨·실내외 기록 없음</Empty>
            )}
          </Panel>
        </section>

        <section className="mt-5 grid gap-5 lg:grid-cols-3">
          <Panel title="품목별 매출·판매율" className="lg:col-span-2">
            {stats.popularProducts.length === 0 ? (
              <Empty>상품별 판매 기록 없음</Empty>
            ) : (
              <ProductBars stats={stats} />
            )}
          </Panel>

          <Panel title="판매 수량 비중">
            {stats.popularProducts.length === 0 ? (
              <Empty>상품별 판매 기록 없음</Empty>
            ) : (
              <ProductQuantityDonutChart items={stats.popularProducts.map((p) => ({ label: p.productName, value: p.totalSold }))} />
            )}
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
      <p className={`mt-1.5 text-xl font-bold tracking-tight tabular-nums sm:text-[22px] ${tone === "bad" ? "text-[#BE3A2A]" : "text-neutral-950"}`}>{value}</p>
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

/** 가로 막대 목록. 음수(적자)는 상태 색으로, 막대 길이는 절댓값 기준. */
function MetricBars({ rows }: { rows: { label: string; sub: string; value: number }[] }) {
  const max = Math.max(...rows.map((r) => Math.abs(r.value)), 1);
  return (
    <ul className="space-y-3">
      {rows.map((r) => (
        <li key={r.label}>
          <div className="flex items-baseline justify-between gap-2 text-sm">
            <span className="truncate text-neutral-700">
              {r.label} <span className="text-xs text-neutral-400">{r.sub}</span>
            </span>
            <span className={`shrink-0 font-semibold tabular-nums ${r.value < 0 ? "text-[#BE3A2A]" : "text-neutral-900"}`}>{won(r.value)}</span>
          </div>
          <div className="mt-1.5 h-2 rounded-full bg-neutral-100">
            <div
              className="h-2 rounded-full"
              style={{ width: `${(Math.abs(r.value) / max) * 100}%`, background: r.value < 0 ? STATUS_COLORS.critical : SERIES_COLORS[0] }}
            />
          </div>
        </li>
      ))}
    </ul>
  );
}

function ProductBars({ stats }: { stats: DashboardStats }) {
  const max = Math.max(...stats.popularProducts.map((p) => p.totalRevenue), 1);
  return (
    <div>
      <div className="mb-2 grid grid-cols-[minmax(0,7rem)_1fr_auto_3.5rem] gap-3 text-xs text-neutral-400">
        <span>상품</span>
        <span />
        <span className="text-right">매출</span>
        <span className="text-right">판매율</span>
      </div>
      <ul className="space-y-3">
        {stats.popularProducts.map((p) => (
          <li key={p.productName} className="grid grid-cols-[minmax(0,7rem)_1fr_auto_3.5rem] items-center gap-3 text-sm">
            <span className="truncate text-neutral-700" title={p.productName}>
              {p.productName}
            </span>
            <div className="h-2 rounded-full bg-neutral-100">
              <div className="h-2 rounded-full" style={{ width: `${(p.totalRevenue / max) * 100}%`, background: SERIES_COLORS[0] }} />
            </div>
            <span className="text-right font-semibold tabular-nums text-neutral-900">{won(p.totalRevenue)}</span>
            <span className="text-right tabular-nums text-neutral-500">{p.sellThrough != null ? `${Math.round(p.sellThrough * 100)}%` : "-"}</span>
          </li>
        ))}
      </ul>
    </div>
  );
}
