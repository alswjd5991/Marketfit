import { createClient } from "@/lib/supabase/server";
import type { ParticipationStatus } from "@/types/database";
import { getMyStore } from "@/features/store/data";
import { getCategoryGroup, type CategoryGroup } from "@/features/events/category-group";

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
  /** 행사 시작월 기준 참가 건수 추이(오래된 달 -> 최근 달). start_date가 없는 행사는 제외. */
  monthlyParticipationCounts: MonthlyCount[];
  /** 매출을 입력한 참가 기록만, 행사 시작일 순으로 정렬한 매출·순이익 추이. */
  eventRevenueTrend: EventTrendPoint[];
  /** 상품별 판매 실적(event_product_sales)을 상품명으로 합산해 매출 높은 순 정렬, 상위 N개. */
  popularProducts: PopularProduct[];
  /** 판매 수량 상위 품목들의 행사별 판매 수량(행사 시작일 순). 판매 기록이 없으면 빈 값. */
  productSalesByEvent: ProductSalesByEvent;
  /** 순이익을 입력한 행사 1건당 평균 순이익 */
  averageNetProfit: number | null;
  /** 순이익 ÷ (참가비 + 교통·주차·숙박·기타 비용). 비용을 기록한 건만 */
  returnOnCost: { percent: number; totalCost: number; entryCount: number } | null;
  /** 총 매출 ÷ 목표 매출. 둘 다 입력한 건만 */
  targetAchievement: { percent: number; entryCount: number } | null;
  /** "다시 참가하고 싶다"에 답한 건 중 '예' 비율 */
  reattend: { yes: number; answered: number } | null;
  /** 오늘 이후 가장 가까운 참가 예정·신청 완료 행사 */
  nextEvent: { eventName: string; startDate: string; status: ParticipationStatus } | null;
  /** 대분류별 평균 순이익(높은 순). 순이익을 입력한 건만 */
  categoryProfit: { group: CategoryGroup; averageNetProfit: number; entryCount: number }[];
}

export interface PopularProduct {
  productName: string;
  totalSold: number;
  totalRevenue: number;
}

export interface ProductSalesByEvent {
  /** x축: 판매 기록이 있는 행사들(시작일 순) */
  events: { eventName: string; startDate: string | null }[];
  /** 품목별 곡선: values[i]는 events[i]에서 판매한 수량(기록 없으면 0) */
  series: { productName: string; values: number[] }[];
}

export const POPULAR_PRODUCTS_LIMIT = 8;
// 한 그래프에 겹쳐 그릴 품목 곡선 수 — 너무 많으면 겹쳐서 읽기 어렵다.
const SALES_TREND_SERIES_LIMIT = 5;

export interface MonthlyCount {
  monthKey: string; // "2026-09"
  monthLabel: string; // "2026년 9월"
  count: number;
}

