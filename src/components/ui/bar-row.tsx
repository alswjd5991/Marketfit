// 가로 막대 한 줄. dataviz 스킬의 마크 스펙을 따른다: 두께 20px(<=24px 캡),
// 기준선(왼쪽)은 각지고 데이터 끝(오른쪽)만 4px 라운드, 값은 막대 끝에 직접 라벨.
// 마우스를 올리면 막대가 살짝 두꺼워지고 건수·비율 말풍선이 뜬다. 나머지 줄을
// 흐리게 하는 건 감싸는 쪽에서 BAR_ROWS_HOVER_CLASS로 처리한다.
export function BarRow({
  label,
  value,
  max,
  color,
  valueLabel,
  total,
  note,
}: {
  label: string;
  value: number;
  max: number;
  color: string;
  valueLabel?: string;
  /** 넘기면 말풍선에 전체 대비 비율을 함께 보여준다 */
  total?: number;
  /** 말풍선 맨 아래 보충 설명(예: "3건 평균") */
  note?: string;
}) {
  // 음수(손실)는 막대 길이 0으로 두고 값 라벨로만 보여준다
  const pct = max > 0 ? Math.max(0, (value / max) * 100) : 0;
  const share = total && total > 0 ? (value / total) * 100 : null;

  return (
    <div className="group/row relative flex cursor-default items-center gap-3 transition-opacity duration-200">
      <span className="w-28 shrink-0 truncate text-sm text-neutral-600 group-hover/row:font-medium group-hover/row:text-neutral-900" title={label}>
        {label}
      </span>
      <div className="relative flex h-5 flex-1 items-center">
        <div
          className="h-5 origin-left transition-transform duration-200 group-hover/row:scale-y-[1.25]"
          style={{ width: `${pct}%`, backgroundColor: color, borderRadius: "0 4px 4px 0" }}
        />

        {/* 마우스를 올리면 뜨는 말풍선 */}
        {/* 곡선 그래프(SmoothAreaChart) 말풍선과 같은 모양 */}
        <div
          className="pointer-events-none absolute bottom-full z-20 mb-2 hidden min-w-[150px] whitespace-nowrap rounded-2xl border border-neutral-200 bg-white px-4 py-3 shadow-[0_12px_35px_rgba(15,23,42,0.14)] group-hover/row:block"
          style={{ left: `min(${pct}%, calc(100% - 160px))` }}
        >
          <p className="flex items-center gap-1.5 text-xs font-medium text-neutral-500">
            <span className="size-2 rounded-full" style={{ backgroundColor: color }} />
            {label}
          </p>
          {/* 막대 색 중 연한 색(관심·취소)은 글자로 읽기 어려워 값은 차콜로 쓴다 */}
          <p className="mt-2 text-lg font-bold text-neutral-900">
            {valueLabel ?? `${value.toLocaleString()}건`}
          </p>
          {share !== null && (
            <p className="mt-0.5 text-xs text-neutral-500">전체의 {share.toFixed(1)}%</p>
          )}
          {note && <p className="mt-0.5 text-xs text-neutral-500">{note}</p>}
        </div>
      </div>
      <span className="min-w-10 shrink-0 whitespace-nowrap text-right text-sm font-medium tabular-nums text-neutral-900">
        {valueLabel ?? value}
      </span>
    </div>
  );
}

// BarRow들을 감싸는 요소에 붙이면, 한 줄에 마우스를 올렸을 때 나머지 줄이 흐려진다.
export const BAR_ROWS_HOVER_CLASS = "[&:hover>*]:opacity-40 [&>*:hover]:opacity-100!";
