import { SERIES_COLORS } from "./chart-colors";

type DonutItem = {
  label: string;
  value: number;
};

const MAX_SLICES = 6; // 도넛은 6조각까지만 — 나머지는 "기타"로 묶는다(dataviz 스킬).

export function ProductQuantityDonutChart({ items }: { items: DonutItem[] }) {
  const sorted = items.filter((item) => item.value > 0).sort((a, b) => b.value - a.value);
  const slices =
    sorted.length > MAX_SLICES
      ? [...sorted.slice(0, MAX_SLICES - 1), { label: "기타", value: sorted.slice(MAX_SLICES - 1).reduce((s, i) => s + i.value, 0) }]
      : sorted;
  const total = slices.reduce((sum, item) => sum + item.value, 0);

  const r = 62;
  const stroke = 18;
  const circumference = 2 * Math.PI * r;
  const gap = slices.length > 1 ? 2 : 0; // 조각 사이 2px 표면 간격
  const lens = slices.map((item) => (item.value / total) * circumference);
  const starts = lens.map((_, i) => lens.slice(0, i).reduce((a, b) => a + b, 0));

  return (
    <div className="flex flex-col items-center gap-5">
      <div className="relative shrink-0">
        <svg width={160} height={160} viewBox="0 0 160 160" role="img" aria-label="품목별 판매 수량 비중">
          <g transform="rotate(-90 80 80)">
            {slices.map((item, i) => {
              return (
                <circle
                  key={item.label}
                  cx="80"
                  cy="80"
                  r={r}
                  fill="none"
                  stroke={item.label === "기타" ? "#cbd5e1" : SERIES_COLORS[i]}
                  strokeWidth={stroke}
                  strokeDasharray={`${Math.max(lens[i] - gap, 0)} ${circumference}`}
                  strokeDashoffset={-starts[i]}
                >
                  <title>{`${item.label}: ${item.value.toLocaleString()}개`}</title>
                </circle>
              );
            })}
          </g>
        </svg>
        <div className="absolute inset-0 flex flex-col items-center justify-center">
          <p className="text-[11px] text-neutral-500">총 판매</p>
          <p className="text-xl font-bold tabular-nums text-neutral-950">{total.toLocaleString()}개</p>
        </div>
      </div>

      <ul className="w-full min-w-0 space-y-2">
        {slices.map((item, i) => (
          <li key={item.label} className="flex items-center justify-between gap-3 text-sm">
            <span className="flex min-w-0 items-center gap-2">
              <span
                className="size-2.5 shrink-0 rounded-full"
                style={{ backgroundColor: item.label === "기타" ? "#cbd5e1" : SERIES_COLORS[i] }}
              />
              <span className="truncate text-neutral-700">{item.label}</span>
            </span>
            <span className="shrink-0 tabular-nums text-neutral-500">
              <span className="font-semibold text-neutral-900">{item.value.toLocaleString()}개</span> · {((item.value / total) * 100).toFixed(0)}%
            </span>
          </li>
        ))}
      </ul>
    </div>
  );
}
