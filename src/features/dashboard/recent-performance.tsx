import type { ReactNode } from "react";
import { Star } from "lucide-react";
import { InteractiveLineChart } from "@/components/ui/interactive-line-chart";
import { ProductRevenueAreaChart } from "@/components/ui/product-revenue-area-chart";
import type { DashboardStats } from "./data";
import { EventRevenueChart } from "./event-revenue-chart";
import { STATUS_FILL } from "@/features/participations/status-labels";
import { InfoTip } from "@/components/ui/info-tip";

/**
 * "최근 성과" — 메인 페이지와 대시보드가 같이 쓰는 성과 요약(숫자 5개 + 행사별 매출 추이 + 품목별 매출 비교).
 * 데이터·내용은 두 곳이 같고 배치만 다르다:
 * - stack(메인): 위에 숫자 5개 가로 한 줄, 아래 차트 2개 나란히
 * - side(대시보드): 왼쪽에 차트 2개를 위아래로 넓게, 오른쪽에 숫자 카드를 세로로. 행사별 매출 추이에 유형 드롭다운.
 * secondChart를 주면 두 번째 차트(품목별 매출 비교) 자리에 그 차트를 넣는다 — 대시보드는 여기에 같은 업종 대비 매출을
 * 넣고 품목별 매출 비교는 "상품" 묶음으로 옮긴다. 메인 페이지는 secondChart 없이 그대로 쓴다.
 */
export function RecentPerformance({
  stats,
  withTypeFilter = false,
  layout = "stack",
  secondChart,
}: {
  stats: DashboardStats;
  withTypeFilter?: boolean;
  layout?: "stack" | "side";
  secondChart?: ReactNode;
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

  const c = stats.statusCounts;
  const total = stats.totalParticipations;
  const attendRate = total ? c.attended / total : 0;
  const margin = stats.totalRevenue && stats.totalNetProfit != null ? stats.totalNetProfit / stats.totalRevenue : null;
  // 대시보드(side) 카드에만 붙는 맥락 표시 — 숫자 아래 빈 공간을 의미 있는 정보로 채운다. (별점은 메인에도 표시)
  const extra = (node: ReactNode) => (side ? node : undefined);

  const planned = c.planning_to_attend + c.applied + c.planning_to_apply;
  // 대시보드(side)는 참가 카드 2개(총 참가·참가 완료)를 하나로 합쳐 4개, 메인(stack)은 5개 그대로.
  const participationTiles = side ? (
    <PerformanceTile
      large
      label="참가 행사"
      value={`${total}건`}
      extra={
        <div>
          <div className="flex h-1.5 gap-0.5 overflow-hidden rounded-full">
            <span style={{ flex: c.attended, background: STATUS_FILL.attended.bg }} />
            <span style={{ flex: planned, background: STATUS_FILL.planning_to_attend.bg }} />
            <span style={{ flex: c.interested + c.cancelled, background: STATUS_FILL.interested.bg }} />
          </div>
          <p className="mt-1.5 text-xs text-[#8A8D93]">
            완료 {c.attended} · 예정 {planned} · 관심 {c.interested + c.cancelled} · 참가율 {Math.round(attendRate * 100)}%
          </p>
        </div>
      }
    />
  ) : (
    <>
      <PerformanceTile label="총 참가 행사" value={`${total}건`} />
      <PerformanceTile label="참가 완료" value={`${c.attended}건`} />
    </>
  );

  const tiles = (
    <div className={side ? "grid grid-cols-2 gap-3 lg:h-full lg:grid-cols-1 lg:grid-rows-4" : "grid grid-cols-2 gap-4 lg:grid-cols-5"}>
      {participationTiles}
      <PerformanceTile
        large={side}
        label="총 매출"
        value={stats.totalRevenue != null ? `${stats.totalRevenue.toLocaleString()}원` : "기록 없음"}
        extra={extra(
          stats.totalRevenue != null && <p className="text-xs text-[#8A8D93]">{stats.revenueEntryCount}회 기록</p>
        )}
      />
      <PerformanceTile
        large={side}
        label="총 순이익"
        value={stats.totalNetProfit != null ? `${stats.totalNetProfit.toLocaleString()}원` : "기록 없음"}
        extra={extra(
          margin != null && (
            <p className="text-xs text-[#8A8D93]">
              순이익률 <span className="font-semibold text-[#43464B]">{Math.round(margin * 100)}%</span> · 매출 대비
            </p>
          )
        )}
      />
      <PerformanceTile
        large={side}
        label="평균 만족도"
        value={stats.averageSatisfaction != null ? `${stats.averageSatisfaction.toFixed(1)} / 5.0` : "기록 없음"}
        extra={
          stats.averageSatisfaction != null && (
            <div className="flex items-center gap-2">
              <span className="flex gap-0.5" aria-hidden>
                {[1, 2, 3, 4, 5].map((n) => (
                  <Star
                    key={n}
                    className="size-3.5"
                    fill={stats.averageSatisfaction! >= n - 0.5 ? "#F5B700" : "none"}
                    stroke={stats.averageSatisfaction! >= n - 0.5 ? "#F5B700" : "#BEBFC1"}
                  />
                ))}
              </span>
              <span className="text-xs text-[#8A8D93]">{stats.satisfactionEntryCount}회 평가</span>
            </div>
          )
        }
      />
    </div>
  );

  const charts = (
    <div className={side ? "flex min-w-0 flex-col gap-5" : "mt-5 grid gap-5 lg:grid-cols-2"}>
      {withTypeFilter && revenuePoints.length > 0 ? (
        <div className="min-w-0 rounded-2xl bg-[#F8FBFD] p-4">
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

      {secondChart ?? (
        <ChartPanel title="품목별 매출 비교">
          <ProductRevenueComparison stats={stats} height={chartHeight} />
        </ChartPanel>
      )}
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

export function ChartPanel({ title, info, children }: { title: string; info?: ReactNode; children: ReactNode }) {
  return (
    <div className="min-w-0 rounded-2xl bg-[#F8FBFD] p-4">
      <p className="mb-3 flex items-center gap-1.5 text-sm font-semibold text-[#1F2023]">
        {title}
        {info && <InfoTip label={`${title} 설명`}>{info}</InfoTip>}
      </p>
      {children}
    </div>
  );
}

/** 품목별 매출 비교 차트(메인·대시보드 공용). 대시보드는 보라 계열로. */
export function ProductRevenueComparison({ stats, height, tone = "teal" }: { stats: DashboardStats; height: number; tone?: "teal" | "purple" }) {
  if (stats.popularProducts.length === 0) return <ChartEmpty text="상품별 판매 실적 없음" />;
  const colors = tone === "purple" ? { color: "#8A7FD6", accent: "text-[#5B4FC4]" } : {};
  return <ProductRevenueAreaChart height={height} items={stats.popularProducts.map((p) => ({ label: p.productName, value: p.totalRevenue }))} {...colors} />;
}

function ChartEmpty({ text }: { text: string }) {
  return <p className="flex h-[200px] items-center justify-center text-sm text-[#8A8D93]">{text}</p>;
}

function PerformanceTile({ label, value, large = false, extra }: { label: string; value: string; large?: boolean; extra?: ReactNode }) {
  return (
    <div className="flex flex-col justify-center gap-2.5 rounded-2xl bg-[#F8FBFD] px-5 py-4">
      <div>
        <p className="text-xs font-medium text-[#6B6E74]">{label}</p>
        <p className={`mt-1.5 font-bold tracking-tight text-[#1F2023] ${large ? "text-2xl" : "mt-2 text-xl"}`}>{value}</p>
      </div>
      {extra}
    </div>
  );
}
