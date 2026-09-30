import { createClient } from "@/lib/supabase/server";
import { getCurrentUser, getMyStore, getMyProducts } from "@/features/store/data";
import type { ChatConversation, ChatMessage } from "@/types/database";

export interface ConversationSummary {
  id: string;
  title: string | null;
  createdAt: string;
}

/** 로그인 사용자의 대화 목록, 최신순. */
export async function getMyConversations(): Promise<ConversationSummary[]> {
  const user = await getCurrentUser();
  if (!user) return [];

  const supabase = await createClient();
  try {
    const { data, error } = await supabase
      .from("chat_conversations")
      .select("id, title, created_at")
      .eq("user_id", user.id)
      .order("created_at", { ascending: false });
    if (error) throw error;
    return (data ?? []).map((c) => ({ id: c.id, title: c.title, createdAt: c.created_at }));
  } catch {
    return []; // 62번 항목
  }
}

export interface ConversationDetail {
  conversation: ChatConversation;
  messages: ChatMessage[];
}

/** 61번 항목: user_id 조건을 쿼리에 직접 걸어 RLS와 이중으로 소유자 검증. */
export async function getConversationDetail(conversationId: string): Promise<ConversationDetail | null> {
  const user = await getCurrentUser();
  if (!user) return null;

  const supabase = await createClient();
  try {
    const { data: conversation, error } = await supabase
      .from("chat_conversations")
      .select("*")
      .eq("id", conversationId)
      .eq("user_id", user.id)
      .maybeSingle();
    if (error) throw error;
    if (!conversation) return null;

    const { data: messages, error: messagesError } = await supabase
      .from("chat_messages")
      .select("*")
      .eq("conversation_id", conversationId)
      .order("created_at", { ascending: true });
    if (messagesError) throw messagesError;

    return { conversation, messages: messages ?? [] };
  } catch {
    return null;
  }
}

const CONTEXT_PARTICIPATION_LIMIT = 30;
const CONTEXT_PRODUCT_LIMIT = 15;

/**
 * AI 도우미가 답할 때 근거로 삼을 "이 가게의 실제 데이터" 요약 텍스트.
 * RAG(knowledge_documents/knowledge_chunks)는 아직 채워져 있지 않아 여기서는
 * 쓰지 않고, 이 가게의 실제 DB 기록(가게 정보/상품/참가 기록/판매 실적)만
 * 근거로 준다 — 65번 원칙: 없는 데이터를 지어내지 않도록, 프롬프트에 없는
 * 숫자는 모델도 만들어낼 근거가 없게 만드는 게 목적.
 */
