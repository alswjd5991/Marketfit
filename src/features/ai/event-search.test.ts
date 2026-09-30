import assert from "node:assert/strict";
import { afterEach, beforeEach, mock, test } from "node:test";
import {
  isSameEvent, parseEventQuery, parseMarketfitEvents, parseSeoulEvents, parseTourEvents,
  type EventQuery, type EventRecord, type MarketfitEventRow,
} from "./event-search";
import { generateChatReply, type ChatDeps } from "./reply";
import { participationStats } from "./stats";

const now = new Date("2026-09-29T15:30:00Z"); // 한국 9월 30일
const question = (text: string) => [{ role: "user" as const, text }];
const base = { today: "2026-09-30", marketOnly: false, recruit: false };
const query = parseEventQuery(question("이번 달 서울에서 열리는 행사는?"), now)!;
const seoulFixture = [
  { festa_code: 1, festa_name: "종료 행사", strt_date: "2026-09-12", end_date: "2026-09-12", place: "서울 광장", period_yn: "Y" },
  { festa_code: 2, festa_name: "진행 행사", strt_date: "2026-09-28", end_date: "2026-10-02", place: "서울 공원", period_yn: "N" },
  { festa_code: 3, festa_name: "작년 행사", strt_date: "2025-09-01", end_date: "2025-09-30" },
];
const record = (name: string, start = "2026-09-20", end = start): EventRecord =>
  ({ name, start, end, place: "장소", url: `/events/${name}`, tentative: false });

let keySeq = 0;
beforeEach(() => {
  process.env.GEMINI_API_KEY = `test-key-${++keySeq}`; // 모델 쿨다운이 테스트 사이에 이어지지 않게 매번 다른 키
  process.env.GEMINI_MODELS = "m1";
  mock.method(console, "warn", () => {});
});
afterEach(() => {
  mock.restoreAll();
  delete process.env.TOUR_API_KEY;
  delete process.env.GEMINI_API_KEY;
  delete process.env.GEMINI_MODELS;
});

