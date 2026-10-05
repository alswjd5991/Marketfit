import type { ReactNode } from "react";
import { InteractiveLineChart } from "@/components/ui/interactive-line-chart";
import { ProductRevenueAreaChart } from "@/components/ui/product-revenue-area-chart";
import type { DashboardStats } from "./data";
import { EventRevenueChart } from "./event-revenue-chart";

/**
 * "최근 성과" — 메인 페이지와 대시보드가 같이 쓰는 성과 요약(숫자 5개 + 행사별 매출 추이 + 품목별 매출 비교).
 * 데이터·내용은 두 곳이 같고 배치만 다르다:
 * - stack(메인): 위에 숫자 5개 가로 한 줄, 아래 차트 2개 나란히
 * - side(대시보드): 왼쪽에 차트 2개를 위아래로 넓게, 오른쪽에 숫자 카드를 세로로. 행사별 매출 추이에 유형 드롭다운.
 */
export function RecentPerformance({
  stats,
  withTypeFilter = false,
  layout = "stack",
}: {
  stats: DashboardStats;
  withTypeFilter?: boolean;
  layout?: "stack" | "side";
}) {
  const side = layout === "side";
  const chartHeight = side ? 230 : 200;
  const revenuePoints = stats.eventRevenueTrend.map((e) => ({
    label: e.eventName.length > 6 ? `${e.eventName.slice(0, 6)}…` : e.eventName,
    value: e.revenue,
    title: e.eventName,
    meta: e.startDate,
    sublabel: e.netProfit != null ? `순이익 ${e.netProfit.toLocaleString()}원` : undefined,
  }));

  const tiles = (
    <div className={side ? "grid grid-cols-2 gap-3 lg:h-full lg:grid-cols-1 lg:grid-rows-5" : "grid grid-cols-2 gap-4 lg:grid-cols-5"}>
      <PerformanceTile label="총 참가 행사" value={`${stats.totalParticipations}건`} />
      <PerformanceTile label="참가 완료" value={`${stats.statusCounts.attended}건`} />
      <PerformanceTile label="총 매출" value={stats.totalRevenue != null ? `${stats.totalRevenue.toLocaleString()}원` : "기록 없음"} />
      <PerformanceTile label="총 순이익" value={stats.totalNetProfit != null ? `${stats.totalNetProfit.toLocaleString()}원` : "기록 없음"} />
      <PerformanceTile label="평균 만족도" value={stats.averageSatisfaction != null ? `${stats.averageSatisfaction.toFixed(1)} / 5.0` : "기록 없음"} />
    </div>
  );

  const charts = (
    <div className={side ? "flex min-w-0 flex-col gap-5" : "mt-5 grid gap-5 lg:grid-cols-2"}>
      {withTypeFilter && revenuePoints.length > 0 ? (
        <div className="min-w-0 overflow-hidden rounded-2xl bg-[#F8FBFD] p-4">
          <EventRevenueChart title="행사별 매출 추이" height={chartHeight} points={stats.eventRevenueTrend} groups={stats.groupPerformance} />
        </div>
      ) : (
        <ChartPanel title="행사별 매출 추이">
          {revenuePoints.length === 0 ? (
            <ChartEmpty text="매출 기록 없음" />
          ) : (
            <InteractiveLineChart color="#F2542D" format="currency" height={chartHeight} points={revenuePoints} />
          )}
        </ChartPanel>
      )}

      <ChartPanel title="품목별 매출 비교">
        {stats.popularProducts.length === 0 ? (
          <ChartEmpty text="상품별 판매 실적 없음" />
        ) : (
          <ProductRevenueAreaChart height={chartHeight} items={stats.popularProducts.map((p) => ({ label: p.productName, value: p.totalRevenue }))} />
        )}
      </ChartPanel>
    </div>
  );

  return (
    <div className="col-span-full rounded-[24px] border border-[#DEDFE3] bg-white p-6 shadow-[0_12px_35px_rgba(40,80,120,0.06)]">
      {side ? (
        <div className="grid gap-5 lg:grid-cols-[minmax(0,1fr)_240px]">
          {charts}
          {tiles}
        </div>
      ) : (
        <>
          {tiles}
          {charts}
        </>
      )}
    </div>
  );
}

function ChartPanel({ title, children }: { title: string; children: ReactNode }) {
  return (
    <div className="min-w-0 overflow-hidden rounded-2xl bg-[#F8FBFD] p-4">
      <p className="mb-3 text-sm font-semibold text-[#1F2023]">{title}</p>
      {children}
    </div>
  );
}

function ChartEmpty({ text }: { text: string }) {
  return <p className="flex h-[200px] items-center justify-center text-sm text-[#8A8D93]">{text}</p>;
}

function PerformanceTile({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex flex-col justify-center rounded-2xl bg-[#F8FBFD] px-5 py-4">
      <p className="text-xs font-medium text-[#6B6E74]">{label}</p>
      <p className="mt-2 text-xl font-bold tracking-tight text-[#1F2023]">{value}</p>
    </div>
  );
}
