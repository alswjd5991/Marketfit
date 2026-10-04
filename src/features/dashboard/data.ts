import { createClient } from "@/lib/supabase/server";
import type { ParticipationStatus } from "@/types/database";
import { getMyStore } from "@/features/store/data";
import { getCategoryGroup, type CategoryGroup } from "@/features/events/category-group";

type Supabase = Awaited<ReturnType<typeof createClient>>;

export interface DashboardStats {
  totalParticipations: number;
  statusCounts: Record<ParticipationStatus, number>;
  /** total_revenue를 입력한 기록이 하나도 없으면 null(0원으로 지어내지 않음). */
  totalRevenue: number | null;
  revenueEntryCount: number;
  totalNetProfit: number | null;
  netProfitEntryCount: number;
  averageSatisfaction: number | null;
  satisfactionEntryCount: number;
  /** 최근 N회 평균 매출과 그 이전 평균 — 매출 기록이 6건 이상일 때만. */
  revenueTrend: { recentAvg: number; earlierAvg: number; recentCount: number } | null;
  /** 행사 시작월 기준 참가 건수(오래된 달 -> 최근 달, 빈 달은 0으로 채움). */
  monthlyParticipationCounts: MonthlyCount[];
  /** 매출을 입력한 참가 기록만, 행사 시작일 순. */
  eventRevenueTrend: EventTrendPoint[];
  /** 행사 유형(대분류)별 참가 수와 평균 순이익. 참가 수 많은 순. */
  groupPerformance: GroupPerformance[];
  /** 날씨·실내외별 평균 매출. 기록이 2개 그룹 이상일 때만 채움. */
  weatherPerformance: ConditionPerformance[];
  venuePerformance: ConditionPerformance[];
  /** 상품별 판매 실적(참가 완료 행사)을 매출 높은 순으로. */
  popularProducts: PopularProduct[];
  /** 대시보드 맨 위 "종합 인사이트" 문장들. **굵게** 표시를 쓴다. */
  insights: string[];
}

export interface PopularProduct {
  productName: string;
  totalSold: number;
  totalPrepared: number;
  totalRevenue: number;
  /** 판매/준비. 준비 수량이 0이면 null. */
  sellThrough: number | null;
}

export interface MonthlyCount {
  monthKey: string; // "2026-09"
  count: number;
}

export interface EventTrendPoint {
  eventName: string;
  startDate: string;
  revenue: number;
  netProfit: number | null;
}

export interface GroupPerformance {
  group: CategoryGroup;
  count: number;
  avgNetProfit: number | null;
  profitCount: number;
}

export interface ConditionPerformance {
  label: string;
  avgRevenue: number;
  count: number;
}

export const POPULAR_PRODUCTS_LIMIT = 8;

const EMPTY_STATUS_COUNTS: Record<ParticipationStatus, number> = {
  interested: 0,
  planning_to_apply: 0,
  applied: 0,
  planning_to_attend: 0,
  attended: 0,
  cancelled: 0,
};

/**
 * 대시보드 통계. 실제 event_participations 기록만 집계한다 — 65번 원칙(실제
 * 데이터 또는 명확히 구분된 샘플 데이터만) 그대로: 기록이 없는 지표는 0이
 * 아니라 null로 돌려주고, 화면에서 "아직 기록 없음"으로 표시한다.
 */
export async function getDashboardStats(): Promise<DashboardStats | null> {
  const store = await getMyStore();
  if (!store) return null;
  try {
    return await computeDashboardStats(await createClient(), store.id);
  } catch {
    return null; // 62번 항목: 네트워크 오류로 페이지 전체가 죽지 않도록
  }
}

