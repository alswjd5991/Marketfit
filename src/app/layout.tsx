import type { Metadata } from "next";
import localFont from "next/font/local";
import "./globals.css";
import { NavBar } from "@/components/nav-bar";
import { BottomNav } from "@/components/bottom-nav";

// next/font/google은 이 샌드박스에서 fonts.googleapis.com 접근이 막혀 빌드가 실패하므로
// 폰트 파일을 저장소에 두고 next/font/local로 쓴다(빌드 시점 네트워크 의존 없음).
// SUIT(sun-typeface, SIL OFL) 가변 폰트 — 굵기 100~900을 파일 하나로 쓴다.
const suit = localFont({
  src: "./fonts/SUIT-Variable.woff2",
  weight: "100 900",
  display: "swap",
  variable: "--font-suit",
});

// Rubik(Google Fonts, SIL OFL) 가변 폰트 라틴 서브셋 — "Marketfit" 로고 글자에만 쓴다.
const rubik = localFont({
  src: "./fonts/Rubik-Variable.woff2",
  weight: "300 900",
  display: "swap",
  variable: "--font-rubik",
});

export const metadata: Metadata = {
  title: "Marketfit — 셀러를 위한 행사 지도",
  description:
    "전국 셀러 모집 공고와 내 판매 기록으로 다음에 나갈 마켓을 고르는 행사 지도.",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="ko" className={`${suit.variable} ${rubik.variable} h-full antialiased`}>
      <body className="flex min-h-full flex-col bg-background font-sans text-neutral-900">
        <NavBar />
        <main className="flex-1 pb-16 sm:pb-0">{children}</main>
        <BottomNav />
      </body>
    </html>
  );
}
