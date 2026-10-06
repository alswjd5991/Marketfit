import { test } from "node:test";
import assert from "node:assert/strict";
import { parseSeoulRows, parseTourItems, runWeeklyEventSync, selectSellerEvents, sourceKey } from "./weekly-sync";

const tour = (contentid: string, title: string, start: string, end: string, addr1 = "경기도 수원시 팔달구") =>
  ({ contentid, title, eventstartdate: start, eventenddate: end, addr1, addr2: "행궁광장", firstimage: "http://tong.visitkorea.or.kr/a.jpg", mapx: "127.01", mapy: "37.28" });

test("TourAPI 응답을 기간 안 행사로 바꾸고 지역·이미지·좌표를 채운다", () => {
  const events = parseTourItems([
    tour("101", "수원 행궁동 플리마켓", "20261017", "20261018"),
    tour("102", "지난 축제", "20250101", "20250102"),
    tour("abc", "잘못된 id", "20261017", "20261018"),
  ], "2026-10-06", "2027-01-04");
  assert.equal(events.length, 1);
  assert.equal(events[0].sourceId, "T101");
  assert.equal(sourceKey(events[0]), "tour:T101");
  assert.equal(events[0].region, "경기");
  assert.equal(events[0].imageUrl, "https://tong.visitkorea.or.kr/a.jpg");
  assert.equal(events[0].lat, 37.28);
});

test("서울시 축제 응답은 서울시 전체 상설·삭제 행사를 뺀다", () => {
  const events = parseSeoulRows([
    { festa_code: 7, festa_name: "성수 로컬마켓", strt_date: "2026-10-20", end_date: "2026-10-20", place: "성수동", gcode: "11200" },
    { festa_code: 8, festa_name: "서울 전역 행사", strt_date: "2026-10-20", end_date: "2026-10-20", gcode: "11000" },
    { festa_code: 9, festa_name: "삭제된 마켓", strt_date: "2026-10-20", end_date: "2026-10-20", del_yn: "Y" },
  ], "2026-10-06", "2027-01-04");
  assert.deepEqual(events.map((e) => e.sourceId), ["F7"]);
  assert.throws(() => parseSeoulRows({}, "2026-10-06", "2027-01-04"));
});

test("셀러 참여형만 남기고 출처 간 중복은 하나로 합친다", () => {
  const [market, concert, sameMarket] = [
    ...parseTourItems([tour("1", "제3회 수원 행궁 야시장", "20261017", "20261018"), tour("2", "가을 불꽃 콘서트", "20261017", "20261017")], "2026-10-06", "2027-01-04"),
    ...parseSeoulRows([{ festa_code: 3, festa_name: "수원 행궁 야시장", strt_date: "2026-10-18", end_date: "2026-10-19" }], "2026-10-06", "2027-01-04"),
  ];
  const { kept, duplicates } = selectSellerEvents([market, concert, sameMarket]);
  assert.deepEqual(kept.map((e) => e.sourceId), ["T1"]);
  assert.equal(duplicates, 1);
});

test("dry-run은 출처가 실패해도 보고서를 돌려주고 DB 없이 끝난다", async () => {
  const realFetch = globalThis.fetch;
  globalThis.fetch = async () => { throw new Error("offline"); };
  try {
    const report = await runWeeklyEventSync({ supabase: null, dryRun: true, now: new Date("2026-10-05T00:00:00Z") });
    assert.equal(report.range.from, "2026-10-05");
    assert.equal(report.range.to, "2027-01-03");
    assert.equal(report.sources[0].error, "offline");
    assert.equal(report.created, 0);
  } finally {
    globalThis.fetch = realFetch;
  }
});

test("기간 수집은 한 달 단위로 나뉘고 빈틈·겹침이 없다", async () => {
  const { monthChunks } = await import("./weekly-sync");
  assert.deepEqual(monthChunks("2024-01-15", "2024-03-10"), [["2024-01-15", "2024-01-31"], ["2024-02-01", "2024-02-29"], ["2024-03-01", "2024-03-10"]]);
  assert.deepEqual(monthChunks("2024-12-31", "2025-01-01"), [["2024-12-31", "2024-12-31"], ["2025-01-01", "2025-01-01"]]);
});

test("NEW는 수집 후 7일 안이면서 그 주에 새로 수집 범위(83~90일 뒤)에 들어온 행사만", async () => {
  const { isNewlyListed } = await import("./weekly-sync");
  const collected = "2026-10-05T00:00:00Z";
  const now = new Date("2026-10-07T00:00:00Z");
  assert.equal(isNewlyListed(collected, "2027-01-01", now), true); // 88일 뒤
  assert.equal(isNewlyListed(collected, "2026-10-20", now), false); // 처음 수집 때 한꺼번에 들어온 근일 행사
  assert.equal(isNewlyListed(collected, "2025-05-01", now), false); // 과거 행사
  assert.equal(isNewlyListed(collected, "2027-01-01", new Date("2026-10-13T00:00:00Z")), false); // 일주일 지남
  assert.equal(isNewlyListed(null, "2027-01-01", now), false); // 직접 수집한 시드 행사
});

test("TourAPI 상세 응답에서 HTML을 걷어내고 빈 항목은 저장하지 않는다", async () => {
  const { parseTourDetails } = await import("./weekly-sync");
  const d = parseTourDetails(
    { overview: "가을 장터<br>지역 농산물 판매", homepage: '<a href="http://www.example.go.kr" target="_blank">www.example.go.kr</a>', tel: "" },
    { playtime: "10:00~18:00", sponsor1: "OO시", sponsor2: "", sponsor1tel: "031-000-0000", usetimefestival: "무료", eventplace: "시청 광장" }
  );
  assert.deepEqual(d, {
    overview: "가을 장터\n지역 농산물 판매", playtime: "10:00~18:00", place: "시청 광장", sponsor: "OO시",
    tel: "031-000-0000", admission: "무료", homepage: "http://www.example.go.kr",
  });
});
