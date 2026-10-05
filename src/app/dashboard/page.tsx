import { ProductRevenueAreaChart } from "@/components/ui/product-revenue-area-chart";
import { ProductSalesTrendChart } from "@/components/ui/product-sales-trend-chart";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { BarRow, BAR_ROWS_HOVER_CLASS } from "@/components/ui/bar-row";
import { InteractiveLineChart } from "@/components/ui/interactive-line-chart";
import { getCurrentUser } from "@/features/store/data";
import { getDashboardStats } from "@/features/dashboard/data";
import { buildInsights } from "@/features/dashboard/insights";
import { Lightbulb } from "lucide-react";
import { STATUS_LABEL } from "@/features/participations/status-labels";
import type { CategoryGroup } from "@/features/events/category-group";
import { formatDday } from "@/features/events/status";
import type { ParticipationStatus } from "@/types/database";

// 상태 진행(관심→신청예정→신청완료→참가예정)은 틸 순차(ordinal) 램프로 —
// "정도"를 나타내는 값이라 색상 정체성보다 명암 순서가 맞다. 참가완료는 토마토로
// 강조하고, 취소는 무채색으로 빼 둔다. (레트로 팝 그래프 팔레트)
const STATUS_COLOR: Record<ParticipationStatus, string> = {
  interested: "#BFE3E1",
  planning_to_apply: "#7CC6C2",
  applied: "#2FA19C",
  planning_to_attend: "#0E7C78",
  attended: "#F2542D",
  cancelled: "#D8D4CC",
};

// events.category는 원문 그대로(21종+) 저장돼 있어 막대 라벨은 그 문구를
// 그대로 쓰되, 색은 category-group.ts의 대분류 6종 기준으로 고정 배정한다 —
// 원문 카테고리가 늘어나도 같은 대분류는 항상 같은 색으로 보이게.
const GROUP_COLOR: Record<CategoryGroup, string> = {
  플리마켓: "#3B8EDB",
  "축제 부스": "#F2542D",
  시즌마켓: "#0E9594",
  야시장: "#F5B700",
  "대학 마켓": "#E86A92",
  "아트·디자인 마켓": "#1D3557",
  "먹거리 부스": "#E1A11A",
  "박람회·전시": "#8C68D9",
};

