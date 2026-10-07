// 합성 셀러 데이터 생성 과정(DGP) — DB와 무관한 순수 함수.
// scripts/seed-synthetic-users.ts(DB 적재)와 scripts/evaluate-synthetic.ts(모형 재평가)가 같이 쓴다.
//
// 생성 순서:
//   1) 인구통계(성별·연령·업종) — 소상공인실태조사 비율 쿼터(config.ts의 SOURCES)
//   2) 참가 횟수 — FM360 신규 셀러 비율 + 재참가 셀러의 꼬리 분포(ACTIVITY)
//   3) 행사 날씨 — 기상청 실측(없으면 [가정] 분포). 행사 단위로 정해 같은 행사의 셀러가 공유
//   4) 수요 → 판매: 수요 ~ 음이항(가게·상품·날씨·주말·일수·행사 충격), 판매 = min(수요, 준비량)
//   5) 참가 전 예상 매출 — 과대 예상(Cassar 2010) 방향의 낙관 편향
//
// 난수는 (셀러, 행사, 상품)마다 따로 흐르게 해서, 날씨만 바꾼 "반사실" 판매를 같은 난수로 다시 계산할 수 있다
// (평가 스크립트가 모형이 맞혀야 할 참 효과를 이렇게 구한다).

import * as C from "../synthetic-users.config";
import type { CategoryGroup } from "../../src/features/events/category-group";
import type { Weather } from "./weather";
import { isPerishable } from "../../src/features/analytics/stock";

