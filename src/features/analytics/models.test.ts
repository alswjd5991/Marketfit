// 모형 단위의 시뮬레이션 검증: 정답(참 효과)을 아는 가상 셀러 데이터를 만들어
// ③ 요인 분석이 참 효과를 구간 안에 담는지, 효과가 없는 조건을 "의미 있음"으로 잘못 판정하지 않는지,
// ① 예측구간이 실제로 80%를 맞히는지 확인한다.
import { test } from "node:test";
import assert from "node:assert/strict";
import type { CategoryGroup } from "@/features/events/category-group";
import { rng } from "./test-utils";
import { analyzeFactors } from "./factors";
import { fitForecastModel, lossProbability, predict, validateForecast } from "./forecast";
import type { AttendedRecord } from "./records";

const TRUE = { 비: Math.log(0.6), 흐림: Math.log(0.9), weekend: Math.log(1.3), 야시장: Math.log(1.25) }; // 실외 효과는 0(가짜 요인)

function simulate(seed: number, stores = 25, perStore = 8): AttendedRecord[] {
  const { u, normal } = rng(seed);
  const groups: CategoryGroup[] = ["플리마켓", "야시장", "축제 부스"];
  const events = Array.from({ length: 70 }, (_, i) => {
    const start = new Date(Date.UTC(2025, 0, 1 + Math.floor(u() * 360)));
    const days = 1 + Math.floor(u() * 3);
    const end = new Date(start.getTime() + (days - 1) * 86_400_000);
    const w = u();
    return {
      id: `e${i}`,
      startDate: start.toISOString().slice(0, 10),
      endDate: end.toISOString().slice(0, 10),
      group: groups[u() < 0.5 ? 0 : u() < 0.5 ? 1 : 2], // 플리마켓이 가장 흔한 기준 유형

      weather: w < 0.55 ? "맑음" : w < 0.8 ? "흐림" : "비",
      indoorOutdoor: u() < 0.5 ? "실내" : "실외",
      shock: 0.2 * normal(),
    };
  });
  const out: AttendedRecord[] = [];
  for (let s = 0; s < stores; s++) {
    const alpha = 12.5 + 0.5 * normal();
    const chosen = [...events].sort(() => u() - 0.5).slice(0, perStore);
    for (const e of chosen) {
      const day = new Date(`${e.startDate}T00:00:00Z`).getUTCDay();
      const days = Math.round((Date.parse(e.endDate) - Date.parse(e.startDate)) / 86_400_000) + 1;
      let y = alpha + e.shock + 0.35 * normal() + 0.2 * Math.log(days);
      if (e.weather === "비") y += TRUE.비;
      if (e.weather === "흐림") y += TRUE.흐림;
      if (e.group === "야시장") y += TRUE.야시장;
      const realWeekend = (() => { for (let i = 0; i < Math.min(days, 7); i++) { const d = (day + i) % 7; if (d === 0 || d === 6) return 1; } return 0; })();
      y += TRUE.weekend * realWeekend;
      out.push({ storeId: `s${s}`, eventId: e.id, revenue: Math.round(Math.exp(y)), startDate: e.startDate, endDate: e.endDate, group: e.group, weather: e.weather, indoorOutdoor: e.indoorOutdoor });
    }
  }
  return out;
}

test("③ 요인 분석: 참 효과를 95% 구간이 담고, 효과 없는 조건은 거의 '의미 있음'으로 판정하지 않는다", () => {
  const reps = 120;
  let rainCovered = 0, weekendCovered = 0, nightCovered = 0, falseOutdoor = 0, rainDetected = 0;
  for (let r = 0; r < reps; r++) {
    const res = analyzeFactors(simulate(1000 + r));
    assert.equal(res.status, "ok");
    if (res.status !== "ok") return;
    const eff = (k: string) => res.effects.find((e) => e.key === k)!;
    const inside = (k: string, t: number) => Math.exp(t) - 1 >= eff(k).low && Math.exp(t) - 1 <= eff(k).high;
    if (inside("weather:비", TRUE.비)) rainCovered++;
    if (inside("weekend", TRUE.weekend)) weekendCovered++;
    // 기준 유형은 "기록이 가장 많은 유형"이라 우연히 야시장이 기준이 되면 플리마켓 효과가 역수로 나온다.
    const nightRef = !res.effects.some((e) => e.key === "group:야시장");
    if (nightRef ? inside("group:플리마켓", -TRUE.야시장) : inside("group:야시장", TRUE.야시장)) nightCovered++;
    if (eff("outdoor").significant) falseOutdoor++;
    if (eff("weather:비").significant) rainDetected++;
  }
  for (const [name, c] of [["비", rainCovered], ["주말", weekendCovered], ["야시장", nightCovered]] as const) {
    assert.ok(c / reps > 0.88, `${name} 포함률 ${c / reps}`);
  }
  assert.ok(falseOutdoor / reps <= 0.06, `가짜 요인 오탐률 ${falseOutdoor / reps}`);
  assert.ok(rainDetected / reps > 0.9, `실제 효과 검출력 ${rainDetected / reps}`);
});