export interface EventTrendPoint {
  eventName: string;
  startDate: string;
  revenue: number;
  netProfit: number | null;
}

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

  const supabase = await createClient();
  try {
    const { data: rows, error } = await supabase
      .from("event_participations")
      .select(
        "id, status, total_revenue, net_profit, satisfaction, event_id, fee, target_revenue, transport_cost, parking_cost, lodging_cost, other_cost, would_reattend"
      )
      .eq("store_id", store.id);
    if (error) throw error;
    const participations = rows ?? [];

    const statusCounts = { ...EMPTY_STATUS_COUNTS };
    let totalRevenue = 0;
    let revenueEntryCount = 0;
    let totalNetProfit = 0;
    let netProfitEntryCount = 0;
    let satisfactionSum = 0;
    let satisfactionEntryCount = 0;
    let costNetSum = 0; // 비용을 기록한 건들의 순이익 합
    let costSum = 0;
    let costEntryCount = 0;
    let achievedRevenueSum = 0;
    let targetRevenueSum = 0;
    let targetEntryCount = 0;
    let reattendYes = 0;
    let reattendAnswered = 0;

    for (const p of participations) {
      statusCounts[p.status]++;

      const cost = (p.fee ?? 0) + p.transport_cost + p.parking_cost + p.lodging_cost + p.other_cost;
      if (p.net_profit != null && cost > 0) {
        costNetSum += p.net_profit;
        costSum += cost;
        costEntryCount++;
      }
      if (p.total_revenue != null && p.target_revenue != null && p.target_revenue > 0) {
        achievedRevenueSum += p.total_revenue;
        targetRevenueSum += p.target_revenue;
        targetEntryCount++;
      }
      if (p.would_reattend != null) {
        reattendAnswered++;
        if (p.would_reattend) reattendYes++;
      }
      if (p.total_revenue != null) {
        totalRevenue += p.total_revenue;
        revenueEntryCount++;
      }
      if (p.net_profit != null) {
        totalNetProfit += p.net_profit;
        netProfitEntryCount++;
      }
      if (p.satisfaction != null) {
        satisfactionSum += p.satisfaction;
        satisfactionEntryCount++;
      }
    }

    const monthCounts = new Map<string, number>();
    const eventRevenueTrend: EventTrendPoint[] = [];
    const eventOfParticipation = new Map<string, { eventName: string; startDate: string | null }>();
    const profitByGroup = new Map<CategoryGroup, { sum: number; count: number }>();
    let nextEvent: DashboardStats["nextEvent"] = null;
    const todayKey = new Date().toLocaleDateString("sv-SE", { timeZone: "Asia/Seoul" }); // "YYYY-MM-DD"

    const eventIds = participations.map((p) => p.event_id);
    if (eventIds.length > 0) {
      const { data: events, error: eventsError } = await supabase
        .from("events")
        .select("id, name, category, start_date")
        .in("id", eventIds);
      if (eventsError) throw eventsError;
      const eventById = new Map((events ?? []).map((e) => [e.id, e]));

      for (const p of participations) {
        const event = eventById.get(p.event_id);
        if (event) {
          eventOfParticipation.set(p.id, { eventName: event.name, startDate: event.start_date });
        }

        if (event && p.net_profit != null) {
          const group = getCategoryGroup(event.category, event.name);
          const entry = profitByGroup.get(group) ?? { sum: 0, count: 0 };
          entry.sum += p.net_profit;
          entry.count++;
          profitByGroup.set(group, entry);
        }

        if (
          event?.start_date &&
          event.start_date >= todayKey &&
          (p.status === "planning_to_attend" || p.status === "applied") &&
          (!nextEvent || event.start_date < nextEvent.startDate)
        ) {
          nextEvent = { eventName: event.name, startDate: event.start_date, status: p.status };
        }

        if (event?.start_date) {
          const monthKey = event.start_date.slice(0, 7); // "YYYY-MM"
          monthCounts.set(monthKey, (monthCounts.get(monthKey) ?? 0) + 1);

          if (p.total_revenue != null) {
            eventRevenueTrend.push({
              eventName: event.name,
              startDate: event.start_date,
              revenue: p.total_revenue,
              netProfit: p.net_profit,
            });
          }
        }
      }
    }

    const monthlyParticipationCounts: MonthlyCount[] = Array.from(monthCounts.entries())
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([monthKey, count]) => ({ monthKey, monthLabel: formatMonthLabel(monthKey), count }));

    eventRevenueTrend.sort((a, b) => a.startDate.localeCompare(b.startDate));

    const { popularProducts, productSalesByEvent } = await getProductSalesStats(
      supabase,
      participations.map((p) => p.id),
      eventOfParticipation
    );

    return {
      totalParticipations: participations.length,
      statusCounts,
      totalRevenue: revenueEntryCount > 0 ? totalRevenue : null,
      revenueEntryCount,
      totalNetProfit: netProfitEntryCount > 0 ? totalNetProfit : null,
      netProfitEntryCount,
      averageSatisfaction: satisfactionEntryCount > 0 ? satisfactionSum / satisfactionEntryCount : null,
      satisfactionEntryCount,
      monthlyParticipationCounts,
      eventRevenueTrend,
      popularProducts,
      productSalesByEvent,
      averageNetProfit: netProfitEntryCount > 0 ? totalNetProfit / netProfitEntryCount : null,
      returnOnCost:
        costEntryCount > 0
          ? { percent: (costNetSum / costSum) * 100, totalCost: costSum, entryCount: costEntryCount }
          : null,
      targetAchievement:
        targetEntryCount > 0
          ? { percent: (achievedRevenueSum / targetRevenueSum) * 100, entryCount: targetEntryCount }
          : null,
      reattend: reattendAnswered > 0 ? { yes: reattendYes, answered: reattendAnswered } : null,
      nextEvent,
      categoryProfit: Array.from(profitByGroup.entries())
        .map(([group, { sum, count }]) => ({ group, averageNetProfit: sum / count, entryCount: count }))
        .sort((a, b) => b.averageNetProfit - a.averageNetProfit),
    };
  } catch {
    return null; // 62번 항목: 네트워크 오류로 페이지 전체가 죽지 않도록
  }
}

