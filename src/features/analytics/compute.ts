// 대시보드 분석 계산 — 서버·스크립트 전용(Next 요청 컨텍스트에 의존하지 않음).
//
// ①③④는 여러 가게의 기록을 함께 써야 해서 service_role로 전체 참가 기록을 읽는다(RLS상 사용자는
// 자기 기록만 읽을 수 있음). 다른 가게의 원본 기록은 이 파일 밖으로 나가지 않고, 화면에는
// 회귀계수·예측값·순위 같은 요약값만 전달된다. 클라이언트 컴포넌트에서 import 금지.

import type { createAdminClient } from "@/lib/supabase/admin";
import { getCategoryGroup } from "@/features/events/category-group";
import { koreaDate } from "@/features/ai/event-search";
import { analyzeFactors, type FactorAnalysis } from "./factors";
import { fitForecastModel, lossProbability, predict, validateForecast, type ForecastValidation, type Prediction } from "./forecast";
import { peerRank, type PeerRank } from "./peer";
import { planAccuracy, type PlanAccuracy } from "./plan";
import { includesWeekend, type AttendedRecord } from "./records";
import type { FactorEffect } from "./factors";
import { diagnoseStock, isPerishable, leftoverLoss, type StockDiagnosis } from "./stock";

/** 합성 테스트 셀러 이메일 도메인(scripts/synthetic-users.config.ts의 EMAIL_DOMAIN과 같음) */
const SYNTHETIC_DOMAIN = "@synthetic.marketfit.test";
const UPCOMING_LIMIT = 5;

export interface ForecastItem {
  eventName: string;
  startDate: string;
  prediction: Prediction;
  /** 적자 확률(0~1). 참가비를 모르면 null */
  lossProbability: number | null;
  /** 손익분기 매출 = 고정비 ÷ (1 − 원가율) */
  breakEven: number | null;
  costNote: string | null;
}

export interface DashboardAnalytics {
  data: { records: number; stores: number; syntheticRecords: number };
  factors: FactorAnalysis;
  forecast:
    | { status: "ok"; validation: ForecastValidation; items: ForecastItem[] }
    | { status: "hidden"; reason: string };
  stock: { perishable: boolean; lossRate: number; category: string; items: StockDiagnosis[] };
  plan: PlanAccuracy;
  peer: PeerRank;
}

export type Admin = NonNullable<ReturnType<typeof createAdminClient>>;

/** PostgREST 한 번에 1000행 제한을 넘는 표를 끝까지 읽는다. */
async function readAll<T>(page: (from: number, to: number) => PromiseLike<{ data: T[] | null; error: { message: string } | null }>): Promise<T[]> {
  const out: T[] = [];
  for (let from = 0; ; from += 1000) {
    const { data, error } = await page(from, from + 999);
    if (error) throw new Error(error.message);
    out.push(...(data ?? []));
    if (!data || data.length < 1000) return out;
  }
}

export type Pooled = Awaited<ReturnType<typeof loadPooled>>;

export async function loadPooled(db: Admin) {
  const [participations, events, stores, profiles] = await Promise.all([
    readAll((a, b) => db.from("event_participations")
      .select("id, store_id, event_id, status, total_revenue, expected_revenue, fee, weather, indoor_outdoor, transport_cost, parking_cost, lodging_cost, other_cost")
      .order("id").range(a, b)),
    readAll((a, b) => db.from("events").select("id, name, category, start_date, end_date, event_recruitments(fee)").order("id").range(a, b)),
    readAll((a, b) => db.from("stores").select("id, category, owner_id").order("id").range(a, b)),
    readAll((a, b) => db.from("profiles").select("id, email").order("id").range(a, b)),
  ]);
  return { participations, events: events as unknown as EventRow[], stores, profiles };
}

interface EventRow {
  id: string;
  name: string;
  category: string | null;
  start_date: string | null;
  end_date: string | null;
  event_recruitments: { fee: number | null }[] | null;
}

// 여러 가게 기록으로 적합하는 모형(③·① 검증)은 모든 사용자에게 같으므로, 같은 데이터면 다시 계산하지 않는다.
let pooledMemo: { key: string; at: number; factors: FactorAnalysis; model: ReturnType<typeof fitForecastModel>; validation: ForecastValidation | null } | null = null;
const MEMO_MS = 10 * 60 * 1000;

