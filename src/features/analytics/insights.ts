import type { DashboardAnalytics } from "./data";
import { manwon } from "./panels";

const p100 = (x: number) => Math.round(Math.abs(x) * 100);

/** 통계 분석 결과로 만드는 인사이트 문장. 기준(유의성·검증)을 통과한 결과만 문장이 된다. */
export function analyticsInsights(a: DashboardAnalytics): string[] {
  const out: string[] = [];

  if (a.forecast.status === "ok") {
    const next = a.forecast.items.find((i) => i.prediction.ok);
    if (next && next.prediction.ok) {
      const loss = next.lossProbability == null ? "" : `, 적자 확률 ${next.lossProbability < 0.01 ? "1% 미만" : `${Math.round(next.lossProbability * 100)}%`}`;
      out.push(`**${next.eventName}** 예상 매출 중앙값 **${manwon(next.prediction.median)}** (80% 구간 ${manwon(next.prediction.low)}~${manwon(next.prediction.high)}${loss})`);
    }
  }

  if (a.factors.status === "ok") {
    const top = a.factors.effects.filter((e) => e.significant).sort((x, y) => Math.abs(Math.log(1 + y.pct)) - Math.abs(Math.log(1 + x.pct))).slice(0, 2);
    for (const e of top) {
      const [lo, hi] = e.pct < 0 ? [p100(e.high), p100(e.low)] : [p100(e.low), p100(e.high)];
      out.push(`같은 가게 기준 **${e.label}** 매출이 ${e.reference}보다 **${p100(e.pct)}% ${e.pct < 0 ? "낮음" : "높음"}** (95% 구간 ${lo}~${hi}%)`);
    }
  }

  for (const s of a.stock.items.filter((i) => i.verdict === "under" || i.verdict === "over").slice(0, 2)) {
    out.push(`**${s.productName}** 품절 ${s.stockouts}/${s.n}회 — 적정 품절률 ${Math.round(s.optimalRate! * 100)}%보다 ${s.verdict === "under" ? "잦아 **준비량 부족 신호**" : "드물어 **준비량 과다 신호**"}`);
  }

  if (a.plan.status === "ok" && a.plan.biased) {
    out.push(`실제 매출이 참가 전 예상보다 평균 **${p100(a.plan.pct)}% ${a.plan.pct < 0 ? "낮음" : "높음"}** — 예상을 ${a.plan.pct < 0 ? "높게" : "낮게"} 잡는 편 (${a.plan.n}회)`);
  }
  return out;
}
