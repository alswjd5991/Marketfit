// 시계열 추이용 단일 시리즈 라인 차트. 서버 컴포넌트라 순수 SVG로 그리고,
// 호버는 각 점의 네이티브 <title>(브라우저 기본 툴팁)로 대신한다 — 커스텀
// 크로스헤어/툴팁은 클라이언트 JS가 필요해 이번 단계에서는 의도적으로
// 생략(dataviz 스킬 interaction.md의 정식 스펙은 아니지만, 값이 이미 마지막
// 점에 직접 라벨로 표시되고 각 점에 호버하면 브라우저 툴팁으로 정확한 값을
// 볼 수 있어 최소한의 상호작용은 유지된다).
//
// 마크 스펙(dataviz 스킬): 선 2px 둥근 join/cap, 마커 지름 10px(>=8px),
// 마커에 배경색 링, 값은 마지막 점에 직접 라벨.
//
// 주의: viewBox를 실제 렌더 픽셀 크기와 1:1로 맞춘다. preserveAspectRatio로
// 정사각형 viewBox를 넓고 납작한 박스에 비균등 스케일하면 원(마커)이 타원으로,
// 선 두께가 축마다 다르게 찌그러진다 — 그 버그를 피하려고 좌표를 처음부터
// 픽셀 단위로 계산한다.

export interface LineChartPoint {
  label: string;
  value: number;
  /** 마지막 점 라벨 옆에 덧붙일 보조 텍스트(예: 순이익) */
  sublabel?: string;
  /** 각 점에 호버했을 때 브라우저 기본 툴팁으로 보여줄 전체 텍스트 */
  title?: string;
}

export function LineChart({
  points,
  color = "#2a78d6",
  valueFormatter = (v: number) => v.toLocaleString(),
}: {
  points: LineChartPoint[];
  color?: string;
  valueFormatter?: (v: number) => string;
}) {
  const n = points.length;
  if (n === 0) return null;

  const height = 160;
  const padX = 20;
  const plotTop = 16;
  const plotBottom = height - 10;
  const widthPx = Math.max(320, n * 72);
  const plotWidth = widthPx - padX * 2;

  const maxValue = Math.max(...points.map((p) => p.value), 1);

  const xFor = (i: number) => padX + (n === 1 ? plotWidth / 2 : (i / (n - 1)) * plotWidth);
  const yFor = (v: number) => plotBottom - (v / maxValue) * (plotBottom - plotTop);

  const pathD = points.map((p, i) => `${i === 0 ? "M" : "L"} ${xFor(i)} ${yFor(p.value)}`).join(" ");
  const last = points[n - 1];

  return (
    <div className="overflow-x-auto">
      <svg
        viewBox={`0 0 ${widthPx} ${height}`}
        width={widthPx}
        height={height}
        className="block"
        role="img"
        aria-label="시계열 추이 차트"
      >
        <line x1={padX} y1={plotBottom} x2={widthPx - padX} y2={plotBottom} stroke="#c3c2b7" strokeWidth={1} />

        {n >= 2 && (
          <path
            d={pathD}
            fill="none"
            stroke={color}
            strokeWidth={2}
            strokeLinejoin="round"
            strokeLinecap="round"
          />
        )}

        {points.map((p, i) => (
          <g key={i}>
            <circle cx={xFor(i)} cy={yFor(p.value)} r={5} fill={color} stroke="#fcfcfb" strokeWidth={2} />
            <title>{p.title ?? `${p.label}: ${valueFormatter(p.value)}`}</title>
          </g>
        ))}
      </svg>

      <div className="mt-1 flex text-[11px] text-neutral-400" style={{ width: widthPx }}>
        {points.map((p, i) => (
          <span key={i} className="flex-1 truncate text-center" title={p.title ?? p.label}>
            {p.label}
          </span>
        ))}
      </div>

      <p className="mt-2 text-sm text-neutral-600">
        최근: <span className="font-semibold text-neutral-900">{valueFormatter(last.value)}</span>
        {last.sublabel && <span className="text-neutral-500"> · {last.sublabel}</span>}
      </p>
    </div>
  );
}
