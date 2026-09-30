import { seedEvents } from "../../lib/data/seed-events";
import type { GeminiSource, GeminiTurn } from "./gemini";

const SEOUL_SEARCH = "https://festival.seoul.go.kr/festival/main/searchModal.do";
const SEOUL_CALENDAR = "https://festival.seoul.go.kr/festival/seasonal/list.do";
// 한국관광공사 TourAPI: 전국 지자체가 등록한 축제·행사 정보를 모은 공식 공공데이터.
const TOUR_SEARCH = "https://apis.data.go.kr/B551011/KorService2/searchFestival2";
const TOUR_CALENDAR = "https://korean.visitkorea.or.kr/kfes/list/wntyFstvlList.do";

// [짧은 이름, 질문에서 찾는 패턴, 주소 앞부분, 법정동 시도 코드]
const REGIONS: [string, RegExp, string[], string][] = [
  ["서울", /서울(?!대)/, ["서울"], "11"],
  ["부산", /부산/, ["부산"], "26"],
  ["대구", /대구/, ["대구"], "27"],
  ["인천", /인천/, ["인천"], "28"],
  ["광주", /광주(?!시)/, ["광주"], "29"],
  ["대전", /대전/, ["대전"], "30"],
  ["울산", /울산/, ["울산"], "31"],
  ["세종", /세종(?!대왕|문화회관|로|대)/, ["세종"], "36"],
  ["경기", /경기(?:도|권|\s|에서|$)/, ["경기"], "41"],
  ["강원", /강원/, ["강원"], "51"],
  ["충북", /충북|충청북도/, ["충북", "충청북도"], "43"],
  ["충남", /충남|충청남도/, ["충남", "충청남도"], "44"],
  ["전북", /전북|전라북도/, ["전북", "전라북도"], "52"],
  ["전남", /전남|전라남도/, ["전남", "전라남도"], "46"],
  ["경북", /경북|경상북도/, ["경북", "경상북도"], "47"],
  ["경남", /경남|경상남도/, ["경남", "경상남도"], "48"],
  ["제주", /제주/, ["제주"], "50"],
];

const TOPIC = /행사|축제|페스티벌|페스타|마켓|장터|야시장|벼룩|박람회|이벤트/;
const MARKET = /플리\s*마켓|마켓|장터|벼룩|야시장/;
// 개인 기록·모집·가격·장르처럼 행사 목록만으로 답할 수 없는 조건은 AI 경로로 보낸다.
const NEEDS_AI = /모집|셀러|신청|참가비|부스|매출|순이익|수익|참가한|참여한|내가|내\s*가게|우리\s*가게|추천|분석|비교|공연|전시|콘서트|무료|유료|입장료|가격/;
// 시·군·구나 동네 조건을 임의로 무시해 시·도 전체 결과로 답하지 않는다.
const SUB_AREA = /[가-힣]{1,5}(?:구|군)(?:에서|의|\s|$)|[가-힣]{2,5}시(?:에서|의|\s|$)|한강|강남|홍대|성수|명동|잠실|여의도|해운대|광안리|서면/;
// 시·도 이름 자체("대구 ", "부산시에서")나 흔한 단어("친구", "혹시")는 세부 지역 조건으로 보지 않는다.
const NOT_SUB_AREA = /친구|연구|가구|도시|당시|동시|역시|잠시|혹시|(?:서울|부산|대구|인천|대전|울산|세종|제주)(?:특별자치시|특별자치도|특별시|광역시|시|도)?|광주광역시|광주(?!시)/g;

export interface EventQuery {
  from: string;
  to: string;
  today: string;
  marketOnly: boolean;
  region: string; // REGIONS의 짧은 이름 또는 "전국"
}

interface EventRecord {
  name: string;
  start: string;
  end: string;
  place: string;
  url: string;
  tentative: boolean;
}

export interface EventReply {
  ok: true;
  text: string;
  sources: GeminiSource[];
}

function koreaDate(now: Date): string {
  return new Intl.DateTimeFormat("sv-SE", { timeZone: "Asia/Seoul", year: "numeric", month: "2-digit", day: "2-digit" }).format(now);
}

function iso(year: number, month: number, day: number): string {
  return new Date(Date.UTC(year, month - 1, day)).toISOString().slice(0, 10);
}

