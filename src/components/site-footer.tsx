import Link from "next/link";
import { cn } from "@/lib/utils";

// 푸터 내용 — 문구·링크는 여기서만 고치면 된다.
const FOOTER = {
  description: "전국 셀러 모집 공고부터 내 판매 성과까지, 셀러 맞춤 정보로 선택하세요.",
  copyright: "© 2026 Marketfit. All rights reserved.",
};

const MENU = [
  { href: "/events", label: "행사 찾기" },
  { href: "/my-events", label: "내 행사" },
  { href: "/dashboard", label: "대시보드" },
  { href: "/ai", label: "AI 도우미" },
  { href: "/store", label: "내 가게" },
];

/**
 * 모든 페이지 하단 공통 푸터. 구성: 위 줄 = 왼쪽 로고·설명 / 오른쪽 메뉴, 구분선, 아래 줄 = 저작권.
 * 색은 사이트의 하늘·구름 톤(옅은 하늘 바탕, 차콜 글자, 브랜드 블루 강조).
 */
export function SiteFooter({ className }: { className?: string }) {
  return (
    <footer className={cn("border-t border-[#DCEAF5] bg-[#F3F8FC]", className)}>
      <div className="mx-auto w-full max-w-7xl px-6 pb-8 pt-12 sm:px-8">
        <div className="flex flex-col gap-8 md:flex-row md:items-start md:justify-between">
          <div className="max-w-sm">
            <Link href="/" className="font-logo text-[28px] font-semibold leading-none tracking-[-0.02em] text-[#1F2023]">
              Marketfit<span className="text-brand">.</span>
            </Link>
            <p className="mt-3 break-keep text-sm leading-6 text-[#6B6E74]">{FOOTER.description}</p>
          </div>

          <nav aria-label="푸터 메뉴" className="flex flex-wrap gap-x-7 gap-y-3 md:pt-2">
            {MENU.map((m) => (
              <Link key={m.href} href={m.href} className="text-[13px] font-semibold tracking-wide text-[#55585E] transition-colors hover:text-brand">
                {m.label}
              </Link>
            ))}
          </nav>
        </div>

        <div className="mt-10 border-t border-[#DCEAF5] pt-6">
          <p className="text-[13px] text-[#8A8D93]">{FOOTER.copyright}</p>
        </div>
      </div>
    </footer>
  );
}
