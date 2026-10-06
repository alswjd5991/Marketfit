// 손으로 유지 관리하는 Supabase 타입 정의.
// Supabase 프로젝트가 연결되면 `supabase gen types typescript`로 자동 생성본으로
// 교체할 수 있다(구조는 supabase/migrations/0001_init.sql과 반드시 일치시킬 것).
//
// 주의: 아래 Row 타입들은 반드시 `interface`가 아니라 `type`으로 선언한다.
// TypeScript는 object type literal(`type X = {...}`)에만 암묵적 string 인덱스
// 시그니처를 부여하고 `interface`에는 부여하지 않기 때문에, Database.Tables를
// postgrest-js의 `Record<string, GenericTable>`에 대입할 때 interface로 선언된
// Row 타입은 조용히 `never`로 좁혀져 .insert()/.update()가 전부 깨진다.
// (Supabase 공식 codegen도 이 이유로 항상 `type Database = {...}`를 출력한다.)

export type ParticipationStatus =
  | "interested"
  | "planning_to_apply"
  | "applied"
  | "planning_to_attend"
  | "attended"
  | "cancelled";

export type RecruitmentStatus = "upcoming" | "open" | "closed";

export type SourceType =
  | "government"
  | "foundation"
  | "operator"
  | "official_site"
  | "other";

export type Profile = {
  id: string;
  email: string | null;
  name: string | null;
  created_at: string;
};

export type Store = {
  id: string;
  owner_id: string;
  name: string;
  nickname: string | null;
  category: string;
  flagship_product: string | null;
  active_region: string | null;
  contact: string | null;
  email: string | null;
  // 2026-09-24 추가(다른 마켓 신청서/판매자 프로필 조사 반영 — 0002 마이그레이션)
  business_registration_number: string | null;
  sns_url: string | null;
  payment_methods: string[] | null;
  hygiene_certified: boolean | null;
  logo_url: string | null;
  created_at: string;
};

export type Product = {
  id: string;
  store_id: string;
  name: string;
  category: string | null;
  price: number | null;
  cost: number | null;
  description: string | null;
  created_at: string;
};

export type Event = {
  id: string;
  name: string;
  image_url: string | null;
  region: string | null;
  venue: string | null;
  lat: number | null;
  lng: number | null;
  category: string | null;
  event_type: string | null;
  start_date: string | null;
  end_date: string | null;
  description: string | null;
  /** 자동 수집 행사의 상세 정보(0003_event_details.sql) */
  details: EventDetails | null;
  recurring_of_event_id: string | null;
  created_at: string;
};

/** TourAPI 상세 조회로 받은 행사 정보 — 관람객 기준 정보이며 셀러 모집 조건은 아니다. */
export type EventDetails = {
  overview?: string; // 행사 소개
  playtime?: string; // 운영 시간
  place?: string; // 행사 장소(시설·광장 이름)
  sponsor?: string; // 주최
  organizer?: string; // 주관
  tel?: string; // 문의처
  admission?: string; // 관람 요금
  homepage?: string; // 행사 홈페이지
  postedAt?: string; // 출처에 행사가 처음 등록된 날(YYYY-MM-DD) — "최근 등록 행사"·NEW 기준
};

export type EventRecruitment = {
  id: string;
  event_id: string;
  source_name: string;
  source_url: string;
  source_type: SourceType;
  source_post_id: string | null;
  original_title: string | null;
  recruit_start: string | null;
  recruit_end: string | null;
  fee: number | null;
  target: string | null;
  conditions: string | null;
  how_to_apply: string | null;
  attachment_url: string | null;
  official_site_url: string | null;
  organizer: string | null;
  status_override: RecruitmentStatus | null;
  collected_at: string;
  last_checked_at: string | null;
  is_sample_data: boolean;
  created_at: string;
};

export type EventReview = {
  id: string;
  event_id: string;
  user_id: string | null;
  rating: number | null;
  body: string;
  visit_age_groups: string[] | null;
  created_at: string;
};

