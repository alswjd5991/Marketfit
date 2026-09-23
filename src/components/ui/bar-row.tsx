// 가로 막대 한 줄. dataviz 스킬의 마크 스펙을 따른다: 두께 20px(<=24px 캡),
// 기준선(왼쪽)은 각지고 데이터 끝(오른쪽)만 4px 라운드, 값은 막대 끝에 직접 라벨.
export function BarRow({
  label,
  value,
  max,
  color,
  valueLabel,
}: {
  label: string;
  value: number;
  max: number;
  color: string;
  valueLabel?: string;
}) {
  const pct = max > 0 ? (value / max) * 100 : 0;
  return (
    <div className="flex items-center gap-3">
      <span className="w-28 shrink-0 truncate text-sm text-neutral-600" title={label}>
        {label}
      </span>
      <div className="h-5 flex-1">
        <div
          className="h-5"
          style={{ width: `${pct}%`, backgroundColor: color, borderRadius: "0 4px 4px 0" }}
        />
      </div>
      <span className="w-10 shrink-0 text-right text-sm font-medium tabular-nums text-neutral-900">
        {valueLabel ?? value}
      </span>
    </div>
  );
}