export async function computeDashboardStats(supabase: Supabase, storeId: string): Promise<DashboardStats> {
  const { data: rows, error } = await supabase
    .from("event_participations")
    .select("id, status, total_revenue, net_profit, satisfaction, weather, indoor_outdoor, event_id")
    .eq("store_id", storeId);
  if (error) throw error;
  const eventIds = (rows ?? []).map((p) => p.event_id);
  const { data: events, error: eventsError } = eventIds.length
    ? await supabase.from("events").select("id, name, category, start_date").in("id", eventIds)
    : { data: [], error: null };
  if (eventsError) throw eventsError;
  const eventById = new Map((events ?? []).map((e) => [e.id, e]));
  const participations = (rows ?? []).map((p) => ({ ...p, event: eventById.get(p.event_id) ?? null }));

  const statusCounts = { ...EMPTY_STATUS_COUNTS };
  for (const p of participations) statusCounts[p.status]++;
  const sum = (xs: number[]) => xs.reduce((a, b) => a + b, 0);
  const avg = (xs: number[]) => (xs.length ? sum(xs) / xs.length : null);

  const revenues = participations.filter((p) => p.total_revenue != null);
  const profits = participations.filter((p) => p.net_profit != null).map((p) => p.net_profit!);
  const satisfactions = participations.filter((p) => p.satisfaction != null).map((p) => p.satisfaction!);

  const monthCounts = new Map<string, number>();
  const eventRevenueTrend: EventTrendPoint[] = [];
  const groups = new Map<CategoryGroup, { count: number; profits: number[] }>();
  for (const p of participations) {
    const e = p.event;
    if (!e) continue;
    const group = getCategoryGroup(e.category, e.name);
    const g = groups.get(group) ?? { count: 0, profits: [] };
    g.count++;
    if (p.net_profit != null) g.profits.push(p.net_profit);
    groups.set(group, g);
    if (!e.start_date) continue;
    const monthKey = e.start_date.slice(0, 7);
    monthCounts.set(monthKey, (monthCounts.get(monthKey) ?? 0) + 1);
    if (p.total_revenue != null) {
      eventRevenueTrend.push({ eventName: e.name, startDate: e.start_date, revenue: p.total_revenue, netProfit: p.net_profit });
    }
  }
  eventRevenueTrend.sort((a, b) => a.startDate.localeCompare(b.startDate));

  const groupPerformance = [...groups]
    .map(([group, g]) => ({ group, count: g.count, avgNetProfit: avg(g.profits), profitCount: g.profits.length }))
    .sort((a, b) => b.count - a.count);

  const recentCount = Math.min(5, Math.floor(eventRevenueTrend.length / 2));
  const revenueTrend =
    eventRevenueTrend.length >= 6
      ? {
          recentAvg: avg(eventRevenueTrend.slice(-recentCount).map((e) => e.revenue))!,
          earlierAvg: avg(eventRevenueTrend.slice(0, -recentCount).map((e) => e.revenue))!,
          recentCount,
        }
      : null;

  const popularProducts = await getPopularProducts(
    supabase,
    participations.filter((p) => p.status === "attended").map((p) => p.id)
  );

  const stats: DashboardStats = {
    totalParticipations: participations.length,
    statusCounts,
    totalRevenue: revenues.length ? sum(revenues.map((p) => p.total_revenue!)) : null,
    revenueEntryCount: revenues.length,
    totalNetProfit: profits.length ? sum(profits) : null,
    netProfitEntryCount: profits.length,
    averageSatisfaction: avg(satisfactions),
    satisfactionEntryCount: satisfactions.length,
    revenueTrend,
    monthlyParticipationCounts: fillMonths(monthCounts),
    eventRevenueTrend,
    groupPerformance,
    weatherPerformance: conditionPerformance(revenues, (p) => p.weather, ["맑음", "흐림", "비", "눈"]),
    venuePerformance: conditionPerformance(revenues, (p) => p.indoor_outdoor, ["실내", "실외"]),
    popularProducts,
    insights: [],
  };
  stats.insights = buildInsights(stats, participations);
  return stats;
}

function conditionPerformance<T extends { total_revenue: number | null }>(
  rows: T[],
  key: (r: T) => string | null,
  order: string[]
): ConditionPerformance[] {
  const by = new Map<string, number[]>();
  for (const r of rows) {
    const k = key(r)?.trim();
    if (k) by.set(k, [...(by.get(k) ?? []), r.total_revenue!]);
  }
  if (by.size < 2) return [];
  const rank = (k: string) => (order.includes(k) ? order.indexOf(k) : order.length);
  return [...by]
    .sort(([a], [b]) => rank(a) - rank(b))
    .map(([label, xs]) => ({ label, count: xs.length, avgRevenue: xs.reduce((a, b) => a + b, 0) / xs.length }));
}

/** 첫 달부터 마지막 달까지 빈 달을 0으로 채운다 — 막대 간격이 실제 시간 간격과 같아지게. */
function fillMonths(counts: Map<string, number>): MonthlyCount[] {
  const keys = [...counts.keys()].sort();
  if (!keys.length) return [];
  const out: MonthlyCount[] = [];
  let [y, m] = keys[0].split("-").map(Number);
  const last = keys.at(-1)!;
  for (;;) {
    const monthKey = `${y}-${String(m).padStart(2, "0")}`;
    out.push({ monthKey, count: counts.get(monthKey) ?? 0 });
    if (monthKey >= last) break;
    if (++m > 12) [y, m] = [y + 1, 1];
  }
  return out;
}

const won = (n: number) => `${Math.round(n).toLocaleString("ko-KR")}원`;
const pct = (n: number) => `${Math.round(n * 100)}%`;

