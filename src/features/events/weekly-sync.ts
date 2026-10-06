// 주간 행사 자동 업데이트 — 매주 월요일 오전 9시(KST)에 Vercel Cron이
// /api/cron/weekly-events를 호출하면 이 파일의 runWeeklyEventSync()가 돈다.
//
//   1) 수집: 공공 행사 데이터 2곳에서 "오늘 ~ 90일 뒤"에 열리는 행사를 가져온다.
//      - 한국관광공사 TourAPI(searchFestival2): 전국 지자체가 등록한 축제·행사
//      - 서울시 공식 축제 찾기(festival.seoul.go.kr): 서울 자치구 행사
//   2) 선별: 셀러가 부스로 참여할 수 있는 행사(마켓·장터·야시장·먹거리·공예 등)만 남기고
//      공연·전시 같은 관람형 축제는 뺀다.
//   3) 중복 제거: 두 출처 사이, 그리고 직접 수집한 시드 행사(seed-events.ts)와 이름·기간이
//      겹치면 한 건만 남긴다.
//   4) 저장: event_recruitments.source_post_id(`tour:T123` / `seoulfest:F45`)를 키로
//      upsert — 처음 보는 행사는 새로 만들고(collected_at = 이번 주), 이미 있던 행사는
//      일정·장소만 최신으로 고치고 last_checked_at을 갱신한다. 여러 번 돌아도 중복이 안 쌓인다.
//
// 화면(행사 찾기)은 events/data.ts가 시드 행사와 이 자동 수집 행사를 합쳐 보여주고,
// collected_at이 최근 7일 안이면 "NEW" 배지를 단다.

import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/types/database";
import { seedEvents } from "@/lib/data/seed-events";
import { isSameEvent, koreaDate, regionOfAddress, type EventRecord } from "@/features/ai/event-search";

const TOUR_SEARCH = "https://apis.data.go.kr/B551011/KorService2/searchFestival2";
const SEOUL_SEARCH = "https://festival.seoul.go.kr/festival/main/searchModal.do";

/** 매주 이만큼 앞의 행사까지 모은다 — 셀러가 모집 공고를 찾아 신청할 여유. */
export const LOOKAHEAD_DAYS = 90;

/** 셀러 부스가 들어갈 수 있는 행사인지(행사명 기준). 공연·불꽃놀이·전시 관람형 축제는 제외된다. */
export const SELLER_EVENT = /마켓|장터|야시장|야행|벼룩|플리|페어|박람회|먹거리|푸드|특산|직거래|공예|크리스마스|김장|로컬/;

export type AutoSourceDataset = "tour" | "seoulfest";

/** 자동 수집 출처별 정보. id 접두어(T/F)는 시드 행사 id(S01, A03 …)와 겹치지 않게 고른 것. */
export const AUTO_SOURCES: Record<AutoSourceDataset, { prefix: string; name: string }> = {
  tour: { prefix: "T", name: "한국관광공사 TourAPI" },
  seoulfest: { prefix: "F", name: "서울시 공식 축제 찾기" },
};

export interface CollectedEvent {
  sourceDataset: AutoSourceDataset;
  sourceId: string; // 화면 URL에 쓰는 id(T2786391, F1234)
  name: string;
  region: string | null;
  venue: string | null;
  startDate: string;
  endDate: string;
  imageUrl: string | null;
  lat: number | null;
  lng: number | null;
  sourceUrl: string;
}

export interface SourceReport {
  source: string;
  fetched: number; // 기간 안에 열리는 전체 행사 수
  kept: number; // 그중 셀러 참여형으로 남긴 수
  error?: string;
}

export interface WeeklySyncReport {
  ranAt: string;
  dryRun: boolean;
  range: { from: string; to: string };
  sources: SourceReport[];
  candidates: number; // 출처 간·시드와 중복 제거 후 저장 대상
  skippedAsDuplicate: number;
  created: number;
  updated: number;
  failed: number;
  newEvents: string[]; // 이번 주 새로 추가된 행사명(최대 30건)
}

export const sourceKey = (e: Pick<CollectedEvent, "sourceDataset" | "sourceId">) => `${e.sourceDataset}:${e.sourceId}`;

