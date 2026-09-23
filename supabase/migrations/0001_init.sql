-- MarketFit initial schema
-- 소상공인 행사 참가 데이터 플랫폼: 핵심 엔티티 + RLS
-- 실행: Supabase 프로젝트의 SQL Editor에 붙여넣거나 `supabase db push`로 적용

create extension if not exists "uuid-ossp";
create extension if not exists vector;

-- ---------------------------------------------------------------------------
-- Enums
-- ---------------------------------------------------------------------------
create type participation_status as enum (
  'interested',      -- 관심
  'planning_to_apply', -- 신청 예정
  'applied',         -- 신청 완료
  'planning_to_attend', -- 참가 예정
  'attended',        -- 참가 완료
  'cancelled'        -- 참가 취소
);

create type recruitment_status as enum (
  'upcoming',  -- 모집 예정
  'open',      -- 모집 중
  'closed'     -- 모집 종료
);

create type source_type as enum (
  'government', -- 지자체·공공기관
  'foundation', -- 문화재단·관광재단
  'operator',   -- 플리마켓 운영사
  'official_site', -- 행사 공식 홈페이지
  'other'
);

-- ---------------------------------------------------------------------------
-- Users / Store / Product
-- ---------------------------------------------------------------------------
create table profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  email text,
  name text,
  created_at timestamptz not null default now()
);

create table stores (
  id uuid primary key default uuid_generate_v4(),
  owner_id uuid not null references profiles(id) on delete cascade,
  name text not null,
  nickname text,
  category text not null, -- 음식/디저트/농산물/수공예/패션/액세서리/생활용품/반려동물/기타
  flagship_product text,
  active_region text,
  contact text,
  email text,
  created_at timestamptz not null default now()
);

create table products (
  id uuid primary key default uuid_generate_v4(),
  store_id uuid not null references stores(id) on delete cascade,
  name text not null,
  category text,
  price numeric(12, 0),
  cost numeric(12, 0),
  description text,
  created_at timestamptz not null default now()
);

-- ---------------------------------------------------------------------------
-- Event / EventRecruitment (분리 구조 — 46번 항목 핵심)
-- ---------------------------------------------------------------------------
create table events (
  id uuid primary key default uuid_generate_v4(),
  name text not null,
  image_url text,
  region text,          -- 서울/경기/인천/... (향후 시군구 확장)
  venue text,
  lat double precision,
  lng double precision,
  category text,         -- 판매 카테고리
  event_type text,       -- 플리마켓/지역축제/팝업마켓/농산물행사/수공예행사 등
  start_date date,
  end_date date,
  description text,
  recurring_of_event_id uuid references events(id), -- 자기참조: 반복 개최 탐지용(9번 개선 제안)
  created_at timestamptz not null default now()
);

create table event_recruitments (
  id uuid primary key default uuid_generate_v4(),
  event_id uuid not null references events(id) on delete cascade,
  source_name text not null,
  source_url text not null,
  source_type source_type not null default 'other',
  source_post_id text,
  original_title text,
  recruit_start date,
  recruit_end date,
  fee numeric(12, 0),
  target text,           -- 모집대상
  conditions text,        -- 모집조건
  how_to_apply text,      -- 신청방법
  attachment_url text,
  official_site_url text,
  organizer text,
  status_override recruitment_status, -- 원본에 조기마감 등 별도 표기가 있을 때만 수동 지정
  collected_at timestamptz not null default now(),
  last_checked_at timestamptz,
  is_sample_data boolean not null default false,
  created_at timestamptz not null default now()
);

create index on event_recruitments (event_id);
create index on events (region, category);
create index on events (start_date);

create table event_reviews (
  id uuid primary key default uuid_generate_v4(),
  event_id uuid not null references events(id) on delete cascade,
  user_id uuid references profiles(id) on delete set null,
  rating smallint check (rating between 1 and 5),
  body text not null,
  visit_age_groups text[], -- ['20대','30대'] 등 복수 선택
  created_at timestamptz not null default now()
);

-- ---------------------------------------------------------------------------
-- EventParticipation / EventProductSale / EventChecklist (45번 핵심 관계)
-- ---------------------------------------------------------------------------
create table event_participations (
  id uuid primary key default uuid_generate_v4(),
  store_id uuid not null references stores(id) on delete cascade,
  event_id uuid not null references events(id) on delete cascade,
  status participation_status not null default 'interested',

  -- 참가 전 입력
  fee numeric(12, 0),
  expected_revenue numeric(12, 0),
  target_revenue numeric(12, 0),

  -- 참가 후 결과
  satisfaction smallint check (satisfaction between 1 and 5),
  visit_age_groups text[],
  total_revenue numeric(12, 0),      -- 상품별 매출 합산(자동 계산, 트리거 또는 앱 레벨)
  operating_hours text,               -- 예: "10:00~18:00"
  transport_cost numeric(12, 0) default 0,
  parking_cost numeric(12, 0) default 0,
  lodging_cost numeric(12, 0) default 0,
  other_cost numeric(12, 0) default 0,
  net_profit numeric(12, 0),          -- total_revenue - fee - transport - parking - lodging - other
  memo text,

  -- 선택 데이터(43·26번)
  weather text,
  indoor_outdoor text,
  perceived_crowd text,
  operation_satisfaction smallint,
  parking_convenience smallint,
  promotion_quality smallint,
  would_reattend boolean,

  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (store_id, event_id)
);

create index on event_participations (store_id);
create index on event_participations (event_id);

