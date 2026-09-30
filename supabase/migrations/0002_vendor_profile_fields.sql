-- MarketFit: 가게(stores)/참가(event_participations) 프로필 확장
-- 2026-09-24 — 사용자 요청: "내 행사"/"내 가게" 입력 항목을 다른 마켓
-- 신청서·판매자 프로필 조사 결과에 맞춰 보강.
--
-- 조사 결과(실제 플리마켓 참가신청서·네이버 스마트스토어·당근 비즈프로필·
-- Etsy·해외 craft fair 템플릿·식품위생법 영업신고 요건 등)에서 반복적으로
-- 등장했지만 기존 스키마엔 없던 항목만 추렸다:
--   가게: 사업자등록번호, SNS 링크, 지원 결제수단, 위생교육 이수 여부, 대표 사진/로고
--   참가: 부스 제공 여부, 부스 크기, 전기/차량 이용 가능 여부, 부스 번호,
--         부스 위치 만족도(전체 만족도와 별개), 현장 결제수단, 부스 사진
-- 정산 계좌, 보험 가입, 신분증 번호처럼 "이 앱이 실제 결제/심사를 대행하지
-- 않는다"는 성격상 맞지 않는 항목(65번 원칙 — 쓰지도 않을 민감정보를
-- 이유 없이 수집하지 않음)은 의도적으로 제외했다.
--
-- 실행: Supabase 프로젝트의 SQL Editor에 붙여넣거나 `supabase db push`로 적용.
-- ⚠️ 이 파일을 적용하기 전에는 아래 신규 컬럼을 쓰는 폼 제출이 전부
-- "column does not exist" 에러로 실패한다 — 배포 전 필수.

-- ---------------------------------------------------------------------------
-- stores: 사업자등록번호 / SNS / 결제수단 / 위생교육 이수 / 대표 사진(로고)
-- ---------------------------------------------------------------------------
alter table stores
  add column if not exists business_registration_number text, -- 사업자등록번호(선택 — 미기재 시 비사업자/부업 판매자로 간주)
  add column if not exists sns_url text,                        -- 인스타그램 등 SNS 계정 링크
  add column if not exists payment_methods text[],               -- 지원 결제수단: 현금/카드/계좌이체/모바일결제 등 복수 선택
  add column if not exists hygiene_certified boolean,             -- 위생교육 이수 여부(식품위생법상 음식류 판매자 필수 교육) — null이면 미입력
  add column if not exists logo_url text;                         -- 대표 사진/로고 이미지 URL(storage.vendor-images)

-- ---------------------------------------------------------------------------
-- event_participations: 부스 로지스틱스(제공여부/크기/전기/차량) +
-- 참가 후 기록(부스 번호/위치 만족도/현장 결제수단/부스 사진)
-- ---------------------------------------------------------------------------
alter table event_participations
  add column if not exists booth_provided text,     -- 부스/매대 제공: 'organizer'(주최측 제공) | 'self'(자비 지참) — 참가 전 입력
  add column if not exists booth_size text,          -- 부스 크기(요구/배정), 예: "2m x 2m" — 참가 전 입력
  add column if not exists power_available boolean,  -- 전기 사용 가능 여부 — 참가 전 입력
  add column if not exists vehicle_access boolean,   -- 차량 출입/주차 가능 여부 — 참가 전 입력
  add column if not exists booth_number text,        -- 실제 배정된 부스 위치/번호 — 참가 후 기록
  add column if not exists booth_location_rating smallint check (booth_location_rating between 1 and 5), -- 부스 위치 만족도(전체 만족도(satisfaction)와 별개 — 조사에서 확인된 흔한 구분점)
  add column if not exists payment_methods_used text[], -- 현장에서 실제 사용된 결제수단(가게의 payment_methods와 다를 수 있어 별도 컬럼)
  add column if not exists booth_photo_url text;      -- 부스 사진(참가 후 기록, storage.vendor-images)

-- ---------------------------------------------------------------------------
-- Storage: 가게 로고 / 부스 사진용 공개 버킷
-- 포스터 이미지(event-poster-manifest.json)와 달리 이건 사용자가 직접
-- 업로드하는 파일이라 Supabase Storage에 저장한다. 경로 규칙:
-- "{auth.uid()}/store-logo/{uuid}.{ext}", "{auth.uid()}/booth-photo/{uuid}.{ext}"
-- — storage.foldername(name)의 첫 세그먼트(=업로더 본인 id)로 쓰기 권한을 제한한다.
-- 공개 읽기로 두는 이유: 민감정보가 아니고(로고·부스 사진), signed URL 없이
-- <img src>로 바로 렌더하는 기존 패턴(event-poster.tsx 등)과 일관되게 하기 위함.
-- ---------------------------------------------------------------------------
insert into storage.buckets (id, name, public)
values ('vendor-images', 'vendor-images', true)
on conflict (id) do nothing;

create policy "vendor images are publicly readable"
on storage.objects for select
using (bucket_id = 'vendor-images');

create policy "users can upload their own vendor images"
on storage.objects for insert
with check (
  bucket_id = 'vendor-images'
  and auth.uid()::text = (storage.foldername(name))[1]
);

create policy "users can update their own vendor images"
on storage.objects for update
using (
  bucket_id = 'vendor-images'
  and auth.uid()::text = (storage.foldername(name))[1]
);

create policy "users can delete their own vendor images"
on storage.objects for delete
using (
  bucket_id = 'vendor-images'
  and auth.uid()::text = (storage.foldername(name))[1]
);
