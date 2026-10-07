import type { ReactNode } from "react";
import { CircleHelp } from "lucide-react";

/**
 * 제목 옆 물음표 아이콘 — 마우스를 올리거나(키보드로 초점을 주면) 부가 설명이 뜬다.
 * 화면은 깔끔하게 두고, 계산 방법·기준·안내 문구는 여기로 보낸다. CSS만 써서 서버 컴포넌트에서도 쓸 수 있다.
 * 숨어 있을 때는 자리를 차지하지 않게 display로 감춘다(보이지 않는 말풍선이 가로 스크롤을 만들지 않도록).
 * 기본은 아이콘에서 오른쪽으로 펼친다(제목 옆 아이콘이 왼쪽에 있어 화면 밖으로 잘리지 않게). 오른쪽 끝 아이콘은 align="right".
 */
export function InfoTip({ children, label = "설명 보기", align = "left" }: { children: ReactNode; label?: string; align?: "center" | "left" | "right" }) {
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
        className={`pointer-events-none absolute top-full z-30 mt-2 hidden w-72 max-w-[calc(100vw-2rem)] rounded-xl border border-[#CFE6F5] bg-[#F5FAFE] px-3.5 py-3 text-left text-[12px] font-normal leading-5 text-[#2B4A63] shadow-[0_10px_28px_rgba(40,80,120,0.16)] group-hover/tip:block group-focus-within/tip:block ${position}`}
      >
        {children}
      </span>
    </span>
  );
}
