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

/** 쿼리스트링 한 값을 바꿔 다시 조회한다. */
function useSetParam() {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  return {
    searchParams,
    setParam(key: string, value: string) {
      const params = new URLSearchParams(searchParams.toString());
      if (value) params.set(key, value);
      else params.delete(key);
      router.push(`${pathname}?${params.toString()}`);
    },
  };
}

/** 검색 → 구분선 → 필터. 테두리·박스 없이 글자만 두고, 선택된 필터는 색·굵기·밑줄로 구분한다. */
export function EventFiltersBar({ regions, categories }: { regions: string[]; categories: string[] }) {
  const { searchParams, setParam } = useSetParam();
  const period = searchParams.get("period") ?? "";

  return (
    <div className="flex flex-col gap-4">
      <label className="flex items-center gap-3">
        <Search className="size-5 shrink-0 text-neutral-500" strokeWidth={2.25} />
        <input
          type="search"
          aria-label="행사명·장소 검색"
          placeholder="행사명·장소 검색"
          className="w-full bg-transparent py-1 text-[17px] font-medium text-neutral-900 outline-none placeholder:font-normal placeholder:text-neutral-400"
          defaultValue={searchParams.get("q") ?? ""}
          onKeyDown={(e) => {
            if (e.key === "Enter") setParam("q", e.currentTarget.value);
          }}
        />
      </label>

      <hr className="border-neutral-300/70" />

      <div className="flex flex-wrap items-center gap-x-7 gap-y-3">
        <TextSelect label="지역" value={searchParams.get("region") ?? ""} onChange={(v) => setParam("region", v)} options={[{ value: "", label: "전체 지역" }, ...regions.map((r) => ({ value: r, label: r }))]} />
        <TextSelect label="카테고리" value={searchParams.get("category") ?? ""} onChange={(v) => setParam("category", v)} options={[{ value: "", label: "전체 카테고리" }, ...categories.map((c) => ({ value: c, label: c }))]} />
        <TextSelect label="모집 상태" value={searchParams.get("status") ?? ""} onChange={(v) => setParam("status", v)} options={STATUS_OPTIONS} />
        <TextSelect label="기간" value={period} onChange={(v) => setParam("period", v)} options={PERIOD_OPTIONS} />
      </div>

      {period === "custom" && (
        <div className="flex items-center gap-3 text-[15px] text-neutral-700">
          <input type="date" aria-label="시작일" className="bg-transparent outline-none" defaultValue={searchParams.get("from") ?? ""} onChange={(e) => setParam("from", e.target.value)} />
          <span className="text-neutral-400">~</span>
          <input type="date" aria-label="종료일" className="bg-transparent outline-none" defaultValue={searchParams.get("to") ?? ""} onChange={(e) => setParam("to", e.target.value)} />
        </div>
      )}
    </div>
  );
}

/** 카드 목록 바로 위 줄: 왼쪽 결과 수, 오른쪽 정렬. */
export function EventResultsBar({ count }: { count: number }) {
  const { searchParams, setParam } = useSetParam();
  return (
    <div className="mt-8 flex items-center justify-between">
      <p className="text-[15px] text-neutral-500">
        <span className="font-bold tabular-nums text-neutral-950">{count}</span>개 행사
      </p>
      <TextSelect label="정렬" value={searchParams.get("sort") ?? ""} onChange={(v) => setParam("sort", v)} options={SORT_OPTIONS} quiet />
    </div>
  );
}

function TextSelect({
  label,
  value,
  onChange,
  options,
  quiet,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  options: { value: string; label: string }[];
  /** 정렬처럼 선택돼도 강조하지 않는 메뉴 */
  quiet?: boolean;
}) {
  const active = Boolean(value) && !quiet;
  return (
    <div className="relative">
      <select
        aria-label={label}
        defaultValue={value}
        onChange={(e) => onChange(e.target.value)}
        className={`cursor-pointer appearance-none bg-transparent py-1 pr-6 text-[15px] outline-none transition-colors focus-visible:underline focus-visible:underline-offset-8 ${
          active
            ? "font-bold text-brand-dark underline decoration-brand/40 decoration-2 underline-offset-8"
            : "font-medium text-neutral-600 hover:text-neutral-950"
        }`}
      >
        {options.map((o) => (
          <option key={o.value} value={o.value}>
            {o.label}
          </option>
        ))}
      </select>
      <ChevronDown className={`pointer-events-none absolute right-0 top-1/2 size-4 -translate-y-1/2 ${active ? "text-brand-dark" : "text-neutral-400"}`} />
    </div>
  );
}