function addDays(isoDate: string, days: number): string {
  const d = new Date(`${isoDate}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() + days);
  return d.toISOString().slice(0, 10);
}

const isIsoDate = (v: unknown): v is string => typeof v === "string" && /^\d{4}-\d{2}-\d{2}$/.test(v);
const text = (v: unknown) => (typeof v === "string" ? v.replace(/<[^>]*>/g, "").replace(/\s+/g, " ").trim() : "");
const coord = (v: unknown) => (Number.isFinite(Number(v)) && Number(v) !== 0 ? Number(v) : null);
const overlaps = (start: string, end: string, from: string, to: string) => start <= to && end >= from;

// ---------------------------------------------------------------------------
// 1) 출처별 응답 → CollectedEvent (순수 함수 — 네트워크 없이 테스트 가능)
// ---------------------------------------------------------------------------

/** TourAPI searchFestival2 item 배열을 행사로 바꾼다. */
export function parseTourItems(items: unknown[], from: string, to: string): CollectedEvent[] {
  const out: CollectedEvent[] = [];
  for (const row of items) {
    if (!row || typeof row !== "object") continue;
    const r = row as Record<string, unknown>;
    const id = String(r.contentid ?? "");
    const toIso = (v: unknown) => (typeof v === "string" && /^\d{8}$/.test(v) ? `${v.slice(0, 4)}-${v.slice(4, 6)}-${v.slice(6)}` : "");
    const [start, end, name] = [toIso(r.eventstartdate), toIso(r.eventenddate), text(r.title)];
    if (!name || !/^\d+$/.test(id) || !isIsoDate(start) || !isIsoDate(end) || end < start) continue;
    if (!overlaps(start, end, from, to)) continue;
    const addr = text(r.addr1);
    out.push({
      sourceDataset: "tour",
      sourceId: `${AUTO_SOURCES.tour.prefix}${id}`,
      name,
      region: regionOfAddress(addr, String(r.lDongRegnCd ?? "")),
      venue: [addr, text(r.addr2)].filter(Boolean).join(" ") || null,
      startDate: start,
      endDate: end,
      imageUrl: text(r.firstimage).replace(/^http:\/\//, "https://") || null, // http 이미지는 https 페이지에서 막힌다
      lat: coord(r.mapy),
      lng: coord(r.mapx),
      // 대한민국 구석구석 상세 주소는 contentid가 아닌 별도 id를 써서, 행사명 검색 결과로 연결한다(AI 도우미와 같은 방식).
      sourceUrl: `https://korean.visitkorea.or.kr/search/search_list.do?keyword=${encodeURIComponent(name)}`,
    });
  }
  return out;
}

/** 서울시 축제 찾기 검색 응답(배열)을 행사로 바꾼다. */
export function parseSeoulRows(rows: unknown, from: string, to: string): CollectedEvent[] {
  if (!Array.isArray(rows)) throw new Error("서울시 축제 응답 형식이 예상과 다름");
  const out: CollectedEvent[] = [];
  for (const row of rows) {
    if (!row || typeof row !== "object") continue;
    const r = row as Record<string, unknown>;
    const id = String(r.festa_code ?? "");
    const name = text(r.festa_name);
    if (!name || !/^\d+$/.test(id) || !isIsoDate(r.strt_date) || !isIsoDate(r.end_date) || r.end_date < r.strt_date) continue;
    if (!overlaps(r.strt_date, r.end_date, from, to)) continue;
    if (r.gcode === "11000" || r.del_yn === "Y" || r.use_yn === "N") continue; // 서울시 전체 상설·삭제·비공개
    out.push({
      sourceDataset: "seoulfest",
      sourceId: `${AUTO_SOURCES.seoulfest.prefix}${id}`,
      name,
      region: "서울",
      venue: text(r.place) || null,
      startDate: r.strt_date,
      endDate: r.end_date,
      imageUrl: null,
      lat: null,
      lng: null,
      sourceUrl: `https://festival.seoul.go.kr/festival/main/festivalView.do?festacode=${id}`,
    });
  }
  return out;
}

const asRecord = (e: { name: string; startDate: string | null; endDate: string | null }): EventRecord => ({
  name: e.name,
  start: e.startDate ?? "",
  end: e.endDate ?? e.startDate ?? "",
  place: "",
  url: "",
  tentative: false,
});

/**
 * 셀러 참여형만 남기고, 출처 간(먼저 온 TourAPI 우선)·시드 행사와 겹치는 것을 뺀다.
 * 같은 행사 판정은 AI 도우미와 같은 isSameEvent(이름 포함 관계 + 기간 겹침).
 */
export function selectSellerEvents(events: CollectedEvent[]): { kept: CollectedEvent[]; duplicates: number } {
  const seeds = seedEvents.filter((s) => s.startDate).map(asRecord);
  const kept: CollectedEvent[] = [];
  let duplicates = 0;
  for (const e of events) {
    if (!SELLER_EVENT.test(e.name)) continue;
    const rec = asRecord(e);
    if (kept.some((k) => k.sourceId === e.sourceId || isSameEvent(asRecord(k), rec)) || seeds.some((s) => isSameEvent(s, rec))) {
      duplicates++;
      continue;
    }
    kept.push(e);
  }
  return { kept, duplicates };
}

