"use client";

import { SmoothAreaChart } from "@/components/ui/smooth-area-chart";

type ChartPoint = {
  label: string;
  value: number;
  title?: string;
  meta?: string;
  sublabel?: string;
};

type InteractiveLineChartProps = {
  points: ChartPoint[];
  color?: string;
  format?: "count" | "currency" | "number";
  height?: number;
};

/** 값 하나의 추이 그래프(공용 SmoothAreaChart 형식) + 아래에 최근 값 한 줄. */
export function InteractiveLineChart({
  points,
  color = "#3B8EDB",
  format = "number",
  height = 260,
}: InteractiveLineChartProps) {
  const lastPoint = points[points.length - 1];

  return (
    <div className="w-full">
      <SmoothAreaChart
        height={height}
        formatValue={(v) => formatChartValue(v, format)}
        points={points.map((p) => ({ label: p.label, title: p.title, meta: p.meta }))}
        series={[
          {
            name: "value",
            color,
            values: points.map((p) => p.value),
            sublabels: points.map((p) => p.sublabel),
          },
        ]}
      />

      {/* 최근 값 */}
      {lastPoint && (
        <div className="mt-1 flex flex-wrap items-center gap-1 text-sm">
          <span className="text-neutral-500">최근:</span>
          <span className="font-semibold text-neutral-900">{formatChartValue(lastPoint.value, format)}</span>
          {lastPoint.sublabel && (
            <>
              <span className="text-neutral-300">·</span>
              <span className="text-neutral-500">{lastPoint.sublabel}</span>
            </>
          )}
        </div>
      )}
    </div>
  );
}

function formatChartValue(value: number, format: "count" | "currency" | "number") {
  switch (format) {
    case "count":
      return `${value.toLocaleString()}건`;

    case "currency":
      return `${value.toLocaleString()}원`;

    default:
      return value.toLocaleString();
  }
}
