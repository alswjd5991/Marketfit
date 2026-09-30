import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { BarRow } from "@/components/ui/bar-row";
import { LineChart } from "@/components/ui/line-chart";
import { getCurrentUser } from "@/features/store/data";
import { getDashboardStats, POPULAR_PRODUCTS_LIMIT } from "@/features/dashboard/data";
import { STATUS_LABEL, STATUS_ORDER } from "@/features/participations/status-labels";
import { getCategoryGroup, type CategoryGroup } from "@/features/events/category-group";
import type { ParticipationStatus } from "@/types/database";

// 상태 진행(관심→신청예정→신청완료→참가예정)은 파란 순차(ordinal) 램프로 —
// "정도"를 나타내는 값이라 색상 정체성보다 명암 순서가 맞다. 참가완료/취소는
// 결과가 갈리는 상태라 고정 status 팔레트(good/critical)를 쓴다.
// (dataviz 스킬 references/palette.md 기준)
const STATUS_COLOR: Record<ParticipationStatus, string> = {
  interested: "#86b6ef",
  planning_to_apply: "#5598e7",
  applied: "#2a78d6",
  planning_to_attend: "#1c5cab",
  attended: "#0ca30c",
  cancelled: "#d03b3b",
};

// events.category는 원문 그대로(21종+) 저장돼 있어 막대 라벨은 그 문구를
// 그대로 쓰되, 색은 category-group.ts의 대분류 6종 기준으로 고정 배정한다 —
// 원문 카테고리가 늘어나도 같은 대분류는 항상 같은 색으로 보이게.
const GROUP_COLOR: Record<CategoryGroup, string> = {
  플리마켓: "#2a78d6",
  "축제 부스": "#eb6834",
  시즌마켓: "#1baf7a",
  야시장: "#eda100",
  "대학 마켓": "#e87ba4",
  "아트·디자인 마켓": "#4a3aa7",
};

