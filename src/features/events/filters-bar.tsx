"use client";

import { useRouter, useSearchParams, usePathname } from "next/navigation";
import { ChevronDown, Search } from "lucide-react";

const STATUS_OPTIONS = [
  { value: "", label: "전체 상태" },
  { value: "upcoming", label: "모집 예정" },
  { value: "open", label: "모집 중" },
  { value: "closed", label: "모집 종료" },
];

const PERIOD_OPTIONS = [
  { value: "", label: "전체 기간" },
  { value: "this_week", label: "이번 주" },
  { value: "this_month", label: "이번 달" },
  { value: "next_month", label: "다음 달" },
  { value: "past", label: "과거 행사" },
  { value: "custom", label: "날짜 직접 선택" },
];

const SORT_OPTIONS = [
  { value: "", label: "마감 임박순" }, // 기본값(deadline)
  { value: "recent", label: "최신 등록순" },
  { value: "start_date", label: "행사 시작일순" },
];

const BASE = "h-11 rounded-xl border text-sm outline-none transition-colors focus:border-brand focus:ring-2 focus:ring-brand/15";
const FIELD = `${BASE} border-neutral-200 bg-white text-neutral-800 hover:border-neutral-300`;
const FIELD_ACTIVE = `${BASE} border-brand/40 bg-brand-light font-semibold text-brand-dark`;

export function EventFiltersBar({ regions, categories }: { regions: string[]; categories: string[] }) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();

  function setParam(key: string, value: string) {
    const params = new URLSearchParams(searchParams.toString());
    if (value) params.set(key, value);
    else params.delete(key);
    router.push(`${pathname}?${params.toString()}`);
  }

  const period = searchParams.get("period") ?? "";

  return (
    <div className="flex flex-col gap-3 rounded-2xl border border-white/80 bg-white/70 p-3 shadow-[0_4px_20px_rgba(40,80,120,0.06)] backdrop-blur-sm sm:p-4">
      <label className="relative block">
        <Search className="pointer-events-none absolute left-4 top-1/2 size-[18px] -translate-y-1/2 text-neutral-400" />
        <input
          type="search"
          aria-label="행사명·장소 검색"
          placeholder="행사명·장소 검색"
          className={`${FIELD} w-full pl-11 pr-4`}
          defaultValue={searchParams.get("q") ?? ""}
          onKeyDown={(e) => {
            if (e.key === "Enter") setParam("q", e.currentTarget.value);
          }}
        />
      </label>

      <div className="grid grid-cols-2 gap-2 sm:flex sm:flex-wrap sm:items-center">
        <Select label="지역" value={searchParams.get("region") ?? ""} onChange={(v) => setParam("region", v)} options={[{ value: "", label: "전체 지역" }, ...regions.map((r) => ({ value: r, label: r }))]} />
        <Select label="카테고리" value={searchParams.get("category") ?? ""} onChange={(v) => setParam("category", v)} options={[{ value: "", label: "전체 카테고리" }, ...categories.map((c) => ({ value: c, label: c }))]} />
        <Select label="모집 상태" value={searchParams.get("status") ?? ""} onChange={(v) => setParam("status", v)} options={STATUS_OPTIONS} />
        <Select label="기간" value={period} onChange={(v) => setParam("period", v)} options={PERIOD_OPTIONS} />
        <div className="col-span-2 sm:col-span-1 sm:ml-auto">
          <Select label="정렬" value={searchParams.get("sort") ?? ""} onChange={(v) => setParam("sort", v)} options={SORT_OPTIONS} />
        </div>
      </div>

      {period === "custom" && (
        <div className="flex items-center gap-2 text-sm">
          <input type="date" aria-label="시작일" className={`${FIELD} px-3`} defaultValue={searchParams.get("from") ?? ""} onChange={(e) => setParam("from", e.target.value)} />
          <span className="text-neutral-400">~</span>
          <input type="date" aria-label="종료일" className={`${FIELD} px-3`} defaultValue={searchParams.get("to") ?? ""} onChange={(e) => setParam("to", e.target.value)} />
        </div>
      )}
    </div>
  );
}

function Select({
  label,
  value,
  onChange,
  options,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  options: { value: string; label: string }[];
}) {
  return (
    <div className="relative">
      <select
        aria-label={label}
        defaultValue={value}
        onChange={(e) => onChange(e.target.value)}
        className={`${value ? FIELD_ACTIVE : FIELD} w-full appearance-none pl-4 pr-10 sm:w-auto`}
      >
        {options.map((o) => (
          <option key={o.value} value={o.value}>
            {o.label}
          </option>
        ))}
      </select>
      <ChevronDown className="pointer-events-none absolute right-3.5 top-1/2 size-4 -translate-y-1/2 text-neutral-400" />
    </div>
  );
}
