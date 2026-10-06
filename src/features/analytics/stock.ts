// ⑤ 준비 수량 진단 — 뉴스벤더 모형의 최적 조건을 실제 품절 빈도로 검정한다.
//
// 그날 못 팔면 버려야 하는 상품(음식·디저트)은 전형적인 뉴스벤더 문제다:
//   1개 덜 준비해서 못 판 손해 = 가격 − 원가,  1개 더 준비해서 버린 손해 = 원가
//   ⇒ 최적 준비량 Q*는 P(수요 ≤ Q*) = (가격 − 원가)/가격 을 만족하고,
//   ⇒ 최적으로 준비했다면 품절(수요 ≥ 준비량)이 일어날 확률 = 원가/가격.
// 이 조건은 수요 분포의 모양과 무관하고, 행사마다 수요가 달라도(행사별로 최적화했다면) 매번 성립한다.
// 그래서 수요 분포를 억지로 추정하지 않고, "품절된 행사 수 ~ 이항(n, 원가/가격)"을 정확 이항검정으로
// 확인한다. 상품 여러 개를 동시에 보므로 Holm 보정.
//
// 가정(화면에 표시): 남은 상품의 잔존가치 0(다음 행사에 못 팖), 품절로 잃는 단골·평판 비용은 미반영
// (반영하면 최적 품절률은 원가/가격보다 조금 낮아진다), 행사 간 독립.
// 다음 행사에 다시 팔 수 있는 상품(수공예·패션 등)은 이 모형의 전제가 맞지 않아 적용하지 않는다.

import { binomTestTwoSided, holmAdjust, wilsonInterval } from "./distributions";

export const PERISHABLE_CATEGORIES = ["음식", "디저트"];
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
  /** 최적 품절률 = 원가/가격(중앙값) */
  optimalRate: number | null;
  /** 정확 이항검정 p값(보정 전·후). 기록이 부족하거나 원가가 없으면 null */
  p: number | null;
  pHolm: number | null;
  verdict: StockVerdict;
  sellThrough: number;
  /** 팔지 못하고 남은 수량 × 원가 합계 */
  leftoverCost: number | null;
}

export function diagnoseStock(records: ProductSaleRecord[]): StockDiagnosis[] {
  const byName = new Map<string, ProductSaleRecord[]>();
  for (const r of records) if (r.prepared > 0) byName.set(r.productName, [...(byName.get(r.productName) ?? []), r]);

  const items = [...byName].map(([productName, rs]) => {
    const n = rs.length;
    const stockouts = rs.filter((r) => r.sold >= r.prepared).length;
    const [low, high] = wilsonInterval(stockouts, n);
    const ratios = rs.filter((r) => r.cost != null && r.price > 0).map((r) => r.cost! / r.price).sort((a, b) => a - b);
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
