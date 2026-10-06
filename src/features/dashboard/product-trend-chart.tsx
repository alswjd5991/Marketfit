"use client";

import { useEffect, useRef, useState } from "react";
import { Check, ChevronDown } from "lucide-react";
import { SmoothAreaChart } from "@/components/ui/smooth-area-chart";
import { SERIES_COLORS } from "@/components/ui/chart-colors";
import type { ProductSalesByEvent } from "./data";

const DEFAULT_SELECTED = 5; // 처음엔 판매 수량 상위 5개 — 곡선이 너무 많으면 겹쳐 읽기 어렵다

/**
 * 품목별 판매 수량 추이 + 품목 다중 선택 드롭다운.
 * 색은 품목 자체에 고정(전체 목록 순서 기준)이라, 선택을 바꿔도 같은 품목은 같은 색이다.
 */
export function ProductTrendChart({ title, data }: { title: string; data: ProductSalesByEvent }) {
  const all = data.series.map((s) => s.productName);
  const [selected, setSelected] = useState<string[]>(all.slice(0, DEFAULT_SELECTED));
  const [open, setOpen] = useState(false);
  const boxRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const close = (e: MouseEvent) => {
      if (!boxRef.current?.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener("mousedown", close);
    return () => document.removeEventListener("mousedown", close);
  }, [open]);

  const toggle = (name: string) =>
    setSelected((cur) => (cur.includes(name) ? cur.filter((n) => n !== name) : all.filter((n) => cur.includes(n) || n === name)));
  const series = data.series
    .map((s, i) => ({ ...s, color: SERIES_COLORS[i % SERIES_COLORS.length] }))
    .filter((s) => selected.includes(s.productName));

  return (
    <div>
      <div className="mb-5 flex flex-wrap items-center gap-3">
      <h2 className="text-[15px] font-semibold text-neutral-900">{title}</h2>
      <div ref={boxRef} className="relative inline-block">
        <button
          type="button"
          onClick={() => setOpen((o) => !o)}
          aria-expanded={open}
          className="flex h-9 items-center gap-2 rounded-full border border-neutral-200 bg-white pl-3.5 pr-3 text-sm text-neutral-700 transition-colors hover:border-neutral-300"
        >
          품목 {selected.length === all.length ? "전체" : `${selected.length}개`}
          <ChevronDown className={`size-4 text-neutral-400 transition-transform ${open ? "rotate-180" : ""}`} />
        </button>
        {open && (
          <ul className="absolute left-0 top-11 z-30 max-h-72 w-56 overflow-y-auto rounded-xl border border-neutral-200/80 bg-white p-1.5 shadow-[0_12px_32px_rgba(40,80,120,0.16)] [scrollbar-width:thin] [&::-webkit-scrollbar]:w-1.5 [&::-webkit-scrollbar-thumb]:rounded-full [&::-webkit-scrollbar-thumb]:bg-neutral-300 [&::-webkit-scrollbar-track]:bg-transparent">
            <li>
              <button
                type="button"
                onClick={() => setSelected(selected.length === all.length ? [] : all)}
                className="w-full rounded-lg px-2.5 py-2 text-left text-xs font-semibold text-neutral-500 hover:bg-neutral-50"
              >
                {selected.length === all.length ? "모두 해제" : "모두 선택"}
              </button>
            </li>
            {all.map((name, i) => {
              const on = selected.includes(name);
              return (
                <li key={name}>
                  <button
                    type="button"
                    role="menuitemcheckbox"
                    aria-checked={on}
                    onClick={() => toggle(name)}
                    className="flex w-full items-center gap-2.5 rounded-lg px-2.5 py-2 text-left text-sm text-neutral-800 hover:bg-neutral-50"
                  >
                    <span
                      className={`flex size-4 shrink-0 items-center justify-center rounded border ${on ? "border-transparent text-white" : "border-neutral-300"}`}
                      style={on ? { background: SERIES_COLORS[i % SERIES_COLORS.length] } : undefined}
                    >
                      {on && <Check className="size-3" strokeWidth={3} />}
                    </span>
                    <span className="truncate">{name}</span>
                  </button>
                </li>
              );
            })}
          </ul>
        )}
      </div>
      </div>

      {series.length === 0 ? (
        <p className="py-16 text-center text-sm text-neutral-400">선택한 품목 없음</p>
      ) : (
        <SmoothAreaChart
          height={300}
          formatValue={(v) => `${v.toLocaleString()}개`}
          points={data.events.map((e) => ({
            label: e.startDate ? e.startDate.slice(2, 7).replace("-", ".") : e.eventName,
            title: e.eventName,
            meta: e.startDate,
          }))}
          series={series.map((s) => ({ name: s.productName, color: s.color, values: s.values }))}
        />
      )}
    </div>
  );
}
