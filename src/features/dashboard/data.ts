import { createClient } from "@/lib/supabase/server";
import type { ParticipationStatus } from "@/types/database";
import { getMyStore } from "@/features/store/data";

export interface DashboardStats {
  totalParticipations: number;
  statusCounts: Record<ParticipationStatus, number>;
  /** 카운트가 1건이라도 있는 카테고리만 담는다(존재하지 않는 카테고리를 0으로 채워 넣지 않음). */
  categoryCounts: Record<string, number>;
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
}

export interface PopularProduct {
  productName: string;
  totalSold: number;
  totalRevenue: number;
}

export const POPULAR_PRODUCTS_LIMIT = 8;

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
      .select("id, status, total_revenue, net_profit, satisfaction, event_id")
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

    for (const p of participations) {
      statusCounts[p.status]++;
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

    const categoryCounts: Record<string, number> = {};
    const monthCounts = new Map<string, number>();
    const eventRevenueTrend: EventTrendPoint[] = [];

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

        const category = event?.category ?? "기타";
        categoryCounts[category] = (categoryCounts[category] ?? 0) + 1;

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

    const popularProducts = await getPopularProducts(
      supabase,
      participations.map((p) => p.id)
    );

    return {
      totalParticipations: participations.length,
      statusCounts,
      categoryCounts,
      totalRevenue: revenueEntryCount > 0 ? totalRevenue : null,
      revenueEntryCount,
      totalNetProfit: netProfitEntryCount > 0 ? totalNetProfit : null,
      netProfitEntryCount,
      averageSatisfaction: satisfactionEntryCount > 0 ? satisfactionSum / satisfactionEntryCount : null,
      satisfactionEntryCount,
      monthlyParticipationCounts,
      eventRevenueTrend,
      popularProducts,
    };
  } catch {
    return null; // 62번 항목: 네트워크 오류로 페이지 전체가 죽지 않도록
  }
}

/**
 * 이 가게의 모든 참가 건에 기록된 event_product_sales를 상품명으로 합산해
 * 매출 높은 순 상위 N개를 돌려준다. 참가 건이 없으면 빈 배열(0건을 지어내지 않음).
 */
async function getPopularProducts(
  supabase: Awaited<ReturnType<typeof createClient>>,
  participationIds: string[]
): Promise<PopularProduct[]> {
  if (participationIds.length === 0) return [];

  const { data: sales, error } = await supabase
    .from("event_product_sales")
    .select("product_name, sold, revenue")
    .in("participation_id", participationIds);
  if (error) throw error;

  const byName = new Map<string, { totalSold: number; totalRevenue: number }>();
  for (const s of sales ?? []) {
    const entry = byName.get(s.product_name) ?? { totalSold: 0, totalRevenue: 0 };
    entry.totalSold += s.sold;
    entry.totalRevenue += s.revenue;
    byName.set(s.product_name, entry);
  }

  return Array.from(byName.entries())
    .map(([productName, agg]) => ({ productName, ...agg }))
    .sort((a, b) => b.totalRevenue - a.totalRevenue)
    .slice(0, POPULAR_PRODUCTS_LIMIT);
}

/** "2026-09" -> "2026년 9월" */
function formatMonthLabel(monthKey: string): string {
  const [year, month] = monthKey.split("-");
  const monthNum = Number(month);
  if (!year || !Number.isFinite(monthNum)) return monthKey;
  return `${year}년 ${monthNum}월`;
}
