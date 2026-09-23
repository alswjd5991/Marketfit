"use client";

import { useState } from "react";
import { cn } from "@/lib/utils";
import { EventPoster, PosterBadge } from "./event-poster";

// 실제 포스터 사진이 있으면 그걸 보여주고(원본 모집공고에 달린 og:image를
// 그대로 하드링크), 없거나 깨져 있으면 카테고리별 생성 포스터(EventPoster)로
// 조용히 대체한다.
//
// imageUrl은 우리가 소유한 이미지가 아니라 원본 출처(뉴스사/행사 플랫폼 등)
// CDN에 걸려 있는 실제 파일이다 — src/lib/data/event-poster-manifest.json
// 참고(각 행사 sourceUrl에서 og:image를 1회 추출해 기록해둔 것, 65번 원칙:
// 실제로 확인된 이미지만 담는다). 원본이 이미지를 내리거나 주소를 바꾸면
// 깨질 수 있어 <img onError>로 안전하게 생성 포스터로 넘어가야 하고, 그
// 상태(state)가 필요해서 이 컴포넌트만 클라이언트 컴포넌트다 — 나머지
// 페이지는 그대로 서버 컴포넌트로 남는다.
export function PosterFrame({
  imageUrl,
  alt,
  category,
  seed,
  size = "card",
  badgeLabel,
  className,
}: {
  imageUrl?: string | null;
  alt: string;
  category?: string | null;
  seed: string;
  size?: "card" | "hero";
  badgeLabel?: string | null;
  className?: string;
}) {
  const [failed, setFailed] = useState(false);

  if (!imageUrl || failed) {
    return (
      <EventPoster category={category} seed={seed} size={size} badgeLabel={badgeLabel} className={className} />
    );
  }

  return (
    <div className={cn("relative h-full w-full overflow-hidden bg-neutral-200", className)}>
      {/* eslint-disable-next-line @next/next/no-img-element -- 출처가 제각각인 외부 도메인 수십 곳을
          핫링크하는 용도라 next/image의 remotePatterns 허용목록·서버 프록시 최적화 대상에서 일부러 뺐다. */}
      <img
        src={imageUrl}
        alt={alt}
        loading="lazy"
        className="h-full w-full object-cover"
        onError={() => setFailed(true)}
      />
      {badgeLabel && <PosterBadge label={badgeLabel} />}
    </div>
  );
}
