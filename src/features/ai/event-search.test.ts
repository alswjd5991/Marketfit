import assert from "node:assert/strict";
import { afterEach, mock, test } from "node:test";
import { getEventReply, parseEventQuery, parseSeoulEvents, parseTourEvents } from "./event-search";
import { generateChatReply } from "./reply";

const now = new Date("2026-09-29T15:30:00Z"); // 한국 9월 30일
const question = (text: string) => [{ role: "user" as const, text }];
const query = parseEventQuery(question("이번 달 서울에서 열리는 행사는?"), now)!;
const fixture = [
  { festa_code: 1, festa_name: "종료 행사", strt_date: "2026-09-12", end_date: "2026-09-12", place: "서울 광장", period_yn: "Y" },
  { festa_code: 2, festa_name: "진행 행사", strt_date: "2026-09-28", end_date: "2026-10-02", place: "서울 공원", period_yn: "N" },
  { festa_code: 3, festa_name: "작년 행사", strt_date: "2025-09-01", end_date: "2025-09-30" },
];
afterEach(() => mock.restoreAll());

afterEach(() => { delete process.env.TOUR_API_KEY; });

test("사용자가 보고한 질문을 한국 날짜의 이번 달로 해석한다", () => {
  assert.deepEqual(query, { from: "2026-09-01", to: "2026-09-30", today: "2026-09-30", marketOnly: false, region: "서울" });
});
test("전국 시·도와 동의어·주 단위 기간을 해석한다", () => {
  const cases: [string, string, string, string][] = [
    ["이번 달 부산 축제 알려줘", "부산", "2026-09-01", "2026-09-30"],
    ["다음 달 강원도 페스티벌", "강원", "2026-10-01", "2026-10-31"],
    ["이번 주말 대구 행사 있어?", "대구", "2026-10-03", "2026-10-04"],
    ["다음 주 경기도 이벤트", "경기", "2026-10-05", "2026-10-11"],
    ["내일 제주 야시장", "제주", "2026-10-01", "2026-10-01"],
    ["10월 전국 축제", "전국", "2026-10-01", "2026-10-31"],
    ["친구랑 갈 이번 달 전라남도 축제", "전남", "2026-09-01", "2026-09-30"],
    ["이번 달 부산시에서 하는 행사", "부산", "2026-09-01", "2026-09-30"],
  ];
  for (const [text, region, from, to] of cases) {
    assert.deepEqual(parseEventQuery(question(text), now), { from, to, today: "2026-09-30", marketOnly: /야시장/.test(text), region }, text);
  }
});
test("후속 질문은 지역만 바꾸거나 기간만 바꿔 이전 조건을 이어받는다", () => {
  const first = [...question("이번 달 서울 마켓"), { role: "model" as const, text: "일정입니다" }];
  assert.deepEqual(parseEventQuery([...first, ...question("부산은?")], now),
    { from: "2026-09-01", to: "2026-09-30", today: "2026-09-30", marketOnly: true, region: "부산" });
  assert.equal(parseEventQuery([...first, ...question("그 가격은?")], now), null);
});
test("한국 자정, 연말 다음 달, 윤년의 마지막 날을 처리한다", () => {
  assert.equal(parseEventQuery(question("이번 달 서울 행사는?"), new Date("2026-09-30T15:01:00Z"))?.from, "2026-10-01");
  assert.equal(parseEventQuery(question("다음 달 서울 행사는?"), new Date("2026-12-15"))?.from, "2027-01-01");
  assert.equal(parseEventQuery(question("2028년 2월 서울 행사는?"), now)?.to, "2028-02-29");
});
test("후속 날짜 질문은 직전 사용자 질문의 서울 조건을 유지한다", () => {
  const parsed = parseEventQuery([...question("이번 달 서울에서 열리는 행사는?"), { role: "model", text: "일정입니다" }, ...question("그럼 다음 달은?")], now);
  assert.equal(parsed?.from, "2026-10-01");
});
test("여러 지역·개인 기록·셀러 모집·세부 지역 조건을 시·도 전체 행사로 바꾸지 않는다", () => {
  for (const text of ["이번 달 서울과 부산 행사", "이번 달 행사", "이번 달 경기 광주시 축제", "이번 달 부산 해운대구 축제", "이번 달 수원시 축제", "이번 달 서울 공연", "이번 달 서울대 축제", "내가 참가한 이번 달 서울 행사", "이번 달 서울 셀러 모집", "이번 달 서울 무료 행사", "이번 달 서울 강남구 행사", "9월 15일 서울 행사", "서울 행사란 무엇이야?", "내 가게에 맞는 이번 달 서울 행사 추천", "13월 서울 행사"]) {
    assert.equal(parseEventQuery(question(text), now), null, text);
  }
});
test("날짜가 겹치는 행사만 남기고 잘못된 날짜·외부 지역을 제외한다", () => {
  const parsed = parseSeoulEvents([...fixture,
    { ...fixture[0], festa_code: 4, strt_date: "2026-09-31" },
    { ...fixture[0], festa_code: 5, gcode: "11000" },
    { ...fixture[0], festa_code: 6, del_yn: "Y" },
  ], query);
  assert.deepEqual(parsed.map((e) => e.name), ["종료 행사", "진행 행사"]);
});
test("최신 공식 조회로 행사·날짜·장소·출처를 답하고 검색 불가 안내를 붙이지 않는다", async () => {
  const fetch = mock.method(globalThis, "fetch", async (url: unknown, options?: RequestInit) => {
    assert.equal(url, "https://festival.seoul.go.kr/festival/main/searchModal.do");
    const body = new URLSearchParams(String(options?.body));
    assert.equal(body.get("searchStrtDate"), "2026-09-01");
    assert.equal(body.get("searchEndDate"), "2026-09-30");
    assert.equal(String(options?.body).includes("가게 비밀"), false);
    return Response.json(fixture);
  });
  const result = await getEventReply(question("이번 달 서울에서 열리는 행사는?"), now);
  assert.ok(result);
  assert.ok(result.text.includes("2026-09-30 조회"));
  assert.ok(result.text.indexOf("진행 행사") < result.text.indexOf("종료 행사"));
  assert.ok(result.text.includes("일정 미확정"));
  assert.ok(result.text.includes("종료"));
  assert.equal(result.text.includes("웹 검색을 연결할 수 없어"), false);
  assert.equal(result.sources[0].url, "https://festival.seoul.go.kr/festival/main/festivalView.do?festacode=2");
  assert.equal(fetch.mock.callCount(), 1);
});
test("공식 조회 장애는 저장된 실제 일정으로 구분해서 답한다", async () => {
  mock.method(globalThis, "fetch", async () => { throw new TypeError("fetch failed"); });
  const result = await getEventReply(question("이번 달 서울 행사"), now);
  assert.ok(result);
  assert.ok(result.text.includes("앱에 저장된 공개 행사 자료"));
  assert.ok(result.text.includes("2026 종로청년축제 플리마켓"));
  assert.ok(result.text.includes("종료"));
});
test("빈 조회 결과를 서울에 행사가 없다는 뜻으로 확대하지 않는다", async () => {
  mock.method(globalThis, "fetch", async () => Response.json([]));
  const result = await getEventReply(question("이번 달 서울 행사"), now);
  assert.ok(result?.text.includes("행사가 전혀 없다는 뜻은 아니에요"));
});
test("실제 채팅 진입점에서도 Google API 대신 공식 일정을 조회한다", async () => {
  const fetch = mock.method(globalThis, "fetch", async (url: unknown) => {
    assert.equal(url, "https://festival.seoul.go.kr/festival/main/searchModal.do");
    return Response.json(fixture);
  });
  const result = await generateChatReply("가게 비밀", question("2026년 9월 서울 행사"));
  assert.ok(result.ok && result.text.includes("종료 행사"));
  assert.equal(fetch.mock.callCount(), 1);
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
  const busan = parseEventQuery(question("이번 달 부산 축제"), now)!;
  assert.deepEqual(parseTourEvents(tourItems, busan).map((e) => e.name), ["부산 가을 축제", "주소 없는 부산 행사"]);
  const gwangju = parseEventQuery(question("이번 달 광주 축제"), now)!;
  assert.deepEqual(parseTourEvents(tourItems, gwangju).map((e) => e.name), ["광주 비엔날레 행사"]);
  const all = parseEventQuery(question("이번 달 전국 축제"), now)!;
  assert.equal(parseTourEvents(tourItems, all).length, 4);
});
test("TOUR_API_KEY가 있으면 전국 공식 축제 정보로 답하고 키를 URL 인코딩한다", async () => {
  process.env.TOUR_API_KEY = "a+b/c==";
  const fetch = mock.method(globalThis, "fetch", async (url: unknown) => {
    const u = new URL(String(url));
    assert.equal(`${u.origin}${u.pathname}`, "https://apis.data.go.kr/B551011/KorService2/searchFestival2");
    assert.ok(String(url).includes("serviceKey=a%2Bb%2Fc%3D%3D&"));
    assert.equal(u.searchParams.get("eventStartDate"), "20260901");
    assert.equal(u.searchParams.get("eventEndDate"), "20260930");
    return tourResponse(tourItems[0], 1);
  });
  const result = await getEventReply(question("이번 달 부산 축제"), now);
  assert.ok(result && result.text.startsWith("한국관광공사 전국 축제 정보"));
  assert.ok(result.text.includes("부산 가을 축제") && result.text.includes("진행 기간"));
  assert.equal(result.sources.at(-1)?.url, "https://korean.visitkorea.or.kr/kfes/list/wntyFstvlList.do");
  assert.equal(fetch.mock.callCount(), 1);
});
test("서울은 서울시 조회가 실패하면 TourAPI로 넘어간다", async () => {
  process.env.TOUR_API_KEY = "key";
  mock.method(globalThis, "fetch", async (url: unknown) => {
    if (String(url).startsWith("https://festival.seoul.go.kr")) throw new TypeError("fetch failed");
    return tourResponse({ ...tourItems[0], title: "서울 행사", addr1: "서울특별시 중구" }, 1);
  });
  const result = await getEventReply(question("이번 달 서울 행사"), now);
  assert.ok(result?.text.startsWith("한국관광공사") && result.text.includes("서울 행사"));
});
test("서울 외 지역은 키가 없거나 조회가 실패하고 저장 자료도 없으면 AI 경로로 넘긴다", async () => {
  const fetch = mock.method(globalThis, "fetch", async () => Response.json({ response: { header: { resultCode: "30" } } }));
  assert.equal(await getEventReply(question("이번 달 부산 축제"), now), null);
  assert.equal(fetch.mock.callCount(), 0);
  process.env.TOUR_API_KEY = "key";
  assert.equal(await getEventReply(question("이번 달 부산 축제"), now), null);
  assert.equal(fetch.mock.callCount(), 1);
});
test("기간 안에 새로 시작하는 행사를 이전부터 이어지는 상설 행사보다 먼저 보여준다", async () => {
  mock.method(globalThis, "fetch", async () => Response.json([
    { festa_code: 7, festa_name: "상설 행사", strt_date: "2026-01-01", end_date: "2026-12-31" },
    { festa_code: 8, festa_name: "새 행사", strt_date: "2026-10-10", end_date: "2026-10-11" },
  ]));
  const result = await getEventReply(question("다음 달 서울 행사"), now);
  assert.ok(result && result.text.indexOf("새 행사") < result.text.indexOf("상설 행사"));
});
