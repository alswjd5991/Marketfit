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
//   (과거 행사를 기간으로 채울 때는 서울시 문화행사 정보(2021년 10월~, 지난 행사가 지워지지 않음)도 쓴다)
//   4) 저장: event_recruitments.source_post_id(`tour:T123` / `seoulfest:F45` / `seoulcult:C135364`)를 키로
//      upsert — 처음 보는 행사는 새로 만들고(collected_at = 이번 주), 이미 있던 행사는
//      일정·장소만 최신으로 고치고 last_checked_at을 갱신한다. 여러 번 돌아도 중복이 안 쌓인다.
//
// 화면(행사 찾기)은 events/data.ts가 시드 행사와 이 자동 수집 행사를 합쳐 보여주고,
// collected_at이 최근 7일 안이면 "NEW" 배지를 단다.

import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database, EventDetails } from "@/types/database";
import { seedEvents } from "@/lib/data/seed-events";
import { isSameEvent, koreaDate, regionOfAddress, type EventRecord } from "@/features/ai/event-search";

const TOUR_SEARCH = "https://apis.data.go.kr/B551011/KorService2/searchFestival2";
const TOUR_COMMON = "https://apis.data.go.kr/B551011/KorService2/detailCommon2";
const TOUR_INTRO = "https://apis.data.go.kr/B551011/KorService2/detailIntro2";
const SEOUL_SEARCH = "https://festival.seoul.go.kr/festival/main/searchModal.do";

/** 매주 이만큼 앞의 행사까지 모은다 — 셀러가 모집 공고를 찾아 신청할 여유. */
export const LOOKAHEAD_DAYS = 90;

/**
 * 셀러가 판매 부스를 낼 수 있는 행사인지(행사명 기준). 위에서부터 먼저 맞는 규칙을 따른다.
 *   1) "부스·입점·참가업체·판매·셀러"처럼 판매 자리를 직접 뜻하는 말 → 포함
 *   2) 셀러가 물건을 팔 수 없는 행사 → 제외: 공연·콘텐츠 거래 마켓(공연예술마켓 등), 투어·관람, 공연·대회,
 *      영화제·불꽃축제, 채용·진로·귀농귀촌, 갤러리 중심 아트페어, 공공예술·비엔날레·전시회
 *   3) 박람회·페어·엑스포·대전 + 식품·공예·리빙·상품 같은 판매 품목 → 포함(회의가 함께 열려도)
 *   4) 회의·포럼·세미나 → 제외
 *   5) 마켓·장터·야시장·밤장·벼룩·직거래·특산물·먹거리·푸드트럭·공예 등 판매형 행사 → 포함
 *      ('공예'는 '공공예술'의 일부로 잘못 잡히지 않게 앞 글자가 '공'이면 제외)
 * 규칙은 사람이 직접 모은 셀러 모집 공고(시드 73건)와 실제 수집된 행사명으로 점검했다(weekly-sync.test.ts).
 */
const BOOTH_WORDS = /부스|입점|참가\s*업체|판매자|셀러|판매/;
const NOT_SELLING = /공연\s*예술|공연\s*마켓|뮤직\s*마켓|음악\s*마켓|콘텐츠\s*마켓|방송\s*마켓|필름\s*마켓|영화|게임|스타트업|투자|창업\s*경진|채용|취업|일자리|입시|유학|진로|공모전|경연|콘서트|음악회|뮤지컬|연극|오페라|발레|마라톤|불꽃|수출|바이어|B2B|무역|투어|아트\s*페어|공공\s*예술|비엔날레|트리엔날레|전시회|사진전|미술전|귀농|귀촌/i;
const FAIR_WORDS = /박람회|페어|엑스포|EXPO|식품\s*대전|수산\s*대전|농\S*\s*대전/i;
const FAIR_GOODS = /공예|핸드\s*메이드|식품|푸드|먹거리|특산|농산|수산|축산|커피|카페|디저트|베이커리|빵|떡|와인|맥주|막걸리|전통주|리빙|생활|캠핑|반려|펫|베이비|육아|웨딩|뷰티|패션|주얼리|굿즈|문구|꽃|화훼|상품|기념품|북\s*페어|도서|사회적\s*경제|사회연대\s*경제/;
const MEETING = /컨퍼런스|콘퍼런스|포럼|세미나|심포지엄|학술|국제\s*회의|비즈니스/;
const SELL_WORDS = /마켓|장터|야시장|야시|밤장|벼룩|직거래|특산|로컬\s*푸드|먹거리|푸드\s*트럭|푸드\s*페스티벌|(?<!공)공예|핸드\s*메이드|김장/;