/** 질문에 지역이 정확히 하나(또는 "전국")면 그 이름, 없으면 undefined, 여러 개면 null. */
function regionOf(text: string): string | null | undefined {
  const found = REGIONS.filter(([, pattern]) => pattern.test(text)).map(([name]) => name);
  if (/전국/.test(text)) found.push("전국");
  return found.length > 1 ? null : found[0];
}

/** 한국 날짜 기준 기간. 기간 표현이 없으면 undefined. */
function rangeOf(text: string, today: string): [string, string] | undefined {
  const [year, month, day] = today.split("-").map(Number);
  const dow = new Date(`${today}T00:00:00Z`).getUTCDay();
  const monday = day - (dow === 0 ? 6 : dow - 1);
  const specified = text.match(/(?<!\d)(?:(20\d{2})년\s*)?(1[0-2]|[1-9])월/);
  if (/다음\s*주\s*말/.test(text)) return [iso(year, month, monday + 12), iso(year, month, monday + 13)];
  if (/이번\s*주\s*말|주말/.test(text)) return [iso(year, month, monday + 5), iso(year, month, monday + 6)];
  if (/다음\s*주/.test(text)) return [iso(year, month, monday + 7), iso(year, month, monday + 13)];
  if (/이번\s*주/.test(text)) return [today, iso(year, month, monday + 6)];
  if (/오늘|내일|모레/.test(text)) {
    const date = iso(year, month, day + (/모레/.test(text) ? 2 : /내일/.test(text) ? 1 : 0));
    return [date, date];
  }
  if (specified || /이번\s*달|이달|다음\s*달/.test(text)) {
    const targetYear = specified?.[1] ? Number(specified[1]) : year;
    const targetMonth = specified ? Number(specified[2]) : month + (/다음\s*달/.test(text) ? 1 : 0);
    return [iso(targetYear, targetMonth, 1), iso(targetYear, targetMonth + 1, 0)];
  }
  return undefined;
}

/** 공식 목록으로 답할 수 있는 "지역 + 기간 + 행사" 질문만 처리하고, 나머지는 AI 경로로 보낸다. */
export function parseEventQuery(history: GeminiTurn[], now = new Date()): EventQuery | null {
  const users = history.filter((turn) => turn.role === "user");
  const latest = users.at(-1)?.text.trim() ?? "";
  const today = koreaDate(now);
  // 날짜나 범위를 함께 명시한 복합 질문은 월 전체로 잘못 해석하지 않는다.
  if (NEEDS_AI.test(latest) || /\d{1,2}\s*일|부터|까지|~/.test(latest)) return null;
  if (SUB_AREA.test(latest.replace(NOT_SUB_AREA, ""))) return null;

  const region = regionOf(latest);
  const range = rangeOf(latest, today);
  if (region === null) return null;

  // "그럼 다음 달은?", "부산은?" 같은 짧은 후속 질문은 직전 질문의 조건을 이어받는다.
  if (!TOPIC.test(latest)) {
    if (latest.length >= 30 || (!region && !range) || users.length < 2) return null;
    const base = parseEventQuery([users.at(-2)!], now);
    if (!base) return null;
    const [from, to] = range ?? [base.from, base.to];
    return { ...base, from, to, region: region ?? base.region, marketOnly: base.marketOnly || MARKET.test(latest) };
  }
  if (!region || !range) return null;
  return { from: range[0], to: range[1], today, marketOnly: MARKET.test(latest), region };
}

function validDate(value: unknown): value is string {
  return typeof value === "string" && /^\d{4}-\d{2}-\d{2}$/.test(value)
    && !Number.isNaN(Date.parse(value)) && new Date(value).toISOString().slice(0, 10) === value;
}

function plain(value: unknown): string {
  return typeof value === "string" ? value.replace(/<[^>]*>/g, "").replace(/\s+/g, " ").trim().slice(0, 200) : "";
}

const isMarket = (text: string) => /마켓|장터|벼룩|야시장/i.test(text);

