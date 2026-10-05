import { cn } from "@/lib/utils";

// 푸터에 보이는 정보 — 팀 이름·연락처는 여기서만 고치면 된다.
const FOOTER = {
  eyebrow: "SELLER EVENT MAP",
  links: [
    { label: "github", text: "github.com/alswjd5991/Marketfit", href: "https://github.com/alswjd5991/Marketfit" },
    { label: "data", text: "전국 셀러 모집 공고 · 공공데이터", href: null },
  ],
  copyright: "© 2026 Marketfit",
  note: "셀러 계정의 판매·참가 기록 중 일부는 시연용 예시 데이터입니다.",
};

/** 모든 페이지 하단 공통 푸터(어두운 차콜 바탕 + 큰 로고). */
export function SiteFooter({ className }: { className?: string }) {
  return (
    <footer className={cn("bg-[#1F2023] text-white", className)}>
      <div className="mx-auto flex w-full max-w-7xl flex-col gap-10 px-6 py-14 sm:px-8 lg:flex-row lg:items-end lg:justify-between lg:py-16">
        <div>
          <p className="font-mono text-[13px] tracking-[0.2em] text-[#8A8D93]">{FOOTER.eyebrow}</p>
          <p className="mt-4 font-logo text-6xl font-semibold leading-none tracking-[-0.02em] sm:text-7xl">
            Marketfit<span className="text-[#5BB3DA]">.</span>
          </p>
          <dl className="mt-10 space-y-2.5 text-[15px]">
            {FOOTER.links.map((l) => (
              <div key={l.label} className="flex items-baseline gap-4">
                <dt className="w-14 font-mono text-[13px] text-[#8A8D93]">{l.label}</dt>
                <dd>
                  {l.href ? (
                    <a href={l.href} target="_blank" rel="noreferrer" className="border-b border-white/40 pb-0.5 transition-colors hover:border-white">
                      {l.text}
                    </a>
                  ) : (
                    <span className="text-[#DEDFE3]">{l.text}</span>
                  )}
                </dd>
              </div>
            ))}
          </dl>
        </div>
        <div className="text-sm leading-6 text-[#8A8D93] lg:text-right">
          <p>{FOOTER.copyright}</p>
          <p>{FOOTER.note}</p>
        </div>
      </div>
    </footer>
  );
}
