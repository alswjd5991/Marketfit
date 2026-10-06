// 실행: npm run find:demo-accounts
//
// DB의 합성 셀러마다 대시보드 분석을 실제와 같은 코드(src/features/analytics/compute.ts)로 계산해,
// 분석 결과가 가장 많이 보이는 계정을 고른다(시연·발표용). DB에는 아무것도 쓰지 않는다.

import { config } from "dotenv";
config({ path: ".env.local" });

import { createAdminClient } from "../src/lib/supabase/admin";
import { computeAnalytics, loadPooled } from "../src/features/analytics/compute";
import { EMAIL_DOMAIN } from "./synthetic-users.config";

async function main() {
  const db = createAdminClient();
  if (!db) throw new Error(".env.local에 NEXT_PUBLIC_SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY가 필요합니다.");
  const pooled = await loadPooled(db);
  const emailOf = new Map(pooled.profiles.map((p) => [p.id, p.email ?? ""]));
  const stores = pooled.stores.filter((s) => emailOf.get(s.owner_id)?.endsWith(`@${EMAIL_DOMAIN}`));
  console.log(`합성 가게 ${stores.length}곳 계산 중…`);

  const rows = [];
  for (const s of stores) {
    const a = await computeAnalytics(db, s.id, pooled);
    const attended = pooled.participations.filter((p) => p.store_id === s.id && p.status === "attended" && p.total_revenue != null).length;
    const forecastOk = a.forecast.status === "ok" ? a.forecast.items.filter((i) => i.prediction.ok).length : 0;
    const lossShown = a.forecast.status === "ok" ? a.forecast.items.filter((i) => i.lossProbability != null).length : 0;
    const signals = a.stock.items.filter((i) => i.verdict === "under" || i.verdict === "over");
    const judged = a.stock.items.filter((i) => i.verdict === "under" || i.verdict === "over" || i.verdict === "ok").length;
    const score =
      (forecastOk > 0 ? 1 : 0) + (lossShown > 0 ? 1 : 0) + (signals.length > 0 ? 1 : 0) + (judged > 0 ? 0.5 : 0) +
      (a.plan.status === "ok" ? 1 : 0) + (a.plan.status === "ok" && a.plan.biased ? 0.5 : 0) + (a.peer.status === "ok" ? 1 : 0) + Math.min(attended, 20) / 20;
    rows.push({
      email: emailOf.get(s.owner_id)!, category: s.category, attended, forecastOk, lossShown,
      stock: signals.map((i) => `${i.productName}:${i.verdict === "under" ? "부족" : "과다"}`).join(",") || (judged ? `판정 ${judged}개(적정)` : a.stock.applicable ? "기록 부족" : "대상 아님"),
      plan: a.plan.status === "ok" ? `${a.plan.biased ? "편향" : "차이 없음"} ${Math.round(a.plan.pct * 100)}%` : "보류",
      peer: a.peer.status === "ok" ? `상위 ${Math.max(1, Math.round((1 - a.peer.below) * 100))}%` : "보류",
      score,
    });
  }

  const first = await computeAnalytics(db, stores[0].id, pooled);
  console.log(`\n■ 매출 요인(모든 가게 공통): ${first.factors.status === "ok" ? first.factors.effects.map((e) => `${e.label} ${Math.round(e.pct * 100)}%${e.significant ? "(유의)" : ""}`).join(" · ") : first.factors.reason}`);
  console.log(`■ 예측 검증: ${first.forecast.status === "ok" ? `${first.forecast.validation.n}건, 80% 구간 적중 ${Math.round(first.forecast.validation.coverage * 1000) / 10}%` : first.forecast.reason}`);

  rows.sort((a, b) => b.score - a.score || b.attended - a.attended);
  console.log(`\n■ 분석이 가장 많이 보이는 계정 TOP 10`);
  console.log("계정".padEnd(36) + "카테고리".padEnd(6) + "참가".padStart(4) + "  예측  적자  준비 수량 진단 / 예상 정확도 / 동종 비교");
  for (const r of rows.slice(0, 10)) {
    console.log(`${r.email.padEnd(36)}${r.category.padEnd(6)}${String(r.attended).padStart(4)}  ${String(r.forecastOk).padStart(4)}  ${String(r.lossShown).padStart(4)}  ${r.stock} / ${r.plan} / ${r.peer}`);
  }
  const best = (label: string, f: (r: (typeof rows)[number]) => boolean) => {
    const r = rows.find(f);
    console.log(`  ${label}: ${r ? `${r.email} (${r.category}, 참가 ${r.attended}건)` : "없음"}`);
  };
  console.log(`\n■ 기능별 추천`);
  best("준비량 '부족' 신호", (r) => r.stock.includes("부족"));
  best("준비량 '과다' 신호", (r) => r.stock.includes("과다"));
  best("예상 매출 편향", (r) => r.plan.startsWith("편향"));
  best("다가올 행사 예측 + 적자 확률", (r) => r.forecastOk > 0 && r.lossShown > 0);
  best("동종 비교 상위권", (r) => r.peer.startsWith("상위") && Number(r.peer.slice(3, -1)) <= 20);
}

main()
  .then(() => process.exit(0))
  .catch((e) => {
    console.error(e);
    process.exit(1);
  });
