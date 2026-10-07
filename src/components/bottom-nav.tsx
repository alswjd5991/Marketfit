"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/utils";
import { CalendarSearch, Ticket, LayoutDashboard, Store } from "lucide-react";
import { BotIcon } from "@/components/bot-icon";

const ITEMS = [
  { href: "/events", label: "행사 찾기", icon: CalendarSearch },
  { href: "/my-events", label: "내 행사", icon: Ticket },
  { href: "/dashboard", label: "대시보드", icon: LayoutDashboard },
  { href: "/ai", label: "AI 도우미", icon: BotIcon },
  { href: "/store", label: "내 가게", icon: Store },
] as const;

/** 행사 현장에서 휴대폰으로 기록할 일이 많다는 전제(43번 항목)의 모바일 하단 탭바 */
export function BottomNav() {
  const pathname = usePathname();

  return (
    <nav className="fixed inset-x-0 bottom-0 z-40 border-t border-neutral-200/80 bg-white/95 backdrop-blur sm:hidden">
      <div className="grid grid-cols-5">
        {ITEMS.map(({ href, label, icon: Icon }) => {
          const active = pathname.startsWith(href);
          return (
            <Link
              key={href}
              href={href}
              className={cn(
                "flex flex-col items-center gap-1 py-2.5 text-[11px] transition-colors",
                active ? "font-medium text-brand" : "text-neutral-400"
              )}
            >
              <Icon className={cn("size-5", active && "text-brand")} />
              {label}
            </Link>
          );
        })}
      </div>
    </nav>
  );
}
