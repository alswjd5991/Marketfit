"use client";

import { useState } from "react";

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
};

export function InteractiveLineChart({
  points,
  color = "#2a78d6",
  format = "number",
}: InteractiveLineChartProps) {
  const [activeIndex, setActiveIndex] = useState<number | null>(null);

  const width = 560;
  const height = 260;

  const paddingLeft = 24;
  const paddingRight = 24;
  const paddingTop = 28;
  const paddingBottom = 56;

  const plotWidth = width - paddingLeft - paddingRight;
  const plotHeight = height - paddingTop - paddingBottom;

  const maxValue = Math.max(...points.map((p) => p.value), 1);

  // 위쪽에 약간 여백을 둬서 점이 카드 상단에 붙지 않도록
  const upperBound = maxValue * 1.2;

  const coordinates = points.map((point, index) => {
    const x =
      points.length === 1
        ? paddingLeft + plotWidth / 2
        : paddingLeft +
          (index / (points.length - 1)) * plotWidth;

    const y =
      paddingTop +
      plotHeight -
      (point.value / upperBound) * plotHeight;

    return {
      ...point,
      x,
      y,
    };
  });

  const path = coordinates
    .map((point, index) =>
      index === 0
        ? `M ${point.x} ${point.y}`
        : `L ${point.x} ${point.y}`
    )
    .join(" ");

  const activePoint =
    activeIndex !== null
      ? coordinates[activeIndex]
      : null;

  const lastPoint = points[points.length - 1];

  return (
    <div
      className="relative w-full"
      onMouseLeave={() => setActiveIndex(null)}
    >
      {/* 그래프 */}
      <svg
        viewBox={`0 0 ${width} ${height}`}
        className="h-[260px] w-full overflow-visible"
        preserveAspectRatio="none"
      >
        {/* 가로 보조선 */}
        {[0.25, 0.5, 0.75, 1].map((ratio) => {
          const y =
            paddingTop +
            plotHeight * ratio;

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

        {/* 아래 축 */}
        <line
          x1={paddingLeft}
          x2={width - paddingRight}
          y1={paddingTop + plotHeight}
          y2={paddingTop + plotHeight}
          stroke="#D8DEE6"
          strokeWidth="1"
        />

        {/* 라인 */}
        <path
          d={path}
          fill="none"
          stroke={color}
          strokeWidth="3"
          strokeLinecap="round"
          strokeLinejoin="round"
          opacity={activeIndex !== null ? 0.55 : 1}
          className="transition-opacity duration-200"
        />

        {/* 점 */}
        {coordinates.map((point, index) => {
          const active = activeIndex === index;
          const anotherPointActive =
            activeIndex !== null && !active;

          return (
            <g key={`${point.label}-${index}`}>
              {/* hover된 점의 은은한 원 */}
              {active && (
                <circle
                  cx={point.x}
                  cy={point.y}
                  r="13"
                  fill={color}
                  opacity="0.12"
                />
              )}

              {/* 실제 점 */}
              <circle
                cx={point.x}
                cy={point.y}
                r={active ? 7 : 5}
                fill={color}
                stroke="white"
                strokeWidth={active ? 3 : 2}
                opacity={
                  anotherPointActive
                    ? 0.28
                    : 1
                }
                className="transition-all duration-200"
              />

              {/* 마우스 잡기 편하게 투명 영역 확대 */}
              <circle
                cx={point.x}
                cy={point.y}
                r="18"
                fill="transparent"
                className="cursor-pointer"
                onMouseEnter={() =>
                  setActiveIndex(index)
                }
                onMouseMove={() =>
                  setActiveIndex(index)
                }
              />
            </g>
          );
        })}

        {/* x축 라벨 */}
        {coordinates.map((point, index) => (
          <text
            key={`label-${index}`}
            x={point.x}
            y={height - 22}
            textAnchor="middle"
            fontSize="11"
            fill={
              activeIndex === index
                ? "#475569"
                : "#9CA3AF"
            }
            fontWeight={
              activeIndex === index
                ? "600"
                : "400"
            }
          >
            {point.label}
          </text>
        ))}
      </svg>


      {/* hover tooltip */}
      {activePoint && (
        <div
          className="pointer-events-none absolute z-20 min-w-[160px] rounded-2xl border border-neutral-200 bg-white px-4 py-3 shadow-[0_12px_35px_rgba(15,23,42,0.14)]"
          style={{
            left: `${(activePoint.x / width) * 100}%`,
            top: `${(activePoint.y / height) * 100}%`,

            transform:
              activePoint.x > width * 0.75
                ? activePoint.y < 90
                  ? "translate(-100%, 16px)"
                  : "translate(-100%, calc(-100% - 16px))"
                : activePoint.x < width * 0.25
                ? activePoint.y < 90
                  ? "translate(0, 16px)"
                  : "translate(0, calc(-100% - 16px))"
                : activePoint.y < 90
                ? "translate(-50%, 16px)"
                : "translate(-50%, calc(-100% - 16px))",
          }}
        >
          <p className="max-w-[220px] text-xs font-medium text-neutral-500">
            {activePoint.title ?? activePoint.label}
          </p>

          {activePoint.meta && (
            <p className="mt-1 text-xs text-neutral-400">
              {activePoint.meta}
            </p>
          )}

          <p
            className="mt-2 text-lg font-bold"
            style={{ color }}
          >
            {formatChartValue(
              activePoint.value,
              format
            )}
          </p>

          {activePoint.sublabel && (
            <p className="mt-1 text-xs text-neutral-500">
              {activePoint.sublabel}
            </p>
          )}
        </div>
      )}


      {/* 최근 값 */}
      {lastPoint && (
        <div className="mt-1 flex flex-wrap items-center gap-1 text-sm">
          <span className="text-neutral-500">
            최근:
          </span>

          <span className="font-semibold text-neutral-900">
            {formatChartValue(
              lastPoint.value,
              format
            )}
          </span>

          {lastPoint.sublabel && (
            <>
              <span className="text-neutral-300">
                ·
              </span>

              <span className="text-neutral-500">
                {lastPoint.sublabel}
              </span>
            </>
          )}
        </div>
      )}
    </div>
  );
}


function formatChartValue(
  value: number,
  format: "count" | "currency" | "number"
) {
  switch (format) {
    case "count":
      return `${value.toLocaleString()}건`;

    case "currency":
      return `${value.toLocaleString()}원`;

    default:
      return value.toLocaleString();
  }
}