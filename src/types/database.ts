// 손으로 유지 관리하는 Supabase 타입 정의.
// Supabase 프로젝트가 연결되면 `supabase gen types typescript`로 자동 생성본으로
// 교체할 수 있다(구조는 supabase/migrations/0001_init.sql과 반드시 일치시킬 것).

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

export interface Profile {
  id: string;
  email: string | null;
  name: string | null;
  created_at: string;
}

export interface Store {
  id: string;
  owner_id: string;
  name: string;
  nickname: string | null;
  category: string;
  flagship_product: string | null;
  active_region: string | null;
  contact: string | null;
  email: string | null;
  created_at: string;
}

export interface Product {
  id: string;
  store_id: string;
  name: string;
  category: string | null;
  price: number | null;
  cost: number | null;
  description: string | null;
  created_at: string;
}

export interface Event {
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
  recurring_of_event_id: string | null;
  created_at: string;
}

export interface EventRecruitment {
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
}

export interface EventReview {
  id: string;
  event_id: string;
  user_id: string | null;
  rating: number | null;
  body: string;
  visit_age_groups: string[] | null;
  created_at: string;
}

export interface EventParticipation {
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
  created_at: string;
  updated_at: string;
}

export interface EventProductSale {
  id: string;
  participation_id: string;
  product_id: string | null;
  product_name: string;
  prepared: number;
  sold: number;
  price: number;
  revenue: number; // generated column
  sell_through_rate: number | null; // generated column
}

export interface EventChecklistItem {
  id: string;
  participation_id: string;
  label: string;
  checked: boolean;
  is_custom: boolean;
  sort_order: number | null;
}

export interface Notification {
  id: string;
  user_id: string;
  type: "deadline_d3" | "attend_d1" | "record_result" | "new_recommendation";
  payload: Record<string, unknown> | null;
  read_at: string | null;
  created_at: string;
}

export interface ChatConversation {
  id: string;
  user_id: string;
  title: string | null;
  created_at: string;
}

export interface ChatMessage {
  id: string;
  conversation_id: string;
  role: "user" | "assistant";
  content: string;
  cited_sources: { title: string; url?: string }[] | null;
  created_at: string;
}

export interface KnowledgeDocument {
  id: string;
  title: string;
  author: string | null;
  source: string | null;
  url: string | null;
  document_type: string | null;
  published_at: string | null;
  created_at: string;
}

export interface KnowledgeChunk {
  id: string;
  document_id: string;
  content: string;
  embedding: number[] | null;
}

/** @supabase/ssr expects a `Database` generic shaped like this. */
export interface Database {
  public: {
    Tables: {
      profiles: { Row: Profile; Insert: Partial<Profile>; Update: Partial<Profile> };
      stores: { Row: Store; Insert: Partial<Store>; Update: Partial<Store> };
      products: { Row: Product; Insert: Partial<Product>; Update: Partial<Product> };
      events: { Row: Event; Insert: Partial<Event>; Update: Partial<Event> };
      event_recruitments: {
        Row: EventRecruitment;
        Insert: Partial<EventRecruitment>;
        Update: Partial<EventRecruitment>;
      };
      event_reviews: { Row: EventReview; Insert: Partial<EventReview>; Update: Partial<EventReview> };
      event_participations: {
        Row: EventParticipation;
        Insert: Partial<EventParticipation>;
        Update: Partial<EventParticipation>;
      };
      event_product_sales: {
        Row: EventProductSale;
        Insert: Partial<EventProductSale>;
        Update: Partial<EventProductSale>;
      };
      event_checklists: {
        Row: EventChecklistItem;
        Insert: Partial<EventChecklistItem>;
        Update: Partial<EventChecklistItem>;
      };
      notifications: { Row: Notification; Insert: Partial<Notification>; Update: Partial<Notification> };
      chat_conversations: {
        Row: ChatConversation;
        Insert: Partial<ChatConversation>;
        Update: Partial<ChatConversation>;
      };
      chat_messages: { Row: ChatMessage; Insert: Partial<ChatMessage>; Update: Partial<ChatMessage> };
      knowledge_documents: {
        Row: KnowledgeDocument;
        Insert: Partial<KnowledgeDocument>;
        Update: Partial<KnowledgeDocument>;
      };
      knowledge_chunks: {
        Row: KnowledgeChunk;
        Insert: Partial<KnowledgeChunk>;
        Update: Partial<KnowledgeChunk>;
      };
    };
  };
}
