"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/utils";

const NAV_ITEMS = [
  { href: "/events", label: "행사 찾기" },
  { href: "/my-events", label: "내 행사" },
  { href: "/dashboard", label: "대시보드" },
  { href: "/ai", label: "AI 도우미" },
  { href: "/store", label: "내 가게" },
] as const;

/** 데스크톱 상단 네비게이션의 현재 위치 표시. usePathname이 필요해서만
 *  클라이언트 컴포넌트로 분리했고, 로그인 상태 표시·로그아웃 폼은 여전히
 *  서버 컴포넌트인 nav-bar.tsx가 담당한다. */
export function NavLinks() {
  const pathname = usePathname();

  return (
    <>
      {NAV_ITEMS.map((item) => {
        const active = pathname.startsWith(item.href);
        return (
          <Link
            key={item.href}
            href={item.href}
            className={cn(
              "relative py-1 transition-colors hover:text-neutral-950",
              active ? "font-medium text-neutral-950" : "text-neutral-600"
            )}
          >
            {item.label}
            {active && <span className="absolute -bottom-[13px] left-0 right-0 h-0.5 rounded-full bg-brand" />}
          </Link>
        );
      })}
    </>
  );
}
