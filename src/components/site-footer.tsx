import Link from "next/link";
import { cn } from "@/lib/utils";

// 푸터 내용 — 문구·링크는 여기서만 고치면 된다.
const FOOTER = {
  description: "전국 셀러 모집 공고와 내 판매 기록으로 다음에 나갈 마켓을 고르는 셀러를 위한 행사 지도.",
  github: "https://github.com/alswjd5991/Marketfit",
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
 * 모든 페이지 하단 공통 푸터. 구성: 위 줄 = 왼쪽 로고·설명 / 오른쪽 메뉴, 구분선, 아래 줄 = 왼쪽 저작권 / 오른쪽 깃허브.
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

        <div className="mt-10 flex items-center justify-between gap-4 border-t border-[#DCEAF5] pt-6">
          <p className="text-[13px] text-[#8A8D93]">{FOOTER.copyright}</p>
          <a
            href={FOOTER.github}
            target="_blank"
            rel="noreferrer"
            aria-label="GitHub 저장소"
            title="GitHub"
            className="flex size-9 items-center justify-center rounded-full bg-white text-[#55585E] shadow-sm ring-1 ring-[#DCEAF5] transition-colors hover:text-brand"
          >
            <svg viewBox="0 0 16 16" className="size-[18px]" fill="currentColor" aria-hidden>
              <path d="M8 0C3.58 0 0 3.58 0 8c0 3.54 2.29 6.53 5.47 7.59.4.07.55-.17.55-.38 0-.19-.01-.82-.01-1.49-2.01.37-2.53-.49-2.69-.94-.09-.23-.48-.94-.82-1.13-.28-.15-.68-.52-.01-.53.63-.01 1.08.58 1.23.82.72 1.21 1.87.87 2.33.66.07-.52.28-.87.51-1.07-1.78-.2-3.64-.89-3.64-3.95 0-.87.31-1.59.82-2.15-.08-.2-.36-1.02.08-2.12 0 0 .67-.21 2.2.82.64-.18 1.32-.27 2-.27.68 0 1.36.09 2 .27 1.53-1.04 2.2-.82 2.2-.82.44 1.1.16 1.92.08 2.12.51.56.82 1.27.82 2.15 0 3.07-1.87 3.75-3.65 3.95.29.25.54.73.54 1.48 0 1.07-.01 1.93-.01 2.2 0 .21.15.46.55.38A8.013 8.013 0 0016 8c0-4.42-3.58-8-8-8z" />
            </svg>
          </a>
        </div>
      </div>
    </footer>
  );
}
