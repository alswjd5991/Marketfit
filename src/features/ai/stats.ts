import type { ParticipationStatus } from "@/types/database";

export interface ParticipationForStats {
  name: string;
  status: ParticipationStatus;
  total_revenue: number | null;
  net_profit: number | null;
  satisfaction: number | null;
  would_reattend: boolean | null;
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
    const loss = profit.filter((r) => r.net_profit! < 0).length;
    if (loss) lines.push(`- 적자 행사 ${loss}건`);
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
