"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useLayoutEffect, useRef, useState } from "react";
import { cn } from "@/lib/utils";

const NAV_ITEMS = [
  { href: "/events", label: "행사 찾기" },
  { href: "/my-events", label: "내 행사" },
  { href: "/dashboard", label: "대시보드" },
  { href: "/ai", label: "AI 도우미" },
  { href: "/store", label: "내 가게" },
] as const;

export function NavLinks() {
  const pathname = usePathname();

  const linkRefs = useRef<(HTMLAnchorElement | null)[]>([]);
  const [indicator, setIndicator] = useState({
    x: 0,
    width: 0,
  });

  useLayoutEffect(() => {
    const activeIndex = NAV_ITEMS.findIndex((item) =>
      pathname.startsWith(item.href)
    );

    // 메인 페이지처럼 활성 메뉴가 없으면 밑줄 숨기기
    if (activeIndex === -1) {
      setIndicator({
        x: 0,
        width: 0,
      });
      return;
    }

    const activeLink = linkRefs.current[activeIndex];

    if (!activeLink) {
      setIndicator({
        x: 0,
        width: 0,
      });
      return;
    }

    const updateIndicator = () => {
      setIndicator({
        x: activeLink.offsetLeft,
        width: activeLink.offsetWidth,
      });
    };

    updateIndicator();

    window.addEventListener("resize", updateIndicator);

    return () => {
      window.removeEventListener("resize", updateIndicator);
    };
  }, [pathname]);

  return (
    <div className="relative flex items-center gap-9">
      {NAV_ITEMS.map((item, index) => {
        const active = pathname.startsWith(item.href);

        return (
          <Link
            key={item.href}
            ref={(element) => {
              linkRefs.current[index] = element;
            }}
            href={item.href}
            className={cn(
              "relative py-1 transition-colors duration-200 hover:text-neutral-950",
              active
                ? "font-medium text-neutral-950"
                : "text-neutral-600"
            )}
          >
            {item.label}
          </Link>
        );
      })}

      {/* 움직이는 활성 메뉴 밑줄 */}
      <span
        className="
          pointer-events-none
          absolute -bottom-[13px] left-0
          h-0.5 rounded-full bg-brand
          transition-[transform,width,opacity]
          duration-300
          ease-[cubic-bezier(0.22,1,0.36,1)]
        "
        style={{
          width: `${indicator.width}px`,
          transform: `translateX(${indicator.x}px)`,
          opacity: indicator.width > 0 ? 1 : 0,
        }}
      />
    </div>
  );
}