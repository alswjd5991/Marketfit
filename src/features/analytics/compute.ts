// 대시보드 분석 계산 — 서버·스크립트 전용(Next 요청 컨텍스트에 의존하지 않음).
//
// ①③④는 여러 가게의 기록을 함께 써야 해서 service_role로 전체 참가 기록을 읽는다(RLS상 사용자는
// 자기 기록만 읽을 수 있음). 다른 가게의 원본 기록은 이 파일 밖으로 나가지 않고, 화면에는
// 회귀계수·예측값·순위 같은 요약값만 전달된다. 클라이언트 컴포넌트에서 import 금지.

import type { createAdminClient } from "@/lib/supabase/admin";
import { getCategoryGroup } from "@/features/events/category-group";
import { koreaDate } from "@/features/ai/event-search";
import { analyzeFactors, type FactorAnalysis } from "./factors";
import { fitForecastModel, lossProbability, predict, probabilityBelow, validateForecast, type ForecastValidation, type Prediction } from "./forecast";
import { peerRank, type PeerRank } from "./peer";
import { planAccuracy, type PlanAccuracy } from "./plan";
import type { AttendedRecord } from "./records";
import { diagnoseStock, isPerishable, leftoverLoss, type StockDiagnosis } from "./stock";

/** 합성 테스트 셀러 이메일 도메인(scripts/synthetic-users.config.ts의 EMAIL_DOMAIN과 같음) */
const SYNTHETIC_DOMAIN = "@synthetic.marketfit.test";
const UPCOMING_LIMIT = 5;
const RECOMMEND_LIMIT = 5;
const RECOMMEND_DAYS = 90;

export interface ForecastItem {
  eventName: string;
  startDate: string;
  group: string;
  region: string | null;
  prediction: Prediction;
  /** 적합도(0~100) = 이 행사에서 내 평소 매출(지난 행사 매출의 중앙값)보다 더 팔 확률 × 100 */
  score: number | null;
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
    | {
        status: "ok"; validation: ForecastValidation;
        /** 내 평소 매출(지난 행사 매출 중앙값) — 적합도 기준 */
        myMedian: number;
        /** 내가 관심·참가 예정으로 담은 다가올 행사 */
        items: ForecastItem[];
        /** 아직 담지 않은 다가올 행사 중 적합도가 높은 행사(활동 지역이 있으면 그 지역만) */
        recommended: ForecastItem[];
        region: string | null;
      }
    | { status: "hidden"; reason: string };
  /** 상품 포트폴리오: 상품별 판매율·매출 비중(내 기록) */
  portfolio: PortfolioItem[];
  stock: { perishable: boolean; lossRate: number; category: string; items: StockDiagnosis[] };
  plan: PlanAccuracy;
  peer: PeerRank;
}

export interface PortfolioItem {
  productName: string;
  revenue: number;
  /** 준비한 만큼 다 팔았을 때의 매출(준비 수 × 가격 합) */
  potential: number;
  share: number; // 상품 매출 비중
  sellThrough: number; // 판매 수 ÷ 준비 수
  events: number;
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
    readAll((a, b) => db.from("events").select("id, name, category, region, start_date, end_date, event_recruitments(fee)").order("id").range(a, b)),
    readAll((a, b) => db.from("stores").select("id, category, owner_id, active_region").order("id").range(a, b)),
    readAll((a, b) => db.from("profiles").select("id, email").order("id").range(a, b)),
  ]);
  return { participations, events: events as unknown as EventRow[], stores, profiles };
}

