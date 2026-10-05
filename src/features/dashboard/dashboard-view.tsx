import type { ReactNode } from "react";
import { skyGradient } from "@/components/sky-page";
import { PageHeader } from "@/components/page-header";
import { Lightbulb } from "lucide-react";
import { ColumnChart } from "@/components/ui/column-chart";
import { ProductTrendChart } from "./product-trend-chart";
import { COUNT_BAR_COLOR, SERIES_COLORS } from "@/components/ui/chart-colors";
import type { DashboardStats } from "@/features/dashboard/data";
import { RecentPerformance } from "./recent-performance";

// 퍼널 단계 색: 노을(관심) → 옅은 하늘(참가 예정) → 하늘(참가 완료). 배경 컨셉처럼 노을에서 하늘로 넘어간다.
const FUNNEL = {
  interested: { bg: "#FFD3B0", ink: "#8A4320" },
  planning_to_attend: { bg: "#A9D5F2", ink: "#1F4E73" },
  attended: { bg: SERIES_COLORS[0], ink: "#FFFFFF" },
};

const won = (n: number) => `${Math.round(n).toLocaleString()}원`;

export function DashboardView({ stats }: { stats: DashboardStats }) {
  const trend = stats.revenueTrend;
  const trendDiff = trend ? (trend.recentAvg - trend.earlierAvg) / trend.earlierAvg : null;

  return (
    <div className="min-h-screen" style={{ background: skyGradient(2) }}>
      <div className="mx-auto w-full max-w-7xl px-4 py-8 sm:px-6 lg:px-8 lg:py-10">
        <PageHeader title="대시보드" />

        {stats.insights.length > 0 && (
          <section className="rounded-3xl border border-white/80 bg-[#FFF6EE] p-6 shadow-[0_12px_32px_rgba(40,80,120,0.08)] sm:p-7">
            <h2 className="flex items-center gap-2 text-sm font-bold text-brand-dark">
              <Lightbulb className="size-4" /> 종합 인사이트
            </h2>
            <ul className="mt-4 grid gap-x-8 gap-y-2.5 text-[15px] leading-6 md:grid-cols-2">
              {stats.insights.map((line) => (
                <li key={line} className="flex gap-2.5">
                  <span className="mt-2.5 size-1.5 shrink-0 rounded-full bg-[#F2836B]" />
                  <span className="text-neutral-700">{bold(line)}</span>
                </li>
              ))}
            </ul>
          </section>
        )}

        <Group title="최근 성과" first>
          <RecentPerformance stats={stats} withTypeFilter />
        </Group>

        <Group title="수익성">
          <div className="grid gap-3 sm:grid-cols-3">
            <ProfitCard
              label="행사당 평균 매출"
              value={stats.totalRevenue != null ? won(stats.totalRevenue / stats.revenueEntryCount) : "기록 없음"}
            >
              {trendDiff != null && Math.abs(trendDiff) >= 0.05 ? ( // 인사이트 문장과 같은 기준
                <span className={`self-start rounded-full px-2.5 py-1 text-[13px] font-semibold ${trendDiff > 0 ? "bg-[#E0EFE8] text-[#2F5F4B]" : "bg-[#FFE4DE] text-[#BE3A2A]"}`}>
                  최근 {trend!.recentCount}회 {trendDiff > 0 ? "▲" : "▼"} {Math.round(Math.abs(trendDiff) * 100)}%
                </span>
              ) : (
                stats.revenueEntryCount > 0 && <span className="text-[13px] text-neutral-500">{stats.revenueEntryCount}회 평균</span>
              )}
            </ProfitCard>

            <ProfitCard
              label="투자 대비 수익률"
              value={stats.returnOnCost ? `${Math.round(stats.returnOnCost.percent).toLocaleString()}%` : "기록 없음"}
              tone={stats.returnOnCost && stats.returnOnCost.percent < 0 ? "bad" : undefined}
            >
              {stats.returnOnCost ? (
                <p className="flex flex-wrap items-center gap-1.5 text-[13px] text-neutral-500">
                  비용 <span className="font-semibold tabular-nums text-neutral-800">{won(stats.returnOnCost.totalCost)}</span>
                  <span className="text-neutral-300">→</span>
                  순이익{" "}
                  <span className="font-semibold tabular-nums text-neutral-800">
                    {won((stats.returnOnCost.percent / 100) * stats.returnOnCost.totalCost)}
                  </span>
                </p>
              ) : (
                <span className="text-[13px] text-neutral-400">비용 입력 시 표시</span>
              )}
            </ProfitCard>

            <ProfitCard
              label="목표 매출 달성률"
              value={stats.targetAchievement ? `${Math.round(stats.targetAchievement.percent)}%` : "기록 없음"}
            >
              {stats.targetAchievement ? (
                <div>
                  <div className="h-2.5 overflow-hidden rounded-full bg-neutral-100">
                    <div
                      className="h-full rounded-full"
                      style={{
                        width: `${Math.min(stats.targetAchievement.percent, 100)}%`,
                        background: stats.targetAchievement.percent >= 100 ? "#3F7A64" : "#7DBFE8",
                      }}
                    />
                  </div>
                  <p className="mt-1.5 text-[13px] text-neutral-500">
                    {stats.targetAchievement.percent >= 100 ? "목표 초과 달성" : `목표까지 ${Math.round(100 - stats.targetAchievement.percent)}%`} ·{" "}
                    {stats.targetAchievement.entryCount}회 기준
                  </p>
                </div>
              ) : (
                <span className="text-[13px] text-neutral-400">목표 매출 입력 시 표시</span>
              )}
            </ProfitCard>
          </div>
        </Group>

        <Group title="참가 활동">
          <div className="grid gap-5 lg:grid-cols-3">
            <Panel title="참가 전환 흐름">
              <Funnel stats={stats} />
            </Panel>
            <Panel title="월별 참가" className="lg:col-span-2">
              <ColumnChart
                unit="건"
                barName="참가 행사 수"
                barColor={COUNT_BAR_COLOR}
                height={290}
                points={stats.monthlyParticipationCounts.map((m) => {
                  const [y, mo] = m.monthKey.split("-");
                  return { label: `${y.slice(2)}.${Number(mo)}`, value: m.count, title: `${y}년 ${Number(mo)}월` };
                })}
              />
            </Panel>
          </div>
        </Group>

        <Group title="상품 판매">
          <Panel title={stats.productSalesByEvent.series.length ? undefined : "품목별 판매 수량 추이"}>
            {stats.productSalesByEvent.series.length === 0 ? (
              <Empty>상품별 판매 기록 없음</Empty>
            ) : (
              <ProductTrendChart title="품목별 판매 수량 추이" data={stats.productSalesByEvent} />
            )}
          </Panel>
        </Group>
      </div>
    </div>
  );
}