// ── 질문 해석 ────────────────────────────────────────────────
test("사용자가 보고한 질문을 한국 날짜의 이번 달로 해석한다", () => {
  assert.deepEqual(query, { from: "2026-09-01", to: "2026-09-30", ...base, region: "서울" });
});
test("한국 자정, 연말 다음 달, 윤년의 마지막 날을 처리한다", () => {
  assert.equal(parseEventQuery(question("이번 달 서울 행사는?"), new Date("2026-09-30T15:01:00Z"))?.from, "2026-10-01");
  assert.equal(parseEventQuery(question("다음 달 서울 행사는?"), new Date("2026-12-15"))?.from, "2027-01-01");
  assert.equal(parseEventQuery(question("2028년 2월 서울 행사는?"), now)?.to, "2028-02-29");
});
test("전국 시·도와 동의어·주 단위 기간을 해석하고, 지역이 없으면 전국으로 본다", () => {
  const cases: [string, string, string, string][] = [
    ["이번 달 부산 축제 알려줘", "부산", "2026-09-01", "2026-09-30"],
    ["다음 달 강원도 페스티벌", "강원", "2026-10-01", "2026-10-31"],
    ["이번 주말 대구 행사 있어?", "대구", "2026-10-03", "2026-10-04"],
    ["다음 주 경기도 이벤트", "경기", "2026-10-05", "2026-10-11"],
    ["10월 전국 축제", "전국", "2026-10-01", "2026-10-31"],
    ["이번 달 행사 뭐 있어?", "전국", "2026-09-01", "2026-09-30"],
    ["친구랑 갈 이번 달 전라남도 축제", "전남", "2026-09-01", "2026-09-30"],
    ["이번 달 부산시에서 하는 행사", "부산", "2026-09-01", "2026-09-30"],
  ];
  for (const [text, region, from, to] of cases) {
    assert.deepEqual(parseEventQuery(question(text), now), { from, to, ...base, region }, text);
  }
  assert.equal(parseEventQuery(question("내일 제주 야시장"), now)?.marketOnly, true);
});
test("셀러 모집 질문은 모집 조회로 보고, 기간이 없으면 오늘부터 90일로 본다", () => {
  assert.deepEqual(parseEventQuery(question("서울 셀러 모집 중인 곳"), now),
    { from: "2026-09-30", to: "2026-12-29", ...base, recruit: true, region: "서울" });
  assert.equal(parseEventQuery(question("이번 달 부산 플리마켓 부스 신청"), now)?.recruit, true);
});
test("후속 질문은 지역이나 기간만 바꿔 이전 조건을 이어받는다", () => {
  const first = [...question("이번 달 서울 마켓"), { role: "model" as const, text: "일정입니다" }];
  assert.deepEqual(parseEventQuery([...first, ...question("부산은?")], now),
    { from: "2026-09-01", to: "2026-09-30", ...base, marketOnly: true, region: "부산" });
  assert.equal(parseEventQuery([...first, ...question("그럼 다음 달은?")], now)?.from, "2026-10-01");
  assert.equal(parseEventQuery([...first, ...question("그 가격은?")], now), null);
});
test("여러 지역·개인 기록·세부 지역·장르·특정 날짜 조건은 목록 조회로 바꾸지 않는다", () => {
  for (const text of ["이번 달 서울과 부산 행사", "이번 달 경기 광주시 축제", "이번 달 부산 해운대구 축제", "이번 달 수원시 축제",
    "이번 달 서울 공연", "이번 달 서울대 축제", "내가 참가한 이번 달 서울 행사", "이번 달 서울 무료 행사", "이번 달 서울 강남구 행사",
    "9월 15일 서울 행사", "서울 행사란 무엇이야?", "내 가게에 맞는 이번 달 서울 행사 추천", "13월 서울 행사"]) {
    assert.equal(parseEventQuery(question(text), now), null, text);
  }
});

// ── 출처별 응답 해석 ─────────────────────────────────────────
test("서울시 응답에서 날짜가 겹치는 행사만 남기고 잘못된 날짜·외부 지역을 제외한다", () => {
  const parsed = parseSeoulEvents([...seoulFixture,
    { ...seoulFixture[0], festa_code: 4, strt_date: "2026-09-31" },
    { ...seoulFixture[0], festa_code: 5, gcode: "11000" },
    { ...seoulFixture[0], festa_code: 6, del_yn: "Y" },
  ], query);
  assert.deepEqual(parsed.map((e) => e.name), ["종료 행사", "진행 행사"]);
});

const tourItems = [
  { contentid: "101", title: "부산 가을 축제", eventstartdate: "20260925", eventenddate: "20261005", addr1: "부산광역시 수영구 광안해변로", addr2: "" },
  { contentid: "102", title: "경기 광주 행사", eventstartdate: "20260910", eventenddate: "20260912", addr1: "경기도 광주시 중앙로", addr2: "" },
  { contentid: "103", title: "광주 비엔날레 행사", eventstartdate: "20260901", eventenddate: "20260903", addr1: "광주광역시 북구", addr2: "" },
  { contentid: "104", title: "지난 해 부산 축제", eventstartdate: "20250901", eventenddate: "20250903", addr1: "부산광역시 중구", addr2: "" },
  { contentid: "105", title: "주소 없는 부산 행사", eventstartdate: "20260901", eventenddate: "20260901", lDongRegnCd: "26" },
];
const tourResponse = (item: unknown, totalCount = 5) => Response.json({ response: { header: { resultCode: "0000" }, body: { totalCount, items: { item } } } });

