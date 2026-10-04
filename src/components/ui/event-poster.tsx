import type { ReactNode } from "react";

import { cn } from "@/lib/utils";
import {
  getPosterTheme,
  seededUnit,
  type PosterIconKey,
} from "@/features/events/poster-theme";

export const POSTER_CREAM = "#FFFDF8";

const ICON_PATHS: Record<PosterIconKey, ReactNode> = {
  // 플리마켓
  tote: (
    <>
      <path d="M7 9V7a5 5 0 0 1 10 0v2" />
      <path d="M5 9h14l-1.2 10.2a2 2 0 0 1-2 1.8H8.2a2 2 0 0 1-2-1.8L5 9Z" />
    </>
  ),

  // 축제 판매부스
  flag: (
    <>
      <path d="M6 21V4" />
      <path d="M6 5c3-2 6 2 9 0v9c-3 2-6-2-9 0V5Z" />
    </>
  ),

  // 시즌마켓
  gift: (
    <>
      <rect x="4" y="10" width="16" height="10" rx="1.5" />
      <path d="M4 14h16" />
      <path d="M12 10v10" />
      <path d="M12 10c-1.8 0-4-1-4-3.2A2.3 2.3 0 0 1 10.3 4C11.8 4 12 6.5 12 10Z" />
      <path d="M12 10c1.8 0 4-1 4-3.2A2.3 2.3 0 0 0 13.7 4C12.2 4 12 6.5 12 10Z" />
    </>
  ),

  // 야시장
  moon: (
    <path d="M17.5 13.5A7 7 0 0 1 10.5 6.5a7 7 0 1 0 7 7Z" />
  ),

  // 대학 마켓
  cap: (
    <>
      <path d="M12 5 2 9.5 12 14l10-4.5L12 5Z" />
      <path d="M6 12v4.5c0 1.4 2.7 2.5 6 2.5s6-1.1 6-2.5V12" />
      <path d="M21 9.5v5.5" />
    </>
  ),

  // 아트마켓
  palette: (
    <>
      <path d="M12 3a9 8 0 1 0 0 16c1.4 0 2-.8 2-1.8 0-.5-.2-.9-.5-1.2-.3-.3-.5-.7-.5-1.2 0-1 .8-1.8 1.8-1.8H17a4 4 0 0 0 4-4c0-4.4-4-6-9-6Z" />
      <circle cx="7.5" cy="10.5" r="1" fill="currentColor" stroke="none" />
      <circle cx="9.5" cy="7" r="1" fill="currentColor" stroke="none" />
      <circle cx="14" cy="7" r="1" fill="currentColor" stroke="none" />
    </>
  ),

  // 음식
  bowl: (
    <>
      <path d="M4 11h16a8 6 0 0 1-16 0Z" />
      <path d="M9 11c0-2 1-4 3-4s3 2 3 4" />
      <path d="M8 17.5 7 20" />
      <path d="M16 17.5l1 2.5" />
    </>
  ),

  // 농산물 / 자원순환
  leaf: (
    <>
      <path d="M5 21c9-1 13-6 13-15C9 6 5 12 5 21Z" />
      <path d="M5 21c0-4 2.5-8 6-10" />
    </>
  ),

  // 수공예
  scissors: (
    <>
      <circle cx="6" cy="6" r="2.2" />
      <circle cx="6" cy="18" r="2.2" />
      <path d="M7.8 7.4 19 18" />
      <path d="M7.8 16.6 19 6" />
    </>
  ),

  // 패션
  hanger: (
    <>
      <path d="M12 4a2 2 0 1 1 2 2c-.4.3-.8.6-.8 1.1V8" />
      <path d="M12 8 4 14c-1 .7-.5 2 .7 2h14.6c1.2 0 1.7-1.3.7-2L12 8Z" />
      <path d="M6 19h12" />
    </>
  ),

  // 액세서리
  gem: (
    <>
      <path d="M6 9 9 4h6l3 5-8 11L6 9Z" />
      <path d="M6 9h12" />
      <path d="M9 4l3 5 3-5" />
    </>
  ),

  // 참고
  tag: (
    <>
      <path d="M3 11.5V5a2 2 0 0 1 2-2h6.5L20 11.5 12.5 19 3 11.5Z" />
      <circle
        cx="7.5"
        cy="7.5"
        r="1.2"
        fill="currentColor"
        stroke="none"
      />
    </>
  ),

  // 기타
  stall: (
    <>
      <path d="M4 9 6 4h12l2 5" />
      <path d="M4 9h16" />
      <path d="M6 9v10h12V9" />
      <path d="M10 19v-5h4v5" />
    </>
  ),
};

export function EventPoster({
  category,
  seed,
  size = "card",
  badgeLabel,
  className,
}: {
  category?: string | null;
  seed: string;
  size?: "card" | "hero";
  badgeLabel?: string | null;
  className?: string;
}) {
  const theme = getPosterTheme(category);

  const viewW = size === "hero" ? 800 : 400;
  const viewH = size === "hero" ? 300 : 225;

  const variant = seededUnit(seed);
  const decorationOnRight = variant > 0.5;

  const iconX = viewW * 0.5;
  const iconY = viewH * 0.5;

  const badgeRadius = size === "hero" ? 72 : 54;
  const iconScale = size === "hero" ? 3.4 : 2.6;

  const decorationX = decorationOnRight
    ? viewW * 0.86
    : viewW * 0.14;

  return (
    <div
      className={cn("relative h-full w-full overflow-hidden", className)}
      style={{
        backgroundColor: theme.pop,
      }}
    >
      <svg
        viewBox={`0 0 ${viewW} ${viewH}`}
        width="100%"
        height="100%"
        preserveAspectRatio="xMidYMid slice"
        role="img"
        aria-label={category ? `${category} 행사 그래픽` : "행사 그래픽"}
        className="block"
      >
        <rect width={viewW} height={viewH} fill={theme.pop} />

        <circle
          cx={decorationX}
          cy={viewH * 0.5}
          r={viewH * 0.72}
          fill={theme.bg}
          opacity={0.18}
        />

        <circle
          cx={iconX}
          cy={iconY}
          r={badgeRadius + 11}
          fill="none"
          stroke={theme.bg}
          strokeWidth={2}
          opacity={0.18}
        />

        <circle
          cx={iconX}
          cy={iconY}
          r={badgeRadius}
          fill={POSTER_CREAM}
        />

        <g
          transform={`
            translate(${iconX} ${iconY})
            scale(${iconScale})
            translate(-12 -12)
          `}
          stroke={theme.bg}
          strokeWidth={1.8}
          strokeLinecap="round"
          strokeLinejoin="round"
          fill="none"
        >
          {ICON_PATHS[theme.icon]}
        </g>

        <circle
          cx={decorationOnRight ? viewW * 0.82 : viewW * 0.18}
          cy={viewH * 0.78}
          r={viewH * 0.035}
          fill={theme.bg}
          opacity={0.7}
        />
      </svg>

      {badgeLabel && (
        <PosterBadge
          label={badgeLabel}
          textColor={theme.bg}
        />
      )}
    </div>
  );
}

export function PosterBadge({
  label,
  textColor = "#1f2937",
}: {
  label: string;
  textColor?: string;
}) {
  return (
    <span
      className="absolute left-3 top-3 rounded-full px-3 py-1 text-[11px] font-semibold tracking-tight shadow-sm"
      style={{
        backgroundColor: POSTER_CREAM,
        color: textColor,
      }}
    >
      {label}
    </span>
  );
}