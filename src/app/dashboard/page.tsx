import { CenteredNotice } from "@/components/page-header";
import { getCurrentUser } from "@/features/store/data";
import { getDashboardStats } from "@/features/dashboard/data";
import { DashboardView } from "@/features/dashboard/dashboard-view";


export default async function DashboardPage() {
  const user = await getCurrentUser();
  if (!user) {
    return <CenteredNotice title="대시보드" text="로그인 후 이용할 수 있어요." href="/login" cta="로그인" />;
  }

  const stats = await getDashboardStats();
  if (!stats) return <CenteredNotice title="대시보드" text="가게를 먼저 등록해 주세요." href="/store" cta="가게 등록" />;
  if (stats.totalParticipations === 0) {
    return <CenteredNotice title="대시보드" text="아직 참가 기록이 없어요." href="/events" cta="행사 찾기" />;
  }
  return <DashboardView stats={stats} />;
}
