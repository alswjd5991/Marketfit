// ⑤ 준비 수량 진단 — 뉴스벤더 모형의 최적 조건을 실제 품절 빈도로 검정한다.
//
// 행사에 가져가지 않은 상품은 팔 수 없고(부족하면 손해), 남은 상품은 상품에 따라 손해가 다르다(남아도 손해).
//   1개 덜 준비해서 못 판 손해  c_u = 가격 − 원가
//   1개 더 준비해서 남은 손해   c_o = 원가 × 남은 상품 손실률(아래 LEFTOVER_LOSS)
//   ⇒ 최적 준비량에서는 P(수요 ≤ Q*) = c_u/(c_u + c_o), 즉 최적 품절 확률 = c_o/(c_u + c_o).
// 당일에 버려야 하는 음식(손실률 1)이면 최적 품절 확률 = 원가/가격이고, 다음에 다시 팔 수 있는 공예품처럼
// 손실률이 작으면 최적 품절 확률도 작아진다(웬만하면 넉넉히 가져가는 게 이득).
// 이 조건은 수요 분포의 모양과 무관하고, 행사마다 수요가 달라도(행사별로 최적화했다면) 매번 성립한다.
// 그래서 수요 분포를 억지로 추정하지 않고, "품절된 행사 수 ~ 이항(n, 최적 품절 확률)"을 정확 이항검정으로
// 확인한다. 상품 여러 개를 동시에 보므로 Holm 보정.
//
// 가정(화면에 표시): 남은 상품 손실률은 카테고리별 [가정], 품절로 잃는 단골·평판 비용은 미반영
// (반영하면 최적 품절률은 조금 더 낮아진다), 행사 간 독립.

import { binomTestTwoSided, holmAdjust, wilsonInterval } from "./distributions";

/**
 * 남은 상품 1개의 손실 = 원가 × 이 비율 [가정 — 공개 통계 없음].
 * 음식·디저트: 당일 폐기 → 1. 농산물: 신선도 저하·운반 중 손상·재운송 → 0.5.
 * 그 밖(공예·패션·액세서리·생활용품·반려동물): 다시 팔 수 있지만 운반·포장·파손·보관 부담 → 0.1.
 */
export const LEFTOVER_LOSS: Record<string, number> = { 음식: 1, 디저트: 1, 농산물: 0.5 };
export const DEFAULT_LEFTOVER_LOSS = 0.1;
export const leftoverLoss = (category: string) => LEFTOVER_LOSS[category] ?? DEFAULT_LEFTOVER_LOSS;
/** 당일 폐기 상품인지(화면 문구용) */
export const isPerishable = (category: string) => leftoverLoss(category) >= 1;

export const STOCK_RULES = { minEvents: 8, alpha: 0.05 };

export interface ProductSaleRecord {
  productName: string;
  prepared: number;
  sold: number;
  price: number;
  cost: number | null;
}

export type StockVerdict = "under" | "over" | "ok" | "few" | "noCost";

export interface StockDiagnosis {
  productName: string;
  n: number;
  stockouts: number;
  /** 관측 품절률과 95% Wilson 구간 */
  rate: number;
  low: number;
  high: number;
  /** 최적 품절률 = 남은 손해 ÷ (못 판 손해 + 남은 손해) (기록별 값의 중앙값) */
  optimalRate: number | null;
  /** 정확 이항검정 p값(보정 전·후). 기록이 부족하거나 원가가 없으면 null */
  p: number | null;
  pHolm: number | null;
  verdict: StockVerdict;
  sellThrough: number;
  /** 팔지 못하고 남은 수량 × 원가 합계 */
  leftoverCost: number | null;
}

export function diagnoseStock(records: ProductSaleRecord[], lossRate = 1): StockDiagnosis[] {
  const byName = new Map<string, ProductSaleRecord[]>();
  for (const r of records) if (r.prepared > 0) byName.set(r.productName, [...(byName.get(r.productName) ?? []), r]);

  const items = [...byName].map(([productName, rs]) => {
    const n = rs.length;
    const stockouts = rs.filter((r) => r.sold >= r.prepared).length;
    const [low, high] = wilsonInterval(stockouts, n);
    // 최적 품절 확률 = c_o/(c_u + c_o), c_u = 가격 − 원가, c_o = 원가 × 손실률
    const ratios = rs.filter((r) => r.cost != null && r.price > r.cost).map((r) => (r.cost! * lossRate) / (r.price - r.cost! + r.cost! * lossRate)).sort((a, b) => a - b);
    const optimalRate = ratios.length ? ratios[Math.floor(ratios.length / 2)] : null;
    const prepared = rs.reduce((s, r) => s + r.prepared, 0);
    const sold = rs.reduce((s, r) => s + Math.min(r.sold, r.prepared), 0);
    const costed = rs.filter((r) => r.cost != null);
    return {
      productName, n, stockouts, rate: stockouts / n, low, high, optimalRate,
      p: optimalRate != null && optimalRate > 0 && optimalRate < 1 && n >= STOCK_RULES.minEvents ? binomTestTwoSided(stockouts, n, optimalRate) : null,
      sellThrough: sold / prepared,
      leftoverCost: costed.length ? costed.reduce((s, r) => s + Math.max(0, r.prepared - r.sold) * r.cost!, 0) : null,
    };
  });

  const tested = items.filter((i) => i.p != null);
  const adjusted = holmAdjust(tested.map((i) => i.p!));
  return items
    .map((i) => {
      const k = tested.findIndex((t) => t.productName === i.productName);
      const pHolm = k >= 0 ? adjusted[k] : null;
      const verdict: StockVerdict =
        i.optimalRate == null ? "noCost"
        : i.n < STOCK_RULES.minEvents ? "few"
        : pHolm == null ? "noCost" // 원가가 가격 이상이거나 0이라 최적 품절률이 정의되지 않음
        : pHolm >= STOCK_RULES.alpha ? "ok"
        : i.rate > i.optimalRate ? "under" : "over";
      return { ...i, pHolm, verdict };
    })
    .sort((a, b) => b.n - a.n);
}