// ---------------------------------------------------------------------------
// 난수
// ---------------------------------------------------------------------------
export function mulberry32(seed: number) {
  return () => {
    seed = (seed + 0x6d2b79f5) | 0;
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
function hash(text: string): number {
  let h = 2166136261;
  for (let i = 0; i < text.length; i++) h = Math.imul(h ^ text.charCodeAt(i), 16777619);
  return h >>> 0;
}
/** 반복 실험용: 같은 설정으로 다른 데이터를 만들 때 바꾼다(기본 0 = DB에 넣는 그 데이터). */
let salt = 0;
export function setSalt(value: number) {
  salt = value;
}
export class Rng {
  private u: () => number;
  constructor(seed: number | string) {
    this.u = mulberry32(typeof seed === "number" ? seed + salt : hash(`${C.SEED}:${salt}:${seed}`));
  }
  next = () => this.u();
  int = (lo: number, hi: number) => lo + Math.floor(this.u() * (hi - lo + 1));
  pick = <T,>(arr: readonly T[]): T => arr[Math.floor(this.u() * arr.length)];
  won = (lo: number, hi: number) => Math.round(this.int(lo, hi) / 1000) * 1000;
  normal = () => Math.sqrt(-2 * Math.log(this.u() || 1e-12)) * Math.cos(2 * Math.PI * this.u());
  shuffle = <T,>(arr: T[]): T[] => {
    for (let i = arr.length - 1; i > 0; i--) {
      const j = Math.floor(this.u() * (i + 1));
      [arr[i], arr[j]] = [arr[j], arr[i]];
    }
    return arr;
  };
  weighted = (weights: Record<string, number>): string => {
    const total = Object.values(weights).reduce((a, b) => a + b, 0);
    let r = this.u() * total;
    for (const [k, w] of Object.entries(weights)) if ((r -= w) < 0) return k;
    return Object.keys(weights).at(-1)!;
  };
  /** 기하분포(0부터), 평균 mean */
  geometric = (mean: number) => Math.floor(Math.log(1 - this.u()) / Math.log(mean / (mean + 1)));
  /** Gamma(shape, 1) — Marsaglia-Tsang */
  gamma = (shape: number): number => {
    if (shape < 1) return this.gamma(shape + 1) * Math.pow(this.u(), 1 / shape);
    const d = shape - 1 / 3, c = 1 / Math.sqrt(9 * d);
    for (;;) {
      const x = this.normal(), v = (1 + c * x) ** 3;
      if (v > 0 && Math.log(this.u()) < 0.5 * x * x + d - d * v + d * Math.log(v)) return d * v;
    }
  };
  poisson = (mean: number): number => {
    if (mean > 30) return Math.max(0, Math.round(mean + Math.sqrt(mean) * this.normal()));
    const L = Math.exp(-mean);
    let k = 0, p = 1;
    do { k++; p *= this.u(); } while (p > L);
    return k - 1;
  };
  /** 음이항(평균 mean, 형태 k) = 포아송(감마 혼합) */
  negBin = (mean: number, k: number) => this.poisson(mean * this.gamma(k) / k);
}

function erf(x: number) {
  const t = 1 / (1 + 0.3275911 * Math.abs(x));
  const y = 1 - ((((1.061405429 * t - 1.453152027) * t + 1.421413741) * t - 0.284496736) * t + 0.254829592) * t * Math.exp(-x * x);
  return x >= 0 ? y : -y;
}
const normCdf = (z: number) => 0.5 * (1 + erf(z / Math.SQRT2));

/** 표준정규 분위수(이분법) */
function zQuantile(p: number): number {
  let lo = -8, hi = 8;
  for (let i = 0; i < 80; i++) {
    const m = (lo + hi) / 2;
    if (normCdf(m) < p) lo = m; else hi = m;
  }
  return (lo + hi) / 2;
}

/**
 * 셀러가 생각하는 수요 X ~ 로그정규(중앙값 median, 로그 표준편차 s)일 때 준비량 q에서 기대 판매량 E[min(X, q)].
 * = E[X]·Φ((ln q − ln median − s²)/s) + q·(1 − Φ((ln q − ln median)/s))
 */
function expectedSold(median: number, s: number, q: number): number {
  const d = (Math.log(q) - Math.log(median)) / s;
  return median * Math.exp((s * s) / 2) * normCdf(d - s) + q * (1 - normCdf(d));
}

// ---------------------------------------------------------------------------
// 입력
// ---------------------------------------------------------------------------
export interface DgpEvent {
  id: string; // DB uuid 또는 시드 id
  key: string; // 난수 흐름용 안정 키(source_post_id 등)
  name: string;
  region: string | null;
  startDate: string;
  endDate: string | null;
  fee: number | null;
  outdoor: boolean | null;
  group: CategoryGroup;
}
export type WeatherLookup = ((region: string | null, date: string) => Weather | null) | null;

// ---------------------------------------------------------------------------
// 1) 인구통계
// ---------------------------------------------------------------------------
type Edge = (typeof C.EDGE_CASES)[number];
export interface Persona {
  no: number;
  email: string;
  name: string;
  given: string;
  gender: "여성" | "남성";
  age: string;
  industry: keyof typeof C.INDUSTRY.categories;
  category: string;
  region: string;
  edge: Edge | null;
}

/** 최대잉여법: 비중을 n명 정수 쿼터로 나눈다(합계가 정확히 n). */
export function quotas(weights: Record<string, number>, n: number): Record<string, number> {
  const total = Object.values(weights).reduce((a, b) => a + b, 0);
  const exact = Object.entries(weights).map(([k, w]) => [k, (w / total) * n] as const);
  const result = Object.fromEntries(exact.map(([k, v]) => [k, Math.floor(v)]));
  let left = n - Object.values(result).reduce((a, b) => a + b, 0);
  for (const [k] of [...exact].sort((a, b) => (b[1] % 1) - (a[1] % 1))) {
    if (left-- <= 0) break;
    result[k]++;
  }
  return result;
}

export function buildPersonas(eventRegions: (string | null)[]): Persona[] {
  const rng = new Rng(C.SEED);
  const n = C.USER_COUNT;
  const expand = (q: Record<string, number>) => rng.shuffle(Object.entries(q).flatMap(([k, c]) => Array<string>(c).fill(k)));
  const genders = expand(quotas(C.GENDER.weights, n)) as Persona["gender"][];
  const ages = expand(quotas(C.AGE.weights, n));
  const industryQuota = quotas(C.INDUSTRY.weights, n);
  // 업종 안의 카테고리는 [가정] 균등 배분.
  const cats = rng.shuffle(
    Object.entries(industryQuota).flatMap(([industry, count]) => {
      const list = C.INDUSTRY.categories[industry as Persona["industry"]];
      const q = quotas(Object.fromEntries(list.map((c) => [c, 1])), count);
      return Object.entries(q).flatMap(([c, k]) => Array(k).fill({ industry, category: c }));
    })
  ) as { industry: Persona["industry"]; category: string }[];
  const regionWeights: Record<string, number> = {};
  for (const r of eventRegions) if (r) regionWeights[r] = (regionWeights[r] ?? 0) + 1;
  const regions = expand(quotas(regionWeights, n));

  const usedNames = new Set<string>();
  return Array.from({ length: n }, (_, i) => {
    const gender = genders[i];
    const pool = C.GIVEN_NAMES[gender][ages[i] === "50대" || ages[i] === "60대 이상" ? "older" : "younger"];
    let given: string, name: string;
    do {
      given = rng.pick(pool);
      name = rng.pick(C.SURNAMES) + given;
    } while (usedNames.has(name));
    usedNames.add(name);
    return {
      no: i + 1,
      email: `seller${String(i + 1).padStart(3, "0")}@${C.EMAIL_DOMAIN}`,
      name, given, gender, age: ages[i], ...cats[i], region: regions[i],
      edge: C.EDGE_CASES[i] ?? null,
    };
  });
}

// ---------------------------------------------------------------------------
// 행사 단위 조건(같은 행사의 모든 셀러가 공유)
// ---------------------------------------------------------------------------
export interface EventConditions {
  weather: Weather;
  weatherObserved: boolean; // 기상청 실측이면 true
  outdoor: boolean;
  shock: number; // 행사 공통 충격(로그)
  weekend: boolean;
  days: number;
}

const eventDays = (s: string, e: string | null) => (!e || e < s ? 1 : Math.round((Date.parse(e) - Date.parse(s)) / 86_400_000) + 1);
function includesWeekend(s: string, e: string | null): boolean {
  const days = eventDays(s, e);
  if (days >= 7) return true;
  const first = new Date(`${s}T00:00:00Z`).getUTCDay();
  for (let i = 0; i < days; i++) if ((first + i) % 7 === 0 || (first + i) % 7 === 6) return true;
  return false;
}

export function eventConditions(e: DgpEvent, weather: WeatherLookup): EventConditions {
  const rng = new Rng(`event:${e.key}`);
  const observed = weather?.(e.region, e.startDate) ?? null;
  const fallback = rng.weighted(C.DEMAND.weatherFallback) as Weather;
  const outdoorDraw = rng.next() < C.DEMAND.outdoorShare;
  return {
    weather: observed ?? fallback,
    weatherObserved: observed != null,
    outdoor: e.outdoor ?? outdoorDraw,
    shock: C.DEMAND.eventSd * rng.normal(),
    weekend: includesWeekend(e.startDate, e.endDate),
    days: eventDays(e.startDate, e.endDate),
  };
}

// ---------------------------------------------------------------------------
// 2) 가게(셀러) 특성과 참가 선택
// ---------------------------------------------------------------------------
export interface GenProduct { name: string; price: number; cost: number; appeal: number }
export interface StoreTraits {
  base: number; // 가게 수요 배수
  stockQuantile: number; // 준비 습관(기대 수요의 몇 분위수만큼 준비하나)
  optimism: number; // 예상 매출 낙관 편향(로그)
  since: string; // 앱 가입일
  products: GenProduct[];
  paymentMethods: string[];
}

export function storeTraits(p: Persona, today: string): StoreTraits {
  const rng = new Rng(`store:${p.no}`);
  const catalog = C.PRODUCTS[p.category];
  const products = rng.shuffle([...catalog.names]).slice(0, rng.int(3, 5)).map((name) => {
    const price = rng.won(...catalog.price);
    return { name, price, cost: Math.round((price * rng.int(30, 50)) / 100 / 100) * 100, appeal: Math.exp(C.DEMAND.productSd * rng.normal()) };
  });
  // 당일 폐기 상품(음식·디저트) 셀러와 다시 팔 수 있는 상품 셀러의 준비 습관을 다르게 둔다.
  const [q0, q1] = isPerishable(p.category) ? C.DEMAND.stockQuantile : C.DEMAND.stockQuantileReusable;
  const sinceMs = Date.parse(C.ACTIVITY.since);
  const lastMs = Date.parse(today) - 60 * 86_400_000;
  return {
    base: Math.exp(C.DEMAND.storeSd * rng.normal()),
    stockQuantile: q0 + rng.next() * (q1 - q0),
    optimism: C.DEMAND.optimismMean + C.DEMAND.optimismSd * rng.normal(),
    since: new Date(sinceMs + rng.next() * (lastMs - sinceMs)).toISOString().slice(0, 10),
    products,
    paymentMethods: rng.next() < 0.5 ? ["카드", "현금", "계좌이체"] : ["카드", "현금"],
  };
}

/** 지난 참가 수 목표: 경계 사례 → 고정, 그 밖 → 신규(FM360 비율) 또는 3 + 기하분포 */
function targetPastCount(p: Persona, rng: Rng): number {
  if (p.edge === "no_participation") return 0;
  if (p.edge === "single_attended") return 1;
  if (p.edge === "heavy") return rng.int(15, 18);
  const A = C.ACTIVITY;
  return rng.next() < A.newShare ? rng.int(...A.newCount) : A.returningMin + rng.geometric(A.extraMean);
}

/** 활동 지역 선호(70%)로 고르되, 날짜가 겹치는 행사는 같이 나갈 수 없다. */
function chooseEvents(p: Persona, pool: DgpEvent[], n: number, rng: Rng): DgpEvent[] {
  const local = rng.shuffle(pool.filter((e) => e.region === p.region));
  const other = rng.shuffle(pool.filter((e) => e.region !== p.region));
  const out: DgpEvent[] = [];
  const overlaps = (a: DgpEvent, b: DgpEvent) => a.startDate <= (b.endDate ?? b.startDate) && b.startDate <= (a.endDate ?? a.startDate);
  while (out.length < n && (local.length || other.length)) {
    const list = (rng.next() < C.ACTIVITY.localShare && local.length) || !other.length ? local : other;
    const e = list.shift()!;
    if (!out.some((o) => overlaps(o, e))) out.push(e);
  }
  return out.sort((a, b) => a.startDate.localeCompare(b.startDate));
}

// ---------------------------------------------------------------------------
// 3) 수요 → 판매 (반사실 계산 가능)
// ---------------------------------------------------------------------------
export interface SaleDraw {
  productIndex: number; prepared: number; demand: number; sold: number; price: number;
  expectedUnits: number; // 수요의 기본 크기(날씨·당일 충격 반영 전) — 실제 수요 평균 = 이것 × 날씨 배수 × e^충격
  expectedSold: number; // 셀러가 생각하는 기대 판매량 E[min(수요, 준비량)]
}

/** 셀러가 경험으로 아는 평소 날씨 분포 — generateAll이 행사 날짜의 실제(기상청) 날씨 빈도로 채운다. */
let climate: Record<string, number> = C.DEMAND.weatherFallback;

/** 평소 날씨에서의 평균 수요 배수(평소 날씨 분포로 가중 평균) — 셀러가 경험으로 아는 "날씨 감안" 수준 */
function typicalWeather(outdoor: boolean): number {
  const table = C.DEMAND.weather[outdoor ? "실외" : "실내"];
  const w = climate;
  const total = Object.values(w).reduce((a, b) => a + b, 0);
  return Object.entries(w).reduce((a, [k, p]) => a + (p / total) * (table[k] ?? 1), 0);
}

export function simulateSales(
  p: Persona,
  t: StoreTraits,
  e: DgpEvent,
  cond: EventConditions,
  override: Partial<Pick<EventConditions, "weather" | "weekend" | "outdoor">> = {}
): SaleDraw[] {
  const c = { ...cond, ...override };
  const D = C.DEMAND;
  const rngDays = new Rng(`days:${p.no}:${e.key}`);
  const attendDays = c.days > 7 ? rngDays.int(...D.longEventDays) : c.days;
  const known = D.baseUnits * t.base * (c.weekend ? D.weekend : 1) * attendDays ** D.durationPower; // 셀러가 미리 아는 부분
  const weatherMult = D.weather[c.outdoor ? "실외" : "실내"][c.weather] ?? 1;
  const z = zQuantile(t.stockQuantile);
  // 이 행사에 가져간 상품(2개 이상) — 고르는 난수는 반사실과 무관하게 고정
  const pickRng = new Rng(`pick:${p.no}:${e.key}`);
  const carried = pickRng.shuffle(t.products.map((_, i) => i)).slice(0, pickRng.int(Math.min(2, t.products.length), t.products.length));
  return carried.map((j) => {
    const prod = t.products[j];
    const rng = new Rng(`sale:${p.no}:${e.key}:${j}`);
    const expectedUnits = known * prod.appeal;
    const mean = expectedUnits * weatherMult * Math.exp(c.shock);
    const demand = rng.negBin(mean, D.dispersion);
    // 셀러의 수요 예상(보정된 기대): 경험으로 평균적인 날씨 영향과 수요가 들쑥날쑥한 정도는 안다고 본다.
    // 모르는 것은 그날 날씨·행사 충격의 실제 값뿐이고, 편향은 예상 매출의 평균(낙관)에만 둔다.
    //   평균 = 기대 수요 × 평소 날씨 배수(실내외별) × E[e^충격],  로그 분산 = ln(1 + 1/μ + 1/k) + 충격 분산
    const beliefMean = expectedUnits * typicalWeather(c.outdoor) * Math.exp(D.eventSd ** 2 / 2);
    const beliefSd = Math.sqrt(Math.log(1 + 1 / beliefMean + 1 / D.dispersion) + D.eventSd ** 2);
    const beliefMedian = beliefMean * Math.exp(-(beliefSd ** 2) / 2);
    const prepared = Math.max(1, Math.round(beliefMedian * Math.exp(beliefSd * z)));
    return { productIndex: j, prepared, demand, sold: Math.min(demand, prepared), price: prod.price, expectedUnits, expectedSold: expectedSold(beliefMedian, beliefSd, prepared) };
  });
}

// ---------------------------------------------------------------------------
// 4) 셀러 1명의 전체 기록
// ---------------------------------------------------------------------------
export interface GenParticipation {
  event: DgpEvent;
  cond: EventConditions;
  status: "attended" | "interested" | "planning_to_attend";
  fee: number;
  recordedAt: string; // created_at
  expectedRevenue: number | null;
  targetRevenue: number | null;
  sales: SaleDraw[];
  result: null | {
    totalRevenue: number;
    transport: number; parking: number; lodging: number; other: number;
    netProfit: number;
    satisfaction: number;
    detailed: boolean;
  };
}

export interface GenSeller { persona: Persona; traits: StoreTraits | null; participations: GenParticipation[] }

export function generateSeller(p: Persona, events: DgpEvent[], cond: Map<string, EventConditions>, today: string): GenSeller {
  if (p.edge === "no_store") return { persona: p, traits: null, participations: [] };
  const t = storeTraits(p, today);
  const rng = new Rng(`seller:${p.no}`);
  const ended = (e: DgpEvent) => (e.endDate ?? e.startDate) < today;
  const pastPool = events.filter((e) => ended(e) && e.startDate >= t.since);
  const futurePool = events.filter((e) => e.startDate >= today);
  const past = chooseEvents(p, pastPool, targetPastCount(p, rng), rng);
  const futureCount = p.edge === "no_participation" ? 0 : p.edge === "empty_checklist" ? Math.max(1, rng.int(...C.ACTIVITY.future)) : rng.int(...C.ACTIVITY.future);
  const future = chooseEvents(p, futurePool, futureCount, rng);
  const detailed = past.length >= C.ACTIVITY.detailedFrom;
  const R = C.EVENT_RESULT;

  const participations: GenParticipation[] = [...past, ...future].map((e) => {
    const c = cond.get(e.id)!;
    const isPast = ended(e);
    const attended = isPast && (p.edge === "single_attended" || rng.next() < C.ACTIVITY.attendRate);
    const status: GenParticipation["status"] = isPast ? (attended ? "attended" : "interested") : rng.next() < 0.6 ? "planning_to_attend" : "interested";
    const fee = (e.fee ?? rng.won(...R.feeWhenUnknown)) * (p.edge === "always_loss" ? 3 : 1);
    const recorded = new Date(Date.parse(e.startDate) - rng.int(10, 40) * 86_400_000).toISOString().slice(0, 10);
    const sales = attended || status === "planning_to_attend" ? simulateSales(p, t, e, c) : [];
    // 참가 전 예상 매출: 셀러 자신의 수요 예상으로 본 기대 판매량(준비량을 넘게 팔 수는 없음) × 가격 × 낙관 편향
    const expectedBase = sales.reduce((a, s) => a + s.expectedSold * s.price, 0);
    const writesExpected = sales.length > 0 && rng.next() < C.DEMAND.expectedRecordShare;
    const expectedRevenue = writesExpected ? Math.max(1000, Math.round((expectedBase * Math.exp(t.optimism)) / 1000) * 1000) : null;
    const targetRevenue = expectedRevenue != null ? Math.round((expectedRevenue * (1 + 0.3 * rng.next())) / 1000) * 1000 : null;

    let result: GenParticipation["result"] = null;
    if (attended && p.edge !== "unrecorded_result") {
      const total = sales.reduce((a, s) => a + s.sold * s.price, 0);
      const transport = rng.won(...R.transport);
      const parking = rng.won(...R.parking);
      const lodging = detailed && e.region !== p.region && rng.next() < 0.5 ? rng.won(...R.lodging) : 0;
      const other = detailed ? rng.won(...R.other) : 0;
      const netProfit = total - fee - transport - parking - lodging - other;
      const margin = total > 0 ? netProfit / total : -1;
      result = { totalRevenue: total, transport, parking, lodging, other, netProfit, satisfaction: margin < 0 ? rng.int(1, 2) : margin < 0.3 ? 3 : margin < 0.5 ? 4 : 5, detailed };
    }
    return {
      event: e, cond: c, status, fee,
      recordedAt: recorded < today ? recorded : today,
      expectedRevenue: attended || status === "planning_to_attend" ? expectedRevenue : null,
      targetRevenue,
      sales: attended || status === "planning_to_attend" ? sales : [],
      result,
    };
  });
  return { persona: p, traits: t, participations };
}

export function generateAll(events: DgpEvent[], weather: WeatherLookup, today: string) {
  const personas = buildPersonas(events.map((e) => e.region));
  const cond = new Map(events.map((e) => [e.id, eventConditions(e, weather)]));
  climate = {};
  for (const c of cond.values()) climate[c.weather] = (climate[c.weather] ?? 0) + 1;
  return { personas, cond, sellers: personas.map((p) => generateSeller(p, events, cond, today)) };
}