interface EventRow {
  id: string;
  name: string;
  category: string | null;
  region: string | null;
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
  const { factors, model, validation } = pooledModels(records);
  const myRevenues = records.filter((r) => r.storeId === storeId).map((r) => r.revenue).sort((a, b) => a - b);

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
    const myMedian = myRevenues[Math.floor(myRevenues.length / 2)] ?? 0;
    const rate = cogsRate ?? 0;
    const evaluate = (e: EventRow, fee: number | null): ForecastItem => {
      const group = getCategoryGroup(e.category, e.name);
      const prediction = predict(model, storeId, { startDate: e.start_date!, endDate: e.end_date, group }, validation.calibration);
      const fixed = fee == null ? null : Number(fee) + avgExtra;
      return {
        eventName: e.name, startDate: e.start_date!, group, region: e.region, prediction,
        score: prediction.ok && myMedian > 0 ? Math.round(100 * (1 - probabilityBelow(prediction, myMedian, validation.calibration))) : null,
        lossProbability: prediction.ok && fixed != null ? lossProbability(prediction, fixed, rate, validation.calibration) : null,
        breakEven: fixed != null ? fixed / (1 - rate) : null,
        costNote: fee == null ? "참가비 정보 없음" : cogsRate == null ? "상품 원가 미입력 — 재료비 제외 기준" : null,
      };
    };
    const myEventIds = new Set(mine.map((p) => p.event_id));
    const items = mine
      .filter((p) => p.status !== "attended" && p.status !== "cancelled")
      .map((p) => ({ p, e: eventById.get(p.event_id) }))
      .filter(({ e }) => e?.start_date && e.start_date >= today)
      .sort((a, b) => a.e!.start_date!.localeCompare(b.e!.start_date!))
      .slice(0, UPCOMING_LIMIT)
      .map(({ p, e }) => evaluate(e!, p.fee ?? e!.event_recruitments?.[0]?.fee ?? null));
    // 추천: 아직 담지 않은, 앞으로 90일 안에 열리는 행사(활동 지역이 있으면 그 지역) 중 적합도 높은 순
    const region = storeById.get(storeId)?.active_region ?? null;
    const horizon = new Date(Date.parse(`${today}T00:00:00Z`) + RECOMMEND_DAYS * 86_400_000).toISOString().slice(0, 10);
    const recommended = events
      .filter((e) => e.start_date && e.start_date >= today && e.start_date <= horizon && !myEventIds.has(e.id) && (!region || e.region === region))
      .map((e) => evaluate(e, e.event_recruitments?.[0]?.fee ?? null))
      .filter((it) => it.score != null)
      .sort((a, b) => b.score! - a.score! || a.startDate.localeCompare(b.startDate))
      .slice(0, RECOMMEND_LIMIT);
    forecast = { status: "ok", validation, myMedian, items, recommended, region };
  }

  // ⑤ 준비 수량
  const stock = {
    perishable: isPerishable(myCategory),
    lossRate: leftoverLoss(myCategory),
    category: myCategory,
    items: diagnoseStock(saleRows.map((s) => ({ productName: s.product_name, prepared: s.prepared, sold: s.sold, price: Number(s.price), cost: s.cost })), leftoverLoss(myCategory)),
  };


  // 상품 포트폴리오(내 기록): 상품별 매출 비중과 판매율
  const byProduct = new Map<string, { revenue: number; potential: number; sold: number; prepared: number; events: number }>();
  for (const r of saleRows) {
    const p = byProduct.get(r.product_name) ?? { revenue: 0, potential: 0, sold: 0, prepared: 0, events: 0 };
    p.revenue += r.sold * Number(r.price);
    p.potential += r.prepared * Number(r.price);
    p.sold += Math.min(r.sold, r.prepared);
    p.prepared += r.prepared;
    p.events += 1;
    byProduct.set(r.product_name, p);
  }
  const productRevenue = [...byProduct.values()].reduce((a, p) => a + p.revenue, 0);
  const portfolio: PortfolioItem[] = productRevenue > 0
    ? [...byProduct].filter(([, p]) => p.prepared > 0).map(([productName, p]) => ({
        productName, revenue: p.revenue, potential: Math.max(p.potential, p.revenue), share: p.revenue / productRevenue, sellThrough: p.sold / p.prepared, events: p.events,
      })).sort((a, b) => b.revenue - a.revenue)
    : [];

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
    factors, forecast, portfolio, stock, plan, peer,
  };
}