export default async function DashboardPage() {
  const user = await getCurrentUser();
  if (!user) {
    return (
      <div className="min-h-screen bg-[linear-gradient(135deg,#FFECD0_0%,#F4F9FD_30%,#DCEEFF_68%,#F6FAFD_100%)]">
      <div className="mx-auto max-w-md px-4 py-20 text-center">
        <h1 className="text-2xl font-bold text-neutral-950">대시보드</h1>
        <p className="mt-3 text-sm text-neutral-500">로그인 후 이용 가능</p>
        <Button asChild className="mt-6">
          <Link href="/login">로그인하러 가기</Link>
        </Button>
      </div>
      </div>
    );
  }

  const stats = await getDashboardStats();

  if (!stats) {
    return (
      <div className="min-h-screen bg-[linear-gradient(135deg,#FFECD0_0%,#F4F9FD_30%,#DCEEFF_68%,#F6FAFD_100%)]">
      <div className="mx-auto max-w-md px-4 py-20 text-center">
        <h1 className="text-2xl font-bold text-neutral-950">대시보드</h1>
        <p className="mt-3 text-sm text-neutral-500">가게 등록 후 이용 가능</p>
        <Button asChild className="mt-6">
          <Link href="/store">가게 등록하러 가기</Link>
        </Button>
      </div>
      </div>
    );
  }

  if (stats.totalParticipations === 0) {
    return (
      <div className="min-h-screen bg-[linear-gradient(135deg,#FFECD0_0%,#F4F9FD_30%,#DCEEFF_68%,#F6FAFD_100%)]">
      <div className="mx-auto max-w-md px-4 py-20 text-center">
        <h1 className="text-2xl font-bold text-neutral-950">대시보드</h1>
        <p className="mt-3 text-sm text-neutral-500">
          참가 기록 없음 · 행사에 참가 기록을 추가하면 표시
        </p>
        <Button asChild className="mt-6">
          <Link href="/events">행사 찾으러 가기</Link>
        </Button>
      </div>
      </div>
    );
  }

  // 참가 전환 흐름: 지금 상태가 그 단계 이상인 기록 수("이 단계까지 온 행사").
  // 취소는 어느 단계에서 멈췄는지 알 수 없어 첫 단계(관심)에만 센다.
  const c = stats.statusCounts;
  const funnel = [
    { label: "관심", count: stats.totalParticipations, color: STATUS_COLOR.interested },
    {
      label: "신청 예정",
      count: c.planning_to_apply + c.applied + c.planning_to_attend + c.attended,
      color: STATUS_COLOR.planning_to_apply,
    },
    { label: "신청 완료", count: c.applied + c.planning_to_attend + c.attended, color: STATUS_COLOR.applied },
    { label: "참가 확정", count: c.planning_to_attend + c.attended, color: STATUS_COLOR.planning_to_attend },
    { label: "참가 완료", count: c.attended, color: STATUS_COLOR.attended },
  ];
  const insights = buildInsights(stats);
  const attendRate = stats.totalParticipations > 0 ? (c.attended / stats.totalParticipations) * 100 : 0;
  const maxCategoryProfit = Math.max(...stats.categoryProfit.map((c) => c.averageNetProfit), 1);

  return (
    <div className="min-h-screen bg-[linear-gradient(135deg,#FFECD0_0%,#F4F9FD_30%,#DCEEFF_68%,#F6FAFD_100%)]">
    <div className="mx-auto w-full max-w-5xl px-6 py-10 lg:px-8">
      <div className="flex flex-wrap items-baseline gap-x-3 gap-y-1">
        <h1 className="text-2xl font-bold text-neutral-950">대시보드</h1>
        <p className="text-sm text-neutral-500">지금까지 기록한 참가 데이터 요약</p>
      </div>

      {insights.length > 0 && (
        <section className="mt-6 rounded-3xl bg-[linear-gradient(135deg,#08648f_0%,#0a78ae_70%,#2a96c8_100%)] p-6 text-white shadow-lg shadow-[#08648f]/15">
          <h2 className="flex items-center gap-2 text-sm font-semibold text-white/80">
            <Lightbulb className="size-4" /> 종합 인사이트
          </h2>
          <ul className="mt-4 grid gap-x-8 gap-y-2.5 text-[15px] leading-6 md:grid-cols-2">
            {insights.map((line) => (
              <li key={line} className="flex gap-2.5">
                <span className="mt-2.5 size-1.5 shrink-0 rounded-full bg-white/60" />
                <span className="text-white/90">
                  {line.split("**").map((part, i) => (i % 2 ? <strong key={i} className="font-semibold text-white">{part}</strong> : part))}
                </span>
              </li>
            ))}
          </ul>
        </section>
      )}

      {/* 판단에 바로 쓰는 지표 위주. 합계 같은 총량은 각 카드 아래 작은 글씨로 남긴다. */}
      <div className="mt-6 grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-5">
        <StatTile
          label="행사당 평균 순이익"
          value={stats.averageNetProfit != null ? `${Math.round(stats.averageNetProfit).toLocaleString()}원` : "아직 기록 없음"}
          sub={
            stats.totalNetProfit != null
              ? `총 ${stats.totalNetProfit.toLocaleString()}원 · ${stats.netProfitEntryCount}건 기준`
              : undefined
          }
        />
        <StatTile
          label="투자 대비 수익률"
          value={stats.returnOnCost ? `${Math.round(stats.returnOnCost.percent).toLocaleString()}%` : "아직 기록 없음"}
          sub={
            stats.returnOnCost
              ? `비용 ${stats.returnOnCost.totalCost.toLocaleString()}원 · ${stats.returnOnCost.entryCount}건 기준`
              : "비용 입력 시 표시"
          }
        />
        <StatTile
          label="목표 매출 달성률"
          value={stats.targetAchievement ? `${Math.round(stats.targetAchievement.percent)}%` : "아직 기록 없음"}
          sub={
            stats.targetAchievement
              ? `${stats.targetAchievement.entryCount}건 기준`
              : "목표 매출 입력 시 표시"
          }
        />
        <StatTile
          label="다시 나가고 싶은 행사"
          value={
            stats.reattend ? `${Math.round((stats.reattend.yes / stats.reattend.answered) * 100)}%` : "아직 기록 없음"
          }
          sub={stats.reattend ? `${stats.reattend.answered}건 중 ${stats.reattend.yes}건` : undefined}
        />
        <StatTile
          label="다음 참가 일정"
          value={stats.nextEvent ? formatDday(stats.nextEvent.startDate) ?? "D-DAY" : "예정 없음"}
          sub={
            stats.nextEvent
              ? `${stats.nextEvent.eventName} · ${stats.nextEvent.startDate} (${STATUS_LABEL[stats.nextEvent.status]})`
              : undefined
          }
        />
      </div>

      <Card className="mt-6">
        <CardHeader>
          <CardTitle>참가 전환 흐름</CardTitle>
          <p className="text-sm font-normal text-neutral-500">
            관심 {stats.totalParticipations}건 중 {c.attended}건 참가 · 참가율 {Math.round(attendRate)}%
          </p>
        </CardHeader>
        <CardContent className={`flex flex-col gap-2 ${BAR_ROWS_HOVER_CLASS}`}>
          {funnel.map((step, i) => {
            const prev = funnel[i - 1];
            return (
              <BarRow
                key={step.label}
                label={step.label}
                value={step.count}
                max={stats.totalParticipations}
                color={step.color}
                total={stats.totalParticipations}
                note={
                  prev && prev.count > 0
                    ? `이전 단계 대비 ${Math.round((step.count / prev.count) * 100)}%`
                    : undefined
                }
              />
            );
          })}
        </CardContent>
        {c.cancelled > 0 && (
          <p className="px-5 pb-5 text-xs text-neutral-400">
            취소 {c.cancelled}건은 &lsquo;관심&rsquo;에만 포함
          </p>
        )}
      </Card>

      <Card className="mt-6">
        <CardHeader>
          <CardTitle>카테고리별 평균 순이익</CardTitle>
          <p className="text-sm font-normal text-neutral-500">
            마켓 종류별 1회 평균 순이익
          </p>
        </CardHeader>
        <CardContent className={`flex flex-col gap-2 ${BAR_ROWS_HOVER_CLASS}`}>
          {stats.categoryProfit.length === 0 ? (
            <p className="text-sm text-neutral-400">
              순이익 기록 없음 · 내 행사 상세의 &ldquo;참가 후 결과&rdquo;에서 입력
            </p>
          ) : (
            stats.categoryProfit.map((c) => (
              <BarRow
                key={c.group}
                label={c.group}
                value={c.averageNetProfit}
                max={maxCategoryProfit}
                color={GROUP_COLOR[c.group]}
                valueLabel={`${Math.round(c.averageNetProfit).toLocaleString()}원`}
                note={`${c.entryCount}건 평균${c.entryCount === 1 ? " · 참고용" : ""}`}
              />
            ))
          )}
        </CardContent>
      </Card>

      <div className="mt-6 grid gap-6 lg:grid-cols-2">

        {/* 월별 참가 추이 */}
        <Card className="min-w-0 overflow-hidden">
          <CardHeader>
            <CardTitle>월별 참가 추이</CardTitle>
            <p className="text-sm font-normal text-neutral-500">
              월별 행사 참가 흐름
            </p>
          </CardHeader>

          <CardContent>
            {stats.monthlyParticipationCounts.length === 0 ? (
              <p className="text-sm text-neutral-400">
                행사 시작일이 등록된 참가 기록 없음
              </p>
            ) : (
              <InteractiveLineChart
                format="count"
                points={stats.monthlyParticipationCounts.map((m) => ({
                  label: m.monthLabel
                    .replace("년 ", ".")
                    .replace("월", ""),
                  value: m.count,
                  title: m.monthLabel,
                }))}
              />
            )}
          </CardContent>
        </Card>


        {/* 행사별 매출 추이 */}
        <Card className="min-w-0 overflow-hidden">
          <CardHeader>
            <CardTitle>행사별 매출 추이</CardTitle>
            <p className="text-sm font-normal text-neutral-500">
              참가한 행사별 매출 성과 비교
            </p>
          </CardHeader>

          <CardContent>
            {stats.eventRevenueTrend.length === 0 ? (
              <p className="text-sm text-neutral-400">
                매출 기록 없음 · 내 행사 상세의 &ldquo;참가 후 결과&rdquo;에서 입력
              </p>
            ) : (
              <InteractiveLineChart
                color="#F2542D"
                format="currency"
                points={stats.eventRevenueTrend.map((e) => ({
                  label:
                    e.eventName.length > 6
                      ? `${e.eventName.slice(0, 6)}…`
                      : e.eventName,

                  value: e.revenue,

                  title: e.eventName,

                  meta: e.startDate,

                  sublabel:
                    e.netProfit != null
                      ? `순이익 ${e.netProfit.toLocaleString()}원`
                      : undefined,
                }))}
              />
            )}
          </CardContent>
        </Card>

      </div>

      <div className="mt-6">
        {stats.popularProducts.length === 0 ? (
          <Card>
            <CardHeader>
              <CardTitle>인기 품목 분석</CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-sm text-neutral-400">
                상품별 판매 실적 없음 · 내 행사 상세의 &ldquo;상품별 판매 실적&rdquo;에서 입력
              </p>
            </CardContent>
          </Card>
        ) : (
          <div className="grid gap-6 lg:grid-cols-2">
            <Card className="overflow-hidden">
              <CardHeader>
                <CardTitle>품목별 매출 비교</CardTitle>
                <p className="text-sm text-neutral-500">
                  매출을 가장 많이 만든 상품 비교
                </p>
              </CardHeader>
              <CardContent>
                <ProductRevenueAreaChart
                  items={stats.popularProducts.map((p) => ({
                    label: p.productName,
                    value: p.totalRevenue,
                  }))}
                />
              </CardContent>
            </Card>

            <Card className="overflow-hidden">
              <CardHeader>
                <CardTitle>품목별 판매 수량 추이</CardTitle>
                <p className="text-sm text-neutral-500">
                  판매 수량 상위 품목의 행사별 판매 수량
                </p>
              </CardHeader>
              <CardContent>
                <ProductSalesTrendChart
                  events={stats.productSalesByEvent.events}
                  series={stats.productSalesByEvent.series}
                />
              </CardContent>
            </Card>
          </div>
        )}
      </div>

      <p className="mt-6 text-xs text-neutral-400">
        매출·순이익·만족도는 내 행사 상세에서 직접 입력한 기록만 집계됩니다. 입력하지 않은 값은
        &lsquo;아직 기록 없음&rsquo;으로 표시됩니다.
      </p>
    </div>
    </div>
  );
}

function StatTile({ label, value, sub }: { label: string; value: string; sub?: string }) {
  return (
    <div className="rounded-xl border border-neutral-200 bg-white p-4">
      <p className="text-xs text-neutral-500">{label}</p>
      <p className="mt-1 text-xl font-semibold text-neutral-950">{value}</p>
      {sub && <p className="mt-1 text-xs text-neutral-400">{sub}</p>}
    </div>
  );
}
