import type { DashboardStats } from "./data";

const won = (n: number) => `${Math.round(n).toLocaleString("ko-KR")}원`;
const pct = (n: number) => `${Math.round(n * 100)}%`;

/**
 * 대시보드 맨 위 "종합 인사이트" 문장들. 숫자는 모두 getDashboardStats가 계산한 값만 쓰고,
 * 근거가 부족한 문장은 만들지 않는다. **굵게** 표시를 쓴다.
 */
export function buildInsights(s: DashboardStats): string[] {
  const out: string[] = [];
  if (s.averageNetProfit != null) {
    out.push(`참가 완료 **${s.statusCounts.attended}회**, 행사당 평균 순이익 **${won(s.averageNetProfit)}**`);
  }

  const trend = s.eventRevenueTrend;
  if (trend.length >= 6) {
    const n = Math.min(5, Math.floor(trend.length / 2));
    const avg = (xs: typeof trend) => xs.reduce((a, e) => a + e.revenue, 0) / xs.length;
    const recent = avg(trend.slice(-n));
    const earlier = avg(trend.slice(0, -n));
    const diff = (recent - earlier) / earlier;
    out.push(
      Math.abs(diff) >= 0.05
        ? `최근 ${n}회 평균 매출 ${won(recent)} — 이전보다 **${pct(Math.abs(diff))} ${diff > 0 ? "증가" : "감소"}**`
        : `최근 ${n}회 평균 매출 ${won(recent)} — 이전과 비슷한 수준`
    );
  }

  // categoryProfit은 평균 순이익 높은 순. 1건짜리는 우연일 수 있어 2건 이상만 본다.
  const best = s.categoryProfit.find((c) => c.entryCount >= 2);
  if (best && s.categoryProfit.filter((c) => c.entryCount >= 2).length >= 2) {
    out.push(`평균 순이익이 가장 높은 유형은 **${best.group}** (${won(best.averageNetProfit)}, ${best.entryCount}회)`);
  }

  const productTotal = s.popularProducts.reduce((a, p) => a + p.totalRevenue, 0);
  const top = s.popularProducts[0];
  if (top && productTotal > 0 && s.popularProducts.length >= 2) {
    out.push(`매출 1위 상품 **${top.productName}** — 상품 매출의 ${pct(top.totalRevenue / productTotal)}`);
  }

  if (s.nextEvent) {
    const [, m, d] = s.nextEvent.startDate.split("-").map(Number);
    out.push(`다음 참가 예정: **${s.nextEvent.eventName}** (${m}월 ${d}일)`);
  }
  return out;
}
