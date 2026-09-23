import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { signOut } from "@/features/auth/actions";
import { NavLinks } from "./nav-links";

export async function NavBar() {
  const user = await getCurrentUser();

  return (
    <header className="sticky top-0 z-40 border-b border-neutral-200/80 bg-background/85 backdrop-blur">
      <div className="mx-auto flex h-16 max-w-6xl items-center justify-between px-4">
        <Link href="/" className="flex items-center gap-1.5 font-bold tracking-tight text-neutral-950">
          <span className="inline-block size-2 rounded-full bg-brand" aria-hidden />
          마켓핏
        </Link>
        <nav className="hidden items-center gap-7 text-sm sm:flex">
          <NavLinks />
          {user ? (
            <form action={signOut} className="flex items-center gap-3 border-l border-neutral-200 pl-7">
              <span className="text-neutral-400">{user.email}</span>
              <button type="submit" className="text-neutral-600 transition-colors hover:text-neutral-950">
                로그아웃
              </button>
            </form>
          ) : (
            <Link
              href="/login"
              className="rounded-lg bg-brand px-3.5 py-1.5 text-white transition-colors hover:bg-brand-dark"
            >
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