/** 숫자는 모두 위에서 계산된 값만 쓴다. 근거가 부족한 문장은 만들지 않는다. */
function buildInsights(
  s: DashboardStats,
  participations: { status: ParticipationStatus; event: { name: string; start_date: string | null } | null }[]
): string[] {
  const out: string[] = [];
  if (s.totalNetProfit != null) {
    out.push(
      `참가 완료 **${s.statusCounts.attended}회**, 누적 순이익 **${won(s.totalNetProfit)}** (행사당 평균 ${won(s.totalNetProfit / s.netProfitEntryCount)})`
    );
  }
  if (s.revenueTrend) {
    const { recentAvg, earlierAvg, recentCount } = s.revenueTrend;
    const diff = (recentAvg - earlierAvg) / earlierAvg;
    if (Math.abs(diff) >= 0.05) {
      out.push(`최근 ${recentCount}회 평균 매출 ${won(recentAvg)} — 이전보다 **${pct(Math.abs(diff))} ${diff > 0 ? "증가" : "감소"}**`);
    } else {
      out.push(`최근 ${recentCount}회 평균 매출 ${won(recentAvg)} — 이전과 비슷한 수준`);
    }
  }
  const groups = s.groupPerformance.filter((g) => g.profitCount >= 2 && g.avgNetProfit != null);
  if (groups.length >= 2) {
    const best = [...groups].sort((a, b) => b.avgNetProfit! - a.avgNetProfit!)[0];
    out.push(`평균 순이익이 가장 높은 유형은 **${best.group}** (${won(best.avgNetProfit!)}, ${best.profitCount}회)`);
  }
  const sunny = s.weatherPerformance.find((w) => w.label === "맑음");
  const rainy = s.weatherPerformance.find((w) => w.label === "비");
  if (sunny && rainy && sunny.count >= 2 && rainy.avgRevenue < sunny.avgRevenue) {
    out.push(`비 오는 날 평균 매출은 맑은 날보다 **${pct(1 - rainy.avgRevenue / sunny.avgRevenue)} 낮음** (${rainy.count}회)`);
  }
  const productTotal = s.popularProducts.reduce((a, p) => a + p.totalRevenue, 0);
  const top = s.popularProducts[0];
  if (top && productTotal > 0 && s.popularProducts.length >= 2) {
    out.push(`매출 1위 상품 **${top.productName}** — 상품 매출의 ${pct(top.totalRevenue / productTotal)}`);
  }
  const rated = s.popularProducts.filter((p) => p.sellThrough != null && p.totalPrepared >= 20);
  if (rated.length >= 2) {
    const low = [...rated].sort((a, b) => a.sellThrough! - b.sellThrough!)[0];
    if (low.sellThrough! < 0.6) out.push(`**${low.productName}** 판매율 ${pct(low.sellThrough!)} — 준비 수량 조절 필요`);
  }
  const today = new Intl.DateTimeFormat("sv-SE", { timeZone: "Asia/Seoul" }).format(new Date());
  const next = participations
    .filter((p) => p.status === "planning_to_attend" && p.event?.start_date && p.event.start_date >= today)
    .sort((a, b) => a.event!.start_date!.localeCompare(b.event!.start_date!))[0];
  if (next) {
    const [, m, d] = next.event!.start_date!.split("-").map(Number);
    out.push(`다음 참가 예정: **${next.event!.name}** (${m}월 ${d}일)`);
  }
  return out;
}

/** 참가 완료 건의 event_product_sales를 상품명으로 합산해 매출 높은 순 상위 N개. */
async function getPopularProducts(supabase: Supabase, participationIds: string[]): Promise<PopularProduct[]> {
  if (participationIds.length === 0) return [];

  const { data: sales, error } = await supabase
    .from("event_product_sales")
    .select("product_name, prepared, sold, revenue")
    .in("participation_id", participationIds);
  if (error) throw error;

  const byName = new Map<string, { totalSold: number; totalPrepared: number; totalRevenue: number }>();
  for (const s of sales ?? []) {
    const entry = byName.get(s.product_name) ?? { totalSold: 0, totalPrepared: 0, totalRevenue: 0 };
    entry.totalSold += s.sold;
    entry.totalPrepared += s.prepared;
    entry.totalRevenue += s.revenue;
    byName.set(s.product_name, entry);
  }

  return Array.from(byName.entries())
    .map(([productName, agg]) => ({ productName, ...agg, sellThrough: agg.totalPrepared > 0 ? agg.totalSold / agg.totalPrepared : null }))
    .sort((a, b) => b.totalRevenue - a.totalRevenue)
    .slice(0, POPULAR_PRODUCTS_LIMIT);
}