export type EventParticipation = {
  id: string;
  store_id: string;
  event_id: string;
  status: ParticipationStatus;
  fee: number | null;
  expected_revenue: number | null;
  target_revenue: number | null;
  satisfaction: number | null;
  visit_age_groups: string[] | null;
  total_revenue: number | null;
  operating_hours: string | null;
  transport_cost: number;
  parking_cost: number;
  lodging_cost: number;
  other_cost: number;
  net_profit: number | null;
  memo: string | null;
  weather: string | null;
  indoor_outdoor: string | null;
  perceived_crowd: string | null;
  operation_satisfaction: number | null;
  parking_convenience: number | null;
  promotion_quality: number | null;
  would_reattend: boolean | null;
  // 2026-09-24 추가(다른 마켓 신청서 조사 반영 — 0002 마이그레이션)
  booth_provided: "organizer" | "self" | null;
  booth_size: string | null;
  power_available: boolean | null;
  vehicle_access: boolean | null;
  booth_number: string | null;
  booth_location_rating: number | null;
  payment_methods_used: string[] | null;
  booth_photo_url: string | null;
  created_at: string;
  updated_at: string;
};

export type EventProductSale = {
  id: string;
  participation_id: string;
  product_id: string | null;
  product_name: string;
  prepared: number;
  sold: number;
  price: number;
  revenue: number; // generated column
  sell_through_rate: number | null; // generated column
};

export type EventChecklistItem = {
  id: string;
  participation_id: string;
  label: string;
  checked: boolean;
  is_custom: boolean;
  sort_order: number | null;
};

export type Notification = {
  id: string;
  user_id: string;
  type: "deadline_d3" | "attend_d1" | "record_result" | "new_recommendation";
  payload: Record<string, unknown> | null;
  read_at: string | null;
  created_at: string;
};

export type ChatConversation = {
  id: string;
  user_id: string;
  title: string | null;
  created_at: string;
};

export type ChatMessage = {
  id: string;
  conversation_id: string;
  role: "user" | "assistant";
  content: string;
  cited_sources: { title: string; url?: string }[] | null;
  created_at: string;
};

export type KnowledgeDocument = {
  id: string;
  title: string;
  author: string | null;
  source: string | null;
  url: string | null;
  document_type: string | null;
  published_at: string | null;
  created_at: string;
};

export type KnowledgeChunk = {
  id: string;
  document_id: string;
  content: string;
  embedding: number[] | null;
};

/**
 * @supabase/ssr (postgrest-js) expects each table to satisfy `GenericTable`
 * (Row/Insert/Update/Relationships) and the schema to satisfy `GenericSchema`
 * (Tables/Views/Functions) — see node_modules/@supabase/postgrest-js/src/types/common/common.ts.
 * Leaving out `Relationships`/`Views`/`Functions` silently breaks type
 * inference on `.insert()`/`.update()` (they resolve to `never`), so we
 * declare them explicitly even though this project has none of the latter two.
 */
type Table<Row, Insert = Partial<Row>, Update = Partial<Row>> = {
  Row: Row;
  Insert: Insert;
  Update: Update;
  Relationships: [];
};

/** @supabase/ssr expects a `Database` generic shaped like this. */
export type Database = {
  public: {
    Tables: {
      profiles: Table<Profile>;
      stores: Table<Store>;
      products: Table<Product>;
      events: Table<Event>;
      event_recruitments: Table<EventRecruitment>;
      event_reviews: Table<EventReview>;
      event_participations: Table<EventParticipation>;
      event_product_sales: Table<EventProductSale>;
      event_checklists: Table<EventChecklistItem>;
      notifications: Table<Notification>;
      chat_conversations: Table<ChatConversation>;
      chat_messages: Table<ChatMessage>;
      knowledge_documents: Table<KnowledgeDocument>;
      knowledge_chunks: Table<KnowledgeChunk>;
    };
    Views: Record<string, never>;
    Functions: Record<string, never>;
  };
};