create table event_product_sales (
  id uuid primary key default uuid_generate_v4(),
  participation_id uuid not null references event_participations(id) on delete cascade,
  product_id uuid references products(id) on delete set null,
  product_name text not null, -- 상품이 나중에 삭제돼도 기록은 남도록 스냅샷
  prepared int not null default 0,
  sold int not null default 0,
  price numeric(12, 0) not null default 0,
  revenue numeric(12, 0) generated always as (sold * price) stored,
  sell_through_rate numeric(5, 2) generated always as (
    case when prepared > 0 then round((sold::numeric / prepared) * 100, 2) else null end
  ) stored
);

create index on event_product_sales (participation_id);

create table event_checklists (
  id uuid primary key default uuid_generate_v4(),
  participation_id uuid not null references event_participations(id) on delete cascade,
  label text not null,
  checked boolean not null default false,
  is_custom boolean not null default false,
  sort_order int default 0
);

create index on event_checklists (participation_id);

-- ---------------------------------------------------------------------------
-- Notification
-- ---------------------------------------------------------------------------
create table notifications (
  id uuid primary key default uuid_generate_v4(),
  user_id uuid not null references profiles(id) on delete cascade,
  type text not null, -- deadline_d3 / attend_d1 / record_result / new_recommendation
  payload jsonb,
  read_at timestamptz,
  created_at timestamptz not null default now()
);

create index on notifications (user_id, read_at);

-- ---------------------------------------------------------------------------
-- AI: Chat + RAG (pgvector)
-- ---------------------------------------------------------------------------
create table chat_conversations (
  id uuid primary key default uuid_generate_v4(),
  user_id uuid not null references profiles(id) on delete cascade,
  title text,
  created_at timestamptz not null default now()
);

create table chat_messages (
  id uuid primary key default uuid_generate_v4(),
  conversation_id uuid not null references chat_conversations(id) on delete cascade,
  role text not null check (role in ('user', 'assistant')),
  content text not null,
  cited_sources jsonb, -- [{title, url}] — 근거 없는 숫자 생성 방지(37번 항목)
  created_at timestamptz not null default now()
);

create table knowledge_documents (
  id uuid primary key default uuid_generate_v4(),
  title text not null,
  author text,
  source text,
  url text,
  document_type text, -- paper/report/article/guide
  published_at date,
  created_at timestamptz not null default now()
);

create table knowledge_chunks (
  id uuid primary key default uuid_generate_v4(),
  document_id uuid not null references knowledge_documents(id) on delete cascade,
  content text not null,
  embedding vector(768) -- Gemini text-embedding-004 차원
);

create index on knowledge_chunks using ivfflat (embedding vector_cosine_ops);

-- ---------------------------------------------------------------------------
-- Row Level Security — "다른 사용자의 참가 기록 접근 금지"(61번 항목)
-- ---------------------------------------------------------------------------
alter table profiles enable row level security;
alter table stores enable row level security;
alter table products enable row level security;
alter table event_participations enable row level security;
alter table event_product_sales enable row level security;
alter table event_checklists enable row level security;
alter table notifications enable row level security;
alter table chat_conversations enable row level security;
alter table chat_messages enable row level security;
alter table event_reviews enable row level security;

-- 이벤트/공고/RAG 자료는 공개 읽기(로그인 없이도 탐색 가능해야 함)
alter table events enable row level security;
alter table event_recruitments enable row level security;
create policy "events are publicly readable" on events for select using (true);
create policy "recruitments are publicly readable" on event_recruitments for select using (true);
create policy "reviews are publicly readable" on event_reviews for select using (true);
create policy "reviews: owner can write" on event_reviews for insert with check (auth.uid() = user_id);

-- RAG 지식베이스: 클라이언트(anon/authenticated)는 직접 접근할 필요가 없다 —
-- AI 챗봇 기능은 서버(service role, RLS 우회)에서만 조회/삽입한다.
-- 정책을 만들지 않고 RLS만 켜서 기본적으로 anon/authenticated 접근을 전면 차단한다.
alter table knowledge_documents enable row level security;
alter table knowledge_chunks enable row level security;

create policy "own profile" on profiles for select using (auth.uid() = id);
create policy "own profile update" on profiles for update using (auth.uid() = id);

create policy "own store" on stores for all using (auth.uid() = owner_id) with check (auth.uid() = owner_id);

create policy "own products" on products for all using (
  exists (select 1 from stores where stores.id = products.store_id and stores.owner_id = auth.uid())
) with check (
  exists (select 1 from stores where stores.id = products.store_id and stores.owner_id = auth.uid())
);

create policy "own participations" on event_participations for all using (
  exists (select 1 from stores where stores.id = event_participations.store_id and stores.owner_id = auth.uid())
) with check (
  exists (select 1 from stores where stores.id = event_participations.store_id and stores.owner_id = auth.uid())
);

create policy "own product sales" on event_product_sales for all using (
  exists (
    select 1 from event_participations p
    join stores s on s.id = p.store_id
    where p.id = event_product_sales.participation_id and s.owner_id = auth.uid()
  )
);

create policy "own checklists" on event_checklists for all using (
  exists (
    select 1 from event_participations p
    join stores s on s.id = p.store_id
    where p.id = event_checklists.participation_id and s.owner_id = auth.uid()
  )
);

create policy "own notifications" on notifications for all using (auth.uid() = user_id);
create policy "own conversations" on chat_conversations for all using (auth.uid() = user_id);
create policy "own messages" on chat_messages for all using (
  exists (select 1 from chat_conversations c where c.id = chat_messages.conversation_id and c.user_id = auth.uid())
);

-- 신규 가입 시 profiles 행 자동 생성
create function public.handle_new_user()
returns trigger as $$
begin
  insert into public.profiles (id, email)
  values (new.id, new.email);
  return new;
end;
$$ language plpgsql security definer set search_path = public;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();
