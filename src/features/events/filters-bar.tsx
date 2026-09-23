"use client";

import { useRouter, useSearchParams, usePathname } from "next/navigation";

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
  { value: "deadline", label: "마감 임박순" },
  { value: "recent", label: "최신 등록순" },
  { value: "start_date", label: "행사 시작일순" },
];

export function EventFiltersBar({
  regions,
  categories,
}: {
  regions: string[];
  categories: string[];
}) {
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
    <div className="flex flex-col gap-2">
    <div className="flex flex-wrap gap-2">
      <select
        className="rounded-lg border border-neutral-200 bg-white px-3 py-2 text-sm"
        defaultValue={searchParams.get("region") ?? ""}
        onChange={(e) => setParam("region", e.target.value)}
      >
        <option value="">전체 지역</option>
        {regions.map((r) => (
          <option key={r} value={r}>
            {r}
          </option>
        ))}
      </select>

      <select
        className="rounded-lg border border-neutral-200 bg-white px-3 py-2 text-sm"
        defaultValue={searchParams.get("category") ?? ""}
        onChange={(e) => setParam("category", e.target.value)}
      >
        <option value="">전체 카테고리</option>
        {categories.map((c) => (
          <option key={c} value={c}>
            {c}
          </option>
        ))}
      </select>

      <select
        className="rounded-lg border border-neutral-200 bg-white px-3 py-2 text-sm"
        defaultValue={searchParams.get("status") ?? ""}
        onChange={(e) => setParam("status", e.target.value)}
      >
        {STATUS_OPTIONS.map((o) => (
          <option key={o.value} value={o.value}>
            {o.label}
          </option>
        ))}
      </select>

      <select
        className="rounded-lg border border-neutral-200 bg-white px-3 py-2 text-sm"
        defaultValue={period}
        onChange={(e) => setParam("period", e.target.value)}
      >
        {PERIOD_OPTIONS.map((o) => (
          <option key={o.value} value={o.value}>
            {o.label}
          </option>
        ))}
      </select>

      <select
        className="rounded-lg border border-neutral-200 bg-white px-3 py-2 text-sm"
        defaultValue={searchParams.get("sort") ?? "deadline"}
        onChange={(e) => setParam("sort", e.target.value)}
      >
        {SORT_OPTIONS.map((o) => (
          <option key={o.value} value={o.value}>
            {o.label}
          </option>
        ))}
      </select>

      <input
        type="search"
        placeholder="행사명·장소 검색"
        className="min-w-[200px] flex-1 rounded-lg border border-neutral-200 bg-white px-3 py-2 text-sm"
        defaultValue={searchParams.get("q") ?? ""}
        onKeyDown={(e) => {
          if (e.key === "Enter") setParam("q", e.currentTarget.value);
        }}
      />
    </div>

      {period === "custom" && (
        <div className="flex items-center gap-2 text-sm">
          <input
            type="date"
            className="rounded-lg border border-neutral-200 bg-white px-3 py-2"
            defaultValue={searchParams.get("from") ?? ""}
            onChange={(e) => setParam("from", e.target.value)}
          />
          <span className="text-neutral-400">~</span>
          <input
            type="date"
            className="rounded-lg border border-neutral-200 bg-white px-3 py-2"
            defaultValue={searchParams.get("to") ?? ""}
            onChange={(e) => setParam("to", e.target.value)}
          />
        </div>
      )}
    </div>
  );
}
