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
    fit, columns, storeCol,
    storeCount: new Map([...byStore].map(([s, rs]) => [s, rs.length])),
    groupCount, levelOf: groups.levelOf,
    abar, tau2: Math.max(0, spread - meanV), varAbar: spread / S,
  };
}

export function predict(model: ForecastModel, storeId: string, e: EventFeatures): Prediction {
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
  const q = tQuantile(1 - (1 - R.level) / 2, df);
  const merged = model.levelOf(e.group) === "기타 유형";
  return {
    ok: true, mu, sd, df,
    median: Math.exp(mu), low: Math.exp(mu - q * sd), high: Math.exp(mu + q * sd),
    note: merged ? `'${e.group}' 기록이 적어 기록이 적은 유형들의 평균으로 추정` : null,
  };
}

/** 적자 확률 P(매출·(1−원가율) < 고정비). 고정비 ≤ 0이면 0. */
export function lossProbability(p: { mu: number; sd: number; df: number }, fixedCost: number, cogsRate: number): number {
  if (fixedCost <= 0) return 0;
  const threshold = fixedCost / (1 - cogsRate);
  return tCdf((Math.log(threshold) - p.mu) / p.sd, p.df);
}

export interface ForecastValidation {
  n: number;
  hits: number;
  coverage: number;
  /** 적중률이 명목 80%와 다른지 정확 이항검정 p값 */
  p: number;
  calibrated: boolean;
  /** 예측 중앙값 대비 실제 매출의 절대 오차율 중앙값 */
  medianAbsPctError: number;
}

/**
 * 한 건 빼고 적합(leave-one-out) → 뺀 건 예측을 모든 기록에 반복해, 80% 예측구간이 실제로
 * 80% 맞히는지 본다. 적중률이 80%와 통계적으로 다르면(정확 이항검정 p < 0.05) 예측을 보이지 않는다.
 */
export function validateForecast(records: AttendedRecord[]): ForecastValidation | null {
  const rows = trainingRows(records);
  const perStore = new Map<string, number>();
  for (const r of rows) perStore.set(r.storeId, (perStore.get(r.storeId) ?? 0) + 1);
  let n = 0, hits = 0;
  const errors: number[] = [];
  for (const target of rows) {
    if (perStore.get(target.storeId)! - 1 < FORECAST_RULES.minStoreRecords) continue; // 빼고 나도 3건 이상 남는 가게만
    const model = fitForecastModel(rows.filter((r) => r !== target));
    if ("insufficient" in model) continue;
    const p = predict(model, target.storeId, target);
    if (!p.ok) continue;
    n++;
    if (target.revenue >= p.low && target.revenue <= p.high) hits++;
    errors.push(Math.abs(target.revenue - p.median) / target.revenue);
  }
  if (n < FORECAST_RULES.minValidation) return null;
  errors.sort((a, b) => a - b);
  const p = binomTestTwoSided(hits, n, FORECAST_RULES.level);
  return { n, hits, coverage: hits / n, p, calibrated: p >= 0.05, medianAbsPctError: errors[Math.floor(errors.length / 2)] };
}
