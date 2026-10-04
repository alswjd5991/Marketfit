import { createClient } from "@/lib/supabase/server";
import { getCurrentUser, getMyStore, getMyProducts } from "@/features/store/data";
import type { ChatConversation, ChatMessage } from "@/types/database";
import { participationStats } from "./stats";
import { parseMarketfitEvents, type EventQuery, type EventRecord, type MarketfitEventRow } from "./event-search";

/** AI 도우미가 행사 질문에 가장 먼저 참고하는 Marketfit 등록 행사(공개 읽기 테이블). */
export async function getMarketfitEvents(query: EventQuery): Promise<EventRecord[]> {
  const supabase = await createClient();
  let request = supabase
    .from("events")
    .select("id, name, venue, event_type, start_date, end_date, event_recruitments(recruit_end, fee, is_sample_data)")
    .not("start_date", "is", null)
    .lte("start_date", query.to)
    .order("start_date", { ascending: false })
    .limit(300);
  if (query.region !== "전국") request = request.eq("region", query.region);
  const { data, error } = await request;
  if (error) throw error;
  return parseMarketfitEvents((data ?? []) as MarketfitEventRow[], query);
}

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

/** "참가 준비" 버튼: 참가 예정 행사별 준비 체크리스트와 상품 준비 수량을 그대로 정리한다(AI 호출 없음). */
export async function buildPrepSummary(): Promise<string> {
  const store = await getMyStore();
  if (!store) return "아직 가게가 등록되어 있지 않아요. **내 가게**에서 가게를 먼저 등록해 주세요.";

  const supabase = await createClient();
  const { data: rows, error } = await supabase
    .from("event_participations")
    .select("id, event_id")
    .eq("store_id", store.id)
    .eq("status", "planning_to_attend");
  if (error) throw error;
  if (!rows?.length) return "참가 예정으로 등록된 행사가 없어요. **내 행사**에서 상태를 \"참가 예정\"으로 바꾸면 준비 사항을 정리해 드릴게요.";

  const ids = rows.map((r) => r.id);
  const [events, checklist, sales] = await Promise.all([
    supabase.from("events").select("id, name, venue, start_date, end_date").in("id", rows.map((r) => r.event_id)),
    supabase.from("event_checklists").select("participation_id, label, checked, sort_order").in("participation_id", ids).order("sort_order", { ascending: true }),
    supabase.from("event_product_sales").select("participation_id, product_name, prepared").in("participation_id", ids),
  ]);
  if (events.error || checklist.error || sales.error) throw events.error ?? checklist.error ?? sales.error;
  const eventById = new Map((events.data ?? []).map((e) => [e.id, e]));

  const sections = rows
    .map((r) => ({ r, e: eventById.get(r.event_id) }))
    .sort((a, b) => (a.e?.start_date ?? "9999").localeCompare(b.e?.start_date ?? "9999"))
    .map(({ r, e }) => {
      const date = e?.start_date ? `${e.start_date}${e.end_date && e.end_date !== e.start_date ? `~${e.end_date}` : ""}` : "날짜 미정";
      const items = (checklist.data ?? []).filter((c) => c.participation_id === r.id);
      const products = (sales.data ?? []).filter((s) => s.participation_id === r.id && s.prepared > 0);
      const lines = [`### ${e?.name ?? "(알 수 없는 행사)"}`, `${date}${e?.venue ? ` · ${e.venue}` : ""}`];
      lines.push(items.length
        ? `**준비 체크리스트** (${items.filter((c) => c.checked).length}/${items.length} 완료)\n${items.map((c) => `- ${c.checked ? "✅" : "⬜"} ${c.label}`).join("\n")}`
        : "**준비 체크리스트**\n- 아직 등록한 항목이 없어요.");
      if (products.length) lines.push(`**준비할 상품**\n${products.map((p) => `- ${p.product_name}: ${p.prepared}개`).join("\n")}`);
      return lines.join("\n\n");
    });

  return `**참가 예정 행사 ${rows.length}건의 준비 사항**\n\n${sections.join("\n\n")}\n\n항목은 **내 행사**의 각 행사 화면에서 체크하거나 추가할 수 있어요.`;
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

      // 합계·평균·순위는 모델이 계산하다 틀리지 않도록 코드에서 미리 계산해 준다.
      lines.push(`\n## 계산된 통계 (최근 ${rows.length}건 기준, 코드가 계산한 값)`);
      lines.push(...participationStats(rows.map((p) => ({ ...p, name: eventById.get(p.event_id)?.name ?? "(알 수 없는 행사)" }))));

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
