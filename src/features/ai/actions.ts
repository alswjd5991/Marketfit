"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { getCurrentUser, getMyStore } from "@/features/store/data";
import { buildPrepSummary, buildStoreContextSummary, getMarketfitEvents } from "./data";
import { type GeminiTurn } from "./gemini";
import { generateChatReply, regionEventReply, type ChatReply } from "./reply";
import type { ChatMessage } from "@/types/database";

function aiPath(conversationId?: string) {
  return conversationId ? `/ai?c=${conversationId}` : "/ai";
}

/** 로그인/가게 등록 여부만 확인 — 대화는 user_id 기준(가게 없어도 대화는 가능하게 둔다). */
async function requireLoggedInUser() {
  const user = await getCurrentUser();
  if (!user) redirect(`/login?notice=${encodeURIComponent("로그인 후 AI 도우미를 이용할 수 있어요.")}`);
  return user;
}

export async function deleteConversation(formData: FormData) {
  const user = await requireLoggedInUser();
  const conversationId = String(formData.get("conversation_id") ?? "");
  if (!conversationId) redirect("/ai");

  const supabase = await createClient();
  const { error } = await supabase
    .from("chat_conversations")
    .delete()
    .eq("id", conversationId)
    .eq("user_id", user!.id);

  if (error) {
    redirect(`/ai?error=${encodeURIComponent(error.message)}`);
  }
  revalidatePath("/ai");
  redirect("/ai");
}

// 빈 화면의 추천 버튼(ai-buttons.tsx SuggestionChips) → 대화에 남길 질문 문장.
const PRESETS: Record<string, string> = {
  sales: "내 매출을 분석해 줘",
  events: "내 활동 지역의 행사를 찾아 줘",
  prep: "참가 예정 행사의 준비 사항을 정리해 줘",
};

export async function sendMessage(formData: FormData) {
  const user = await requireLoggedInUser();
  let conversationId = String(formData.get("conversation_id") ?? "");
  const preset = String(formData.get("preset") ?? "");
  const content = Object.hasOwn(PRESETS, preset) ? PRESETS[preset] : String(formData.get("content") ?? "").trim();

  if (!content) {
    redirect(`/ai?${conversationId ? `c=${conversationId}&` : ""}error=${encodeURIComponent("메시지를 입력해 주세요.")}`);
  }

  const supabase = await createClient();

  // 빈 화면(새 대화)에서 보낸 첫 메시지면 대화를 여기서 만든다.
  if (!conversationId) {
    const { data, error } = await supabase
      .from("chat_conversations")
      .insert({ user_id: user!.id, title: null })
      .select("id")
      .single();
    if (error || !data) {
      redirect(`/ai?error=${encodeURIComponent(error?.message ?? "대화를 시작하지 못했어요.")}`);
    }
    conversationId = data!.id;
  }

  // 61번 항목: user_id까지 걸어 남의 대화에 메시지를 못 붙이게 이중 확인
  // (RLS의 own conversations/own messages 정책으로도 이미 막히지만 앱 레벨 방어 추가).
  const { data: conversation, error: convError } = await supabase
    .from("chat_conversations")
    .select("id, title")
    .eq("id", conversationId)
    .eq("user_id", user!.id)
    .maybeSingle();
  if (convError || !conversation) {
    redirect(`/ai?error=${encodeURIComponent("대화를 찾을 수 없어요.")}`);
  }

  const { error: insertUserError } = await supabase.from("chat_messages").insert({
    conversation_id: conversationId,
    role: "user",
    content,
  });
  if (insertUserError) {
    redirect(`${aiPath(conversationId)}&error=${encodeURIComponent(insertUserError.message)}`);
  }

  // 첫 메시지면 대화 제목을 자동으로 채워준다(사용자가 나중에 목록에서 알아보기 쉽게).
  if (!conversation!.title) {
    await supabase
      .from("chat_conversations")
      .update({ title: content.length > 30 ? `${content.slice(0, 30)}…` : content })
      .eq("id", conversationId);
  }

  const { data: history, error: historyError } = await supabase
    .from("chat_messages")
    .select("role, content")
    .eq("conversation_id", conversationId)
    .order("created_at", { ascending: true });
  if (historyError) {
    redirect(`${aiPath(conversationId)}&error=${encodeURIComponent(historyError.message)}`);
  }

  const turns: GeminiTurn[] = ((history ?? []) as Pick<ChatMessage, "role" | "content">[]).map((m) => ({
    role: m.role === "user" ? "user" : "model",
    text: m.content,
  }));

  // 질문 종류에 따라 개인 기록 / Marketfit 행사 → 다른 웹사이트 / 웹 검색 순서로 답한다(reply.ts).
  // 가게 기록은 개인 질문일 때만 불러와 AI에 전달한다.
  // 추천 버튼 중 "행사 찾기"는 가게에 저장된 지역으로, "참가 준비"는 저장된 체크리스트로 바로 답한다.
  const deps = { storeContext: buildStoreContextSummary, marketfitEvents: getMarketfitEvents };
  let result: ChatReply;
  if (preset === "events") {
    const store = await getMyStore().catch(() => null);
    result = await regionEventReply(store?.active_region ?? null, turns, deps);
  } else if (preset === "prep") {
    result = await buildPrepSummary().then(
      (text): ChatReply => ({ ok: true, text, sources: [] }),
      (): ChatReply => ({ ok: false, error: "준비 사항을 불러오지 못했어요. 잠시 후 다시 시도해 주세요." })
    );
  } else {
    result = await generateChatReply(turns, deps);
  }

  if (!result.ok) {
    // 실패해도 방금 보낸 사용자 메시지는 남아있고, 에러만 배너로 보여준다
    // (65번 원칙: 답을 지어내는 대신 실패를 솔직하게 알림).
    redirect(`${aiPath(conversationId)}&error=${encodeURIComponent(result.error)}`);
  }

  const { error: insertAssistantError } = await supabase.from("chat_messages").insert({
    conversation_id: conversationId,
    role: "assistant",
    content: result.text,
    cited_sources: result.sources.length > 0 ? result.sources : null,
  });
  if (insertAssistantError) {
    redirect(`${aiPath(conversationId)}&error=${encodeURIComponent(insertAssistantError.message)}`);
  }

  revalidatePath("/ai");
  redirect(aiPath(conversationId));
}