export async function buildStoreContextSummary(): Promise<string | null> {
  let store;
  try {
    store = await getMyStore();
  } catch {
    // 조회 장애와 미등록을 구분한다. 가게 조회 실패가 AI 요청 전체를 중단하지 않게 한다.
    return "## 가게 정보\n가게 기록을 불러오지 못했습니다. 기록이 없다고 단정하거나 사용자 수치를 추정하지 말고, 잠시 후 다시 확인하도록 안내하세요.";
  }
  if (!store) return null;

  const supabase = await createClient();
  const lines: string[] = [];

  lines.push(`## 가게 정보`);
  lines.push(`이름: ${store.name}${store.nickname ? ` (${store.nickname})` : ""}`);
  lines.push(`업종: ${store.category}`);
  if (store.flagship_product) lines.push(`대표 상품: ${store.flagship_product}`);
  if (store.active_region) lines.push(`주 활동 지역: ${store.active_region}`);
  if (store.payment_methods && store.payment_methods.length > 0) {
    lines.push(`지원 결제수단: ${store.payment_methods.join(", ")}`);
  }
  if (store.hygiene_certified != null) {
    lines.push(`위생교육 이수 여부: ${store.hygiene_certified ? "이수함" : "아직 안 함"}`);
  }

  try {
    const products = await getMyProducts(store.id);
    if (products.length > 0) {
      lines.push(`\n## 등록된 상품 (${products.length}개)`);
      for (const p of products) {
        const priceText = p.price != null ? `${p.price.toLocaleString()}원` : "가격 미기재";
        lines.push(`- ${p.name}${p.category ? ` [${p.category}]` : ""}: ${priceText}`);
      }
    }

    const { data: participations, error: participationsError } = await supabase
      .from("event_participations")
      .select(
        "id, status, event_id, fee, expected_revenue, target_revenue, total_revenue, net_profit, satisfaction, would_reattend, weather, indoor_outdoor, memo, created_at, booth_provided, booth_size, power_available, vehicle_access, booth_number, booth_location_rating, payment_methods_used"
      )
      .eq("store_id", store.id)
      .order("created_at", { ascending: false })
      .limit(CONTEXT_PARTICIPATION_LIMIT);
    if (participationsError) throw participationsError;

    const rows = participations ?? [];
    if (rows.length > 0) {
      const eventIds = rows.map((p) => p.event_id);
      const { data: events, error: eventsError } = await supabase
        .from("events")
        .select("id, name, category, region, start_date, end_date")
        .in("id", eventIds);
      if (eventsError) throw eventsError;
      const eventById = new Map((events ?? []).map((e) => [e.id, e]));

      lines.push(`\n## 참가 기록 (최근 ${rows.length}건)`);
      for (const p of rows) {
        const e = eventById.get(p.event_id);
        const parts = [
          `${e?.name ?? "(알 수 없는 행사)"}`,
          e?.category ? `[${e.category}]` : null,
          e?.start_date ? `${e.start_date}${e.end_date && e.end_date !== e.start_date ? `~${e.end_date}` : ""}` : null,
          `상태:${p.status}`,
          p.fee != null ? `참가비:${p.fee.toLocaleString()}원` : null,
          p.total_revenue != null ? `총매출:${p.total_revenue.toLocaleString()}원` : null,
          p.net_profit != null ? `순이익:${p.net_profit.toLocaleString()}원` : null,
          p.satisfaction != null ? `만족도:${p.satisfaction}/5` : null,
          p.would_reattend != null ? `재참가의향:${p.would_reattend ? "있음" : "없음"}` : null,
          p.weather ? `날씨:${p.weather}` : null,
          p.booth_number ? `부스위치:${p.booth_number}` : null,
          p.booth_location_rating != null ? `부스위치만족도:${p.booth_location_rating}/5` : null,
          p.booth_provided ? `부스제공:${p.booth_provided === "organizer" ? "주최측 제공" : "자비 지참"}` : null,
          p.memo ? `메모:"${p.memo}"` : null,
        ].filter(Boolean);
        lines.push(`- ${parts.join(" / ")}`);
      }

      const { data: sales, error: salesError } = await supabase
        .from("event_product_sales")
        .select("product_name, sold, revenue")
        .in(
          "participation_id",
          rows.map((p) => p.id)
        );
      if (salesError) throw salesError;

      const byProduct = new Map<string, { sold: number; revenue: number }>();
      for (const s of sales ?? []) {
        const cur = byProduct.get(s.product_name) ?? { sold: 0, revenue: 0 };
        cur.sold += s.sold;
        cur.revenue += s.revenue;
        byProduct.set(s.product_name, cur);
      }
      const topProducts = Array.from(byProduct.entries())
        .sort((a, b) => b[1].revenue - a[1].revenue)
        .slice(0, CONTEXT_PRODUCT_LIMIT);
      if (topProducts.length > 0) {
        lines.push(`\n## 상품별 판매 실적 합계 (매출 높은 순)`);
        for (const [name, agg] of topProducts) {
          lines.push(`- ${name}: 판매 ${agg.sold}개 / 매출 ${agg.revenue.toLocaleString()}원`);
        }
      }
    } else {
      lines.push(`\n## 참가 기록\n아직 참가 기록이 없음.`);
    }
  } catch {
    lines.push(`\n(일부 데이터를 불러오지 못했어요 — 네트워크 오류일 수 있어요.)`);
  }

  return lines.join("\n");
}
