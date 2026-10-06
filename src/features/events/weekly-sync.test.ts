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