export default async function DashboardPage() {
  const user = await getCurrentUser();
  if (!user) {
    return (
      <div className="mx-auto max-w-md px-4 py-20 text-center">
        <h1 className="text-xl font-semibold text-neutral-900">대시보드</h1>
        <p className="mt-3 text-sm text-neutral-500">참가 데이터를 보려면 먼저 로그인해 주세요.</p>
        <Button asChild className="mt-6">
          <Link href="/login">로그인하러 가기</Link>
        </Button>
      </div>
    );
  }

  const stats = await getDashboardStats();

  if (!stats) {
    return (
      <div className="mx-auto max-w-md px-4 py-20 text-center">
        <h1 className="text-xl font-semibold text-neutral-900">대시보드</h1>
        <p className="mt-3 text-sm text-neutral-500">먼저 가게를 등록해 주세요.</p>
        <Button asChild className="mt-6">
          <Link href="/store">가게 등록하러 가기</Link>
        </Button>
      </div>
    );
  }

  if (stats.totalParticipations === 0) {
    return (
      <div className="mx-auto max-w-md px-4 py-20 text-center">
        <h1 className="text-xl font-semibold text-neutral-900">대시보드</h1>
        <p className="mt-3 text-sm text-neutral-500">
          아직 참가 기록이 없어서 보여드릴 통계가 없어요. 행사에 참가 기록을 추가하면 여기 채워집니다.
        </p>
        <Button asChild className="mt-6">
          <Link href="/events">행사 찾으러 가기</Link>
        </Button>
      </div>
    );
  }

  const maxStatusCount = Math.max(...STATUS_ORDER.map((s) => stats.statusCounts[s]), 1);
  const categoryEntries = Object.entries(stats.categoryCounts).sort((a, b) => b[1] - a[1]);
  const maxCategoryCount = Math.max(...categoryEntries.map(([, count]) => count), 1);
  const maxProductRevenue = Math.max(...stats.popularProducts.map((p) => p.totalRevenue), 1);

  return (
    <div className="mx-auto max-w-2xl px-4 py-8">
      <h1 className="text-xl font-bold text-neutral-950">대시보드</h1>
      <p className="mt-1 text-sm text-neutral-500">지금까지 기록한 참가 데이터 요약이에요.</p>

      <div className="mt-6 grid grid-cols-2 gap-3 sm:grid-cols-3">
        <StatTile label="총 참가 행사" value={`${stats.totalParticipations}건`} />
        <StatTile label="참가 완료" value={`${stats.statusCounts.attended}건`} />
        <StatTile
          label="총 매출 합계"
          value={stats.totalRevenue != null ? `${stats.totalRevenue.toLocaleString()}원` : "아직 기록 없음"}
          sub={stats.totalRevenue != null ? `${stats.revenueEntryCount}건 기준` : undefined}
        />
        <StatTile
          label="총 순이익 합계"
          value={
            stats.totalNetProfit != null ? `${stats.totalNetProfit.toLocaleString()}원` : "아직 기록 없음"
          }
          sub={stats.totalNetProfit != null ? `${stats.netProfitEntryCount}건 기준` : undefined}
        />
        <StatTile
          label="평균 만족도"
          value={stats.averageSatisfaction != null ? `${stats.averageSatisfaction.toFixed(1)} / 5` : "아직 기록 없음"}
          sub={stats.averageSatisfaction != null ? `${stats.satisfactionEntryCount}건 기준` : undefined}
        />
      </div>

      <Card className="mt-6">
        <CardHeader>
          <CardTitle>참가 상태 분포</CardTitle>
        </CardHeader>
        <CardContent className="flex flex-col gap-2">
          {STATUS_ORDER.map((s) => (
            <BarRow
              key={s}
              label={STATUS_LABEL[s]}
              value={stats.statusCounts[s]}
              max={maxStatusCount}
              color={STATUS_COLOR[s]}
            />
          ))}
        </CardContent>
      </Card>

      {categoryEntries.length > 0 && (
        <Card className="mt-6">
          <CardHeader>
            <CardTitle>카테고리별 참가 분포</CardTitle>
          </CardHeader>
          <CardContent className="flex flex-col gap-2">
            {categoryEntries.map(([category, count]) => (
              <BarRow
                key={category}
                label={category}
                value={count}
                max={maxCategoryCount}
                color={GROUP_COLOR[getCategoryGroup(category, category)]}
              />
            ))}
          </CardContent>
        </Card>
      )}

      <Card className="mt-6">
        <CardHeader>
          <CardTitle>월별 참가 추이</CardTitle>
        </CardHeader>
        <CardContent>
          {stats.monthlyParticipationCounts.length === 0 ? (
            <p className="text-sm text-neutral-400">
              행사 시작일이 등록된 참가 기록이 없어서 월별 추이를 보여드릴 수 없어요.
            </p>
          ) : (
            <LineChart
              points={stats.monthlyParticipationCounts.map((m) => ({
                label: m.monthLabel.replace("년 ", ".").replace("월", ""),
                value: m.count,
                title: `${m.monthLabel}: ${m.count}건`,
              }))}
              valueFormatter={(v) => `${v}건`}
            />
          )}
        </CardContent>
      </Card>

      <Card className="mt-6">
        <CardHeader>
          <CardTitle>행사별 매출 추이</CardTitle>
        </CardHeader>
        <CardContent>
          {stats.eventRevenueTrend.length === 0 ? (
            <p className="text-sm text-neutral-400">
              총 매출을 입력한 참가 기록이 없어서 매출 추이를 보여드릴 수 없어요. 내 행사 상세의
              &ldquo;참가 후 결과&rdquo;에서 매출을 입력하면 여기 채워집니다.
            </p>
          ) : (
            <LineChart
              color="#1baf7a"
              points={stats.eventRevenueTrend.map((e) => ({
                label: e.eventName.length > 6 ? `${e.eventName.slice(0, 6)}…` : e.eventName,
                value: e.revenue,
                sublabel: e.netProfit != null ? `순이익 ${e.netProfit.toLocaleString()}원` : undefined,
                title: `${e.eventName} (${e.startDate}): 매출 ${e.revenue.toLocaleString()}원${
                  e.netProfit != null ? ` · 순이익 ${e.netProfit.toLocaleString()}원` : ""
                }`,
              }))}
              valueFormatter={(v) => `${v.toLocaleString()}원`}
            />
          )}
        </CardContent>
      </Card>

      <Card className="mt-6">
        <CardHeader>
          <CardTitle>인기 품목 TOP {POPULAR_PRODUCTS_LIMIT}</CardTitle>
        </CardHeader>
        <CardContent className="flex flex-col gap-2">
          {stats.popularProducts.length === 0 ? (
            <p className="text-sm text-neutral-400">
              아직 상품별 판매 실적이 없어서 인기 품목을 보여드릴 수 없어요. 내 행사 상세의
              &ldquo;상품별 판매 실적&rdquo;에서 판매 내역을 기록하면 여기 채워집니다.
            </p>
          ) : (
            stats.popularProducts.map((p) => (
              <BarRow
                key={p.productName}
                label={p.productName}
                value={p.totalRevenue}
                max={maxProductRevenue}
                color="#1baf7a"
                valueLabel={`${p.totalRevenue.toLocaleString()}원`}
              />
            ))
          )}
        </CardContent>
      </Card>

      <p className="mt-6 text-xs text-neutral-400">
        매출·순이익·만족도는 내 행사 상세에서 직접 입력한 기록만 집계돼요. 아직 입력하지 않은 값은
        0원으로 지어내지 않고 &ldquo;아직 기록 없음&rdquo;으로 표시합니다.
      </p>
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