function pooledModels(records: AttendedRecord[]) {
  const key = `${records.length}:${records.reduce((s, r) => s + r.revenue, 0)}:${records.map((r) => r.weather ?? "").join("").length}`;
  if (pooledMemo && pooledMemo.key === key && Date.now() - pooledMemo.at < MEMO_MS) return pooledMemo;
  pooledMemo = { key, at: Date.now(), factors: analyzeFactors(records), model: fitForecastModel(records), validation: validateForecast(records) };
  return pooledMemo;
}

/** pooled를 주면 다시 읽지 않는다(여러 가게를 한 번에 계산하는 스크립트용). */
export async function computeAnalytics(db: Admin, storeId: string, pooled?: Pooled): Promise<DashboardAnalytics> {
  const { participations, events, stores, profiles } = pooled ?? (await loadPooled(db));
  const eventById = new Map(events.map((e) => [e.id, e]));
  const storeById = new Map(stores.map((s) => [s.id, s]));
  const syntheticOwners = new Set(profiles.filter((p) => p.email?.endsWith(SYNTHETIC_DOMAIN)).map((p) => p.id));
  const myCategory = storeById.get(storeId)?.category ?? "";

  const records: AttendedRecord[] = [];
  for (const p of participations) {
    const e = eventById.get(p.event_id);
    if (p.status !== "attended" || p.total_revenue == null || !e?.start_date) continue;
    records.push({
      storeId: p.store_id, eventId: p.event_id, revenue: Number(p.total_revenue),
      startDate: e.start_date, endDate: e.end_date, group: getCategoryGroup(e.category, e.name),
      weather: p.weather, indoorOutdoor: p.indoor_outdoor,
    });
  }
  const pooled_ = pooledModels(records);
  const { model, validation } = pooled_;
  // 조건별 효과는 모든 셀러 기록으로 추정한 공통 경향이다. 가게마다 "내 기록에서는 어땠나"를 단순 평균으로 덧붙인다.
  const myRecords = records.filter((r) => r.storeId === storeId);
  const factors = pooled_.factors.status === "ok"
    ? { ...pooled_.factors, effects: pooled_.factors.effects.map((e) => ({ ...e, mine: ownComparison(myRecords, e) })) }
    : pooled_.factors;

  const mine = participations.filter((p) => p.store_id === storeId);
  const myAttended = mine.filter((p) => p.status === "attended" && p.total_revenue != null);

  // 원가율·평균 부대비용(내 기록)
  const attendedIds = mine.filter((p) => p.status === "attended").map((p) => p.id);
  const [{ data: sales, error: salesError }, { data: products, error: productError }] = await Promise.all([
    attendedIds.length
      ? db.from("event_product_sales").select("participation_id, product_id, product_name, prepared, sold, price").in("participation_id", attendedIds)
      : Promise.resolve({ data: [], error: null }),
    db.from("products").select("id, cost").eq("store_id", storeId),
  ]);
  if (salesError) throw new Error(salesError.message);
  if (productError) throw new Error(productError.message);
  const costOf = new Map((products ?? []).map((p) => [p.id, p.cost == null ? null : Number(p.cost)]));
  const saleRows = (sales ?? []).map((s) => ({ ...s, cost: s.product_id ? costOf.get(s.product_id) ?? null : null }));
  const costed = saleRows.filter((s) => s.cost != null && s.sold > 0);
  const soldValue = costed.reduce((a, s) => a + s.sold * Number(s.price), 0);
  const cogsRate = soldValue > 0 ? costed.reduce((a, s) => a + s.sold * s.cost!, 0) / soldValue : null;
  const extras = myAttended.map((p) => Number(p.transport_cost ?? 0) + Number(p.parking_cost ?? 0) + Number(p.lodging_cost ?? 0) + Number(p.other_cost ?? 0));
  const avgExtra = extras.length ? extras.reduce((a, b) => a + b, 0) / extras.length : 0;

  // ①② 다가올 행사
  const today = koreaDate(new Date());
  let forecast: DashboardAnalytics["forecast"];
  if ("insufficient" in model) forecast = { status: "hidden", reason: model.insufficient };
  else if (!validation) forecast = { status: "hidden", reason: "교차검증에 쓸 기록이 30건 미만" };
  else if (!validation.calibrated) {
    forecast = { status: "hidden", reason: `교차검증에서 80% 예측구간 적중률이 ${Math.round(validation.coverage * 100)}%로 80%와 유의하게 달라 표시하지 않음` };
  } else {
    const upcoming = mine
      .filter((p) => p.status !== "attended" && p.status !== "cancelled")
      .map((p) => ({ p, e: eventById.get(p.event_id) }))
      .filter(({ e }) => e?.start_date && e.start_date >= today)
      .sort((a, b) => a.e!.start_date!.localeCompare(b.e!.start_date!))
      .slice(0, UPCOMING_LIMIT);
    forecast = {
      status: "ok",
      validation,
      items: upcoming.map(({ p, e }) => {
        const prediction = predict(model, storeId, { startDate: e!.start_date!, endDate: e!.end_date, group: getCategoryGroup(e!.category, e!.name) }, validation.calibration);
        const fee = p.fee ?? e!.event_recruitments?.[0]?.fee ?? null;
        const fixed = fee == null ? null : Number(fee) + avgExtra;
        const rate = cogsRate ?? 0;
        return {
          eventName: e!.name,
          startDate: e!.start_date!,
          prediction,
          lossProbability: prediction.ok && fixed != null ? lossProbability(prediction, fixed, rate, validation.calibration) : null,
          breakEven: fixed != null ? fixed / (1 - rate) : null,
          costNote: fee == null ? "참가비 정보 없음" : cogsRate == null ? "상품 원가 미입력 — 재료비 제외 기준" : null,
        };
      }),
    };
  }

  // ⑤ 준비 수량
  const stock = {
    perishable: isPerishable(myCategory),
    lossRate: leftoverLoss(myCategory),
    category: myCategory,
    items: diagnoseStock(saleRows.map((s) => ({ productName: s.product_name, prepared: s.prepared, sold: s.sold, price: Number(s.price), cost: s.cost })), leftoverLoss(myCategory)),
  };


  // ⑦ 계획 정확도
  const plan = planAccuracy(myAttended.filter((p) => p.expected_revenue != null).map((p) => ({ expected: Number(p.expected_revenue), actual: Number(p.total_revenue) })));

  // ④ 동종 비교
  const revenuesByStore = new Map<string, number[]>();
  for (const r of records) revenuesByStore.set(r.storeId, [...(revenuesByStore.get(r.storeId) ?? []), r.revenue]);
  const peer = peerRank([...revenuesByStore].map(([id, revenues]) => ({ storeId: id, category: storeById.get(id)?.category ?? "", revenues })), storeId);

  return {
    data: {
      records: records.length,
      stores: revenuesByStore.size,
      syntheticRecords: records.filter((r) => syntheticOwners.has(storeById.get(r.storeId)?.owner_id ?? "")).length,
    },
    factors, forecast, stock, plan, peer,
  };
}

/** 내 기록에서 그 조건이 있었을 때와 비교 기준일 때의 평균 매출(양쪽 2번 이상일 때만). */
function ownComparison(mine: AttendedRecord[], e: FactorEffect): FactorEffect["mine"] {
  const [kind, level] = e.key.split(":");
  const side = (r: AttendedRecord): boolean | null => {
    if (kind === "weather") return r.weather === level ? true : r.weather === "맑음" ? false : null;
    if (kind === "outdoor") return r.indoorOutdoor === "실외" ? true : r.indoorOutdoor === "실내" ? false : null;
    if (kind === "weekend") return includesWeekend(r.startDate, r.endDate);
    if (kind === "group") return r.group === level ? true : r.group === e.reference ? false : null;
    return null;
  };
  const withR = mine.filter((r) => side(r) === true).map((r) => r.revenue);
  const withoutR = mine.filter((r) => side(r) === false).map((r) => r.revenue);
  if (withR.length < 2 || withoutR.length < 2) return null;
  const avg = (xs: number[]) => xs.reduce((a, b) => a + b, 0) / xs.length;
  return { withAvg: avg(withR), withN: withR.length, withoutAvg: avg(withoutR), withoutN: withoutR.length };
}
