import type { ParticipationStatus } from "@/types/database";

export interface ParticipationForStats {
  name: string;
  status: ParticipationStatus;
  total_revenue: number | null;
  net_profit: number | null;
  satisfaction: number | null;
  would_reattend: boolean | null;
  // 아래는 비교 통계용(없으면 해당 줄을 건너뛴다).
  start_date?: string | null;
  category?: string | null;
  region?: string | null;
  weather?: string | null;
  indoor_outdoor?: string | null;
  fee?: number | null;
  transport_cost?: number | null;
  parking_cost?: number | null;
  lodging_cost?: number | null;
  other_cost?: number | null;
}

const STATUS_LABEL: Record<ParticipationStatus, string> = {
  interested: "관심",
  planning_to_apply: "신청 예정",
  applied: "신청 완료",
  planning_to_attend: "참가 예정",
  attended: "참가 완료",
  cancelled: "취소",
};

const won = (n: number) => `${Math.round(n).toLocaleString("ko-KR")}원`;
const pct = (n: number) => `${Math.round(n * 100)}%`;

/**
 * 그룹별 평균 매출·순이익(순이익 높은 순). 1건짜리 그룹은 우연일 수 있어 빼고,
 * 2건 이상인 그룹이 2개 미만이면 비교가 안 되니 null.
 */
function groupLine(
  label: string,
  rows: ParticipationForStats[],
  key: (r: ParticipationForStats) => string | null | undefined,
  chronological = false
): string | null {
  const groups = new Map<string, { revenue: number; profit: number; n: number }>();
  for (const r of rows) {
    const k = key(r);
    if (!k) continue;
    const g = groups.get(k) ?? { revenue: 0, profit: 0, n: 0 };
    g.revenue += r.total_revenue!;
    g.profit += r.net_profit ?? 0;
    g.n++;
    groups.set(k, g);
  }
  const kept = [...groups].filter(([, g]) => g.n >= 2);
  if (kept.length < 2) return null;
  const skipped = groups.size - kept.length;
  const items = kept
    .map(([k, g]) => ({ k, revenue: g.revenue / g.n, profit: g.profit / g.n, n: g.n }))
    .sort((a, b) => (chronological ? a.k.localeCompare(b.k) : b.profit - a.profit))
    .map((g) => `${g.k} 평균 매출 ${won(g.revenue)}·순이익 ${won(g.profit)}(${g.n}건)`);
  return `- ${label}: ${items.join(", ")}${skipped ? ` (1건뿐인 ${skipped}개 그룹은 비교에서 제외)` : ""}`;
}