export function parseSeoulEvents(data: unknown, query: EventQuery): EventRecord[] {
  if (!Array.isArray(data)) throw new Error("Unexpected Seoul event response");
  const events: EventRecord[] = [];
  for (const row of data) {
    if (!row || typeof row !== "object") continue;
    const name = plain(row.festa_name);
    const id = String(row.festa_code ?? "");
    if (!name || !/^\d+$/.test(id) || !validDate(row.strt_date) || !validDate(row.end_date)) continue;
    if (row.end_date < row.strt_date || row.strt_date > query.to || row.end_date < query.from) continue;
    if (row.gcode === "11000" || row.del_yn === "Y" || row.use_yn === "N") continue;
    if (query.marketOnly && !isMarket(`${name} ${plain(row.thumb_desc)}`)) continue;
    events.push({ name, start: row.strt_date, end: row.end_date, place: plain(row.place) || "장소 미기재",
      url: `https://festival.seoul.go.kr/festival/main/festivalView.do?festacode=${id}`, tentative: row.period_yn === "N" });
  }
  return events;
}

/** TourAPI 응답 item 배열에서 기간·지역이 맞는 행사만 남긴다. */
export function parseTourEvents(items: unknown[], query: EventQuery): EventRecord[] {
  const region = REGIONS.find(([name]) => name === query.region);
  const events: EventRecord[] = [];
  for (const row of items) {
    if (!row || typeof row !== "object") continue;
    const r = row as Record<string, unknown>;
    const name = plain(r.title);
    const toIso = (v: unknown) => typeof v === "string" && /^\d{8}$/.test(v) ? `${v.slice(0, 4)}-${v.slice(4, 6)}-${v.slice(6)}` : "";
    const start = toIso(r.eventstartdate);
    const end = toIso(r.eventenddate);
    if (!name || !/^\d+$/.test(String(r.contentid ?? "")) || !validDate(start) || !validDate(end)) continue;
    if (end < start || start > query.to || end < query.from) continue;
    const addr = plain(r.addr1);
    if (region && !(addr ? region[2].some((prefix) => addr.startsWith(prefix)) : String(r.lDongRegnCd ?? "") === region[3])) continue;
    if (query.marketOnly && !isMarket(name)) continue;
    events.push({ name, start, end, place: plain(`${addr} ${plain(r.addr2)}`) || "장소 미기재",
      url: `https://korean.visitkorea.or.kr/search/search_list.do?keyword=${encodeURIComponent(name)}`, tentative: false });
  }
  return events;
}

async function fetchSeoulEvents(query: EventQuery): Promise<EventRecord[]> {
  const response = await fetch(SEOUL_SEARCH, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({ searchStrtDate: query.from, searchEndDate: query.to, searchGcode: "", searchSubjCode: "", searchKeyword: query.marketOnly ? "마켓" : "" }),
    cache: "no-store",
    signal: AbortSignal.timeout(8000),
  });
  if (!response.ok) throw new Error("Seoul event search unavailable");
  return parseSeoulEvents(await response.json(), query);
}

async function fetchTourEvents(query: EventQuery, key: string): Promise<EventRecord[]> {
  // 공공데이터포털의 "인코딩" 키(이미 %가 들어간 값)와 "디코딩" 키를 모두 받는다.
  const serviceKey = key.includes("%") ? key : encodeURIComponent(key);
  const signal = AbortSignal.timeout(8000);
  const rows: unknown[] = [];
  for (let page = 1; page <= 5; page++) {
    const params = new URLSearchParams({ MobileOS: "ETC", MobileApp: "Marketfit", _type: "json", arrange: "A", numOfRows: "1000",
      pageNo: String(page), eventStartDate: query.from.replaceAll("-", ""), eventEndDate: query.to.replaceAll("-", "") });
    const response = await fetch(`${TOUR_SEARCH}?serviceKey=${serviceKey}&${params}`, { cache: "no-store", signal });
    if (!response.ok) throw new Error("Tour event search unavailable");
    const data = await response.json() as { response?: { header?: { resultCode?: string }; body?: { totalCount?: number; items?: { item?: unknown } | "" } } };
    if (data.response?.header?.resultCode !== "0000") throw new Error("Tour event search rejected");
    const body = data.response.body;
    const item = typeof body?.items === "object" ? body.items.item : undefined;
    rows.push(...(Array.isArray(item) ? item : item ? [item] : []));
    if (page * 1000 >= Number(body?.totalCount ?? 0)) break;
  }
  return parseTourEvents(rows, query);
}

