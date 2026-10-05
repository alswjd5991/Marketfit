"use client";

import { usePathname } from "next/navigation";
import type { ReactNode } from "react";

/** 메인(/)은 자체 스크롤 영역 안에 푸터를 직접 넣으므로, 공통 레이아웃의 푸터는 숨긴다. */
export function FooterGate({ children }: { children: ReactNode }) {
  return usePathname() === "/" ? null : <>{children}</>;
}