test("③ 기록이 부족하면 결과 대신 이유를 돌려준다", () => {
  const res = analyzeFactors(simulate(7, 3, 5));
  assert.equal(res.status, "insufficient");
});

test("① 예측: 교차검증 80% 구간 적중률이 명목 수준과 맞는다", () => {
  const v = validateForecast(simulate(2024, 25, 8))!;
  assert.ok(v, "검증 결과 없음");
  assert.ok(v.coverage > 0.72 && v.coverage < 0.88, `적중률 ${v.coverage}`);
  assert.equal(v.calibrated, true);
});

test("① 기록이 적은 가게는 예측하지 않고, ② 적자 확률은 예측분포와 일치한다", () => {
  const data = simulate(99);
  const model = fitForecastModel(data);
  assert.ok(!("insufficient" in model));
  if ("insufficient" in model) return;
  const few = predict(model, "새가게", { startDate: "2026-11-07", endDate: null, group: "야시장" });
  assert.equal(few.ok, false);
  const p = predict(model, "s0", { startDate: "2026-11-07", endDate: null, group: "야시장" });
  assert.ok(p.ok);
  if (!p.ok) return;
  assert.ok(p.low < p.median && p.median < p.high);
  // 고정비가 예측 중앙값 × (1−원가율)과 같으면 적자 확률은 정확히 50%
  const half = lossProbability(p, p.median * 0.6, 0.4);
  assert.ok(Math.abs(half - 0.5) < 1e-6, `${half}`);
  // 80% 구간 아래끝이 손익분기점이면 적자 확률 10%
  assert.ok(Math.abs(lossProbability(p, p.low * 0.6, 0.4) - 0.1) < 1e-6);
});

test("① 빠른 교차검증(셔먼-모리슨 갱신)이 매번 다시 적합한 결과와 같다", () => {
  const data = simulate(77, 15, 8);
  const fast = validateForecast(data)!;
  const model = fitForecastModel(data);
  assert.ok(!("insufficient" in model));
  if ("insufficient" in model) return;
  let hits = 0;
  const z: number[] = [];
  model.rows.forEach((target) => {
    if (model.storeCount.get(target.storeId)! - 1 < 3 || model.groupCount.get(target.group)! < 2) return;
    const refit = fitForecastModel(model.rows.filter((r) => r !== target));
    if ("insufficient" in refit) return;
    const p = predict(refit, target.storeId, target);
    if (!p.ok) return;
    if (target.revenue >= p.low && target.revenue <= p.high) hits++;
    z.push((Math.log(target.revenue) - p.mu) / p.sd);
  });
  z.sort((a, b) => a - b);
  assert.equal(fast.n, z.length);
  assert.ok(Math.abs(fast.normalCoverage - hits / z.length) < 1e-12);
  fast.calibration.forEach((v, i) => assert.ok(Math.abs(v - z[i]) < 1e-9, `z[${i}] ${v} vs ${z[i]}`));
});

test("① 오차가 한쪽으로 치우쳐도(품절로 매출 상한) 보정된 구간은 80%를 맞힌다", () => {
  // 매출 = min(수요, 상한) 구조: 로그 오차가 왼쪽으로 길게 치우침
  const data = simulate(31, 25, 8).map((r, i) => ({ ...r, revenue: Math.min(r.revenue, Math.round(Math.exp(12.6 + 0.3 * Math.sin(i)))) }));
  const v = validateForecast(data)!;
  assert.ok(v.coverage > 0.74 && v.coverage < 0.86, `보정 적중률 ${v.coverage}`);
  // 적자 확률은 보정 분포의 경험적 누적확률과 일치
  const model = fitForecastModel(data);
  if ("insufficient" in model) return;
  const p = predict(model, "s0", { startDate: "2026-11-07", endDate: null, group: "야시장" }, v.calibration);
  assert.ok(p.ok);
  if (!p.ok) return;
  const loss = lossProbability(p, p.median * 0.6, 0.4, v.calibration);
  assert.ok(Math.abs(loss - 0.5) < 0.05, `중앙값이 손익분기면 적자 확률 약 50%: ${loss}`);
});
