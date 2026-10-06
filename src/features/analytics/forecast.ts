// ① 다가올 행사 매출 예측 + ② 적자 확률
//
// 예측 모형은 ③ 요인 분석과 일부러 분리했다 — 예측에는 "행사 전에 알 수 있는 정보"만 쓸 수 있어서다.
// 날씨·실내외는 미리 모르므로 넣지 않고(그 변동은 예측구간 폭에 그대로 반영된다), 아래만 쓴다.
//
//   ln(매출_ij) = α_가게 + β1·주말포함 + β2·ln(행사일수) + γ_유형 + ε,  ε ~ N(0, σ²)
//
// 가게 효과 α는 경험적 베이즈로 축소 추정한다(부분 풀링):
//   α̃_s = ᾱ + w_s(α̂_s − ᾱ),  w_s = τ² / (τ² + v_s)
//   v_s = α̂_s의 분산(기록이 적을수록 큼), τ² = 가게 간 실제 차이의 분산(적률법: 관측 분산 − 평균 v_s)
// 기록이 적은 가게일수록 전체 평균 쪽으로 당겨져 극단적인 예측을 막는다.
//
// 예측분포: ln(매출) ~ μ + sd·t_df,  sd² = σ² + Var(α̃_s) + xᵀVar(β̂)x
// 적자 확률: 순이익 = 매출·(1 − 원가율) − 고정비 < 0  ⇔  ln(매출) < ln(고정비 / (1 − 원가율))
//   → t분포 누적확률로 정확히 계산된다(시뮬레이션이 필요 없다).
//
// 근사(계수 추정 오차 간 공분산 무시 등)가 있으므로 반드시 validateForecast()의 교차검증으로
// 예측구간이 실제로 80%를 맞히는지 확인하고, 통과할 때만 화면에 보인다.

import type { CategoryGroup } from "@/features/events/category-group";
import { binomTestTwoSided, tCdf, tQuantile } from "./distributions";
import { fitOls, quadForm, type OlsFit } from "./ols";
import { MAX_EVENT_DAYS, dropSmallStores, eventDays, groupLevels, includesWeekend, type AttendedRecord } from "./records";

export const FORECAST_RULES = {
  minRecords: 40,
  minStores: 5,
  minResidualDf: 20,
  minStoreRecords: 3, // 내 가게 기록이 이보다 적으면 예측하지 않음
  minVaryingStores: 3,
  level: 0.8, // 예측구간 수준
  minValidation: 30, // 교차검증 최소 건수
};

export interface EventFeatures {
  startDate: string;
  endDate: string | null;
  group: CategoryGroup;
}

interface Column {
  key: string;
  value: (e: EventFeatures) => number;
}

export interface ForecastModel {
  fit: OlsFit;
  rows: AttendedRecord[];
  X: number[][];
  columns: Column[];
  storeCol: Map<string, number>;
  storeCount: Map<string, number>;
  groupCount: Map<CategoryGroup, number>;
  levelOf: (g: CategoryGroup) => string;
  abar: number;
  tau2: number;
  varAbar: number;
}

export type Prediction =
  | { ok: true; mu: number; sd: number; df: number; median: number; low: number; high: number; note: string | null }
  | { ok: false; reason: string };

function trainingRows(records: AttendedRecord[]) {
  return dropSmallStores(records.filter((r) => r.revenue > 0 && eventDays(r.startDate, r.endDate) <= MAX_EVENT_DAYS), 2).kept;
}

