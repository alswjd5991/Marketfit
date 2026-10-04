import Link from "next/link";
import { Button } from "@/components/ui/button";
import { getCurrentUser } from "@/features/store/data";
import { getDashboardStats } from "@/features/dashboard/data";
import { DashboardView } from "@/features/dashboard/dashboard-view";


export default async function DashboardPage() {
  const user = await getCurrentUser();
  if (!user) {
    return (
      <EmptyState text="로그인하면 내 참가 기록을 볼 수 있어요." href="/login" cta="로그인" />
    );
  }

  const stats = await getDashboardStats();
  if (!stats) return <EmptyState text="가게를 먼저 등록해 주세요." href="/store" cta="가게 등록" />;
  if (stats.totalParticipations === 0) {
    return <EmptyState text="아직 참가 기록이 없어요." href="/events" cta="행사 찾기" />;
  }
  return <DashboardView stats={stats} />;
}

function EmptyState({ text, href, cta }: { text: string; href: string; cta: string }) {
  return (
    <div className="mx-auto max-w-md px-4 py-24 text-center">
      <h1 className="text-2xl font-bold text-neutral-950">대시보드</h1>
      <p className="mt-3 text-sm text-neutral-500">{text}</p>
      <Button asChild className="mt-6">
        <Link href={href}>{cta}</Link>
      </Button>
    </div>
  );
}
