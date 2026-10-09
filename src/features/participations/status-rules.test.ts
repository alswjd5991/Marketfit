import assert from "node:assert/strict";
import test from "node:test";
import { isMissed, sortByEventDate } from "./status-rules";

const TODAY = "2026-10-10";

test("관심·참가 예정은 행사 마지막 날이 지나면 미참여 대상이다", () => {
  const ended = { startDate: "2026-10-01", endDate: "2026-10-03" };
  for (const status of ["interested", "planning_to_attend", "planning_to_apply", "applied"] as const) {
    assert.equal(isMissed(status, ended, TODAY), true, status);
  }
});

test("행사 마지막 날 당일까지는 바뀌지 않고, 종료일이 없으면 시작일 기준이다", () => {
  assert.equal(isMissed("interested", { startDate: "2026-10-08", endDate: "2026-10-10" }, TODAY), false);
  assert.equal(isMissed("interested", { startDate: "2026-10-10", endDate: null }, TODAY), false);
  assert.equal(isMissed("interested", { startDate: "2026-10-09", endDate: null }, TODAY), true);
});

test("참가 완료·미참여와 날짜 없는 행사는 건드리지 않는다", () => {
  const ended = { startDate: "2026-10-01", endDate: "2026-10-03" };
  assert.equal(isMissed("attended", ended, TODAY), false);
  assert.equal(isMissed("cancelled", ended, TODAY), false);
  assert.equal(isMissed("interested", { startDate: null, endDate: null }, TODAY), false);
});

test("정렬: 다가오는 행사는 가까운 순, 끝난 행사는 최근 순, 날짜 없는 행사는 맨 아래", () => {
  const items = [
    { name: "지난-오래전", startDate: "2026-08-01", endDate: "2026-08-02" },
    { name: "날짜없음", startDate: null, endDate: null },
    { name: "다가옴-멀리", startDate: "2026-12-01", endDate: "2026-12-02" },
    { name: "지난-최근", startDate: "2026-10-01", endDate: "2026-10-03" },
    { name: "진행중", startDate: "2026-10-09", endDate: "2026-10-12" },
    { name: "다가옴-가까이", startDate: "2026-10-20", endDate: null },
  ];
  assert.deepEqual(
    sortByEventDate(items, TODAY).map((i) => i.name),
    ["진행중", "다가옴-가까이", "다가옴-멀리", "지난-최근", "지난-오래전", "날짜없음"],
  );
});

test("참가 완료 행사끼리는 등록 순서와 상관없이 최근 날짜 순이다", () => {
  const attended = [
    { name: "가나다 마켓(7월)", startDate: "2026-07-05", endDate: "2026-07-05" },
    { name: "하늘 축제(9월)", startDate: "2026-09-12", endDate: "2026-09-13" },
    { name: "나무 장터(8월)", startDate: "2026-08-20", endDate: null },
  ];
  assert.deepEqual(
    sortByEventDate(attended, TODAY).map((i) => i.name),
    ["하늘 축제(9월)", "나무 장터(8월)", "가나다 마켓(7월)"],
  );
});