// ---------------------------------------------------------------------------
// 2) 네트워크 수집
// ---------------------------------------------------------------------------

async function fetchTour(key: string, from: string, to: string): Promise<CollectedEvent[]> {
  // 공공데이터포털의 "인코딩" 키(이미 %가 들어간 값)와 "디코딩" 키를 모두 받는다.
  const serviceKey = key.includes("%") ? key : encodeURIComponent(key);
  const rows: unknown[] = [];
  for (let page = 1; page <= 5; page++) {
    const params = new URLSearchParams({ MobileOS: "ETC", MobileApp: "Marketfit", _type: "json", arrange: "A", numOfRows: "1000",
      pageNo: String(page), eventStartDate: from.replaceAll("-", ""), eventEndDate: to.replaceAll("-", "") });
    const res = await fetch(`${TOUR_SEARCH}?serviceKey=${serviceKey}&${params}`, { cache: "no-store", signal: AbortSignal.timeout(15000) });
    if (!res.ok) throw new Error(`TourAPI HTTP ${res.status}`);
    const data = await res.json() as { response?: { header?: { resultCode?: string; resultMsg?: string }; body?: { totalCount?: number; items?: { item?: unknown } | "" } } };
    if (data.response?.header?.resultCode !== "0000") throw new Error(`TourAPI 거절: ${data.response?.header?.resultMsg ?? "알 수 없음"}`);
    const body = data.response.body;
    const item = typeof body?.items === "object" ? body.items.item : undefined;
    rows.push(...(Array.isArray(item) ? item : item ? [item] : []));
    if (page * 1000 >= Number(body?.totalCount ?? 0)) break;
  }
  return parseTourItems(rows, from, to);
}

async function fetchSeoul(from: string, to: string): Promise<CollectedEvent[]> {
  const res = await fetch(SEOUL_SEARCH, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({ searchStrtDate: from, searchEndDate: to, searchGcode: "", searchSubjCode: "", searchKeyword: "" }),
    cache: "no-store",
    signal: AbortSignal.timeout(15000),
  });
  if (!res.ok) throw new Error(`서울시 축제 HTTP ${res.status}`);
  return parseSeoulRows(await res.json(), from, to);
}

// ---------------------------------------------------------------------------
// 3) 저장 (source_post_id 기준 upsert)
// ---------------------------------------------------------------------------

type Admin = SupabaseClient<Database>;

function eventRow(e: CollectedEvent) {
  return {
    name: e.name,
    image_url: e.imageUrl,
    region: e.region,
    venue: e.venue,
    lat: e.lat,
    lng: e.lng,
    category: null, // 화면 분류(8종)는 행사명으로 자동 결정 — category-group.ts
    event_type: "지역축제·행사",
    start_date: e.startDate,
    end_date: e.endDate,
  };
}

async function saveEvents(supabase: Admin, events: CollectedEvent[], now: string) {
  const existing = new Map<string, { id: string; event_id: string }>();
  const keys = events.map(sourceKey);
  for (let i = 0; i < keys.length; i += 100) {
    const { data, error } = await supabase
      .from("event_recruitments")
      .select("id, event_id, source_post_id")
      .in("source_post_id", keys.slice(i, i + 100));
    if (error) throw new Error(`기존 행사 조회 실패: ${error.message}`);
    for (const r of data ?? []) if (r.source_post_id) existing.set(r.source_post_id, r);
  }

  let created = 0, updated = 0, failed = 0;
  const newEvents: string[] = [];

  const upsertOne = async (e: CollectedEvent) => {
    const key = sourceKey(e);
    const found = existing.get(key);
    if (found) {
      // 일정·장소 변경만 반영하고 collected_at(최초 수집일)은 그대로 둔다 — "NEW" 배지 기준.
      const [ev, rc] = await Promise.all([
        supabase.from("events").update(eventRow(e)).eq("id", found.event_id),
        supabase.from("event_recruitments").update({ last_checked_at: now, original_title: e.name, source_url: e.sourceUrl }).eq("id", found.id),
      ]);
      if (ev.error || rc.error) failed++;
      else updated++;
      return;
    }
    const { data: ev, error: evErr } = await supabase.from("events").insert(eventRow(e)).select("id").single();
    if (evErr || !ev) { failed++; return; }
    const { error: rcErr } = await supabase.from("event_recruitments").insert({
      event_id: ev.id,
      source_name: AUTO_SOURCES[e.sourceDataset].name,
      source_url: e.sourceUrl,
      source_type: "government",
      source_post_id: key,
      original_title: e.name,
      collected_at: now,
      last_checked_at: now,
      is_sample_data: false,
    });
    if (rcErr) {
      // 모집정보 없이 events만 남으면 다음 주에 키로 못 찾아 중복이 생기므로 되돌린다.
      await supabase.from("events").delete().eq("id", ev.id);
      failed++;
      return;
    }
    created++;
    newEvents.push(e.name);
  };

  // Supabase 요청을 10개씩 병렬로 — 수백 건이어도 함수 제한 시간 안에 끝난다.
  for (let i = 0; i < events.length; i += 10) await Promise.all(events.slice(i, i + 10).map(upsertOne));
  return { created, updated, failed, newEvents };
}