/** "**굵게**" 표시만 지원하는 아주 작은 렌더러(인사이트 문장용). */
function bold(text: string): ReactNode[] {
  return text.split("**").map((part, i) => (i % 2 ? <strong key={i} className="font-bold text-neutral-950">{part}</strong> : part));
}

/** 목적이 같은 차트 묶음. 묶음이 바뀔 때마다 구분선 + 소제목으로 나눈다. */
function Group({ title, first = false, children }: { title: string; first?: boolean; children: ReactNode }) {
  return (
    <section className={first ? "mt-8" : "mt-10 border-t border-neutral-300/60 pt-8"}>
      <h2 className="mb-4 text-lg font-bold text-neutral-950">{title}</h2>
      {children}
    </section>
  );
}

/** title을 비우면 제목 줄을 자식(드롭다운이 붙은 차트)이 직접 그린다. */
function Panel({ title, className = "", children }: { title?: string; className?: string; children: ReactNode }) {
  return (
    <div className={`min-w-0 rounded-2xl border border-white/80 bg-white/85 shadow-[0_8px_24px_rgba(40,80,120,0.06)] backdrop-blur-sm p-5 sm:p-6 ${className}`}>
      {title && <h2 className="mb-5 text-[15px] font-semibold text-neutral-900">{title}</h2>}
      {children}
    </div>
  );
}