export function isSellerEvent(name: string): boolean {
  if (BOOTH_WORDS.test(name)) return true;
  if (NOT_SELLING.test(name)) return false;
  if (FAIR_WORDS.test(name) && FAIR_GOODS.test(name)) return true;
  if (MEETING.test(name)) return false;
  return SELL_WORDS.test(name);
}

const NEW_BADGE_DAYS = 7;

/**
 * "새로 등록된 행사"인지. 매주 월요일 수집은 "수집일 ~ 90일 뒤"에 열리는 행사를 모으므로, 평소라면 그 주에
 * 새로 잡히는 행사는 수집 범위 끝(83~90일 뒤)에 막 들어온 행사다. 처음 수집했을 때 한꺼번에 들어온 과거·근일
 * 행사까지 NEW로 보이지 않도록, 수집 후 7일 이내이면서 시작일이 그 주의 새 범위에 드는 행사만 NEW로 본다.
 */
export function isNewlyListed(collectedAt: string | null | undefined, startDate: string | null, now = new Date()): boolean {
  if (!collectedAt || !startDate) return false;
  const collected = new Date(collectedAt);
  if (now.getTime() - collected.getTime() >= NEW_BADGE_DAYS * 86_400_000) return false;
  const day = (offset: number) => new Date(collected.getTime() + offset * 86_400_000).toISOString().slice(0, 10);
  return startDate > day(LOOKAHEAD_DAYS - NEW_BADGE_DAYS) && startDate <= day(LOOKAHEAD_DAYS);
}

export type AutoSourceDataset = "tour" | "seoulfest" | "seoulcult";

/** 자동 수집 출처별 정보. id 접두어(T/F)는 시드 행사 id(S01, A03 …)와 겹치지 않게 고른 것. */
export const AUTO_SOURCES: Record<AutoSourceDataset, { prefix: string; name: string }> = {
  tour: { prefix: "T", name: "한국관광공사 TourAPI" },
  seoulfest: { prefix: "F", name: "서울시 공식 축제 찾기" },
  seoulcult: { prefix: "C", name: "서울시 문화행사 정보" },
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
  /** 수집 응답에 상세 정보가 함께 오는 출처(서울시 문화행사 정보)는 여기에 담아 바로 저장한다 */
  details?: EventDetails;
}

/** 자동 수집 행사의 source_post_id 조회 조건(PostgREST or 필터) */
export const AUTO_SOURCE_FILTER = (Object.keys({ tour: 1, seoulfest: 1, seoulcult: 1 } satisfies Record<AutoSourceDataset, 1>))
  .map((d) => `source_post_id.like.${d}:*`).join(",");

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
  detailed: number; // 상세 정보(소개·운영 시간 등)를 채운 행사 수
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
    if (!isSellerEvent(e.name)) continue;
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

// ---------------------------------------------------------------------------
// 서울시 문화행사 정보(서울 열린데이터광장 culturalEventInfo) — 2021년 10월부터 지난 행사가 남아 있다.
// 키: .env.local의 SEOUL_OPENAPI_KEY(서울 열린데이터광장 인증키, 공공데이터포털 키와 다름).
// 날짜로 거르는 요청 파라미터가 없어 전체를 1,000건씩 받아 기간·판매형 여부로 거른다(과거 행사 채우기 전용).
// ---------------------------------------------------------------------------
const SEOUL_CULTURE = "http://openapi.seoul.go.kr:8088";

