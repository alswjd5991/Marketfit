// 실행: npm run evaluate:synthetic                 (DB 행사 + 기상청 실측 날씨로, 반복 20회)
//       npm run evaluate:synthetic -- --seed-file    (로컬 시드 행사만으로, 네트워크 없이)
//       npm run evaluate:synthetic -- --reps 50
//
// 합성 데이터로 대시보드 분석 모형을 재평가한다. DB에는 아무것도 쓰지 않는다.
// 생성 과정(scripts/synthetic/dgp.ts)은 "정답"을 알고 있으므로, 같은 설정으로 데이터를 여러 번 새로 만들어
//   ③ 요인 분석: 95% 구간이 참 효과를 담는 비율, 효과 없는 조건의 오탐률
//   ① 예측: 교차검증 80% 구간 적중률, 보정 통과율
//   ⑤ 준비 수량: 부족·과다 판정이 실제 방향과 맞는 비율
//   ⑦ 계획 정확도: 낙관 편향 검출률
//   ④ 동종 비교: 기준을 넘는 가게 비율
// 을 잰다. 첫 번째 반복(salt 0)이 실제로 DB에 넣는 데이터다.

import { config } from "dotenv";
config({ path: ".env.local" });

import { createClient } from "@supabase/supabase-js";
import type { Database } from "../src/types/database";
import { analyzeFactors } from "../src/features/analytics/factors";
import { validateForecast } from "../src/features/analytics/forecast";
import { peerRank } from "../src/features/analytics/peer";
import { planAccuracy } from "../src/features/analytics/plan";
import type { AttendedRecord } from "../src/features/analytics/records";
import { PERISHABLE_CATEGORIES, diagnoseStock } from "../src/features/analytics/stock";
import * as C from "./synthetic-users.config";
import { Rng, generateAll, setSalt, simulateSales, type DgpEvent, type GenSeller } from "./synthetic/dgp";
import { loadDbEvents, loadEventWeather, loadSeedFileEvents, printSummary } from "./seed-synthetic-users";

const today = new Intl.DateTimeFormat("sv-SE", { timeZone: "Asia/Seoul" }).format(new Date());
const pct = (x: number) => `${(x * 100).toFixed(1)}%`;
const signed = (x: number) => `${x >= 0 ? "+" : ""}${(x * 100).toFixed(1)}%`;

function toRecords(sellers: GenSeller[]): AttendedRecord[] {
  return sellers.flatMap((s) => s.participations.filter((g) => g.result).map((g) => ({
    storeId: `s${s.persona.no}`, eventId: g.event.id, revenue: g.result!.totalRevenue,
    startDate: g.event.startDate, endDate: g.event.endDate, group: g.event.group,
    weather: g.cond.weather, indoorOutdoor: g.cond.outdoor ? "실외" : "실내",
  })));
}

const revenueOf = (draws: ReturnType<typeof simulateSales>) => draws.reduce((a, d) => a + d.sold * d.price, 0);

/**
 * 모형이 맞혀야 할 참 효과: 실제 기록마다 그 조건만 바꾼 반사실 매출을 같은 난수로 다시 계산해
 * 평균 로그 차이를 구한다(판매 = min(수요, 준비량)이라 수요 배수보다 매출 효과가 작아지는 것까지 반영).
 */
function trueEffects(sellers: GenSeller[]) {
  const diffs: Record<string, number[]> = { "weather:흐림": [], "weather:비": [], "weather:눈": [], outdoor: [], weekend: [] };
  for (const s of sellers) {
    if (!s.traits) continue;
    for (const g of s.participations.filter((x) => x.result)) {
      const rev = (o: Parameters<typeof simulateSales>[4]) => revenueOf(simulateSales(s.persona, s.traits!, g.event, g.cond, o));
      const sunny = rev({ weather: "맑음" });
      for (const w of ["흐림", "비", "눈"] as const) {
        const r = rev({ weather: w });
        if (sunny > 0 && r > 0) diffs[`weather:${w}`].push(Math.log(r / sunny));
      }
      const [inn, out] = [rev({ outdoor: false }), rev({ outdoor: true })];
      if (inn > 0 && out > 0) diffs.outdoor.push(Math.log(out / inn));
      const [wd, we] = [rev({ weekend: false }), rev({ weekend: true })];
      if (wd > 0 && we > 0) diffs.weekend.push(Math.log(we / wd));
    }
  }
  return Object.fromEntries(Object.entries(diffs).map(([k, xs]) => [k, xs.length ? Math.exp(xs.reduce((a, b) => a + b, 0) / xs.length) - 1 : 0]));
}

