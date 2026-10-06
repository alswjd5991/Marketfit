"use client";

import { SmoothAreaChart } from "@/components/ui/smooth-area-chart";

type RevenueItem = {
  label: string;
  value: number;
};

/** 품목별 매출 비교(공용 SmoothAreaChart 형식) + 아래에 요약 카드 3개. */
export function ProductRevenueAreaChart({
  items,
  height = 280,
  color = "#0E9594",
  accent = "text-[#0E7C78]",
}: {
  items: RevenueItem[];
  height?: number;
  /** 막대·영역 색(기본 청록 — 메인 페이지), 대시보드는 보라 계열 */
  color?: string;
  accent?: string;
}) {
  const totalRevenue = items.reduce((sum, item) => sum + item.value, 0);
  const topItem = [...items].sort((a, b) => b.value - a.value)[0];

  return (
    <div className="w-full">
      <SmoothAreaChart
        bars
        height={height}
        formatValue={(v) => `${v.toLocaleString()}원`}
        points={items.map((item) => ({ label: item.label, title: item.label }))}
        series={[
          {
            name: "매출",
            color,
            values: items.map((item) => item.value),
            sublabels: items.map((item) =>
              totalRevenue > 0
                ? `전체 품목 매출의 ${((item.value / totalRevenue) * 100).toFixed(1)}%`
                : undefined
            ),
          },
        ]}
      />

      <div className="mt-4 grid grid-cols-1 gap-3 sm:grid-cols-3">
        <SummaryMiniCard
          label="총 품목 매출"
          value={`${totalRevenue.toLocaleString()}원`}
          accent={accent}
        />
        <SummaryMiniCard
          label="1위 품목"
          value={topItem?.label ?? "-"}
          accent="text-[#D9431E]"
        />
        <SummaryMiniCard
          label="1위 품목 매출"
          value={topItem ? `${topItem.value.toLocaleString()}원` : "-"}
          accent="text-[#A87A00]"
        />
      </div>
    </div>
  );
}

function SummaryMiniCard({
  label,
  value,
  accent,
}: {
  label: string;
  value: string;
  accent?: string;
}) {
  return (
    <div className="rounded-2xl bg-neutral-50 px-4 py-3">
      <p className="text-xs text-neutral-500">{label}</p>
      <p className={`mt-1 text-sm font-semibold text-neutral-900 ${accent ?? ""}`}>
        {value}
      </p>
    </div>
  );
}