export function fitForecastModel(records: AttendedRecord[]): ForecastModel | { insufficient: string } {
  const R = FORECAST_RULES;
  const rows = trainingRows(records);
  const stores = [...new Set(rows.map((r) => r.storeId))];
  if (rows.length < R.minRecords) return { insufficient: `예측에 쓸 기록 ${rows.length}건(최소 ${R.minRecords}건 필요)` };
  if (stores.length < R.minStores) return { insufficient: `기록 있는 가게 ${stores.length}곳(최소 ${R.minStores}곳 필요)` };

  const byStore = new Map<string, AttendedRecord[]>();
  for (const r of rows) byStore.set(r.storeId, [...(byStore.get(r.storeId) ?? []), r]);
  const varies = (f: (e: EventFeatures) => number) => [...byStore.values()].filter((rs) => new Set(rs.map(f)).size > 1).length >= R.minVaryingStores;

  const groups = groupLevels(rows);
  const candidates: Column[] = [
    { key: "weekend", value: (e) => (includesWeekend(e.startDate, e.endDate) ? 1 : 0) },
    { key: "lnDays", value: (e) => Math.log(eventDays(e.startDate, e.endDate)) },
    ...[...groups.own, "기타 유형"].map((g) => ({ key: `group:${g}`, value: (e: EventFeatures) => (groups.levelOf(e.group) === g ? 1 : 0) })),
  ];
  const columns = candidates.filter((c) => varies(c.value));
  const names = [...columns.map((c) => c.key), ...stores.map((s) => `store:${s}`)];
  const X = rows.map((r) => [...columns.map((c) => c.value(r)), ...stores.map((s) => (r.storeId === s ? 1 : 0))]);
  const fit = fitOls(X, rows.map((r) => Math.log(r.revenue)), names);
  if (!fit) return { insufficient: "조건끼리 겹쳐(공선성) 추정할 수 없음" };
  if (fit.dfResidual < R.minResidualDf) return { insufficient: `자유도 ${fit.dfResidual}(최소 ${R.minResidualDf} 필요)` };

  const storeCol = new Map(stores.map((s, i) => [s, columns.length + i]));
  const alphas = stores.map((s) => fit.beta[storeCol.get(s)!]);
  const vs = stores.map((s) => fit.vcovClassical[storeCol.get(s)!][storeCol.get(s)!]);
  const S = stores.length;
  const abar = alphas.reduce((a, b) => a + b, 0) / S;
  const spread = alphas.reduce((a, b) => a + (b - abar) ** 2, 0) / (S - 1);
  const meanV = vs.reduce((a, b) => a + b, 0) / S;
  const groupCount = new Map<CategoryGroup, number>();
  for (const r of rows) groupCount.set(r.group, (groupCount.get(r.group) ?? 0) + 1);

  return {
    fit, rows, X, columns, storeCol,
    storeCount: new Map([...byStore].map(([s, rs]) => [s, rs.length])),
    groupCount, levelOf: groups.levelOf,
    abar, tau2: Math.max(0, spread - meanV), varAbar: spread / S,
  };
}

/**
 * 예측 오차의 실제 분포(교차검증에서 나온 표준화 잔차 z = (실제 − 예측)/sd, 오름차순).
 * 주면 정규분포 대신 이 분포로 구간·확률을 계산한다(정규화 점수 기반 conformal 예측: Lei et al. 2018,
 * Barber et al. 2021). 품절로 매출 상한이 생기면 로그 매출 오차가 한쪽으로 치우쳐 정규 가정이 맞지 않아서다.
 */
export type Calibration = number[];

/** conformal 분위수: n개 점수에서 (n+1)p번째(아래쪽은 내림, 위쪽은 올림) 값 */
function conformalQuantile(z: Calibration, p: number): number {
  const n = z.length;
  const rank = p < 0.5 ? Math.floor((n + 1) * p) : Math.ceil((n + 1) * p);
  return z[Math.min(n, Math.max(1, rank)) - 1];
}

