"use client";

type RevenueItem = {
  label: string;
  value: number;
};

export function ProductRevenueAreaChart({ items }: { items: RevenueItem[] }) {
  const width = 640;
  const height = 280;
  const paddingLeft = 55;
  const paddingRight = 55;
  const paddingTop = 24;
  const paddingBottom = 64;

  const plotWidth = width - paddingLeft - paddingRight;
  const plotHeight = height - paddingTop - paddingBottom;

  const maxValue = Math.max(...items.map((item) => item.value), 1);
  const upperBound = maxValue * 1.15;

  const points = items.map((item, index) => {
    const x =
      items.length === 1
        ? paddingLeft + plotWidth / 2
        : paddingLeft + (index / (items.length - 1)) * plotWidth;

    const y =
      paddingTop + plotHeight - (item.value / upperBound) * plotHeight;

    return {
      ...item,
      x,
      y,
    };
  });

  const linePath = points
    .map((point, index) =>
      index === 0 ? `M ${point.x} ${point.y}` : `L ${point.x} ${point.y}`
    )
    .join(" ");

  const areaPath = `
    ${linePath}
    L ${points[points.length - 1]?.x ?? paddingLeft} ${paddingTop + plotHeight}
    L ${points[0]?.x ?? paddingLeft} ${paddingTop + plotHeight}
    Z
  `;

  const totalRevenue = items.reduce((sum, item) => sum + item.value, 0);
  const topItem = [...items].sort((a, b) => b.value - a.value)[0];

  return (
    <div className="w-full">
      <svg
        viewBox={`0 0 ${width} ${height}`}
        className="h-[280px] w-full"
        preserveAspectRatio="none"
      >
        <defs>
          <linearGradient id="revenueAreaFill" x1="0" x2="0" y1="0" y2="1">
            <stop offset="0%" stopColor="#8B5CF6" stopOpacity="0.35" />
            <stop offset="100%" stopColor="#EC4899" stopOpacity="0.06" />
          </linearGradient>

          <linearGradient id="revenueLineStroke" x1="0" x2="1" y1="0" y2="0">
            <stop offset="0%" stopColor="#8B5CF6" />
            <stop offset="100%" stopColor="#EC4899" />
          </linearGradient>
        </defs>

        {[0.25, 0.5, 0.75, 1].map((ratio) => {
          const y = paddingTop + plotHeight * ratio;
          return (
            <line
              key={ratio}
              x1={paddingLeft}
              x2={width - paddingRight}
              y1={y}
              y2={y}
              stroke="#EEF2F6"
              strokeWidth="1"
            />
          );
        })}

        <path d={areaPath} fill="url(#revenueAreaFill)" />
        <path
          d={linePath}
          fill="none"
          stroke="url(#revenueLineStroke)"
          strokeWidth="3"
          strokeLinecap="round"
          strokeLinejoin="round"
        />

        {points.map((point, index) => (
          <g key={`${point.label}-${index}`}>
            <circle cx={point.x} cy={point.y} r="5.5" fill="#ffffff" />
            <circle
              cx={point.x}
              cy={point.y}
              r="4"
              fill={index % 2 === 0 ? "#8B5CF6" : "#F59E0B"}
            />
          </g>
        ))}

        {points.map((point, index) => (
          <text
            key={`label-${index}`}
            x={point.x}
            y={height - 24}
            textAnchor="middle"
            fontSize="11"
            fill="#9CA3AF"
          >
            {point.label.length > 6  ? `${point.label.slice(0, 6)}…`  : point.label}
          </text>
        ))}
      </svg>

      <div className="mt-4 grid grid-cols-1 gap-3 sm:grid-cols-3">
        <SummaryMiniCard
          label="총 품목 매출"
          value={`${totalRevenue.toLocaleString()}원`}
          accent="text-[#8B5CF6]"
        />
        <SummaryMiniCard
          label="1위 품목"
          value={topItem?.label ?? "-"}
          accent="text-[#EC4899]"
        />
        <SummaryMiniCard
          label="1위 품목 매출"
          value={topItem ? `${topItem.value.toLocaleString()}원` : "-"}
          accent="text-[#F59E0B]"
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