/**
 * 이 가게의 모든 참가 건에 기록된 event_product_sales로 두 가지를 만든다.
 * - popularProducts: 상품명으로 합산해 매출 높은 순 상위 N개
 * - productSalesByEvent: 판매 수량 상위 품목들의 행사별 판매 수량(행사 시작일 순)
 * 참가 건이나 판매 기록이 없으면 빈 값(0건을 지어내지 않음).
 */
async function getProductSalesStats(
  supabase: Awaited<ReturnType<typeof createClient>>,
  participationIds: string[],
  eventOfParticipation: Map<string, { eventName: string; startDate: string | null }>
): Promise<{ popularProducts: PopularProduct[]; productSalesByEvent: ProductSalesByEvent }> {
  const empty = { popularProducts: [], productSalesByEvent: { events: [], series: [] } };
  if (participationIds.length === 0) return empty;

  const { data: sales, error } = await supabase
    .from("event_product_sales")
    .select("participation_id, product_name, sold, revenue")
    .in("participation_id", participationIds);
  if (error) throw error;

  const byName = new Map<string, { totalSold: number; totalRevenue: number }>();
  // 참가 건 -> (품목명 -> 판매 수량)
  const soldByParticipation = new Map<string, Map<string, number>>();

  for (const s of sales ?? []) {
    const entry = byName.get(s.product_name) ?? { totalSold: 0, totalRevenue: 0 };
    entry.totalSold += s.sold;
    entry.totalRevenue += s.revenue;
    byName.set(s.product_name, entry);

    const perProduct = soldByParticipation.get(s.participation_id) ?? new Map<string, number>();
    perProduct.set(s.product_name, (perProduct.get(s.product_name) ?? 0) + s.sold);
    soldByParticipation.set(s.participation_id, perProduct);
  }

  const totals = Array.from(byName.entries()).map(([productName, agg]) => ({ productName, ...agg }));

  const popularProducts = [...totals]
    .sort((a, b) => b.totalRevenue - a.totalRevenue)
    .slice(0, POPULAR_PRODUCTS_LIMIT);

  const trendProducts = [...totals]
    .sort((a, b) => b.totalSold - a.totalSold)
    .slice(0, SALES_TREND_SERIES_LIMIT)
    .map((p) => p.productName);

  const eventRows = Array.from(soldByParticipation.entries())
    .map(([participationId, perProduct]) => ({
      event: eventOfParticipation.get(participationId) ?? { eventName: "이름 없는 행사", startDate: null },
      perProduct,
    }))
    .sort((a, b) => (a.event.startDate ?? "").localeCompare(b.event.startDate ?? ""));

  return {
    popularProducts,
    productSalesByEvent: {
      events: eventRows.map((r) => r.event),
      series: trendProducts.map((productName) => ({
        productName,
        values: eventRows.map((r) => r.perProduct.get(productName) ?? 0),
      })),
    },
  };
}

/** "2026-09" -> "2026년 9월" */
function formatMonthLabel(monthKey: string): string {
  const [year, month] = monthKey.split("-");
  const monthNum = Number(month);
  if (!year || !Number.isFinite(monthNum)) return monthKey;
  return `${year}년 ${monthNum}월`;
}
