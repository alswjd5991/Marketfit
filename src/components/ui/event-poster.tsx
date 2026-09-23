import { cn } from "@/lib/utils";
import { getPosterTheme, seededUnit, type PosterIconKey } from "@/features/events/poster-theme";

// 카테고리별 "포스터" 배너. 실제 행사 사진이 없는 채로 생성한 그래픽
// 아이콘/도형이며, 실제 포스터 사진을 흉내 내지 않는다(위 poster-theme.ts
// 주석 참고). 서버 컴포넌트 — 순수 SVG라 JS 번들 비용 없이 렌더된다.
//
// 구성(레퍼런스 반영): 짙은 단색 배경 + 그 위에 얹은 굵은 유기적 블롭 한
// 덩어리(Your Creative 스타일 도형감) + 블롭 중심에 크림색 모노라인
// 아이콘 하나(Juliet Creative의 "짙은 배경 + 큰 아이콘 하나" 구도) + 반대
// 코너의 은은한 점 텍스처. 블롭에는 아주 느린 회전 애니메이션을 줘서
// 정적인 카드에 미세한 생동감(모션)을 더한다 — prefers-reduced-motion이면
// globals.css에서 꺼진다.

const CREAM = "#fbf9f2";

const ICON_PATHS: Record<PosterIconKey, React.ReactNode> = {
  // 플리마켓 — 토트백
  tote: (
    <>
      <path d="M7 9V7a5 5 0 0 1 10 0v2" />
      <path d="M5 9h14l-1.2 10.2a2 2 0 0 1-2 1.8H8.2a2 2 0 0 1-2-1.8L5 9Z" />
    </>
  ),
  // 축제 판매부스 — 깃발
  flag: (
    <>
      <path d="M6 21V4" />
      <path d="M6 5c3-2 6 2 9 0v9c-3 2-6-2-9 0V5Z" />
    </>
  ),
  // 시즌마켓 — 선물상자
  gift: (
    <>
      <rect x="4" y="10" width="16" height="10" rx="1.5" />
      <path d="M4 14h16" />
      <path d="M12 10v10" />
      <path d="M12 10c-1.8 0-4-1-4-3.2A2.3 2.3 0 0 1 10.3 4C11.8 4 12 6.5 12 10Z" />
      <path d="M12 10c1.8 0 4-1 4-3.2A2.3 2.3 0 0 0 13.7 4C12.2 4 12 6.5 12 10Z" />
    </>
  ),
  // 야시장 — 초승달
  moon: <path d="M17.5 13.5A7 7 0 0 1 10.5 6.5a7 7 0 1 0 7 7Z" />,
  // 대학 마켓 — 학사모
  cap: (
    <>
      <path d="M12 5 2 9.5 12 14l10-4.5L12 5Z" />
      <path d="M6 12v4.5c0 1.4 2.7 2.5 6 2.5s6-1.1 6-2.5V12" />
      <path d="M21 9.5v5.5" />
    </>
  ),
  // 아트마켓 — 팔레트
  palette: (
    <>
      <path d="M12 3a9 8 0 1 0 0 16c1.4 0 2-.8 2-1.8 0-.5-.2-.9-.5-1.2-.3-.3-.5-.7-.5-1.2 0-1 .8-1.8 1.8-1.8H17a4 4 0 0 0 4-4c0-4.4-4-6-9-6Z" />
      <circle cx="7.5" cy="10.5" r="1" fill="currentColor" stroke="none" />
      <circle cx="9.5" cy="7" r="1" fill="currentColor" stroke="none" />
      <circle cx="14" cy="7" r="1" fill="currentColor" stroke="none" />
    </>
  ),
  // 음식 — 그릇
  bowl: (
    <>
      <path d="M4 11h16a8 6 0 0 1-16 0Z" />
      <path d="M9 11c0-2 1-4 3-4s3 2 3 4" />
      <path d="M8 17.5 7 20" />
      <path d="M16 17.5l1 2.5" />
    </>
  ),
  // 농산물 — 잎
  leaf: (
    <>
      <path d="M5 21c9-1 13-6 13-15C9 6 5 12 5 21Z" />
      <path d="M5 21c0-4 2.5-8 6-10" />
    </>
  ),
  // 수공예 — 가위
  scissors: (
    <>
      <circle cx="6" cy="6" r="2.2" />
      <circle cx="6" cy="18" r="2.2" />
      <path d="M7.8 7.4 19 18" />
      <path d="M7.8 16.6 19 6" />
    </>
  ),
  // 패션 — 옷걸이
  hanger: (
    <>
      <path d="M12 4a2 2 0 1 1 2 2c-.4.3-.8.6-.8 1.1V8" />
      <path d="M12 8 4 14c-1 .7-.5 2 .7 2h14.6c1.2 0 1.7-1.3.7-2L12 8Z" />
      <path d="M6 19h12" />
    </>
  ),
  // 액세서리 — 보석
  gem: (
    <>
      <path d="M6 9 9 4h6l3 5-8 11L6 9Z" />
      <path d="M6 9h12" />
      <path d="M9 4l3 5 3-5" />
    </>
  ),
  // 참고 — 태그
  tag: (
    <>
      <path d="M3 11.5V5a2 2 0 0 1 2-2h6.5L20 11.5 12.5 19 3 11.5Z" />
      <circle cx="7.5" cy="7.5" r="1.2" fill="currentColor" stroke="none" />
    </>
  ),
  // 기타/기본값 — 판매 부스
  stall: (
    <>
      <path d="M4 9 6 4h12l2 5" />
      <path d="M4 9h16" />
      <path d="M6 9v10h12V9" />
      <path d="M10 19v-5h4v5" />
    </>
  ),
};

