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
      .select("status, total_revenue, net_profit, satisfaction, event_id")
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
    const eventIds = participations.map((p) => p.event_id);
    if (eventIds.length > 0) {
      const { data: events, error: eventsError } = await supabase
        .from("events")
        .select("id, category")
        .in("id", eventIds);
      if (eventsError) throw eventsError;
      const categoryByEvent = new Map((events ?? []).map((e) => [e.id, e.category]));
      for (const p of participations) {
        const category = categoryByEvent.get(p.event_id) ?? "기타";
        const key = category ?? "기타";
        categoryCounts[key] = (categoryCounts[key] ?? 0) + 1;
      }
    }

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
    };
  } catch {
    return null; // 62번 항목: 네트워크 오류로 페이지 전체가 죽지 않도록
  }
}
