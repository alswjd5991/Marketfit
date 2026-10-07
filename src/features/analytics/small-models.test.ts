import { test } from "node:test";
import assert from "node:assert/strict";
import { peerRank } from "./peer";
import { planAccuracy } from "./plan";
import { diagnoseStock, type ProductSaleRecord } from "./stock";
import { rng } from "./test-utils";

/** 행사마다 수요 ~ 로그정규(행사별 평균이 다름). policyQuantile = 셀러가 준비하는 수요 분위수. */
function sales(seed: number, n: number, policyQuantile: number, price = 4000, cost = 1200): ProductSaleRecord[] {
  const { normal } = rng(seed);
  const z = (p: number) => { let lo = -8, hi = 8; for (let i = 0; i < 80; i++) { const m = (lo + hi) / 2; const c = 0.5 * (1 + erf(m / Math.SQRT2)); if (c < p) lo = m; else hi = m; } return lo; };
  return Array.from({ length: n }, () => {
    const mu = Math.log(40) + 0.4 * normal(); // 행사마다 기대 수요가 다름(셀러는 이걸 안다고 가정)
    const demand = Math.round(Math.exp(mu + 0.35 * normal()));
    const prepared = Math.round(Math.exp(mu + 0.35 * z(policyQuantile)));
    return { productName: "마카롱", prepared, sold: Math.min(demand, prepared), price, cost };
  });
}
function erf(x: number) { const t = 1 / (1 + 0.3275911 * Math.abs(x)); const y = 1 - (((((1.061405429 * t - 1.453152027) * t) + 1.421413741) * t - 0.284496736) * t + 0.254829592) * t * Math.exp(-x * x); return x >= 0 ? y : -y; }

test("⑤ 최적으로 준비하는 셀러는 거의 경고받지 않고, 덜 준비하는 셀러는 '부족'으로 잡힌다", () => {
  const cr = 1 - 1200 / 4000; // 최적 분위수 0.7 → 최적 품절률 0.3
  let falseAlarm = 0, detected = 0;
  const reps = 300;
  for (let r = 0; r < reps; r++) {
    if (diagnoseStock(sales(r, 20, cr))[0].verdict !== "ok") falseAlarm++;
    if (diagnoseStock(sales(10_000 + r, 40, 0.4))[0].verdict === "under") detected++;
  }
  assert.ok(falseAlarm / reps < 0.08, `오탐률 ${falseAlarm / reps}`);
  assert.ok(detected / reps > 0.6, `검출률 ${detected / reps}`);
});

test("⑤ 기록이 적거나 원가가 없으면 판정하지 않는다", () => {
  assert.equal(diagnoseStock(sales(1, 5, 0.7))[0].verdict, "few");
  assert.equal(diagnoseStock(sales(1, 20, 0.7).map((s) => ({ ...s, cost: null })))[0].verdict, "noCost");
});

test("⑦ 예상 매출을 늘 30% 높게 적으면 체계적 차이로 잡고, 맞게 적으면 잡지 않는다", () => {
  const { normal } = rng(5);
  const pairs = (bias: number) => Array.from({ length: 12 }, () => { const actual = 300000 * Math.exp(0.3 * normal()); return { actual, expected: actual * bias * Math.exp(0.1 * normal()) }; });
  const over = planAccuracy(pairs(1.3));
  assert.ok(over.status === "ok" && over.biased && over.pct < 0);
  const fair = planAccuracy(pairs(1));
  assert.ok(fair.status === "ok" && !fair.biased);
  assert.equal(planAccuracy(pairs(1).slice(0, 4)).status, "insufficient");
});

test("④ 비교 대상이 10곳 미만이면 순위를 보이지 않는다", () => {
  const store = (id: string, mean: number, cat = "디저트") => ({ storeId: id, category: cat, revenues: [mean, mean, mean] });
  const peers = Array.from({ length: 10 }, (_, i) => store(`p${i}`, 100 + i * 10));
  const ok = peerRank([store("me", 175), ...peers], "me");
  assert.ok(ok.status === "ok" && ok.below === 0.8);
  assert.equal(peerRank([store("me", 175), ...peers.slice(0, 9), store("x", 1, "패션")], "me").status, "insufficient");
});