export function predict(model: ForecastModel, storeId: string, e: EventFeatures, calibration?: Calibration): Prediction {
  const R = FORECAST_RULES;
  const nStore = model.storeCount.get(storeId) ?? 0;
  if (nStore < R.minStoreRecords) return { ok: false, reason: `내 매출 기록 ${nStore}건(최소 ${R.minStoreRecords}건 필요)` };
  if (eventDays(e.startDate, e.endDate) > MAX_EVENT_DAYS) return { ok: false, reason: `${MAX_EVENT_DAYS}일 넘는 장기 행사는 예측하지 않음` };
  if (!model.groupCount.get(e.group)) return { ok: false, reason: `'${e.group}' 유형의 과거 기록 없음` };

  const { fit } = model;
  const col = model.storeCol.get(storeId)!;
  const aHat = fit.beta[col];
  const v = fit.vcovClassical[col][col];
  const w = model.tau2 / (model.tau2 + v);
  const alpha = model.abar + w * (aHat - model.abar);
  const varAlpha = w * v + (1 - w) ** 2 * model.varAbar;

  const k = model.columns.length;
  const x = model.columns.map((c) => c.value(e));
  const mu = alpha + x.reduce((s, xi, j) => s + xi * fit.beta[j], 0);
  const vBeta = quadForm(x, fit.vcovClassical.slice(0, k).map((row) => row.slice(0, k)));
  const sd = Math.sqrt(fit.sigma2 + varAlpha + vBeta);
  const df = fit.dfResidual;
  const tail = (1 - R.level) / 2;
  const [zLo, zMid, zHi] = calibration
    ? [conformalQuantile(calibration, tail), calibration[Math.floor(calibration.length / 2)], conformalQuantile(calibration, 1 - tail)]
    : [tQuantile(tail, df), 0, tQuantile(1 - tail, df)];
  const merged = model.levelOf(e.group) === "기타 유형";
  return {
    ok: true, mu, sd, df,
    median: Math.exp(mu + zMid * sd), low: Math.exp(mu + zLo * sd), high: Math.exp(mu + zHi * sd),
    note: merged ? `'${e.group}' 기록이 적어 기록이 적은 유형들의 평균으로 추정` : null,
  };
}

/**
 * 적자 확률 P(매출·(1−원가율) < 고정비). 고정비 ≤ 0이면 0.
 * calibration이 있으면 예측 오차의 실제 분포(경험적 누적분포, 양 끝을 0·1로 단정하지 않도록 (k+1)/(n+2))로 계산한다.
 */
export function lossProbability(p: { mu: number; sd: number; df: number }, fixedCost: number, cogsRate: number, calibration?: Calibration): number {
  if (fixedCost <= 0) return 0;
  const t = (Math.log(fixedCost / (1 - cogsRate)) - p.mu) / p.sd;
  if (!calibration) return tCdf(t, p.df);
  const below = calibration.filter((z) => z <= t).length;
  return (below + 1) / (calibration.length + 2);
}

export interface ForecastValidation {
  n: number;
  hits: number;
  /** 보정된 80% 구간의 적중률 — 가게 단위 10겹 교차검증(구간을 정한 데이터와 채점 데이터가 다름) */
  coverage: number;
  /** 적중률이 명목 80%와 다른지 정확 이항검정 p값 */
  p: number;
  calibrated: boolean;
  /** 예측 중앙값 대비 실제 매출의 절대 오차율 중앙값 */
  medianAbsPctError: number;
  /** 참고: 정규분포(t) 가정 구간의 적중률 — 보정이 왜 필요한지 보여 준다 */
  normalCoverage: number;
  /** 전체 교차검증 표준화 잔차(오름차순) — 화면 예측의 보정에 쓴다 */
  calibration: Calibration;
}

/**
 * 한 건 빼고 적합(leave-one-out) → 뺀 건 예측을 모든 기록에 반복해, 80% 예측구간이 실제로
 * 80% 맞히는지 본다. 적중률이 80%와 통계적으로 다르면(정확 이항검정 p < 0.05) 예측을 보이지 않는다.
 *
 * 매번 다시 적합하면 기록 n건에 n번의 역행렬 계산이 필요해 느리다(1,000건이면 수 분). 대신 OLS의 정확한
 * 한 건 제거 공식(셔먼-모리슨)으로 계수·(X'X)⁻¹·잔차분산을 갱신하고, 가게 효과 축소(τ², 평균)도 갱신된 값으로
 * 다시 계산한다. 범주 구성(어떤 유형을 따로 추정할지 등)만 전체 데이터 기준으로 고정한다.
 *
 * 구간 보정: 각 기록의 한 건 제거 예측으로 표준화 잔차 z를 모은 뒤, 구간 끝을 z의 분위수로 정한다.
 * 이 보정이 맞는지는 가게를 10묶음으로 나눠 "다른 9묶음의 z로 정한 구간이 남은 1묶음을 80% 맞히나"로 채점한다.
 */
