import { josa } from "@/lib/josa";
import type { DashboardAnalytics } from "./data";
import { manwon } from "./panels";

const p100 = (x: number) => Math.round(Math.abs(x) * 100);

/** 통계 분석 결과로 만드는 한 줄 요약(해요체). 기준(유의성·검증)을 통과한 결과만 문장이 된다. */
export function analyticsInsights(a: DashboardAnalytics): string[] {
  const out: string[] = [];

  if (a.forecast.status === "ok") {
    const next = a.forecast.items.find((i) => i.prediction.ok);
    if (next && next.prediction.ok) {
      out.push(`**${next.eventName}**에서 **${manwon(next.prediction.median)}**쯤 팔 것 같아요 (보통 ${manwon(next.prediction.low)}~${manwon(next.prediction.high)})`);
    }
  }

  if (a.factors.status === "ok") {
    const top = a.factors.effects.filter((e) => e.significant).sort((x, y) => Math.abs(Math.log(1 + y.pct)) - Math.abs(Math.log(1 + x.pct))).slice(0, 2);
    for (const e of top) out.push(`**${e.label}**엔 ${e.reference}보다 **${p100(e.pct)}% ${e.pct < 0 ? "덜" : "더"}** 팔렸어요`);
  }

  for (const s of a.stock.items.filter((i) => i.verdict === "under" || i.verdict === "over").slice(0, 2)) {
    out.push(s.verdict === "under"
      ? `**${s.productName}**: ${s.n}번 중 ${s.stockouts}번 다 팔렸어요. 다음엔 **조금 더** 준비해 보세요`
      : `**${s.productName}**: ${s.stockouts === 0 ? `${s.n}번 모두 남았어요` : `${s.n}번 중 ${s.stockouts}번만 다 팔렸어요`}. **조금 줄여도** 괜찮아요`);
  }

  if (a.plan.status === "ok" && a.plan.biased) {
    out.push(`실제 매출이 참가 전 예상보다 평균 **${p100(a.plan.pct)}% ${a.plan.pct < 0 ? "적었어요" : "많았어요"}**`);
  }
  return out.map((line) => line.replace(/\*\*([^*]+)\*\*:/g, (_, w) => `**${josa(w, "은", "는")}**`));
}