test("TourAPI 결과에서 기간과 시·도가 맞는 행사만 남긴다 (경기 광주 ≠ 광주광역시)", () => {
  const q = (region: string): EventQuery => ({ ...query, region });
  assert.deepEqual(parseTourEvents(tourItems, q("부산")).map((e) => e.name), ["부산 가을 축제", "주소 없는 부산 행사"]);
  assert.deepEqual(parseTourEvents(tourItems, q("광주")).map((e) => e.name), ["광주 비엔날레 행사"]);
  assert.equal(parseTourEvents(tourItems, q("전국")).length, 4);
});

const row = (id: string, over: Partial<MarketfitEventRow> = {}): MarketfitEventRow => ({
  id, name: `행사${id}`, venue: "장소", event_type: null, start_date: "2026-09-20", end_date: "2026-09-21",
  event_recruitments: [{ recruit_end: "2026-10-10", fee: 30000, is_sample_data: false }], ...over,
});
test("Marketfit 행사는 기간·샘플 여부·모집 마감을 거르고 모집 정보를 붙인다", () => {
  const rows = [
    row("1"),
    row("2", { event_recruitments: [{ recruit_end: "2026-09-01", fee: 0, is_sample_data: false }] }),
    row("3", { event_recruitments: [{ recruit_end: null, fee: null, is_sample_data: true }] }),
    row("4", { start_date: "2025-09-20", end_date: null }),
    row("5", { event_recruitments: [] }),
  ];
  const events = parseMarketfitEvents(rows, query);
  assert.deepEqual(events.map((e) => e.name), ["행사1", "행사2", "행사5"]);
  assert.equal(events[0].detail, "모집 마감 2026-10-10 · 참가비 30,000원");
  assert.equal(events[0].url, "/events/1");
  assert.equal(events[1].detail, "모집 마감됨(2026-09-01) · 참가비 무료");
  assert.deepEqual(parseMarketfitEvents(rows, { ...query, recruit: true }).map((e) => e.name), ["행사1"]);
});
test("이름의 연도·회차·공백이 달라도 기간이 겹치면 같은 행사로 본다", () => {
  assert.ok(isSameEvent(record("2026 노원 수제맥주축제"), record("노원수제맥주축제", "2026-09-19", "2026-09-21")));
  assert.equal(isSameEvent(record("노원수제맥주축제"), record("노원수제맥주축제", "2025-09-20")), false);
  assert.equal(isSameEvent(record("가을 축제"), record("봄 축제")), false);
});

// ── 조회 순서 (reply.ts) ─────────────────────────────────────
const deps = (events: EventRecord[] | Error, context: string | null = "## 가게 정보\n이름: 테스트 가게"): ChatDeps & { calls: string[] } => {
  const calls: string[] = [];
  return {
    calls,
    storeContext: async () => { calls.push("store"); return context; },
    marketfitEvents: async () => { calls.push("events"); if (events instanceof Error) throw events; return events; },
  };
};
const geminiText = (text: string, uri?: string) => Response.json({ candidates: [{ finishReason: "STOP", content: { parts: [{ text }] },
  groundingMetadata: uri ? { groundingChunks: [{ web: { uri, title: "검색 출처" } }] } : undefined }] });