export function validateForecast(records: AttendedRecord[]): ForecastValidation | null {
  const model = fitForecastModel(records);
  if ("insufficient" in model) return null;
  const { fit, X, rows, storeCol } = model;
  const kb = model.columns.length; // 가게가 아닌 계수 수
  const inv = fit.xtxInv;
  const stores = [...storeCol];
  const df = fit.dfResidual - 1;
  const q = tQuantile(1 - (1 - FORECAST_RULES.level) / 2, df);
  const scored: { store: string; z: number; mu: number; sd: number; y: number; normalHit: boolean }[] = [];

  rows.forEach((target, i) => {
    if (model.storeCount.get(target.storeId)! - 1 < FORECAST_RULES.minStoreRecords) return; // 빼고 나도 3건 이상 남는 가게만
    if (!model.groupCount.get(target.group) || model.groupCount.get(target.group)! < 2) return; // 그 유형의 유일한 기록이면 예측 불가
    const x = X[i];
    const u = inv.map((row) => row.reduce((s, v, j) => s + v * x[j], 0));
    const h = x.reduce((s, v, j) => s + v * u[j], 0);
    if (1 - h < 1e-8) return;
    const e = fit.resid[i];
    const beta = fit.beta.map((b, j) => b - (u[j] * e) / (1 - h));
    const sigma2 = (fit.dfResidual * fit.sigma2 - (e * e) / (1 - h)) / df;
    const invDiag = (c: number) => inv[c][c] + (u[c] * u[c]) / (1 - h);

    // 갱신된 계수로 가게 효과 축소 추정을 다시 한다.
    const alphas = stores.map(([, c]) => beta[c]);
    const vs = stores.map(([, c]) => sigma2 * invDiag(c));
    const S = stores.length;
    const abar = alphas.reduce((a, b) => a + b, 0) / S;
    const spread = alphas.reduce((a, b) => a + (b - abar) ** 2, 0) / (S - 1);
    const tau2 = Math.max(0, spread - vs.reduce((a, b) => a + b, 0) / S);
    const c = storeCol.get(target.storeId)!;
    const v = sigma2 * invDiag(c);
    const w = tau2 / (tau2 + v);
    const alpha = abar + w * (beta[c] - abar);
    const varAlpha = w * v + (1 - w) ** 2 * (spread / S);

    const xb = x.slice(0, kb);
    let quad = 0;
    for (let a = 0; a < kb; a++) for (let b = 0; b < kb; b++) quad += xb[a] * inv[a][b] * xb[b];
    const ub = xb.reduce((s, v2, j) => s + v2 * u[j], 0);
    const vBeta = sigma2 * (quad + (ub * ub) / (1 - h));
    const mu = alpha + xb.reduce((s, v2, j) => s + v2 * beta[j], 0);
    const sd = Math.sqrt(sigma2 + varAlpha + vBeta);

    const y = Math.log(target.revenue);
    scored.push({ store: target.storeId, z: (y - mu) / sd, mu, sd, y, normalHit: Math.abs(y - mu) <= q * sd });
  });

  const n = scored.length;
  if (n < FORECAST_RULES.minValidation) return null;
  const fold = (store: string) => { let h = 0; for (const ch of store) h = (h * 31 + ch.charCodeAt(0)) >>> 0; return h % 10; };
  const tail = (1 - FORECAST_RULES.level) / 2;
  let hits = 0;
  const errors: number[] = [];
  for (let f = 0; f < 10; f++) {
    const test = scored.filter((s) => fold(s.store) === f);
    if (!test.length) continue;
    const train = scored.filter((s) => fold(s.store) !== f).map((s) => s.z).sort((a, b) => a - b);
    const [lo, mid, hi] = [conformalQuantile(train, tail), train[Math.floor(train.length / 2)], conformalQuantile(train, 1 - tail)];
    for (const s of test) {
      if (s.z >= lo && s.z <= hi) hits++;
      errors.push(Math.abs(Math.exp(s.y) - Math.exp(s.mu + mid * s.sd)) / Math.exp(s.y));
    }
  }
  errors.sort((a, b) => a - b);
  const p = binomTestTwoSided(hits, n, FORECAST_RULES.level);
  return {
    n, hits, coverage: hits / n, p, calibrated: p >= 0.05,
    medianAbsPctError: errors[Math.floor(errors.length / 2)],
    normalCoverage: scored.filter((s) => s.normalHit).length / n,
    calibration: scored.map((s) => s.z).sort((a, b) => a - b),
  };
}
