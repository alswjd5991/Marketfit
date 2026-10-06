// ③ 매출 요인 분석 — "어떤 조건에서 매출이 달랐나"
//
// 모형: ln(매출_ij) = α_가게 + β·조건_ij + ε_ij
//   - α_가게(가게 고정효과): 가게마다 다른 가격대·상품·실력을 통째로 통제한다. 그래서 각 β는
//     "같은 가게가 조건만 달랐을 때" 매출이 평균 몇 % 달랐는지를 뜻한다(가게 간 비교가 아님).
//   - 조건: 날씨(기준 맑음), 실외 여부, 주말 포함 여부, 행사 유형(기준 = 가장 흔한 유형),
//     행사 일수(로그, 통제용 — 화면에 표시하지 않음).
//   - 로그 매출이라 효과는 곱셈적: 100·(e^β − 1)%.
//   - 표준오차: 행사 단위 군집-강건(CR1). 같은 행사에 나간 셀러들은 그날 방문객 수 같은 충격을 공유한다.
//   - 여러 요인을 동시에 보므로 "의미 있는 차이" 판정은 Holm 보정 p < 0.05로 한다.
//
// 해석 한계(화면에도 표시): 관찰 자료라 인과효과가 아니라 "함께 나타난 차이"다. 셀러가 날씨를 보고
// 참가를 정하는 등의 선택 효과는 통제하지 못한다.

import { holmAdjust, tQuantile, tTwoSidedP } from "./distributions";
import { fitOls } from "./ols";
import { MAX_EVENT_DAYS, dropSmallStores, eventDays, filterWithReasons, groupLevels, includesWeekend, type AttendedRecord, type Exclusion } from "./records";

const WEATHER_LEVELS = ["흐림", "비", "눈"] as const;
const WEATHER_LABEL: Record<string, string> = { 흐림: "흐린 날", 비: "비 온 날", 눈: "눈 온 날" };

/** 공개 기준(화면 "분석 방법"에도 그대로 노출) */
export const FACTOR_RULES = {
  minRecords: 40,
  minEvents: 20,
  minResidualDf: 20,
  minLevelCount: 5, // 범주별 최소 기록 수
  minVaryingStores: 3, // 그 조건이 "있을 때와 없을 때"를 모두 겪은 가게 수
  /** 그 조건이 있었던 행사·없었던 행사가 각각 이만큼 있어야 한다. 날씨·주말·실내외는 행사 단위로 정해지므로
   *  실질 표본은 기록 수가 아니라 행사 수다 — 몇 개 행사에서만 관측된 효과는 그 행사들의 특수성과 구분되지 않고,
   *  군집-강건 표준오차도 처리 군집이 적으면 믿을 수 없다(MacKinnon & Webb 2017). */
  minEventsPerLevel: 5,
  alpha: 0.05,
};

export interface FactorEffect {
  key: string;
  label: string;
  reference: string;
  /** 기준 대비 매출 차이(비율, −0.3 = 30% 낮음)와 95% 신뢰구간 */
  pct: number;
  low: number;
  high: number;
  p: number;
  pHolm: number;
  significant: boolean;
  count: number;
}

export type FactorAnalysis =
  | {
      status: "ok";
      effects: FactorEffect[];
      n: number;
      stores: number;
      events: number;
      excluded: Exclusion[];
      notes: string[];
    }
  | { status: "insufficient"; reason: string; n: number };

