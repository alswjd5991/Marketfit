import assert from "node:assert/strict";
import { afterEach, mock, test } from "node:test";
import { getEventReply, parseEventQuery, parseSeoulEvents } from "./event-search";
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

test("사용자가 보고한 질문을 한국 날짜의 이번 달로 해석한다", () => {
  assert.deepEqual(query, { from: "2026-09-01", to: "2026-09-30", today: "2026-09-30", marketOnly: false });
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
test("다른 지역·개인 기록·셀러 모집·추가 조건을 서울 전체 행사로 바꾸지 않는다", () => {
  for (const text of ["이번 달 부산 행사", "이번 달 서울과 부산 행사", "내가 참가한 이번 달 서울 행사", "이번 달 서울 셀러 모집", "이번 달 서울 무료 행사", "이번 달 서울 강남구 행사", "9월 15일 서울 행사", "서울 행사란 무엇이야?", "내 가게에 맞는 이번 달 서울 행사 추천", "13월 서울 행사"]) {
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