// 유기적 블롭 하나(200x205 기준 좌표계). 모든 포스터가 같은 도형을 공유해서
// "브랜드"로 읽히게 하고, 색·회전·위치만 카테고리/행사별로 바꾼다.
const BLOB_PATH =
  "M120,20 C160,10 190,50 185,90 C180,135 210,150 195,185 C180,215 130,210 95,200 C55,190 15,175 15,130 C15,85 45,50 75,35 C90,27 100,25 120,20 Z";
const BLOB_H = 205;
const BLOB_CENTER_X = 108;
const BLOB_CENTER_Y = 110;

export function EventPoster({
  category,
  seed,
  size = "card",
  badgeLabel,
  className,
}: {
  category?: string | null;
  /** 블롭 회전/위치를 고정하는 시드(보통 행사 id) — 같은 행사는 항상 같은 모양. */
  seed: string;
  size?: "card" | "hero";
  /** 코너에 스티커처럼 얹을 짧은 라벨(보통 카테고리명). 생략하면 표시 안 함. */
  badgeLabel?: string | null;
  className?: string;
}) {
  const theme = getPosterTheme(category);
  const r1 = seededUnit(seed);
  const r2 = seededUnit(`${seed}:2`);

  const viewW = size === "hero" ? 800 : 400;
  const viewH = size === "hero" ? 300 : 225;

  const blobScale = (viewH * 0.92) / BLOB_H;
  const offsetX = (r1 - 0.5) * viewW * 0.14;
  const offsetY = (r2 - 0.5) * viewH * 0.14;
  const blobX = viewW / 2 - BLOB_CENTER_X * blobScale + offsetX;
  const blobY = viewH / 2 - BLOB_CENTER_Y * blobScale + offsetY;
  const rotBase = -10 + r1 * 20;
  const rotA = rotBase - 3;
  const rotB = rotBase + 3;

  const iconScale = viewH / 92;
  const patternId = `poster-dots-${seed.replace(/[^a-zA-Z0-9_-]/g, "")}`;

  return (
    <div
      className={cn("relative h-full w-full overflow-hidden", className)}
      style={{ backgroundColor: theme.bg }}
    >
      <svg
        viewBox={`0 0 ${viewW} ${viewH}`}
        width="100%"
        height="100%"
        preserveAspectRatio="xMidYMid slice"
        role="img"
        aria-label={category ? `${category} 행사 포스터` : "행사 포스터"}
        className="block"
      >
        <defs>
          <pattern id={patternId} width="14" height="14" patternUnits="userSpaceOnUse">
            <circle cx="2" cy="2" r="1.4" fill={theme.pop} />
          </pattern>
        </defs>

        <rect width={viewW} height={viewH} fill={theme.bg} />
        <rect
          x={0}
          y={viewH * 0.55}
          width={viewW * 0.4}
          height={viewH * 0.45}
          fill={`url(#${patternId})`}
          opacity={0.14}
        />

        <g transform={`translate(${blobX} ${blobY}) scale(${blobScale})`}>
          <g
            className="poster-blob"
            style={{
              transformOrigin: `${BLOB_CENTER_X}px ${BLOB_CENTER_Y}px`,
              ["--poster-rot-a" as string]: `${rotA}deg`,
              ["--poster-rot-b" as string]: `${rotB}deg`,
            }}
          >
            <path d={BLOB_PATH} fill={theme.pop} opacity={0.94} />
          </g>
        </g>

        <g
          transform={`translate(${viewW / 2} ${viewH / 2}) scale(${iconScale}) translate(-12 -12)`}
          stroke={CREAM}
          strokeWidth={1.7}
          strokeLinecap="round"
          strokeLinejoin="round"
          fill="none"
          opacity={0.97}
        >
          {ICON_PATHS[theme.icon]}
        </g>
      </svg>

      {badgeLabel && (
        <span
          className="absolute left-3 top-3 -rotate-3 rounded-full px-3 py-1 text-[11px] font-bold tracking-tight shadow-sm"
          style={{ backgroundColor: CREAM, color: theme.bg }}
        >
          {badgeLabel}
        </span>
      )}
    </div>
  );
}
