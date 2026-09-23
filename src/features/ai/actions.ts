"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { getCurrentUser } from "@/features/store/data";
import { buildStoreContextSummary } from "./data";
import { generateGeminiReply, type GeminiTurn } from "./gemini";
import type { ChatMessage } from "@/types/database";

const SYSTEM_PROMPT_HEADER = `당신은 "마켓핏"이라는 소상공인 행사 참가 데이터 플랫폼의 AI 도우미입니다.
아래 "## 가게 정보/등록된 상품/참가 기록/상품별 판매 실적 합계"에 나온 이 사용자의 실제 기록만
근거로 답하세요. 여기 없는 숫자나 행사, 상품은 절대 지어내지 마세요. 근거가 부족하면
"기록에 없어서 답하기 어려워요" 라고 솔직히 말하세요. 답변은 한국어로, 간결하고 구체적인
숫자와 함께 제시하세요.`;

function aiPath(conversationId?: string) {
  return conversationId ? `/ai?c=${conversationId}` : "/ai";
}

/** 로그인/가게 등록 여부만 확인 — 대화는 user_id 기준(가게 없어도 대화는 가능하게 둔다). */
async function requireLoggedInUser() {
  const user = await getCurrentUser();
  if (!user) redirect(`/login?notice=${encodeURIComponent("로그인 후 AI 도우미를 이용할 수 있어요.")}`);
  return user;
}

export async function startConversation() {
  const user = await requireLoggedInUser();
  const supabase = await createClient();

  const { data, error } = await supabase
    .from("chat_conversations")
    .insert({ user_id: user!.id, title: null })
    .select("id")
    .single();

  if (error || !data) {
    redirect(`/ai?error=${encodeURIComponent(error?.message ?? "대화를 시작하지 못했어요.")}`);
  }
  revalidatePath("/ai");
  redirect(aiPath(data!.id));
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

export async function sendMessage(formData: FormData) {
  const user = await requireLoggedInUser();
  const conversationId = String(formData.get("conversation_id") ?? "");
  const content = String(formData.get("content") ?? "").trim();

  if (!conversationId) redirect("/ai");
  if (!content) {
    redirect(`${aiPath(conversationId)}&error=${encodeURIComponent("메시지를 입력해 주세요.")}`);
  }

  const supabase = await createClient();

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

  const contextSummary = await buildStoreContextSummary();
  const systemInstruction = contextSummary
    ? `${SYSTEM_PROMPT_HEADER}\n\n${contextSummary}`
    : `${SYSTEM_PROMPT_HEADER}\n\n(이 사용자는 아직 가게를 등록하지 않아서 참가/판매 기록이 없어요. 가게 등록부터 안내해 주세요.)`;

  const turns: GeminiTurn[] = ((history ?? []) as Pick<ChatMessage, "role" | "content">[]).map((m) => ({
    role: m.role === "user" ? "user" : "model",
    text: m.content,
  }));

  const result = await generateGeminiReply(systemInstruction, turns);

  if (!result.ok) {
    // 실패해도 방금 보낸 사용자 메시지는 남아있고, 에러만 배너로 보여준다
    // (65번 원칙: 답을 지어내는 대신 실패를 솔직하게 알림).
    redirect(`${aiPath(conversationId)}&error=${encodeURIComponent(result.error)}`);
  }

  const { error: insertAssistantError } = await supabase.from("chat_messages").insert({
    conversation_id: conversationId,
    role: "assistant",
    content: result.text,
  });
  if (insertAssistantError) {
    redirect(`${aiPath(conversationId)}&error=${encodeURIComponent(insertAssistantError.message)}`);
  }

  revalidatePath("/ai");
  redirect(aiPath(conversationId));
}