function storedEvents(query: EventQuery): EventRecord[] {
  return seedEvents.filter((e) => (query.region === "전국" ? e.region : e.region === query.region) && e.startDate && e.endDate && e.sourceUrl
    && e.startDate <= query.to && e.endDate >= query.from
    && (!query.marketOnly || isMarket(e.name)))
    .map((e) => ({ name: e.name, start: e.startDate!, end: e.endDate!, place: e.venue ?? "장소 미기재", url: e.sourceUrl!, tentative: false }));
}

/** 공개 행사 목록 조회. 대화/가게 정보는 전송하지 않는다. 처리할 수 없으면 null(AI 경로). */
export async function getEventReply(history: GeminiTurn[], now = new Date()): Promise<EventReply | null> {
  const query = parseEventQuery(history, now);
  if (!query) return null;
  const tourKey = process.env.TOUR_API_KEY?.trim();
  const lookups: [string, string, () => Promise<EventRecord[]>][] = [];
  if (query.region === "서울") lookups.push(["서울시 공식 행사 자료", SEOUL_CALENDAR, () => fetchSeoulEvents(query)]);
  if (tourKey) lookups.push(["한국관광공사 전국 축제 정보(지자체 등록 자료)", TOUR_CALENDAR, () => fetchTourEvents(query, tourKey)]);

  let events: EventRecord[] | undefined;
  let source: [string, string] | undefined;
  for (const [label, calendar, lookup] of lookups) {
    try {
      events = await lookup();
      source = [label, calendar];
      break;
    } catch { /* 다음 공식 출처 또는 저장 자료로 넘어간다. */ }
  }
  if (!events) {
    events = storedEvents(query);
    // 서울 외 지역은 저장 자료가 적어, 비어 있으면 "없다"고 답하기보다 AI 경로에 맡긴다.
    if (!events.length && query.region !== "서울") return null;
  }

  // 종료한 행사는 뒤로, 조회 기간 안에 시작하는 행사를 몇 달째 이어지는 상설 행사보다 앞에 둔다.
  const unique = [...new Map(events.map((e) => [e.url, e])).values()].sort((a, b) =>
    Number(a.end < query.today) - Number(b.end < query.today)
    || Number(a.start < query.from) - Number(b.start < query.from)
    || a.start.localeCompare(b.start));
  const shown = unique.slice(0, 8);
  const range = query.from === query.to ? query.from : `${query.from} ~ ${query.to}`;
  const kind = query.marketOnly ? "마켓" : "행사";
  const lines = [source
    ? `${source[0]}에서 확인한 ${range} ${query.region} ${kind} 일정이에요. (${query.today} 조회)`
    : `실시간 조회가 어려워 앱에 저장된 공개 행사 자료에서 ${range} ${query.region} 일정을 찾았어요. 최신 변경 사항은 원문을 확인해 주세요.`];
  if (!shown.length) {
    lines.push("이번 조회 자료에서 조건에 맞는 일정을 찾지 못했어요. 해당 기간에 행사가 전혀 없다는 뜻은 아니에요.");
  } else {
    for (const [index, event] of shown.entries()) {
      const status = event.end < query.today ? "종료" : event.start > query.today ? "예정" : "진행 기간";
      lines.push(`${index + 1}. ${event.name}\n   ${event.start} ~ ${event.end} · ${event.place}\n   ${status}${event.tentative ? " · 일정 미확정" : ""}`);
    }
    if (unique.length > shown.length) lines.push(`조회된 ${unique.length}건 중 ${shown.length}건만 보여드렸어요. 전체 목록은 아래 행사 달력에서 확인해 주세요.`);
    lines.push("조회된 일부 일정이며, 표시된 기간 내 매일 운영된다는 뜻은 아니에요. 운영일·시간과 변경 여부는 아래 공식 출처를 확인해 주세요. 셀러 모집 여부는 이 행사 목록만으로 확인되지 않아요.");
  }
  return { ok: true, text: lines.join("\n\n"), sources: [
    ...shown.map((e) => ({ title: e.name, url: e.url })),
    ...(source ? [{ title: source[1] === SEOUL_CALENDAR ? "서울시 공식 행사 달력" : "대한민국 구석구석 축제 달력", url: source[1] }] : []),
  ] };
}
