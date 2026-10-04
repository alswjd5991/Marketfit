import Link from "next/link";
import type { ReactNode } from "react";

/** 모든 페이지 공통 제목. 크기·굵기·간격을 한곳에서 맞춘다. */
export function PageHeader({ title, sub, actions }: { title: ReactNode; sub?: ReactNode; actions?: ReactNode }) {
  return (
    <div className="mb-6 flex flex-wrap items-end justify-between gap-3 sm:mb-8">
      <div className="min-w-0">
        <h1 className="text-[26px] font-extrabold leading-tight tracking-[-0.03em] text-neutral-950 sm:text-[32px]">{title}</h1>
        {sub && <p className="mt-1.5 text-[15px] text-neutral-500">{sub}</p>}
      </div>
      {actions}
    </div>
  );
}

/** 로그인 필요·빈 상태처럼 화면 가운데 안내 한 줄 + 버튼 하나만 있는 페이지. */
export function CenteredNotice({ title, text, href, cta }: { title: string; text: string; href: string; cta: string }) {
  return (
    <div className="mx-auto max-w-md px-4 py-24 text-center">
      <h1 className="text-[26px] font-extrabold tracking-[-0.03em] text-neutral-950">{title}</h1>
      <p className="mt-3 text-[15px] text-neutral-500">{text}</p>
      <Link
        href={href}
        className="mt-6 inline-flex h-11 items-center rounded-xl bg-brand px-6 text-sm font-semibold text-white transition-colors hover:bg-brand-dark"
      >
        {cta}
      </Link>
    </div>
  );
}
