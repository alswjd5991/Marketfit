// ⑦ 계획 정확도 — 참가 전에 적은 "예상 매출"이 실제 매출과 체계적으로 어긋나는지.
//
// 같은 행사의 (예상, 실제) 짝으로 d = ln(실제/예상)을 만들고, 평균 d의 t 신뢰구간을 본다(대응표본 비교).
// 로그 비율이라 "실제가 예상의 몇 배였나"로 해석된다: 100·(e^d̄ − 1)%.
// 목표 매출(target_revenue)은 "바라는 값"이지 예측이 아니어서 쓰지 않는다.

import { tQuantile } from "./distributions";

export const PLAN_RULES = { minPairs: 5 };

export type PlanAccuracy =
  | { status: "ok"; n: number; pct: number; low: number; high: number; biased: boolean }
  | { status: "insufficient"; n: number };

export function planAccuracy(pairs: { expected: number; actual: number }[]): PlanAccuracy {
  const d = pairs.filter((p) => p.expected > 0 && p.actual > 0).map((p) => Math.log(p.actual / p.expected));
  const n = d.length;
  if (n < PLAN_RULES.minPairs) return { status: "insufficient", n };
  const mean = d.reduce((a, b) => a + b, 0) / n;
  const sd = Math.sqrt(d.reduce((a, b) => a + (b - mean) ** 2, 0) / (n - 1));
  const half = tQuantile(0.975, n - 1) * (sd / Math.sqrt(n));
  const [low, high] = [Math.exp(mean - half) - 1, Math.exp(mean + half) - 1];
  return { status: "ok", n, pct: Math.exp(mean) - 1, low, high, biased: low > 0 || high < 0 };
}
