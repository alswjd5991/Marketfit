import type { ReactNode } from "react";

/** 목적이 같은 차트 묶음. 묶음이 바뀔 때마다 구분선 + 소제목으로 나눈다. */
export function Group({ title, first = false, children }: { title: string; first?: boolean; children: ReactNode }) {
  return (
    <section className={first ? "mt-8" : "mt-10 border-t border-neutral-300/60 pt-8"}>
      <h2 className="mb-4 text-lg font-bold text-neutral-950">{title}</h2>
      {children}
    </section>
  );
}

/** title을 비우면 제목 줄을 자식(드롭다운이 붙은 차트)이 직접 그린다. */
export function Panel({ title, className = "", children }: { title?: string; className?: string; children: ReactNode }) {
  return (
    <div className={`min-w-0 rounded-2xl border border-white/80 bg-white/85 shadow-[0_8px_24px_rgba(40,80,120,0.06)] backdrop-blur-sm p-5 sm:p-6 ${className}`}>
      {title && <h2 className="mb-5 text-[15px] font-semibold text-neutral-900">{title}</h2>}
      {children}
    </div>
  );
}

export function Empty({ children }: { children: ReactNode }) {
  return <p className="py-8 text-center text-sm text-neutral-400">{children}</p>;
}

