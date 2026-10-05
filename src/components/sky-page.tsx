import type { ReactNode } from "react";

// 모든 페이지 배경 = 왼쪽 위 노을(붉은 기) → 오른쪽 아래 하늘(파란 기) 대각선 그라데이션.
// 상단 메뉴 순서(행사 찾기 → 내 행사 → 대시보드 → AI 도우미 → 내 가게)대로
// 오른쪽 메뉴일수록 노을 구간이 줄어든다. 메뉴 밖 페이지(로그인 등)는 0단계와 같다.
const SUNSET_END = [30, 24, 18, 13, 8]; // 노을이 하늘로 넘어가는 지점(%)

export type SkyLevel = 0 | 1 | 2 | 3 | 4;

export function skyGradient(level: SkyLevel = 0) {
  const s = SUNSET_END[level];
  return `linear-gradient(135deg, #FFECD0 0%, #F4F9FD ${s}%, #DCEEFF ${s + 38}%, #F6FAFD 100%)`;
}

export function SkyPage({ level = 0, className = "", children }: { level?: SkyLevel; className?: string; children: ReactNode }) {
  return (
    <div className={`min-h-screen ${className}`} style={{ background: skyGradient(level) }}>
      {children}
    </div>
  );
}
