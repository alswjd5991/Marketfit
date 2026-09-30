import Link from "next/link";
import { ExternalLink, Sparkles, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { getCurrentUser } from "@/features/store/data";
import { getMyConversations, getConversationDetail } from "@/features/ai/data";
import { isGeminiConfigured } from "@/features/ai/gemini";
import { startConversation, deleteConversation, sendMessage } from "@/features/ai/actions";
import { NewChatIconButton, MessageInput, SendMessageButton, StartConversationButton } from "@/features/ai/ai-buttons";
import { cn } from "@/lib/utils";

export default async function AiPage(props: PageProps<"/ai">) {
  const sp = await props.searchParams;
  const notice = typeof sp.error === "string" ? sp.error : null;
  const requestedId = typeof sp.c === "string" ? sp.c : null;

  const user = await getCurrentUser();
  if (!user) {
    return (
      <div className="mx-auto max-w-md px-4 py-20 text-center">
        <h1 className="text-xl font-semibold text-neutral-900">AI 도우미</h1>
        <p className="mt-3 text-sm text-neutral-500">로그인 후 이용할 수 있어요.</p>
        <Button asChild className="mt-6">
          <Link href="/login">로그인하러 가기</Link>
        </Button>
      </div>
    );
  }

  const conversations = await getMyConversations();
  const activeId = requestedId ?? conversations[0]?.id ?? null;
  const detail = activeId ? await getConversationDetail(activeId) : null;
  const geminiReady = isGeminiConfigured();

  return (
    <div className="mx-auto max-w-2xl px-4 py-8">
      <h1 className="text-xl font-bold text-neutral-950">AI 도우미</h1>
      <p className="mt-1 text-sm text-neutral-500">
        내 참가·판매 질문은 내 기록으로 분석하고, 행사·모집 일정은 Marketfit 등록 행사부터 찾아요.
        Marketfit 행사가 적으면 다른 웹사이트에서 찾아 출처를 함께 알려드려요.
      </p>

      {!geminiReady && (
        <p className="mt-4 rounded-lg bg-amber-50 px-3 py-2 text-sm text-amber-800">
          아직 GEMINI_API_KEY가 설정되지 않아서 실제 답변은 받을 수 없어요. <code>.env.local</code>에 키를 추가하면
          바로 동작해요.
        </p>
      )}
      {notice && <p className="mt-4 rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">{notice}</p>}

      {/* 대화가 여러 개면 채팅창 위에 전환용 칩을 보여준다. */}
      {conversations.length > 1 && (
        <div className="mt-4 flex flex-wrap items-center gap-2">
          {conversations.map((c) => (
            <Link
              key={c.id}
              href={`/ai?c=${c.id}`}
              className={cn(
                "rounded-full border px-3 py-1.5 text-xs transition-colors",
                c.id === activeId
                  ? "border-brand bg-brand-light text-brand"
                  : "border-neutral-200 text-neutral-500 hover:border-neutral-300"
              )}
            >
              {c.title ?? "새 대화"}
            </Link>
          ))}
        </div>
      )}

      {/* 채팅창 — 헤더(아바타+이름+상태) / 메시지 스크롤 영역 / 입력창을 한 패널로 묶는다. */}
      <div className="mt-4 flex flex-col overflow-hidden rounded-2xl border border-neutral-200/80 bg-white shadow-sm shadow-neutral-900/5">
        <div className="flex items-center gap-3 border-b border-neutral-100 px-5 py-4">
          <div className="flex size-11 shrink-0 items-center justify-center rounded-full bg-brand text-white">
            <Sparkles className="size-5" />
          </div>
          <div className="min-w-0 flex-1">
            <p className="font-semibold text-neutral-900">AI 도우미</p>
            <p className="flex items-center gap-1.5 text-xs text-neutral-400">
              <span
                className={cn("inline-block size-1.5 rounded-full", geminiReady ? "bg-emerald-500" : "bg-neutral-300")}
                aria-hidden
              />
              {geminiReady ? "내 참가 데이터 기반으로 답해요" : "GEMINI_API_KEY 연결 필요"}
            </p>
          </div>
          <form action={startConversation}>
            <NewChatIconButton />
          </form>
        </div>

        <div className="flex max-h-[520px] min-h-[360px] flex-col gap-4 overflow-y-auto px-5 py-5">
          {!detail || detail.messages.length === 0 ? (
            <div className="m-auto max-w-xs text-center text-sm text-neutral-400">
              {!detail
                ? "아직 대화가 없어요. 아래 “새 대화 시작”을 눌러 물어보세요."
                : "궁금한 걸 물어보세요. 예: “내가 참가한 행사 중 순이익이 제일 높았던 건 뭐야?”"}
            </div>
          ) : (
            detail.messages.map((m) =>
              m.role === "assistant" ? (
                <div key={m.id} className="flex items-start gap-2.5">
                  <div className="flex size-8 shrink-0 items-center justify-center rounded-full bg-brand-light text-brand">
                    <Sparkles className="size-4" />
                  </div>
                  <div className="flex max-w-[80%] flex-col items-start gap-1">
                    <p className="whitespace-pre-wrap rounded-2xl rounded-tl-md bg-neutral-100 px-4 py-2.5 text-sm text-neutral-900">
                      {m.content}
                    </p>
                    {m.cited_sources && m.cited_sources.length > 0 && (
                      <div className="flex flex-col gap-0.5 px-1">
                        {m.cited_sources.map((s, i) =>
                          s.url ? (
                            <a
                              key={i}
                              href={s.url}
                              target="_blank"
                              rel="noreferrer"
                              className="flex items-center gap-1 text-[11px] text-neutral-400 hover:text-brand"
                            >
                              <ExternalLink className="size-3 shrink-0" />
                              <span className="truncate">{s.title}</span>
                            </a>
                          ) : (
                            <span key={i} className="text-[11px] text-neutral-400">
                              {s.title}
                            </span>
                          )
                        )}
                      </div>
                    )}
                    <span className="px-1 text-[11px] text-neutral-400">{formatTime(m.created_at)}</span>
                  </div>
                </div>
              ) : (
                <div key={m.id} className="flex justify-end">
                  <div className="flex max-w-[80%] flex-col items-end gap-1">
                    <p className="whitespace-pre-wrap rounded-2xl rounded-tr-md bg-brand px-4 py-2.5 text-sm text-white">
                      {m.content}
                    </p>
                    <span className="px-1 text-[11px] text-neutral-400">{formatTime(m.created_at)}</span>
                  </div>
                </div>
              )
            )
          )}
        </div>

        {detail ? (
          <form action={sendMessage} className="flex items-center gap-2 border-t border-neutral-100 px-4 py-3">
            <input type="hidden" name="conversation_id" value={activeId!} />
            <MessageInput />
            <SendMessageButton />
          </form>
        ) : (
          <div className="border-t border-neutral-100 px-4 py-3">
            <form action={startConversation}>
              <StartConversationButton />
            </form>
          </div>
        )}
      </div>

      {detail && (
        <form action={deleteConversation} className="mt-2 flex justify-end">
          <input type="hidden" name="conversation_id" value={activeId!} />
          <button
            type="submit"
            className="flex items-center gap-1 rounded-lg px-2 py-1 text-xs text-neutral-400 transition-colors hover:text-red-600"
          >
            <Trash2 className="size-3.5" />이 대화 삭제
          </button>
        </form>
      )}
    </div>
  );
}

/** ISO 타임스탬프 -> "오후 3:42" 같은 표시용 시각. */
function formatTime(iso: string): string {
  return new Date(iso).toLocaleTimeString("ko-KR", {
    hour: "numeric",
    minute: "2-digit",
    timeZone: "Asia/Seoul",
  });
}