/** 상품별 실제 품절 확률: 같은 행사 조건에서 수요만 새로 뽑아(행사당 200회) 준비량 이상일 확률의 평균. */
function trueStockoutRate(s: GenSeller, productName: string): number | null {
  const t = s.traits!;
  const j = t.products.findIndex((p) => p.name === productName);
  let hit = 0, n = 0;
  for (const g of s.participations.filter((x) => x.result)) {
    const draw = g.sales.find((d) => d.productIndex === j);
    if (!draw) continue;
    const mean = draw.expectedUnits * (C.DEMAND.weather[g.cond.outdoor ? "실외" : "실내"][g.cond.weather] ?? 1) * Math.exp(g.cond.shock);
    const rng = new Rng(`truth:${s.persona.no}:${g.event.key}:${j}`);
    for (let r = 0; r < 200; r++) { if (rng.negBin(mean, C.DEMAND.dispersion) >= draw.prepared) hit++; n++; }
  }
  return n ? hit / n : null;
}

function evaluateOnce(events: DgpEvent[], weather: Awaited<ReturnType<typeof loadEventWeather>>) {
  const { sellers, cond } = generateAll(events, weather, today);
  const records = toRecords(sellers);
  const truth = trueEffects(sellers);
  const factors = analyzeFactors(records);
  const validation = validateForecast(records);

  // ⑤ 준비 수량: 음식·디저트 가게의 상품별 판정 vs 실제 품절 확률의 방향
  let calls = 0, right = 0, wrong = 0, tested = 0;
  for (const s of sellers.filter((x) => x.traits && PERISHABLE_CATEGORIES.includes(x.persona.category))) {
    const rows = s.participations.filter((g) => g.result).flatMap((g) => g.sales.map((d) => ({
      productName: s.traits!.products[d.productIndex].name, prepared: d.prepared, sold: d.sold, price: d.price, cost: s.traits!.products[d.productIndex].cost,
    })));
    for (const d of diagnoseStock(rows)) {
      if (d.verdict !== "under" && d.verdict !== "over" && d.verdict !== "ok") continue;
      tested++;
      if (d.verdict === "ok") continue;
      calls++;
      const real = trueStockoutRate(s, d.productName)!;
      if ((d.verdict === "under") === (real > d.optimalRate!)) right++; else wrong++;
    }
  }

  // ⑦ 계획 정확도
  let planOk = 0, planHigh = 0, planLow = 0;
  for (const s of sellers) {
    const pairs = s.participations.filter((g) => g.result && g.expectedRevenue).map((g) => ({ expected: g.expectedRevenue!, actual: g.result!.totalRevenue }));
    const r = planAccuracy(pairs);
    if (r.status !== "ok") continue;
    planOk++;
    if (r.biased && r.pct < 0) planHigh++;
    if (r.biased && r.pct > 0) planLow++;
  }

  // ④ 동종 비교
  const byStore = new Map<string, number[]>();
  for (const r of records) byStore.set(r.storeId, [...(byStore.get(r.storeId) ?? []), r.revenue]);
  const summaries = [...byStore].map(([storeId, revenues]) => ({ storeId, category: sellers.find((s) => `s${s.persona.no}` === storeId)!.persona.category, revenues }));
  const peerOk = summaries.filter((s) => peerRank(summaries, s.storeId).status === "ok").length;

  return { sellers, cond, records, truth, factors, validation, stock: { tested, calls, right, wrong }, plan: { planOk, planHigh, planLow }, peer: { ok: peerOk, stores: summaries.length } };
}

