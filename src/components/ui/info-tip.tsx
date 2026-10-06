import type { ReactNode } from "react";
import { CircleHelp } from "lucide-react";

/**
 * 제목 옆 물음표 아이콘 — 마우스를 올리거나(키보드로 초점을 주면) 부가 설명이 뜬다.
 * 화면은 깔끔하게 두고, 계산 방법·기준·안내 문구는 여기로 보낸다. CSS만 써서 서버 컴포넌트에서도 쓸 수 있다.
 */
export function InfoTip({ children, label = "설명 보기", align = "center" }: { children: ReactNode; label?: string; align?: "center" | "left" | "right" }) {
  const position = { center: "left-1/2 -translate-x-1/2", left: "left-0", right: "right-0" }[align];
  return (
    <span className="group/tip relative inline-flex align-middle">
      <button
        type="button"
        aria-label={label}
        className="inline-flex rounded-full text-neutral-400 transition-colors hover:text-neutral-600 focus:outline-none focus-visible:text-neutral-700 focus-visible:ring-2 focus-visible:ring-brand/40"
      >
        <CircleHelp className="size-4" strokeWidth={2} />
      </button>
      <span
        role="tooltip"
        className={`pointer-events-none invisible absolute top-full z-30 mt-2 w-72 max-w-[80vw] rounded-xl bg-neutral-900/95 px-3.5 py-3 text-left text-[12px] font-normal leading-5 text-white opacity-0 shadow-lg transition-opacity duration-150 group-hover/tip:visible group-hover/tip:opacity-100 group-focus-within/tip:visible group-focus-within/tip:opacity-100 ${position}`}
      >
        {children}
      </span>
    </span>
  );
}
