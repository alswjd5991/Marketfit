import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { signOut } from "@/features/auth/actions";
import { NavLinks } from "./nav-links";

export async function NavBar() {
  const user = await getCurrentUser();

  const displayName = user
    ? user.user_metadata?.name ??
      user.user_metadata?.full_name ??
      user.user_metadata?.nickname ??
      "내 계정"
    : null;

  return (
    <header
      className="
        sticky top-0 z-40
        border-b border-[#DDE7EF]
        bg-[#FAFBFC]/95
        backdrop-blur-lg
      "
    >
      <div className="mx-auto flex h-16 max-w-6xl items-center justify-between px-4">

        {/* 로고 */}
        <Link
          href="/"
          className="flex items-center font-bold tracking-tight text-neutral-950"
        >
          <span className="text-[17px]">
            Marketfit
          </span>
          <span className="text-[17px] text-brand">
            .
          </span>
        </Link>

        {/* 메뉴 */}
        <nav className="hidden items-center gap-7 text-sm sm:flex">
          <NavLinks />

          {user ? (
            <form
              action={signOut}
              className="flex items-center gap-3 border-l border-neutral-300/50 pl-7"
            >
              <span className="max-w-[120px] truncate text-neutral-500">
                {displayName}
              </span>

              <button
                type="submit"
                className="text-neutral-600 transition-colors hover:text-neutral-950"
              >
                로그아웃
              </button>
            </form>
          ) : (
            <Link
              href="/login"
              className="
                rounded-lg bg-brand px-3.5 py-1.5
                text-white
                transition-colors hover:bg-brand-dark
              "
            >
              로그인
            </Link>
          )}
        </nav>

        {/* 모바일은 BottomNav 사용 */}
      </div>
    </header>
  );
}

async function getCurrentUser() {
  if (!process.env.NEXT_PUBLIC_SUPABASE_URL) return null;

  try {
    const supabase = await createClient();

    const {
      data: { user },
    } = await supabase.auth.getUser();

    return user;
  } catch {
    return null;
  }
}