/** culturalEventInfo의 row 배열을 행사로 바꾼다. 위도·경도 칸이 서로 바뀌어 오는 경우가 있어 범위로 구분한다. */
export function parseSeoulCultureRows(rows: unknown[], from: string, to: string): CollectedEvent[] {
  const out: CollectedEvent[] = [];
  for (const row of rows) {
    if (!row || typeof row !== "object") continue;
    const r = row as Record<string, unknown>;
    const name = text(r.TITLE);
    const id = text(r.HMPG_ADDR).match(/cultcode=(\d+)/)?.[1];
    const start = text(r.STRTDATE).slice(0, 10);
    const end = text(r.END_DATE).slice(0, 10) || start;
    if (!name || !id || !isIsoDate(start) || !isIsoDate(end) || end < start) continue;
    if (!overlaps(start, end, from, to)) continue;
    // 공연·영화 분류는 이름에 '마켓'이 있어도 판매 부스가 없는 관람 행사다.
    if (/콘서트|연극|뮤지컬|오페라|클래식|국악|무용|영화|독주|독창/.test(text(r.CODENAME))) continue;
    const [a, b] = [coord(r.LAT), coord(r.LOT)];
    const lat = a != null && a > 30 && a < 40 ? a : b != null && b > 30 && b < 40 ? b : null;
    const lng = lat === a ? b : a;
    const place = text(r.PLACE);
    const details: EventDetails = Object.fromEntries(Object.entries({
      overview: [text(r.PROGRAM), text(r.ETC_DESC)].filter(Boolean).join("\n").slice(0, 1500),
      place,
      sponsor: text(r.ORG_NAME),
      admission: text(r.USE_FEE) || (text(r.IS_FREE) === "무료" ? "무료" : ""),
      homepage: /^https?:\/\//.test(text(r.ORG_LINK)) ? text(r.ORG_LINK) : "",
    }).filter(([, v]) => v));
    out.push({
      sourceDataset: "seoulcult",
      sourceId: `${AUTO_SOURCES.seoulcult.prefix}${id}`,
      name,
      region: "서울",
      venue: [text(r.GUNAME), place].filter(Boolean).join(" ") || null,
      startDate: start,
      endDate: end,
      imageUrl: text(r.MAIN_IMG).replace(/^http:\/\//, "https://") || null,
      lat,
      lng,
      sourceUrl: text(r.HMPG_ADDR),
      details,
    });
  }
  return out;
}

async function fetchSeoulCulture(key: string, from: string, to: string): Promise<CollectedEvent[]> {
  const page = async (start: number, end: number) => {
    const res = await fetch(`${SEOUL_CULTURE}/${encodeURIComponent(key)}/json/culturalEventInfo/${start}/${end}/`, { cache: "no-store", signal: AbortSignal.timeout(30000) });
    if (!res.ok) throw new Error(`서울시 문화행사 HTTP ${res.status}`);
    const data = await res.json() as { culturalEventInfo?: { list_total_count?: number; RESULT?: { CODE?: string; MESSAGE?: string }; row?: unknown[] }; RESULT?: { CODE?: string; MESSAGE?: string } };
    const body = data.culturalEventInfo;
    if (!body) throw new Error(`서울시 문화행사 거절: ${data.RESULT?.MESSAGE ?? "알 수 없음"}`);
    if (body.RESULT?.CODE && body.RESULT.CODE !== "INFO-000") throw new Error(`서울시 문화행사 거절: ${body.RESULT.MESSAGE ?? body.RESULT.CODE}`);
    return { total: Number(body.list_total_count ?? 0), rows: body.row ?? [] };
  };
  const first = await page(1, 1000);
  const rows = [...first.rows];
  for (let s = 1001; s <= first.total; s += 1000) rows.push(...(await page(s, Math.min(s + 999, first.total))).rows);
  return parseSeoulCultureRows(rows, from, to);
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

/** TourAPI 응답의 HTML 조각을 글자로: <br>은 줄바꿈, 나머지 태그는 지운다. */
function htmlText(v: unknown): string {
  if (typeof v !== "string") return "";
  return v.replace(/<br\s*\/?>/gi, "\n").replace(/<[^>]*>/g, "").replace(/&nbsp;/g, " ").replace(/&amp;/g, "&")
    .replace(/[ \t]+/g, " ").replace(/\n{3,}/g, "\n\n").trim();
}
/** homepage 칸은 보통 <a href="...">…</a> 형태 — 주소만 뽑는다. */
function htmlHref(v: unknown): string {
  if (typeof v !== "string") return "";
  const href = v.match(/href=["']([^"']+)["']/i)?.[1] ?? v.match(/https?:\/\/[^\s"'<>]+/)?.[0] ?? "";
  if (!href) return "";
  return /^https?:\/\//.test(href) ? href : `https://${href.replace(/^\/+/, "")}`;
}

async function tourItem(url: string, key: string, params: Record<string, string>): Promise<Record<string, unknown> | null> {
  const serviceKey = key.includes("%") ? key : encodeURIComponent(key);
  const q = new URLSearchParams({ MobileOS: "ETC", MobileApp: "Marketfit", _type: "json", ...params });
  const res = await fetch(`${url}?serviceKey=${serviceKey}&${q}`, { cache: "no-store", signal: AbortSignal.timeout(15000) });
  if (!res.ok) throw new Error(`TourAPI 상세 HTTP ${res.status}`);
  const data = await res.json() as { response?: { header?: { resultCode?: string }; body?: { items?: { item?: unknown } | "" } } };
  if (data.response?.header?.resultCode !== "0000") return null;
  const items = data.response.body?.items;
  const item = typeof items === "object" ? items.item : undefined;
  const first = Array.isArray(item) ? item[0] : item;
  return first && typeof first === "object" ? (first as Record<string, unknown>) : null;
}

/** TourAPI 상세 조회(공통정보 + 축제 소개정보)로 관람객용 행사 정보를 모은다. 실패하면 null. */
export async function fetchTourDetails(key: string, sourceId: string): Promise<EventDetails | null> {
  const contentId = sourceId.replace(/^T/, "");
  const [common, intro] = await Promise.all([
    tourItem(TOUR_COMMON, key, { contentId }),
    tourItem(TOUR_INTRO, key, { contentId, contentTypeId: "15" }), // 15 = 축제공연행사
  ]);
  if (!common && !intro) return null;
  return parseTourDetails(common ?? {}, intro ?? {});
}

export function parseTourDetails(common: Record<string, unknown>, intro: Record<string, unknown>): EventDetails {
  const details: EventDetails = {
    overview: htmlText(common.overview).slice(0, 1500),
    playtime: htmlText(intro.playtime),
    place: htmlText(intro.eventplace),
    sponsor: htmlText(intro.sponsor1),
    organizer: htmlText(intro.sponsor2),
    tel: htmlText(intro.sponsor1tel) || htmlText(common.tel),
    admission: htmlText(intro.usetimefestival),
    homepage: htmlHref(intro.eventhomepage) || htmlHref(common.homepage),
  };
  // 빈 칸은 저장하지 않는다(화면에 빈 항목을 늘어놓지 않도록).
  return Object.fromEntries(Object.entries(details).filter(([, v]) => v)) as EventDetails;
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

async function saveEvents(supabase: Admin, events: CollectedEvent[], now: string, tourKey?: string) {
  const existing = new Map<string, { id: string; event_id: string; hasDetails: boolean }>();
  const keys = events.map(sourceKey);
  // details 칸(0003_event_details.sql)이 아직 없으면 상세 정보 없이 기존처럼 저장한다.
  let detailsColumn = true;
  type Found = { id: string; event_id: string; source_post_id: string | null; events?: { details: unknown } | null };
  for (let i = 0; i < keys.length; i += 100) {
    const chunk = keys.slice(i, i + 100);
    const query = (cols: string) => supabase.from("event_recruitments").select(cols).in("source_post_id", chunk) as unknown as PromiseLike<{ data: Found[] | null; error: { message: string } | null }>;
    let res = detailsColumn ? await query("id, event_id, source_post_id, events(details)") : null;
    if (!res || res.error) {
      detailsColumn = false;
      res = await query("id, event_id, source_post_id");
    }
    if (res.error) throw new Error(`기존 행사 조회 실패: ${res.error.message}`);
    for (const r of res.data ?? []) {
      if (r.source_post_id) existing.set(r.source_post_id, { id: r.id, event_id: r.event_id, hasDetails: Boolean(r.events?.details) });
    }
  }

  let created = 0, updated = 0, failed = 0, detailed = 0;
  /** 새 행사와 상세 정보가 비어 있는 행사만 상세 조회한다(API 하루 호출 한도를 아끼려고). */
  const enrich = async (eventId: string, recruitmentId: string, e: CollectedEvent) => {
    if (!detailsColumn) return;
    if (!e.details && (!tourKey || e.sourceDataset !== "tour")) return;
    try {
      const d = e.details ?? (await fetchTourDetails(tourKey!, e.sourceId));
      if (!d || !Object.keys(d).length) return;
      const [ev, rc] = await Promise.all([
        supabase.from("events").update({ details: d, description: d.overview ?? null }).eq("id", eventId),
        supabase.from("event_recruitments").update({ organizer: d.sponsor ?? null, official_site_url: d.homepage ?? null }).eq("id", recruitmentId),
      ]);
      if (!ev.error && !rc.error) detailed++;
    } catch { /* 상세 정보가 없어도 행사 자체는 저장돼 있다 */ }
  };
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
      if (!found.hasDetails) await enrich(found.event_id, found.id, e);
      return;
    }
    const { data: ev, error: evErr } = await supabase.from("events").insert(eventRow(e)).select("id").single();
    if (evErr || !ev) { failed++; return; }
    const { data: rc, error: rcErr } = await supabase.from("event_recruitments").insert({
      event_id: ev.id,
      source_name: AUTO_SOURCES[e.sourceDataset].name,
      source_url: e.sourceUrl,
      source_type: "government",
      source_post_id: key,
      original_title: e.name,
      collected_at: now,
      last_checked_at: now,
      is_sample_data: false,
    }).select("id").single();
    if (rcErr || !rc) {
      // 모집정보 없이 events만 남으면 다음 주에 키로 못 찾아 중복이 생기므로 되돌린다.
      await supabase.from("events").delete().eq("id", ev.id);
      failed++;
      return;
    }
    created++;
    newEvents.push(e.name);
    await enrich(ev.id, rc.id, e);
  };

  // Supabase 요청을 10개씩 병렬로 — 수백 건이어도 함수 제한 시간 안에 끝난다.
  for (let i = 0; i < events.length; i += 10) await Promise.all(events.slice(i, i + 10).map(upsertOne));
  return { created, updated, failed, newEvents, detailed };
}

/**
 * 이미 저장된 자동 수집 행사 중 지금 기준(isSellerEvent)에 맞지 않는 행사를 지운다.
 * 행사를 지우면 그 행사의 모집정보·참가 기록·판매 기록도 함께 지워진다(on delete cascade).
 */
export async function pruneNonSellerEvents(supabase: Admin, dryRun: boolean) {
  const rows: { event_id: string; source_post_id: string | null; events: { name: string } | null }[] = [];
  for (let from = 0; ; from += 1000) {
    const { data, error } = await supabase
      .from("event_recruitments")
      .select("event_id, source_post_id, events(name)")
      .or(AUTO_SOURCE_FILTER)
      .range(from, from + 999);
    if (error) throw new Error(`자동 수집 행사 조회 실패: ${error.message}`);
    rows.push(...((data ?? []) as unknown as typeof rows));
    if (!data || data.length < 1000) break;
  }
  const targets = rows.filter((r) => r.events && !isSellerEvent(r.events.name));
  let participations = 0;
  const ids = targets.map((t) => t.event_id);
  for (let i = 0; i < ids.length; i += 100) {
    const { count, error } = await supabase.from("event_participations").select("id", { count: "exact", head: true }).in("event_id", ids.slice(i, i + 100));
    if (error) throw new Error(`참가 기록 조회 실패: ${error.message}`);
    participations += count ?? 0;
  }
  if (!dryRun) {
    for (let i = 0; i < ids.length; i += 100) {
      const { error } = await supabase.from("events").delete().in("id", ids.slice(i, i + 100));
      if (error) throw new Error(`행사 삭제 실패: ${error.message}`);
    }
  }
  return { checked: rows.length, removed: targets.map((t) => t.events!.name), participations };
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
  /** 서울시 문화행사 정보 키 — 기간(range)을 줄 때만 쓴다(전체를 받아 걸러야 해서 매주 자동 수집에는 쓰지 않음) */
  seoulCultureKey?: string;
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
  if (opts.range && opts.seoulCultureKey) lookups.push([AUTO_SOURCES.seoulcult.name, () => fetchSeoulCulture(opts.seoulCultureKey!, from, to)]);

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
    sources.push({ source, fetched: r.value.length, kept: r.value.filter((e) => isSellerEvent(e.name)).length });
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
    detailed: 0,
  };

  if (dryRun) {
    report.newEvents = kept.slice(0, 30).map((e) => `${e.name} (${e.startDate}, ${e.region ?? "지역 미상"})`);
    return report;
  }
  if (!opts.supabase) throw new Error("SUPABASE_SERVICE_ROLE_KEY가 없어 저장할 수 없습니다.");

  const saved = await saveEvents(opts.supabase, kept, now.toISOString(), opts.tourKey);
  return { ...report, ...saved, newEvents: saved.newEvents.slice(0, 30) };
}
