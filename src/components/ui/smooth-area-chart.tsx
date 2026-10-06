"use client";

import { useEffect, useId, useRef, useState } from "react";
import { cn } from "@/lib/utils";

export type SmoothAreaPoint = {
  /** x축에 짧게 쓰는 이름 */
  label: string;
  /** 말풍선 제목(없으면 label) */
  title?: string;
  /** 말풍선 제목 아래 작은 글씨(날짜 등) */
  meta?: string | null;
};

export type SmoothAreaSeries = {
  name: string;
  color: string;
  values: number[];
  /** 한 줄짜리 그래프에서 말풍선 값 아래에 붙는 설명(값과 같은 순서) */
  sublabels?: (string | undefined)[];
};

/**
 * 모든 추이 그래프가 같이 쓰는 형식: 부드러운 곡선 + 그라데이션 영역.
 * x 위치에 마우스를 올리면 점선 세로선과 점이 강조되고 말풍선이 뜬다.
 * 곡선이 여러 개면 범례가 생기고, 범례에 올리면 그 곡선만 강조된다.
 */
export function SmoothAreaChart({
  points,
  series,
  formatValue,
  height = 260,
  bars = false,
  barColors,
}: {
  points: SmoothAreaPoint[];
  series: SmoothAreaSeries[];
  formatValue: (value: number) => string;
  height?: number;
  /** 첫 번째 곡선 값을 곡선 아래 연한 막대로도 그린다(항목 비교용). */
  bars?: boolean;
  /** 막대마다 다른 색(품목 고정 색). 주면 막대를 조금 더 진하게 그린다. */
  barColors?: string[];
}) {
  // useId 결과의 특수문자는 SVG url(#...) 참조를 깨뜨릴 수 있어 걸러 낸다
  const gradientId = `area-${useId().replace(/[^a-zA-Z0-9_-]/g, "")}`;
  const [activeIndex, setActiveIndex] = useState<number | null>(null);
  const [activeSeries, setActiveSeries] = useState<number | null>(null);

  // 실제 그려지는 폭으로 좌표계를 맞춘다 — 고정 폭(640)을 늘려 그리면 넓은 카드에서 글자·점이 가로로 퍼진다.
  const boxRef = useRef<HTMLDivElement>(null);
  const [width, setWidth] = useState(640);
  useEffect(() => {
    const el = boxRef.current;
    if (!el) return;
    const observer = new ResizeObserver(([entry]) => setWidth(Math.max(280, Math.round(entry.contentRect.width))));
    observer.observe(el);
    return () => observer.disconnect();
  }, []);
  const paddingLeft = 44;
  const paddingRight = 24;
  const paddingTop = 24;
  const paddingBottom = 44;
  const plotWidth = width - paddingLeft - paddingRight;
  const plotHeight = height - paddingTop - paddingBottom;
  const baseline = paddingTop + plotHeight;

  const maxValue = Math.max(...series.flatMap((s) => s.values), 1);
  // 값이 작으면(건수 등) 눈금이 "1, 1, 0"처럼 겹치지 않게 짝수 정수로 올린다 → 0 / 절반 / 꼭대기가 모두 정수
  const smallUpper = Math.max(2, Math.ceil(maxValue * 1.2));
  const upperBound = maxValue <= 10 ? smallUpper + (smallUpper % 2) : maxValue * 1.2;
  const multi = series.length > 1;
  const labelStep = Math.max(1, Math.ceil(points.length / Math.max(1, Math.floor((width - 68) / 64)))); // 라벨 하나에 약 64px

  // 막대를 그릴 땐 양 끝 막대가 축 밖으로 나가지 않게 점들을 안쪽으로 들인다(모든 막대 같은 두께).
  const inset = bars ? 24 : 0;
  const xAt = (i: number) =>
    points.length === 1
      ? paddingLeft + plotWidth / 2
      : paddingLeft + inset + (i / (points.length - 1)) * (plotWidth - inset * 2);
  const yAt = (v: number) => baseline - (v / upperBound) * plotHeight;

  // 막대 두께(막대 모드). 끝 막대도 축 안에 들어오는 같은 두께.
  const barStep = points.length > 1 ? (plotWidth - inset * 2) / (points.length - 1) : plotWidth;
  const barW = Math.min(inset * 2 - 8, barStep * 0.45);

  const lines = series.map((s) => {
    const coords = s.values.map((v, i) => ({ x: xAt(i), y: yAt(v) }));
    // 막대 모드에선 곡선·영역을 양 끝 막대의 가장자리까지 평평하게 이어, 막대가 곡선 밖으로 튀어나오지 않게 한다.
    const path =
      bars && coords.length > 1
        ? [{ x: coords[0].x - barW / 2, y: coords[0].y }, ...coords, { x: coords[coords.length - 1].x + barW / 2, y: coords[coords.length - 1].y }]
        : coords;
    const line = smoothPath(path, paddingTop, baseline);
    const area = path.length > 1 ? `${line} L ${path[path.length - 1].x} ${baseline} L ${path[0].x} ${baseline} Z` : "";
    return { coords, line, area };
  });

  const activePoint = activeIndex !== null ? points[activeIndex] : null;
  const activeX = activeIndex !== null ? xAt(activeIndex) : 0;
  const columnWidth = points.length > 1 ? plotWidth / (points.length - 1) : plotWidth;

  return (
    <div className="w-full">
      <div ref={boxRef} className="relative w-full" onMouseLeave={() => setActiveIndex(null)}>
        <svg
          viewBox={`0 0 ${width} ${height}`}
          className="w-full overflow-visible"
          style={{ height }}
          preserveAspectRatio="none"
        >
          <defs>
            {series.map((s, i) => (
              <linearGradient key={i} id={`${gradientId}-${i}`} x1="0" x2="0" y1="0" y2="1">
                <stop offset="0%" stopColor={s.color} stopOpacity="0.32" />
                <stop offset="100%" stopColor={s.color} stopOpacity="0.02" />
              </linearGradient>
            ))}
          </defs>

          {/* 가로 보조선 + 세로축 눈금 */}
          {[0, 0.5, 1].map((ratio) => {
            const y = baseline - plotHeight * ratio;
            return (
              <g key={ratio}>
                <line x1={paddingLeft} x2={width - paddingRight} y1={y} y2={y} stroke="#EEEFF1" strokeWidth="1" />
                <text x={paddingLeft - 10} y={y + 4} textAnchor="end" fontSize="11" fill="#8A8D93">
                  {compactNumber(upperBound * ratio)}
                </text>
              </g>
            );
          })}

          {/* 마우스를 올린 위치의 세로선 */}
          {activeIndex !== null && (
            <line x1={activeX} x2={activeX} y1={paddingTop} y2={baseline} stroke="#BEBFC1" strokeDasharray="4 4" />
          )}

          {/* 영역 + 곡선 */}
          {lines.map((l, i) => {
            const s = series[i];
            const dimmed = activeSeries !== null && activeSeries !== i;
            return (
              <g key={s.name} className="transition-opacity duration-200" opacity={dimmed ? 0.15 : 1}>
                {l.area && <path d={l.area} fill={`url(#${gradientId}-${i})`} />}
                <path
                  d={l.line}
                  fill="none"
                  stroke={s.color}
                  strokeWidth={activeSeries === i ? 3.5 : 2.5}
                  strokeLinecap="round"
                  strokeLinejoin="round"
                />
                {l.coords.map((c, j) => {
                  const active = j === activeIndex;
                  // 점은 평소엔 작게, 마우스를 올린 위치만 크게(나머지 점은 흐리게)
                  return (
                    <g key={j} opacity={activeIndex !== null && !active ? 0.35 : 1}>
                      {active && <circle cx={c.x} cy={c.y} r="9" fill={s.color} opacity="0.15" />}
                      <circle
                        cx={c.x}
                        cy={c.y}
                        r={active ? 4.5 : 2.2}
                        fill={s.color}
                        stroke="white"
                        strokeWidth={active ? 2 : 1}
                      />
                    </g>
                  );
                })}

          {/* 연한 막대(선택) — 영역 채움 위에 그려야 양 끝 막대도 같은 두께로 보인다 */}
          {bars &&
            series[0]?.values.map((v, i) => {
              const w = barW;
              const top = yAt(v);
              return (
                <rect
                  key={`bar-${i}`}
                  x={xAt(i) - w / 2}
                  y={top}
                  width={w}
                  height={Math.max(0, baseline - top)}
                  rx={4}
                  fill={barColors?.[i] ?? series[0].color}
                  opacity={barColors ? (activeIndex === i ? 0.75 : 0.5) : activeIndex === i ? 0.28 : 0.14}
                  className="transition-opacity duration-150"
                />
              );
            })}

              </g>
            );
          })}

          {/* x축 이름 — 점이 많으면 겹치지 않게 일정 간격으로만(마우스 올린 점은 항상) */}
          {points.map((p, i) => (i % labelStep === 0 || activeIndex === i) && (
            <text
              key={`label-${i}`}
              x={xAt(i)}
              y={height - 16}
              textAnchor="middle"
              fontSize="11"
              fill={activeIndex === i ? "#43464B" : "#8A8D93"}
              fontWeight={activeIndex === i ? "600" : "400"}
            >
              {p.label.length > 6 ? `${p.label.slice(0, 6)}…` : p.label}
            </text>
          ))}

          {/* 마우스 감지 영역 */}
          {points.map((_, i) => (
            <rect
              key={`hit-${i}`}
              x={xAt(i) - columnWidth / 2}
              y={paddingTop}
              width={columnWidth}
              height={plotHeight}
              fill="transparent"
              className="cursor-pointer"
              onMouseEnter={() => setActiveIndex(i)}
            />
          ))}
        </svg>

        {/* 말풍선 */}
        {activePoint && activeIndex !== null && (
          <div
            className="pointer-events-none absolute top-2 z-20 min-w-[190px] rounded-2xl border border-neutral-200 bg-white px-4 py-3 shadow-[0_12px_35px_rgba(15,23,42,0.14)]"
            style={{
              left: `${(activeX / width) * 100}%`,
              transform: activeX > width * 0.6 ? "translateX(calc(-100% - 14px))" : "translateX(14px)",
            }}
          >
            <p className="max-w-[220px] text-xs font-medium text-neutral-500">{activePoint.title ?? activePoint.label}</p>
            {activePoint.meta && <p className="mt-0.5 text-xs text-neutral-400">{activePoint.meta}</p>}

            {multi ? (
              <ul className="mt-2 flex flex-col gap-1">
                {series
                  .map((s) => ({ name: s.name, color: s.color, value: s.values[activeIndex] }))
                  .sort((a, b) => b.value - a.value)
                  .map((row) => (
                    <li key={row.name} className="flex items-center justify-between gap-4 text-xs">
                      <span className="flex min-w-0 items-center gap-1.5 text-neutral-600">
                        <span className="size-2 shrink-0 rounded-full" style={{ backgroundColor: row.color }} />
                        <span className="truncate">{row.name}</span>
                      </span>
                      <span className="shrink-0 whitespace-nowrap font-semibold tabular-nums text-neutral-900">
                        {formatValue(row.value)}
                      </span>
                    </li>
                  ))}
              </ul>
            ) : (
              series[0] && (
                <>
                  <p className="mt-2 text-lg font-bold" style={{ color: series[0].color }}>
                    {formatValue(series[0].values[activeIndex])}
                  </p>
                  {series[0].sublabels?.[activeIndex] && (
                    <p className="mt-0.5 text-xs text-neutral-500">{series[0].sublabels[activeIndex]}</p>
                  )}
                </>
              )
            )}
          </div>
        )}
      </div>

      {/* 범례 — 곡선이 여러 개일 때만. 올리면 그 곡선만 강조 */}
      {multi && (
        <div className="mt-3 flex flex-wrap gap-2">
          {series.map((s, i) => (
            <button
              key={s.name}
              type="button"
              onMouseEnter={() => setActiveSeries(i)}
              onMouseLeave={() => setActiveSeries(null)}
              onFocus={() => setActiveSeries(i)}
              onBlur={() => setActiveSeries(null)}
              className={cn(
                "flex items-center gap-1.5 rounded-full bg-neutral-50 px-3 py-1 text-xs text-neutral-600 transition-opacity",
                activeSeries !== null && activeSeries !== i && "opacity-40"
              )}
            >
              <span className="size-2 rounded-full" style={{ backgroundColor: s.color }} />
              {s.name}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

/** 세로축 눈금용 짧은 숫자: 12000 -> "1.2만", 450000 -> "45만" */
function compactNumber(value: number): string {
  if (value >= 10000) {
    const man = value / 10000;
    return `${man >= 10 ? Math.round(man) : Math.round(man * 10) / 10}만`;
  }
  return Math.round(value).toLocaleString();
}

/**
 * 점들을 단조(monotone) 곡선으로 잇는다(Fritsch–Carlson). 두 점 사이에서 곡선이
 * 양 끝 값보다 위·아래로 튀지 않아, 데이터에 없는 골짜기·봉우리를 만들지 않는다.
 */
function smoothPath(points: { x: number; y: number }[], top: number, bottom: number): string {
  if (points.length === 0) return "";
  if (points.length === 1) return `M ${points[0].x} ${points[0].y}`;

  const n = points.length;
  const slopes: number[] = [];
  for (let i = 0; i < n - 1; i++) {
    slopes.push((points[i + 1].y - points[i].y) / (points[i + 1].x - points[i].x));
  }

  // 각 점의 접선 기울기: 양옆 기울기의 부호가 다르면(꼭짓점) 0으로 눕힌다
  const tangents = points.map((_, i) => {
    if (i === 0) return slopes[0];
    if (i === n - 1) return slopes[n - 2];
    return slopes[i - 1] * slopes[i] <= 0 ? 0 : (slopes[i - 1] + slopes[i]) / 2;
  });

  // 기울기가 너무 크면 줄여서 넘침(overshoot)을 막는다
  for (let i = 0; i < n - 1; i++) {
    if (slopes[i] === 0) {
      tangents[i] = 0;
      tangents[i + 1] = 0;
      continue;
    }
    const a = tangents[i] / slopes[i];
    const b = tangents[i + 1] / slopes[i];
    const h = a * a + b * b;
    if (h > 9) {
      const t = 3 / Math.sqrt(h);
      tangents[i] = t * a * slopes[i];
      tangents[i + 1] = t * b * slopes[i];
    }
  }

  const clampY = (y: number) => Math.min(bottom, Math.max(top, y));
  let d = `M ${points[0].x} ${points[0].y}`;

  for (let i = 0; i < n - 1; i++) {
    const p1 = points[i];
    const p2 = points[i + 1];
    const dx = (p2.x - p1.x) / 3;

    d += ` C ${p1.x + dx} ${clampY(p1.y + tangents[i] * dx)}, ${p2.x - dx} ${clampY(p2.y - tangents[i + 1] * dx)}, ${p2.x} ${p2.y}`;
  }

  return d;
}
