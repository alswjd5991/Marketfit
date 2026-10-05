"use client";

import { useState } from "react";

export interface ColumnPoint {
  /** x축 라벨(짧게). */
  label: string;
  value: number;
  /** 같은 축에 겹쳐 그리는 선 값(예: 순이익). 없으면 그 점은 건너뛴다. */
  line?: number | null;
  /** 툴팁 제목(행사명 등). */
  title?: string;
  meta?: string;
}

/**
 * 세로 막대 + (선택) 같은 단위의 선 하나. 축은 하나뿐이다(이중 축 금지 — dataviz 스킬).
 * 음수(적자 순이익)도 0 기준선 아래로 그린다. 막대마다 넓은 투명 영역에 호버 툴팁.
 */
export function ColumnChart({
  points,
  unit,
  barColor = "#0A78AE",
  lineColor = "#F2542D",
  barName,
  lineName,
  height = 240,
  labelEvery,
}: {
  points: ColumnPoint[];
  unit: "원" | "건";
  barColor?: string;
  lineColor?: string;
  barName: string;
  lineName?: string;
  height?: number;
  /** x축 라벨을 n개마다 하나씩만 표시(라벨이 겹치지 않게). 기본은 개수에 맞춰 자동. */
  labelEvery?: number;
}) {
  const [active, setActive] = useState<number | null>(null);
  const width = 640;
  const pad = { top: 16, right: 8, bottom: 28, left: 52 };
  const plotW = width - pad.left - pad.right;
  const plotH = height - pad.top - pad.bottom;

  const values = points.flatMap((p) => [p.value, p.line ?? 0]);
  const max = niceCeil(Math.max(...values, 1));
  const min = Math.min(...values, 0) < 0 ? -niceCeil(-Math.min(...values)) : 0;
  const y = (v: number) => pad.top + ((max - v) / (max - min)) * plotH;
  const slot = plotW / Math.max(points.length, 1);
  const barW = Math.max(2, Math.min(28, slot - 2)); // 막대 사이 최소 2px 간격
  const cx = (i: number) => pad.left + slot * (i + 0.5);
  const every = labelEvery ?? Math.max(1, Math.ceil(points.length / 8));
  const ticks = [...new Set([min, 0, max / 2, max])].filter((v) => unit !== "건" || Number.isInteger(v));

  const linePts = points.map((p, i) => (p.line != null ? `${cx(i)},${y(p.line)}` : null));
  // 값이 빠진 점에서는 선을 끊고 다음 점에서 새로 시작한다.
  const linePath = linePts.map((pt, i) => (pt ? `${i > 0 && linePts[i - 1] ? "L" : "M"}${pt}` : "")).join(" ").trim();
  const hovered = active != null ? points[active] : null;

  return (
    <div className="relative" onMouseLeave={() => setActive(null)}>
      <div className="mb-3 flex items-center gap-4 text-xs text-neutral-500">
        <span className="flex items-center gap-1.5">
          <span className="size-2.5 rounded-[3px]" style={{ background: barColor }} />
          {barName}
        </span>
        {lineName && (
          <span className="flex items-center gap-1.5">
            <span className="h-0.5 w-3 rounded-full" style={{ background: lineColor }} />
            {lineName}
          </span>
        )}
      </div>
      <svg viewBox={`0 0 ${width} ${height}`} className="h-auto w-full" role="img" aria-label={barName}>
        {ticks.map((t) => (
          <g key={t}>
            <line x1={pad.left} x2={width - pad.right} y1={y(t)} y2={y(t)} stroke={t === 0 ? "#cbd5e1" : "#eef2f6"} />
            <text x={pad.left - 8} y={y(t) + 4} textAnchor="end" fontSize="11" fill="#94a3b8">
              {formatShort(t, unit)}
            </text>
          </g>
        ))}
        {points.map((p, i) => {
          const top = y(Math.max(p.value, 0));
          const h = Math.abs(y(p.value) - y(0));
          return (
            <g key={i}>
              <path
                d={roundedTop(cx(i) - barW / 2, top, barW, h)}
                fill={barColor}
                opacity={active == null || active === i ? 1 : 0.35}
                className="transition-opacity duration-150"
              />
              {i % every === 0 && (
                <text x={cx(i)} y={height - 8} textAnchor="middle" fontSize="11" fill={active === i ? "#334155" : "#94a3b8"}>
                  {p.label}
                </text>
              )}
              <rect x={cx(i) - slot / 2} y={pad.top} width={slot} height={plotH} fill="transparent" onMouseEnter={() => setActive(i)} />
            </g>
          );
        })}
        {linePath && <path d={linePath} fill="none" stroke={lineColor} strokeWidth="2" strokeLinejoin="round" pointerEvents="none" />}
        {points.map((p, i) =>
          p.line != null ? (
            <circle key={i} cx={cx(i)} cy={y(p.line)} r={active === i ? 5 : 3.5} fill={lineColor} stroke="#fff" strokeWidth="2" pointerEvents="none" />
          ) : null
        )}
      </svg>
      {hovered && (
        <div
          className="pointer-events-none absolute top-8 z-20 min-w-[150px] max-w-[240px] rounded-xl border border-neutral-200 bg-white px-3 py-2.5 text-xs shadow-lg"
          style={{
            left: `${(cx(active!) / width) * 100}%`,
            transform: cx(active!) > width * 0.6 ? "translateX(calc(-100% - 12px))" : "translateX(12px)",
          }}
        >
          <p className="font-semibold text-neutral-900">{hovered.title ?? hovered.label}</p>
          {hovered.meta && <p className="mt-0.5 text-neutral-400">{hovered.meta}</p>}
          <p className="mt-1.5 flex justify-between gap-3 text-neutral-600">
            {barName} <span className="font-semibold tabular-nums text-neutral-900">{hovered.value.toLocaleString()}{unit}</span>
          </p>
          {lineName && hovered.line != null && (
            <p className="mt-0.5 flex justify-between gap-3 text-neutral-600">
              {lineName} <span className="font-semibold tabular-nums text-neutral-900">{hovered.line.toLocaleString()}{unit}</span>
            </p>
          )}
        </div>
      )}
    </div>
  );
}

/** 위쪽 모서리만 4px 둥근 막대(기준선 쪽은 각지게). 막대 값은 0 이상만 들어온다(매출·건수). */
function roundedTop(x: number, top: number, w: number, h: number) {
  const r = Math.min(4, w / 2, h);
  return `M${x},${top + h} V${top + r} Q${x},${top} ${x + r},${top} H${x + w - r} Q${x + w},${top} ${x + w},${top + r} V${top + h} Z`;
}

function niceCeil(v: number) {
  const mag = 10 ** Math.floor(Math.log10(v));
  return Math.ceil(v / mag) * mag;
}

function formatShort(v: number, unit: "원" | "건") {
  if (unit === "건") return `${v}`;
  if (Math.abs(v) >= 10000) return `${Math.round(v / 10000)}만`;
  return v.toLocaleString();
}