function Empty({ children }: { children: ReactNode }) {
  return <p className="py-8 text-center text-sm text-neutral-400">{children}</p>;
}

/** 수익성 카드: 큰 숫자 + 아래 보조 표시(추세 배지·비용 흐름·달성 막대). */
function ProfitCard({ label, value, tone, children }: { label: string; value: string; tone?: "bad"; children?: ReactNode }) {
  return (
    <div className="flex flex-col justify-between gap-4 rounded-2xl border border-white/80 bg-white/85 p-5 shadow-[0_8px_24px_rgba(40,80,120,0.06)] backdrop-blur-sm sm:p-6">
      <div>
        <p className="text-sm font-medium text-neutral-500">{label}</p>
        <p className={`mt-1 whitespace-nowrap text-[30px] font-extrabold leading-tight tracking-tight tabular-nums ${tone === "bad" ? "text-[#BE3A2A]" : "text-neutral-950"}`}>
          {value}
        </p>
      </div>
      {children}
    </div>
  );
}

/**
 * 참가 전환 퍼널(인포그래픽형): 사다리꼴 층이 쌓여 깔때기를 이루고, 층 안에 건수,
 * 오른쪽엔 점선 연결선 + 단계 이름·전환율. 층 너비는 값이 아니라 고정 비율로 좁아진다(모양 유지용).
 * 각 단계는 지금 그 단계 이상인 기록 수.
 */
function Funnel({ stats }: { stats: DashboardStats }) {
  const c = stats.statusCounts;
  const steps = [
    { label: "관심", count: stats.totalParticipations, color: FUNNEL.interested.bg, ink: FUNNEL.interested.ink },
    { label: "참가 예정", count: c.planning_to_attend + c.attended, color: FUNNEL.planning_to_attend.bg, ink: FUNNEL.planning_to_attend.ink },
    { label: "참가 완료", count: c.attended, color: FUNNEL.attended.bg, ink: FUNNEL.attended.ink },
  ];
  const top = Math.max(steps[0].count, 1);
  const edges = [100, 74, 50, 28]; // 층 경계의 너비(%) — 위에서 아래로 좁아진다
  const trapezoid = (i: number) => {
    const [a, b] = [edges[i], edges[i + 1]];
    return `polygon(${(100 - a) / 2}% 0, ${(100 + a) / 2}% 0, ${(100 + b) / 2}% 100%, ${(100 - b) / 2}% 100%)`;
  };

  return (
    <div>
      <ol className="mt-2 flex flex-col gap-2">
        {steps.map((step, i) => {
          const prev = steps[i - 1];
          const rate = prev ? (prev.count > 0 ? `${Math.round((step.count / prev.count) * 100)}%` : "-") : null;
          return (
            <li key={step.label} className="flex items-center">
              <div
                className="flex h-[78px] w-[56%] shrink-0 items-center justify-center text-xl font-bold tabular-nums"
                style={{ background: step.color, color: step.ink, clipPath: trapezoid(i) }}
                title={`${step.label} ${step.count}건`}
              >
                {step.count}
              </div>
              <span className="mx-2 h-px flex-1 border-t border-dashed border-neutral-300" />
              <span className="size-2 shrink-0 rounded-full" style={{ background: step.color }} />
              <div className="ml-2.5 w-[76px] shrink-0">
                <p className="text-sm font-bold text-neutral-900">{step.label}</p>
                <p className="text-xs tabular-nums text-neutral-500">{rate ? `전환 ${rate}` : "전체"}</p>
              </div>
            </li>
          );
        })}
      </ol>
      {/* 깔때기 꼭지 */}
      <div className="w-[56%]">
        <div className="mx-auto h-4 w-[12%] rounded-b-md opacity-60" style={{ background: steps[2].color }} />
      </div>
      <p className="mt-4 text-center text-sm text-neutral-600">
        전체 참가율 <span className="font-bold text-neutral-950">{Math.round((c.attended / top) * 100)}%</span>
      </p>
    </div>
  );
}
