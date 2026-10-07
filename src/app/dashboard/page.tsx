import { CenteredNotice } from "@/components/page-header";
import { getCurrentUser } from "@/features/store/data";
import { getDashboardStats } from "@/features/dashboard/data";
import { DashboardView } from "@/features/dashboard/dashboard-view";
import { getDashboardAnalytics } from "@/features/analytics/data";


export default async function DashboardPage() {
  const user = await getCurrentUser();
  if (!user) {
    return <CenteredNotice level={2} title="대시보드" text="로그인 후 이용 가능" href="/login" cta="로그인" />;
  }

  // 기본 통계(내 기록)와 통계 분석(여러 가게 기록 기반)은 서로 기다릴 필요가 없어 동시에 계산한다.
  const [stats, analytics] = await Promise.all([getDashboardStats(), getDashboardAnalytics()]);
  if (!stats) return <CenteredNotice level={2} title="대시보드" text="가게 등록 후 이용 가능" href="/store" cta="가게 등록" />;
  if (stats.totalParticipations === 0) {
    return <CenteredNotice level={2} title="대시보드" text="참가 기록 없음" href="/events" cta="행사 찾기" />;
  }
  return <DashboardView stats={stats} analytics={analytics} />;
}
