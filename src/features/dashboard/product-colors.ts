import { SERIES_COLORS } from "@/components/ui/chart-colors";
import type { DashboardStats } from "./data";

/**
 * 품목별 고정 색 — "품목별 판매 수량 추이"와 같은 순서(판매 수량 많은 순)로 SERIES_COLORS를 붙인다.
 * 대시보드의 모든 품목 차트(매출 비교·포트폴리오·준비 수량)가 이 표를 같이 써서 같은 품목은 같은 색이 된다.
 */
export function productColors(stats: DashboardStats): Record<string, string> {
  return Object.fromEntries(stats.productSalesByEvent.series.map((s, i) => [s.productName, SERIES_COLORS[i % SERIES_COLORS.length]]));
}

export const FALLBACK_PRODUCT_COLOR = "#B8C2CC";
