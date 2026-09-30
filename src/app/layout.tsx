import type { Metadata } from "next";
import "./globals.css";
import { NavBar } from "@/components/nav-bar";
import { BottomNav } from "@/components/bottom-nav";

// next/font/google(Geist)은 이 샌드박스에서 fonts.googleapis.com 접근이
// 막혀 있어 빌드가 실패한다. Vercel 등 실제 배포 환경에서는 문제없이
// 동작하지만, 외부 의존을 하나 줄이는 셈 치고 시스템 폰트 스택으로 대체했다.
// 다시 웹폰트를 쓰고 싶다면 next/font/local로 폰트 파일을 내려받아 쓰는 것을
// 권장한다(빌드 시점 네트워크 의존이 사라진다).

export const metadata: Metadata = {
  title: "Marketfit — 소상공인을 위한 마켓 인사이트 플랫폼",
  description:
    "전국 행사 정보를 한눈에 확인하고, 데이터를 바탕으로 우리 가게에 맞는 마켓을 찾는 소상공인 마켓 인사이트 플랫폼.",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="ko" className="h-full antialiased">
      <body className="flex min-h-full flex-col bg-background font-sans text-neutral-900">
        <NavBar />
        <main className="flex-1 pb-16 sm:pb-0">{children}</main>
        <BottomNav />
      </body>
    </html>
  );
}
