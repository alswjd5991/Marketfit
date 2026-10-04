"use client";

import { SmoothAreaChart } from "@/components/ui/smooth-area-chart";

type TrendEvent = { eventName: string; startDate: string | null };
type TrendSeries = { productName: string; values: number[] };

// 레트로 팝 그래프 팔레트 앞쪽 5색 — 품목 곡선 순서대로 배정
const SERIES_COLORS = ["#3B8EDB", "#F2542D", "#0E9594", "#F5B700", "#E86A92"];

/** 품목별 판매 수량을 행사 순서대로 겹쳐 그린다(공용 SmoothAreaChart 형식). */
export function ProductSalesTrendChart({
  events,
  series,
  height = 300,
}: {
  events: TrendEvent[];
  series: TrendSeries[];
  height?: number;
}) {
  return (
    <SmoothAreaChart
      height={height}
      formatValue={(v) => `${v.toLocaleString()}개`}
      points={events.map((e) => ({ label: e.eventName, title: e.eventName, meta: e.startDate }))}
      series={series.map((s, i) => ({
        name: s.productName,
        color: SERIES_COLORS[i % SERIES_COLORS.length],
        values: s.values,
      }))}
    />
  );
}