export function analyzeFactors(all: AttendedRecord[]): FactorAnalysis {
  const R = FACTOR_RULES;
  const weatherCount = new Map<string, number>();
  for (const r of all) if (r.weather) weatherCount.set(r.weather, (weatherCount.get(r.weather) ?? 0) + 1);

  const filtered = filterWithReasons(all, [
    ["매출 0원", (r) => r.revenue > 0],
    [`${MAX_EVENT_DAYS}일 넘는 장기 행사`, (r) => eventDays(r.startDate, r.endDate) <= MAX_EVENT_DAYS],
    ["날씨 미기재", (r) => r.weather === "맑음" || WEATHER_LEVELS.includes(r.weather as (typeof WEATHER_LEVELS)[number])],
    [`기록 ${R.minLevelCount}건 미만인 날씨`, (r) => (weatherCount.get(r.weather!) ?? 0) >= R.minLevelCount],
    ["실내·실외 미기재", (r) => r.indoorOutdoor === "실내" || r.indoorOutdoor === "실외"],
  ]);
  const { kept: rows, dropped } = dropSmallStores(filtered.kept, 2);
  const excluded = [...filtered.excluded, ...(dropped ? [{ reason: "기록 1건뿐인 가게(가게 안 비교 불가)", count: dropped }] : [])];

  const events = new Set(rows.map((r) => r.eventId)).size;
  if (rows.length < R.minRecords) return { status: "insufficient", reason: `분석 가능한 기록 ${rows.length}건(최소 ${R.minRecords}건 필요)`, n: rows.length };
  if (events < R.minEvents) return { status: "insufficient", reason: `행사 ${events}곳(최소 ${R.minEvents}곳 필요)`, n: rows.length };

  // 설명변수 후보: [키, 이름, 기준, 값 함수]
  const groups = groupLevels(rows);
  const candidates: { key: string; label: string; reference: string; value: (r: AttendedRecord) => number }[] = [
    ...WEATHER_LEVELS.filter((w) => rows.some((r) => r.weather === w)).map((w) => ({
      key: `weather:${w}`, label: WEATHER_LABEL[w], reference: "맑은 날", value: (r: AttendedRecord) => (r.weather === w ? 1 : 0),
    })),
    { key: "outdoor", label: "실외 행사", reference: "실내 행사", value: (r) => (r.indoorOutdoor === "실외" ? 1 : 0) },
    { key: "weekend", label: "주말이 낀 행사", reference: "평일에만 열린 행사", value: (r) => (includesWeekend(r.startDate, r.endDate) ? 1 : 0) },
    ...groups.own.map((g) => ({ key: `group:${g}`, label: g, reference: groups.reference, value: (r: AttendedRecord) => (groups.levelOf(r.group) === g ? 1 : 0) })),
  ];

  // 가게 안에서 변하지 않는 조건은 가게 고정효과와 구분되지 않아 추정하지 않는다.
  const notes: string[] = [];
  const byStore = new Map<string, AttendedRecord[]>();
  for (const r of rows) byStore.set(r.storeId, [...(byStore.get(r.storeId) ?? []), r]);
  const shown = candidates.filter((c) => {
    const ones = rows.filter((r) => c.value(r) === 1).length;
    const varying = [...byStore.values()].filter((rs) => new Set(rs.map(c.value)).size > 1).length;
    const eventsWith = new Set(rows.filter((r) => c.value(r) === 1).map((r) => r.eventId)).size;
    const eventsWithout = new Set(rows.filter((r) => c.value(r) === 0).map((r) => r.eventId)).size;
    const ok = ones >= R.minLevelCount && rows.length - ones >= R.minLevelCount && varying >= R.minVaryingStores
      && eventsWith >= R.minEventsPerLevel && eventsWithout >= R.minEventsPerLevel;
    if (!ok) notes.push(`${c.label}: ${eventsWith < R.minEventsPerLevel ? `${eventsWith}개 행사에서만 관측돼` : "비교할 기록이 부족해"} 추정하지 않음`);
    return ok;
  });
  // 날씨 범주는 빼면 기준(맑음)에 섞여 버리므로, 추정하지 못하는 날씨는 행 자체를 뺀다.
  const droppedWeather = candidates.filter((c) => c.key.startsWith("weather:") && !shown.includes(c));
  // 행을 뺀 뒤 기록이 1건만 남은 가게는 다시 뺀다(가게 효과가 그 1건에 딱 맞춰져 정보가 없고, 군집 잭나이프도 깨진다).
  const usable = dropSmallStores(rows.filter((r) => !droppedWeather.some((c) => c.value(r) === 1)), 2).kept;
  // 따로 추정하지 못한 유형은 기준 유형에 섞이지 않게 "기타 유형"으로 보낸다.
  const shownGroups = new Set(shown.filter((c) => c.key.startsWith("group:")).map((c) => c.key.slice(6)));
  const isOther = (r: AttendedRecord) => r.group !== groups.reference && !shownGroups.has(r.group);
  const hasOtherGroup = usable.some(isOther);
  // 행사 일수 통제: 가게 안에서 일수가 달라진 적이 있을 때만 넣는다(모두 하루짜리면 상수라 추정 불가).
  const lnDays = (r: AttendedRecord) => Math.log(eventDays(r.startDate, r.endDate));
  const daysVary = [...byStore.values()].filter((rs) => new Set(rs.map(lnDays)).size > 1).length >= R.minVaryingStores;

  const stores = [...new Set(usable.map((r) => r.storeId))];
  const names = [...shown.map((c) => c.key), ...(daysVary ? ["lnDays"] : []), ...(hasOtherGroup ? ["group:기타"] : []), ...stores.map((s) => `store:${s}`)];
  const X = usable.map((r) => [
    ...shown.map((c) => c.value(r)),
    ...(daysVary ? [lnDays(r)] : []),
    ...(hasOtherGroup ? [isOther(r) ? 1 : 0] : []),
    ...stores.map((s) => (r.storeId === s ? 1 : 0)),
  ]);
  const fit = fitOls(X, usable.map((r) => Math.log(r.revenue)), names, usable.map((r) => r.eventId));
  if (!fit) return { status: "insufficient", reason: "조건끼리 겹치거나 한 행사를 빼면 사라지는 조건이 있어 추정할 수 없음", n: usable.length };
  if (fit.dfResidual < R.minResidualDf) return { status: "insufficient", reason: `자유도 ${fit.dfResidual}(최소 ${R.minResidualDf} 필요)`, n: usable.length };

  const crit = tQuantile(1 - R.alpha / 2, fit.df);
  const raw = shown.map((c, j) => {
    const b = fit.beta[j];
    const se = Math.sqrt(fit.vcov[j][j]);
    return {
      key: c.key, label: c.label, reference: c.reference,
      pct: Math.exp(b) - 1, low: Math.exp(b - crit * se) - 1, high: Math.exp(b + crit * se) - 1,
      p: tTwoSidedP(b / se, fit.df),
      count: usable.filter((r) => c.value(r) === 1).length,
    };
  });
  const adjusted = holmAdjust(raw.map((e) => e.p));
  return {
    status: "ok",
    effects: raw.map((e, i) => ({ ...e, pHolm: adjusted[i], significant: adjusted[i] < R.alpha })),
    n: usable.length,
    stores: stores.length,
    events: new Set(usable.map((r) => r.eventId)).size,
    excluded,
    notes: [...notes, ...(hasOtherGroup ? ["기록이 적은 행사 유형은 '기타 유형'으로 묶어 통제만 함"] : [])],
  };
}