test("Marketfit 등록 행사가 3건 이상이면 다른 웹사이트를 조회하지 않는다", async () => {
  const fetch = mock.method(globalThis, "fetch", async () => { throw new Error("외부 호출 금지"); });
  const d = deps([record("가"), record("나"), record("다")]);
  const result = await generateChatReply(question("이번 달 서울 행사"), d, now);
  assert.ok(result.ok);
  assert.ok(result.text.includes("■ Marketfit에 등록된 행사 (3건)"));
  assert.equal(result.text.includes("다른 웹사이트"), false);
  assert.deepEqual(result.sources.map((s) => s.url), ["/events/가", "/events/나", "/events/다"]);
  assert.equal(fetch.mock.callCount(), 0);
  assert.deepEqual(d.calls, ["events"]); // 행사 질문에는 가게 기록을 불러오지 않는다
});
test("3건 미만이면 서울시 공식 목록으로 보충하고, 가져온 출처를 알리며 중복을 뺀다", async () => {
  const urls: string[] = [];
  mock.method(globalThis, "fetch", async (url: unknown) => {
    urls.push(String(url));
    return String(url).includes("festival.seoul") ? Response.json(seoulFixture) : geminiText("웹 검색에서 추가로 확인된 행사가 없어요.");
  });
  const result = await generateChatReply(question("이번 달 서울 행사"), deps([record("2026 진행 행사", "2026-09-28", "2026-10-02")]), now);
  assert.ok(result.ok);
  assert.ok(result.text.indexOf("■ Marketfit에 등록된 행사 (1건)") < result.text.indexOf("■ 다른 웹사이트에서 가져온 행사 — 출처: 서울시 공식 축제 찾기"));
  assert.ok(result.text.includes("Marketfit에 등록되지 않은 행사예요"));
  assert.ok(result.text.includes("2. 종료 행사"));
  assert.equal(result.text.match(/진행 행사/g)?.length, 1); // DB와 같은 행사는 한 번만
  assert.ok(result.sources.some((s) => s.title === "[서울시] 종료 행사"));
  // DB 1건 + 새 공식 행사 1건 = 2건 < 3 → 웹 검색까지 보충
  assert.equal(urls[0], "https://festival.seoul.go.kr/festival/main/searchModal.do");
  assert.ok(urls[1].includes("generativelanguage"));
});
test("공식 목록까지 합쳐도 3건 미만이면 웹 검색으로 보충하고 출처를 구분한다", async () => {
  process.env.TOUR_API_KEY = "key";
  const bodies: string[] = [];
  mock.method(globalThis, "fetch", async (url: unknown, init?: RequestInit) => {
    if (String(url).includes("apis.data.go.kr")) return tourResponse(tourItems[0], 1);
    bodies.push(String(init?.body));
    return geminiText("1. 부산 불꽃축제 (2026-09-26, 광안리)", "https://example.com/busan");
  });
  const result = await generateChatReply(question("이번 달 부산 축제"), deps([]), now);
  assert.ok(result.ok);
  assert.ok(result.text.includes("조건에 맞는 행사가 아직 등록되어 있지 않아요"));
  assert.ok(result.text.includes("출처: 한국관광공사 전국 축제 정보"));
  assert.ok(result.text.includes("■ 다른 웹사이트에서 찾은 정보 — 출처: 구글 웹 검색"));
  assert.ok(result.text.includes("부산 불꽃축제"));
  assert.ok(result.sources.some((s) => s.title === "[웹 검색] 검색 출처"));
  assert.equal(bodies.length, 1);
  assert.ok(bodies[0].includes("google_search") && bodies[0].includes("부산 가을 축제")); // 검색만 사용, 이미 안내한 행사 제외 지시
});
test("모집 질문은 행사 목록(모집 정보 없음)을 건너뛰고 웹 검색으로 보충한다", async () => {
  process.env.TOUR_API_KEY = "key";
  mock.method(globalThis, "fetch", async (url: unknown) => {
    assert.ok(String(url).includes("generativelanguage"), "모집 질문에 행사 목록을 조회하면 안 된다");
    return geminiText("웹 검색에서 추가로 확인된 행사가 없어요.", "https://example.com/r");
  });
  const result = await generateChatReply(question("서울 셀러 모집 중인 곳"), deps([{ ...record("가"), detail: "모집 마감 2026-10-10" }]), now);
  assert.ok(result.ok && result.text.includes("셀러 모집 행사") && result.text.includes("모집 마감 2026-10-10"));
});
test("웹 검색이 막히면 보충 실패를 알리고, 모든 출처가 실패하면 오류를 돌려준다", async () => {
  mock.method(globalThis, "fetch", async () => Response.json({ error: {} }, { status: 429 }));
  const partial = await generateChatReply(question("이번 달 부산 축제"), deps([record("가")]), now);
  assert.ok(partial.ok && partial.text.includes("웹 검색을 연결할 수 없어") && partial.text.includes("1. 가"));
  process.env.GEMINI_API_KEY = `test-key-${++keySeq}`;
  const failed = await generateChatReply(question("이번 달 부산 축제"), deps(new Error("db down")), now);
  assert.equal(failed.ok, false);
});
test("개인 질문은 가게 기록만으로 답하고 웹 검색을 쓰지 않는다", async () => {
  const bodies: string[] = [];
  mock.method(globalThis, "fetch", async (_url: unknown, init?: RequestInit) => {
    bodies.push(String(init?.body));
    return geminiText("순이익 합계는 50,000원이에요.");
  });
  const d = deps([]);
  const result = await generateChatReply(question("내 순이익 얼마야?"), d, now);
  assert.ok(result.ok && result.text === "순이익 합계는 50,000원이에요."); // 검색 불가 안내를 붙이지 않는다
  assert.deepEqual(d.calls, ["store"]);
  assert.equal(bodies[0].includes("google_search"), false);
  assert.ok(bodies[0].includes("테스트 가게") && bodies[0].includes("계산된 통계"));
  // 짧은 후속 질문도 개인 질문으로 이어간다
  await generateChatReply([...question("내 매출 알려줘"), { role: "model", text: "..." }, ...question("그럼 지난달은?")], d, now);
  assert.equal(bodies[1].includes("google_search"), false);
});
test("개인 기록 + 행사 추천 질문은 Marketfit 등록 예정 행사를 함께 넘긴다", async () => {
  const bodies: string[] = [];
  mock.method(globalThis, "fetch", async (_url: unknown, init?: RequestInit) => { bodies.push(String(init?.body)); return geminiText("추천"); });
  const d = deps([record("다음 달 마켓", "2026-10-10")]);
  await generateChatReply(question("내 가게에 맞는 행사 추천해줘"), d, now);
  assert.deepEqual(d.calls, ["store", "events"]);
  assert.ok(bodies[0].includes("Marketfit 등록 예정 행사") && bodies[0].includes("다음 달 마켓"));
});
test("일반 질문은 가게 기록 없이 웹 검색으로 답한다", async () => {
  const bodies: string[] = [];
  mock.method(globalThis, "fetch", async (_url: unknown, init?: RequestInit) => { bodies.push(String(init?.body)); return geminiText("트렌드"); });
  const d = deps([]);
  await generateChatReply(question("요즘 플리마켓 트렌드 어때?"), d, now);
  assert.deepEqual(d.calls, []);
  assert.ok(bodies[0].includes("google_search"));
});

// ── 개인 통계 ───────────────────────────────────────────────
test("개인 통계의 합계·평균·순위를 코드에서 계산한다", () => {
  const lines = participationStats([
    { name: "A", status: "attended", total_revenue: 300000, net_profit: 100000, satisfaction: 5, would_reattend: true },
    { name: "B", status: "attended", total_revenue: 100000, net_profit: -20000, satisfaction: 2, would_reattend: false },
    { name: "C", status: "planning_to_attend", total_revenue: null, net_profit: null, satisfaction: null, would_reattend: null },
  ]).join("\n");
  assert.ok(lines.includes("기록 3건 (참가 완료 2건, 참가 예정 1건)"));
  assert.ok(lines.includes("총매출 합계 400,000원, 행사당 평균 200,000원"));
  assert.ok(lines.includes("순이익 합계 80,000원, 행사당 평균 40,000원"));
  assert.ok(lines.includes("순이익 최고: A (100,000원) / 최저: B (-20,000원)"));
  assert.ok(lines.includes("적자 행사 1건"));
  assert.ok(lines.includes("평균 만족도 3.5/5 (2건)"));
  assert.ok(lines.includes("재참가 의향 있음 1건 / 없음 1건"));
});
