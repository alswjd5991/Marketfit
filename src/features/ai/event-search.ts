import { seedEvents } from "../../lib/data/seed-events";
import type { GeminiSource, GeminiTurn } from "./gemini";

const SEOUL_SEARCH = "https://festival.seoul.go.kr/festival/main/searchModal.do";
const SEOUL_CALENDAR = "https://festival.seoul.go.kr/festival/seasonal/list.do";

export interface EventQuery {
  from: string;
  to: string;
  today: string;
  marketOnly: boolean;
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

/** 지원하는 서울 행사 일정 조회만 처리하고, 개인 기록·모집·다른 지역 질문은 AI 경로로 보낸다. */
export function parseEventQuery(history: GeminiTurn[], now = new Date()): EventQuery | null {
  const users = history.filter((turn) => turn.role === "user");
  const latest = users.at(-1)?.text ?? "";
  const previous = users.at(-2)?.text ?? "";
  const followup = /^(그럼\s*)?(이번\s*달|다음\s*달|다음달|이번달|오늘|내일|이번\s*주말|\d{1,2}월)(은|는|에|\s|\?|$)/.test(latest.trim())
    && latest.length < 35 && !/서울|부산|인천|대구|대전|광주|울산|경기|제주/.test(latest);
  const scope = followup ? `${previous}\n${latest}` : latest;
  if (!/서울/.test(scope) || !/행사|축제|마켓/.test(scope)) return null;
  if (/부산|인천|대구|대전|광주|울산|경기|제주|전국|모집|셀러|신청|참가비|매출|순이익|참가한|참여한|내가|추천|분석|내\s*가게|우리\s*가게/.test(scope)) return null;
  // 구/장소/가격 등의 조건을 임의로 무시해 서울 전체 결과로 답하지 않는다.
  if (/[가-힣]+구(?:에서|의|\s)|무료|유료|한강|강남|홍대|성수|공연|전시/.test(scope)) return null;
  const today = koreaDate(now);
  const [year, month, day] = today.split("-").map(Number);
  let from: string;
  let to: string;
  const specified = latest.match(/(?<!\d)(?:(20\d{2})년\s*)?(1[0-2]|[1-9])월/);
  if (/이번\s*주말/.test(latest)) {
    const dow = new Date(`${today}T00:00:00Z`).getUTCDay();
    const saturday = day + (dow === 0 ? -1 : 6 - dow);
    from = iso(year, month, saturday);
    to = iso(year, month, saturday + 1);
  } else if (/오늘|내일/.test(latest)) {
    from = to = iso(year, month, day + (/내일/.test(latest) ? 1 : 0));
  } else if (specified || /이번\s*달|다음\s*달/.test(latest)) {
    const targetYear = specified?.[1] ? Number(specified[1]) : year;
    const targetMonth = specified ? Number(specified[2]) : month + (/다음\s*달/.test(latest) ? 1 : 0);
    from = iso(targetYear, targetMonth, 1);
    to = iso(targetYear, targetMonth + 1, 0);
  } else {
    return null;
  }
  // 날짜나 범위를 함께 명시한 복합 질문은 월 전체로 잘못 해석하지 않는다.
  if (/\d{1,2}\s*일|부터|까지|~/.test(latest)) return null;
  return { from, to, today, marketOnly: /플리\s*마켓|플리마켓|벼룩|장터|마켓/.test(scope) };
}

function validDate(value: unknown): value is string {
  return typeof value === "string" && /^\d{4}-\d{2}-\d{2}$/.test(value)
    && !Number.isNaN(Date.parse(value)) && new Date(value).toISOString().slice(0, 10) === value;
}

function plain(value: unknown): string {
  return typeof value === "string" ? value.replace(/<[^>]*>/g, "").replace(/\s+/g, " ").trim().slice(0, 200) : "";
}

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
    if (query.marketOnly && !/마켓|장터|벼룩/.test(`${name} ${plain(row.thumb_desc)}`)) continue;
    events.push({ name, start: row.strt_date, end: row.end_date, place: plain(row.place) || "장소 미기재",
      url: `https://festival.seoul.go.kr/festival/main/festivalView.do?festacode=${id}`, tentative: row.period_yn === "N" });
  }
  return events;
}

function storedEvents(query: EventQuery): EventRecord[] {
  return seedEvents.filter((e) => e.region === "서울" && e.startDate && e.endDate && e.sourceUrl
    && e.startDate <= query.to && e.endDate >= query.from
    && (!query.marketOnly || /마켓|장터|벼룩/.test(e.name)))
    .map((e) => ({ name: e.name, start: e.startDate!, end: e.endDate!, place: e.venue ?? "장소 미기재", url: e.sourceUrl!, tentative: false }));
}

/** 서울시 공개 검색 폼과 동일한 읽기 요청. 대화/가게 정보는 전송하지 않는다. */
export async function getEventReply(history: GeminiTurn[], now = new Date()): Promise<EventReply | null> {
  const query = parseEventQuery(history, now);
  if (!query) return null;
  let events: EventRecord[];
  let live = false;
  try {
    const response = await fetch(SEOUL_SEARCH, {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({ searchStrtDate: query.from, searchEndDate: query.to, searchGcode: "", searchSubjCode: "", searchKeyword: query.marketOnly ? "마켓" : "" }),
      cache: "no-store",
      signal: AbortSignal.timeout(8000),
    });
    if (!response.ok) throw new Error("Seoul event search unavailable");
    events = parseSeoulEvents(await response.json(), query);
    live = true;
  } catch {
    events = storedEvents(query);
  }

  // 종료한 행사를 앞으로 갈 수 있는 행사처럼 안내하지 않는다.
  const unique = [...new Map(events.map((e) => [e.url, e])).values()].sort((a, b) =>
    Number(a.end < query.today) - Number(b.end < query.today) || a.start.localeCompare(b.start));
  const shown = unique.slice(0, 8);
  const range = query.from === query.to ? query.from : `${query.from} ~ ${query.to}`;
  const lines = [live
    ? `서울시 공식 행사 자료에서 확인한 ${range} 서울 ${query.marketOnly ? "마켓" : "행사"} 일정이에요. (${query.today} 조회)`
    : `서울시 실시간 조회가 어려워 앱에 저장된 공개 행사 자료에서 ${range} 서울 일정을 찾았어요. 최신 변경 사항은 원문을 확인해 주세요.`];
  if (!shown.length) {
    lines.push("이번 조회 자료에서 조건에 맞는 일정을 찾지 못했어요. 해당 기간에 행사가 전혀 없다는 뜻은 아니에요.");
  } else {
    for (const [index, event] of shown.entries()) {
      const status = event.end < query.today ? "종료" : event.start > query.today ? "예정" : "진행 기간";
      lines.push(`${index + 1}. ${event.name}\n   ${event.start} ~ ${event.end} · ${event.place}\n   ${status}${event.tentative ? " · 일정 미확정" : ""}`);
    }
    lines.push("조회된 일부 일정이며, 표시된 기간 내 매일 운영된다는 뜻은 아니에요. 운영일·시간과 변경 여부는 아래 공식 출처를 확인해 주세요. 셀러 모집 여부는 이 행사 목록만으로 확인되지 않아요.");
  }
  return { ok: true, text: lines.join("\n\n"), sources: [
    ...shown.map((e) => ({ title: e.name, url: e.url })),
    { title: "서울시 공식 행사 달력", url: SEOUL_CALENDAR },
  ] };
}
