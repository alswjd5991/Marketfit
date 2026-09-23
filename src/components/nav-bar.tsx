import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { signOut } from "@/features/auth/actions";

const NAV_ITEMS = [
  { href: "/events", label: "행사 찾기" },
  { href: "/my-events", label: "내 행사" },
  { href: "/dashboard", label: "대시보드" },
  { href: "/ai", label: "AI 도우미" },
  { href: "/store", label: "내 가게" },
] as const;

export async function NavBar() {
  const user = await getCurrentUser();

  return (
    <header className="sticky top-0 z-40 border-b border-neutral-200 bg-white/80 backdrop-blur">
      <div className="mx-auto flex h-14 max-w-6xl items-center justify-between px-4">
        <Link href="/" className="font-semibold tracking-tight text-neutral-900">
          마켓핏
        </Link>
        <nav className="hidden items-center gap-6 text-sm text-neutral-600 sm:flex">
          {NAV_ITEMS.map((item) => (
            <Link key={item.href} href={item.href} className="hover:text-neutral-950">
              {item.label}
            </Link>
          ))}
          {user ? (
            <form action={signOut} className="flex items-center gap-3">
              <span className="text-neutral-400">{user.email}</span>
              <button type="submit" className="hover:text-neutral-950">
                로그아웃
              </button>
            </form>
          ) : (
            <Link href="/login" className="hover:text-neutral-950">
              로그인
            </Link>
          )}
        </nav>
        {/* 모바일: 행사 현장에서 휴대폰으로 쓰는 경우가 많으므로 하단 탭바로 별도 제공(BottomNav) */}
      </div>
    </header>
  );
}

async function getCurrentUser() {
  if (!process.env.NEXT_PUBLIC_SUPABASE_URL) return null; // Supabase 미연결 시 안전하게 로그아웃 상태로
  try {
    const supabase = await createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();
    return user;
  } catch {
    return null; // 네트워크 오류로 사이트 전체가 죽지 않도록(62번 항목)
  }
}
