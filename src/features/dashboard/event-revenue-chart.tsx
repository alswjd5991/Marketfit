"use client";

import { useState } from "react";
import { ChevronDown } from "lucide-react";
import { InteractiveLineChart } from "@/components/ui/interactive-line-chart";
import type { EventTrendPoint, GroupPerformance } from "./data";

const won = (n: number) => `${Math.round(n).toLocaleString()}원`;

/**
 * "최근 성과"의 행사별 매출 추이 + 제목 옆 행사 유형 드롭다운(대시보드 전용).
 * 유형을 고르면 그 유형 행사만 남기고 평균 순이익을 보여주고, 점에 마우스를 올리면 순이익과 유형이 나온다.
 */
export function EventRevenueChart({ title, points, groups }: { title: string; points: EventTrendPoint[]; groups: GroupPerformance[] }) {
  const [group, setGroup] = useState("");
  const avgByGroup = new Map(groups.map((g) => [g.group, g]));
  const shown = group ? points.filter((p) => p.group === group) : points;
  const selected = group ? avgByGroup.get(group as GroupPerformance["group"]) : null;
  const options = groups.filter((g) => g.avgNetProfit != null);

  return (
    <div>
      <div className="mb-3 flex flex-wrap items-center gap-2.5">
        <p className="text-sm font-semibold text-[#1F2023]">{title}</p>
        <div className="relative">
          <select
            aria-label="행사 유형"
            value={group}
            onChange={(e) => setGroup(e.target.value)}
            className="h-8 appearance-none rounded-full border border-neutral-200 bg-white pl-3 pr-8 text-[13px] text-neutral-700 outline-none transition-colors hover:border-neutral-300 focus:ring-2 focus:ring-brand/15"
          >
            <option value="">전체 유형</option>
            {options.map((g) => (
              <option key={g.group} value={g.group}>
                {g.group} · 평균 순이익 {won(g.avgNetProfit!)}
              </option>
            ))}
          </select>
          <ChevronDown className="pointer-events-none absolute right-2.5 top-1/2 size-4 -translate-y-1/2 text-neutral-400" />
        </div>
        {selected?.avgNetProfit != null && (
          <p className="text-[13px] text-neutral-600">
            평균 순이익{" "}
            <span className={`font-bold tabular-nums ${selected.avgNetProfit < 0 ? "text-[#BE3A2A]" : "text-neutral-950"}`}>
              {won(selected.avgNetProfit)}
            </span>{" "}
            <span className="text-neutral-400">· {selected.profitCount}회</span>
          </p>
        )}
      </div>

      {shown.length === 0 ? (
        <p className="flex h-[200px] items-center justify-center text-sm text-[#8A8D93]">매출 기록 없음</p>
      ) : (
        <InteractiveLineChart
          color="#F2542D"
          format="currency"
          height={200}
          points={shown.map((e) => ({
            label: e.eventName.length > 6 ? `${e.eventName.slice(0, 6)}…` : e.eventName,
            value: e.revenue,
            title: e.eventName,
            meta: e.startDate,
            sublabel: [e.netProfit != null ? `순이익 ${e.netProfit.toLocaleString()}원` : null, e.group].filter(Boolean).join(" · "),
          }))}
        />
      )}
    </div>
  );
}