async function main() {
  const repsArg = process.argv.indexOf("--reps");
  const reps = repsArg >= 0 ? Number(process.argv[repsArg + 1]) : 20;
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  const useSeed = process.argv.includes("--seed-file") || !url || !key;
  const events = useSeed ? loadSeedFileEvents() : await loadDbEvents(createClient<Database>(url!, key!, { auth: { persistSession: false } }));
  const weather = useSeed ? null : await loadEventWeather(events);
  console.log(`행사 출처: ${useSeed ? "로컬 시드 파일" : "DB"} · 날씨: ${weather ? "기상청 실측" : "[가정] 분포"} · 반복 ${reps}회`);

  const keys = ["weather:흐림", "weather:비", "weather:눈", "outdoor", "weekend"];
  const cover: Record<string, { n: number; hit: number; sig: number; est: number[]; truth: number[] }> = {};
  const nullFlags = { n: 0, flagged: 0 };
  const forecast = { n: 0, calibrated: 0, coverage: [] as number[], mape: [] as number[] };
  const stock = { tested: 0, calls: 0, right: 0, wrong: 0 };
  const plan = { ok: 0, high: 0, low: 0 };
  let insufficient = 0;

  for (let r = 0; r < reps; r++) {
    setSalt(r);
    const res = evaluateOnce(events, weather);
    if (r === 0) {
      printSummary(res.sellers, events, res.cond);
      console.log(`\n■ 첫 번째 데이터(실제 DB에 넣는 데이터)의 ③ 추정 vs 참 효과`);
      if (res.factors.status === "ok") {
        for (const e of res.factors.effects) {
          const t = res.truth[e.key] ?? 0;
          console.log(`  ${e.label.padEnd(10)} 추정 ${signed(e.pct).padStart(7)} (95% ${signed(e.low)}~${signed(e.high)}) · 참 ${signed(t).padStart(7)} · ${e.low <= t && t <= e.high ? "포함" : "벗어남"}${e.significant ? " · 유의" : ""}`);
        }
        console.log(`  기록 ${res.factors.n}건 · 가게 ${res.factors.stores}곳 · 행사 ${res.factors.events}곳${res.factors.notes.length ? ` · ${res.factors.notes.join(" / ")}` : ""}`);
      } else console.log(`  보류: ${res.factors.reason}`);
      console.log(`  ① 교차검증: ${res.validation ? `${res.validation.n}건, 80% 구간 적중 ${pct(res.validation.coverage)}, 보정 ${res.validation.calibrated ? "통과" : "실패"}, 중앙 오차 ±${pct(res.validation.medianAbsPctError)}` : "기록 부족"}`);
      console.log(`  ④ 동종 비교 표시 가능: ${res.peer.ok}/${res.peer.stores}곳`);
    }
    if (res.validation) { forecast.n++; if (res.validation.calibrated) forecast.calibrated++; forecast.coverage.push(res.validation.coverage); forecast.mape.push(res.validation.medianAbsPctError); }
    for (const k of Object.keys(stock) as (keyof typeof stock)[]) stock[k] += res.stock[k];
    plan.ok += res.plan.planOk; plan.high += res.plan.planHigh; plan.low += res.plan.planLow;
    if (res.factors.status !== "ok") { insufficient++; continue; }
    for (const e of res.factors.effects) {
      if (e.key.startsWith("group:")) { nullFlags.n++; if (e.significant) nullFlags.flagged++; continue; } // 유형 효과는 생성 과정에 없음(참 0)
      if (!keys.includes(e.key)) continue;
      const t = res.truth[e.key];
      const c = (cover[e.key] ??= { n: 0, hit: 0, sig: 0, est: [], truth: [] });
      c.n++; if (e.low <= t && t <= e.high) c.hit++; if (e.significant) c.sig++;
      c.est.push(e.pct); c.truth.push(t);
    }
  }

  const mean = (xs: number[]) => xs.reduce((a, b) => a + b, 0) / xs.length;
  console.log(`\n■ 반복 ${reps}회 종합${insufficient ? ` (③ 보류 ${insufficient}회 제외)` : ""}`);
  console.log(`  ③ 요인 분석 — 95% 구간이 참 효과를 담은 비율 / 유의 판정 비율 / 추정 평균 vs 참 평균`);
  for (const k of keys) {
    const c = cover[k];
    if (!c) { console.log(`    ${k}: 추정 안 됨(기록 부족)`); continue; }
    console.log(`    ${k.padEnd(12)} 포함 ${pct(c.hit / c.n)} · 유의 ${pct(c.sig / c.n)} · 추정 ${signed(mean(c.est))} vs 참 ${signed(mean(c.truth))} (${c.n}회)`);
  }
  console.log(`    행사 유형(참 효과 0) 오탐률: ${nullFlags.n ? pct(nullFlags.flagged / nullFlags.n) : "-"} (${nullFlags.n}개 추정)`);
  console.log(`  ① 예측 — 보정 통과 ${forecast.calibrated}/${forecast.n}회 · 80% 구간 적중 평균 ${forecast.n ? pct(mean(forecast.coverage)) : "-"} (범위 ${forecast.n ? `${pct(Math.min(...forecast.coverage))}~${pct(Math.max(...forecast.coverage))}` : "-"}) · 중앙 오차 ±${forecast.n ? pct(mean(forecast.mape)) : "-"}`);
  console.log(`  ⑤ 준비 수량 — 판정한 상품 ${stock.tested}개 중 부족·과다 신호 ${stock.calls}개 · 방향 맞음 ${stock.right} · 방향 틀림 ${stock.wrong}`);
  console.log(`  ⑦ 계획 정확도 — 판정 가능 가게 ${plan.ok} · "예상을 높게 잡음" ${plan.high} · "낮게 잡음" ${plan.low} (생성 가정: 모든 가게가 평균 +15% 낙관, 실제는 날씨·품절로 더 낮아짐)`);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
