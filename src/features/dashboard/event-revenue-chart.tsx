"use client";

import { useState } from "react";
import { ChevronDown } from "lucide-react";
import { ColumnChart } from "@/components/ui/column-chart";
import type { EventTrendPoint, GroupPerformance } from "./data";

const won = (n: number) => `${Math.round(n).toLocaleString()}원`;

/**
 * 행사별 매출·순이익 + 행사 유형 보기.
 * 드롭다운으로 유형을 고르면 그 유형 행사만 남기고 평균 순이익을 보여주고,
 * 막대에 마우스를 올리면 그 행사의 유형과 유형 평균 순이익이 툴팁에 나온다.
 */
export function EventRevenueChart({ points, groups }: { points: EventTrendPoint[]; groups: GroupPerformance[] }) {
  const [group, setGroup] = useState("");
  const avgByGroup = new Map(groups.map((g) => [g.group, g]));
  const shown = group ? points.filter((p) => p.group === group) : points;
  const selected = group ? avgByGroup.get(group as GroupPerformance["group"]) : null;
  const options = groups.filter((g) => g.avgNetProfit != null);

  return (
    <div>
      <div className="mb-4 flex flex-wrap items-center gap-3">
        <div className="relative">
          <select
            aria-label="행사 유형"
            value={group}
            onChange={(e) => setGroup(e.target.value)}
            className="h-9 appearance-none rounded-full border border-neutral-200 bg-white pl-3.5 pr-9 text-sm text-neutral-700 outline-none transition-colors hover:border-neutral-300 focus:ring-2 focus:ring-brand/15"
          >
            <option value="">전체 유형</option>
            {options.map((g) => (
              <option key={g.group} value={g.group}>
                {g.group} · 평균 순이익 {won(g.avgNetProfit!)}
              </option>
            ))}
          </select>
          <ChevronDown className="pointer-events-none absolute right-3 top-1/2 size-4 -translate-y-1/2 text-neutral-400" />
        </div>
        {selected?.avgNetProfit != null && (
          <p className="text-sm text-neutral-600">
            평균 순이익{" "}
            <span className={`font-bold tabular-nums ${selected.avgNetProfit < 0 ? "text-[#BE3A2A]" : "text-neutral-950"}`}>
              {won(selected.avgNetProfit)}
            </span>{" "}
            <span className="text-neutral-400">· {selected.profitCount}회</span>
          </p>
        )}
      </div>

      {shown.length === 0 ? (
        <p className="py-8 text-center text-sm text-neutral-400">매출 기록 없음</p>
      ) : (
        <ColumnChart
          unit="원"
          height={300}
          barName="매출"
          lineName="순이익"
          points={shown.map((e) => {
            const g = avgByGroup.get(e.group);
            return {
              label: e.startDate.slice(2, 7).replace("-", "."),
              value: e.revenue,
              line: e.netProfit,
              title: e.eventName,
              meta: e.startDate,
              note: g?.avgNetProfit != null ? `${e.group} · 유형 평균 순이익 ${won(g.avgNetProfit)}` : e.group,
            };
          })}
        />
      )}
    </div>
  );
}