/** AI에게 넘기는 개인 통계. 모델이 직접 더하고 나누다 틀리지 않도록 숫자는 모두 여기서 계산한다. */
export function participationStats(rows: ParticipationForStats[]): string[] {
  const counts = new Map<string, number>();
  for (const r of rows) counts.set(STATUS_LABEL[r.status] ?? r.status, (counts.get(STATUS_LABEL[r.status] ?? r.status) ?? 0) + 1);
  const lines = [`- 기록 ${rows.length}건 (${[...counts].map(([label, n]) => `${label} ${n}건`).join(", ")})`];

  const revenue = rows.filter((r) => r.total_revenue != null);
  if (revenue.length) {
    const sum = revenue.reduce((s, r) => s + r.total_revenue!, 0);
    lines.push(`- 매출 기록 ${revenue.length}건: 총매출 합계 ${won(sum)}, 행사당 평균 ${won(sum / revenue.length)}`);
  }
  const profit = [...rows.filter((r) => r.net_profit != null)].sort((a, b) => b.net_profit! - a.net_profit!);
  if (profit.length) {
    const sum = profit.reduce((s, r) => s + r.net_profit!, 0);
    lines.push(`- 순이익 기록 ${profit.length}건: 순이익 합계 ${won(sum)}, 행사당 평균 ${won(sum / profit.length)}`);
    lines.push(`- 순이익 최고: ${profit[0].name} (${won(profit[0].net_profit!)}) / 최저: ${profit.at(-1)!.name} (${won(profit.at(-1)!.net_profit!)})`);
    lines.push(`- 순이익 순위: ${profit.slice(0, 5).map((r, i) => `${i + 1}위 ${r.name} ${won(r.net_profit!)}`).join(", ")}`);
    const loss = profit.filter((r) => r.net_profit! < 0);
    if (loss.length) lines.push(`- 적자 행사 ${loss.length}건: ${loss.map((r) => `${r.name} ${won(r.net_profit!)}`).join(", ")}`);
  }

  // 비용 구조: 매출이 있는 행사의 비용 항목별 합계와 매출 대비 비율.
  if (revenue.length) {
    const sales = revenue.reduce((s, r) => s + r.total_revenue!, 0);
    const costs = (
      [
        ["참가비", (r) => r.fee],
        ["교통비", (r) => r.transport_cost],
        ["주차비", (r) => r.parking_cost],
        ["숙박비", (r) => r.lodging_cost],
        ["기타 비용", (r) => r.other_cost],
      ] as [string, (r: ParticipationForStats) => number | null | undefined][]
    )
      .map(([label, get]) => [label, revenue.reduce((s, r) => s + (get(r) ?? 0), 0)] as const)
      .filter(([, v]) => v > 0);
    if (costs.length) {
      const total = costs.reduce((s, [, v]) => s + v, 0);
      lines.push(`- 비용 합계 ${won(total)} (매출의 ${sales ? pct(total / sales) : "-"}): ${costs.map(([l, v]) => `${l} ${won(v)}`).join(", ")}`);
    }
  }

  // 조건별 비교 — 모델이 비율·평균을 직접 계산하지 않도록 여기서 만든다.
  for (const [label, key] of [
    ["날씨별", (r) => r.weather],
    ["실내/실외별", (r) => r.indoor_outdoor],
    ["행사 유형별", (r) => r.category ?? "유형 미분류"],
    ["지역별", (r) => r.region],
  ] as [string, (r: ParticipationForStats) => string | null | undefined][]) {
    const line = groupLine(label, revenue, key);
    if (line) lines.push(line);
  }

  // 기간별 추이: 연도별 평균, 그리고 오래된 절반 대비 최근 절반.
  const dated = revenue.filter((r) => r.start_date).sort((a, b) => a.start_date!.localeCompare(b.start_date!));
  const yearly = groupLine("연도별", dated, (r) => `${r.start_date!.slice(0, 4)}년`, true);
  if (yearly) lines.push(yearly);
  if (dated.length >= 6) {
    const half = Math.floor(dated.length / 2);
    const avg = (xs: ParticipationForStats[]) => xs.reduce((s, r) => s + r.total_revenue!, 0) / xs.length;
    const [early, recent] = [avg(dated.slice(0, half)), avg(dated.slice(-half))];
    lines.push(
      `- 매출 추이: 오래된 ${half}건 평균 ${won(early)} → 최근 ${half}건 평균 ${won(recent)} (${recent >= early ? "+" : ""}${pct((recent - early) / early)}, ${dated[0].start_date}~${dated.at(-1)!.start_date})`
    );
  }

  const satisfaction = rows.filter((r) => r.satisfaction != null);
  if (satisfaction.length) {
    lines.push(`- 평균 만족도 ${(satisfaction.reduce((s, r) => s + r.satisfaction!, 0) / satisfaction.length).toFixed(1)}/5 (${satisfaction.length}건)`);
  }
  const reattend = rows.filter((r) => r.would_reattend != null);
  if (reattend.length) {
    lines.push(`- 재참가 의향 있음 ${reattend.filter((r) => r.would_reattend).length}건 / 없음 ${reattend.filter((r) => !r.would_reattend).length}건`);
  }
  if (!revenue.length && !profit.length) lines.push("- 매출·순이익이 입력된 기록이 없음");
  return lines;
}

export interface ProductSaleForStats {
  product_name: string;
  prepared: number;
  sold: number;
  revenue: number;
}

/** 상품별 판매 합계·판매율(판매/준비). 매출 높은 순 상위 limit개. 참가 예정 행사의 준비 수량(sold 0)은 넣지 않는다. */
export function productStats(sales: ProductSaleForStats[], limit: number): string[] {
  const by = new Map<string, { prepared: number; sold: number; revenue: number }>();
  for (const s of sales) {
    const cur = by.get(s.product_name) ?? { prepared: 0, sold: 0, revenue: 0 };
    cur.prepared += s.prepared;
    cur.sold += s.sold;
    cur.revenue += s.revenue;
    by.set(s.product_name, cur);
  }
  return [...by]
    .sort((a, b) => b[1].revenue - a[1].revenue)
    .slice(0, limit)
    .map(([name, a]) => `- ${name}: 판매 ${a.sold}개 / 준비 ${a.prepared}개${a.prepared ? ` (판매율 ${pct(a.sold / a.prepared)})` : ""} / 매출 ${won(a.revenue)}`);
}
