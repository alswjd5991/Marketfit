-- MarketFit: 자동 수집 행사의 상세 정보
-- 2026-10-07 — 한국관광공사 TourAPI 상세 조회(detailCommon2·detailIntro2)로 받은 행사 소개·운영 시간·
-- 주최/주관·문의처·관람 요금·홈페이지를 담는다. 모양이 출처마다 달라 jsonb 한 칸으로 둔다.
-- 예: {"overview": "...", "playtime": "10:00~18:00", "sponsor": "OO시", "organizer": "OO문화재단",
--      "tel": "02-000-0000", "admission": "무료", "homepage": "https://...", "place": "OO광장"}
--
-- 실행: Supabase 프로젝트의 SQL Editor에 붙여넣거나 `supabase db push`로 적용.
-- 적용 전에도 사이트는 동작한다(상세 정보만 비어 보임). 적용 후 과거 행사 수집을 한 번 더 돌리면 채워진다.

alter table events add column if not exists details jsonb;
