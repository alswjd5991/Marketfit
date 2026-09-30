"use client";

type DonutItem = {
  label: string;
  value: number;
};

const DONUT_COLORS = [
  "#EC4899",
  "#8B5CF6",
  "#F59E0B",
  "#38BDF8",
  "#10B981",
  "#6366F1",
  "#FB7185",
  "#A3A3A3",
];

export function ProductQuantityDonutChart({ items }: { items: DonutItem[] }) {
  const filtered = items.filter((item) => item.value > 0);
  const total = filtered.reduce((sum, item) => sum + item.value, 0);

  const radius = 72;
  const stroke = 20;
  const normalizedRadius = radius - stroke / 2;
  const circumference = normalizedRadius * 2 * Math.PI;

  let cumulative = 0;

  return (
    <div className="grid min-w-0 items-center gap-6 md:grid-cols-[180px_minmax(0,1fr)]">
      <div className="flex flex-col items-center justify-center">
        <div className="relative flex items-center justify-center">
          <svg width={180} height={180} viewBox="0 0 220 220">
            <g transform="rotate(-90 110 110)">
              <circle
                cx="110"
                cy="110"
                r={normalizedRadius}
                fill="transparent"
                stroke="#EEF2F6"
                strokeWidth={stroke}
              />

              {filtered.map((item, index) => {
                const percent = item.value / total;
                const dash = percent * circumference;
                const gap = circumference - dash;
                const dashOffset = -cumulative * circumference;
                cumulative += percent;

                return (
                  <circle
                    key={item.label}
                    cx="110"
                    cy="110"
                    r={normalizedRadius}
                    fill="transparent"
                    stroke={DONUT_COLORS[index % DONUT_COLORS.length]}
                    strokeWidth={stroke}
                    strokeDasharray={`${dash} ${gap}`}
                    strokeDashoffset={dashOffset}
                    strokeLinecap="round"
                  />
                );
              })}
            </g>
          </svg>

          <div className="absolute text-center">
            <p className="text-xs text-neutral-500">총 판매수량</p>
            <p className="mt-1 text-2xl font-bold text-neutral-950">
              {total.toLocaleString()}
            </p>
            <p className="text-xs text-neutral-400">개</p>
          </div>
        </div>
      </div>

      <div className="min-w-0 space-y-3">
        {filtered.map((item, index) => {
          const ratio = total > 0 ? (item.value / total) * 100 : 0;

          return (
            <div
              key={item.label}
              className="flex items-center justify-between gap-4 rounded-xl bg-neutral-50 px-3 py-2"
            >
              <div className="flex min-w-0 items-center gap-2">
                <span
                  className="h-3 w-3 shrink-0 rounded-full"
                  style={{ backgroundColor: DONUT_COLORS[index % DONUT_COLORS.length] }}
                />
                <p className="min-w-0 break-words text-sm font-medium leading-5 text-neutral-700">
                 {item.label}
                </p>
              </div>

              <div className="shrink-0 text-right">
                <p className="text-sm font-semibold text-neutral-900">
                  {item.value.toLocaleString()}개
                </p>
                <p className="text-xs text-neutral-400">{ratio.toFixed(1)}%</p>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}