// ---------------------------------------------------------------------------
// 4) 전체 실행
// ---------------------------------------------------------------------------

/** [from, to]를 한 달 단위 구간으로 나눈다(긴 기간을 한 번에 조회하면 API 응답 한도에 걸린다). */
export function monthChunks(from: string, to: string): [string, string][] {
  const out: [string, string][] = [];
  let start = from;
  while (start <= to) {
    const d = new Date(`${start}T00:00:00Z`);
    const monthEnd = new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth() + 1, 0)).toISOString().slice(0, 10);
    const end = monthEnd < to ? monthEnd : to;
    out.push([start, end]);
    start = addDays(end, 1);
  }
  return out;
}

/** 구간별로 차례로 조회해 합치고, 여러 달에 걸친 행사는 한 번만 남긴다. */
async function fetchChunked(chunks: [string, string][], fetchOne: (from: string, to: string) => Promise<CollectedEvent[]>) {
  const byId = new Map<string, CollectedEvent>();
  for (const [a, b] of chunks) for (const e of await fetchOne(a, b)) byId.set(e.sourceId, e);
  return [...byId.values()];
}

/**
 * 기본은 "오늘 ~ 90일 뒤"(매주 월요일 자동 업데이트). range를 주면 그 기간에 열린 행사를 모은다 —
 * 과거 행사를 기간 단위로 한 번에 채울 때(npm run sync:events -- --from 2024-01-01 --to 2026-10-06).
 */
export async function runWeeklyEventSync(opts: {
  supabase: Admin | null; // dryRun이면 null 가능
  dryRun?: boolean;
  now?: Date;
  tourKey?: string;
  range?: { from: string; to: string };
}): Promise<WeeklySyncReport> {
  const now = opts.now ?? new Date();
  const from = opts.range?.from ?? koreaDate(now);
  const to = opts.range?.to ?? addDays(from, LOOKAHEAD_DAYS);
  const dryRun = Boolean(opts.dryRun);
  const chunks = opts.range ? monthChunks(from, to) : [[from, to] as [string, string]];

  const lookups: [string, () => Promise<CollectedEvent[]>][] = [];
  if (opts.tourKey) lookups.push([AUTO_SOURCES.tour.name, () => fetchChunked(chunks, (a, b) => fetchTour(opts.tourKey!, a, b))]);
  lookups.push([AUTO_SOURCES.seoulfest.name, () => fetchChunked(chunks, fetchSeoul)]);

  // 한 출처가 실패해도 나머지 출처 결과는 저장한다.
  const results = await Promise.allSettled(lookups.map(([, fn]) => fn()));
  const sources: SourceReport[] = [];
  const all: CollectedEvent[] = [];
  results.forEach((r, i) => {
    const source = lookups[i][0];
    if (r.status === "rejected") {
      sources.push({ source, fetched: 0, kept: 0, error: r.reason instanceof Error ? r.reason.message : String(r.reason) });
      return;
    }
    sources.push({ source, fetched: r.value.length, kept: r.value.filter((e) => SELLER_EVENT.test(e.name)).length });
    all.push(...r.value);
  });

  const { kept, duplicates } = selectSellerEvents(all);
  const report: WeeklySyncReport = {
    ranAt: now.toISOString(),
    dryRun,
    range: { from, to },
    sources,
    candidates: kept.length,
    skippedAsDuplicate: duplicates,
    created: 0,
    updated: 0,
    failed: 0,
    newEvents: [],
  };

  if (dryRun) {
    report.newEvents = kept.slice(0, 30).map((e) => `${e.name} (${e.startDate}, ${e.region ?? "지역 미상"})`);
    return report;
  }
  if (!opts.supabase) throw new Error("SUPABASE_SERVICE_ROLE_KEY가 없어 저장할 수 없습니다.");

  const saved = await saveEvents(opts.supabase, kept, now.toISOString());
  return { ...report, ...saved, newEvents: saved.newEvents.slice(0, 30) };
}
