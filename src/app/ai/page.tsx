import Link from "next/link";
import { Button } from "@/components/ui/button";
import { ChevronRight, ExternalLink, MoreVertical, Plus, Trash2 } from "lucide-react";
import { BotIcon } from "@/components/bot-icon";
import { getCurrentUser } from "@/features/store/data";
import { getMyConversations, getConversationDetail, type ConversationSummary } from "@/features/ai/data";
import { isGeminiConfigured } from "@/features/ai/gemini";
import { deleteConversation, sendMessage } from "@/features/ai/actions";
import { MessageInput, SendMessageButton, SuggestionChips } from "@/features/ai/ai-buttons";
import { cn } from "@/lib/utils";
import { MessageContent } from "@/features/ai/message-content";

export default async function AiPage(props: PageProps<"/ai">) {
  const sp = await props.searchParams;
  const notice = typeof sp.error === "string" ? sp.error : null;
  const requestedId = typeof sp.c === "string" ? sp.c : null;

  const user = await getCurrentUser();
  if (!user) {
    return (
      <div className="min-h-screen bg-[linear-gradient(135deg,#FFECD0_0%,#F4F9FD_30%,#DCEEFF_68%,#F6FAFD_100%)]">
      <div className="mx-auto max-w-md px-4 py-20 text-center font-[350]">
        <h1 className="text-xl font-normal tracking-[-0.025em] text-neutral-900">AI 도우미</h1>
        <p className="mt-3 text-sm text-neutral-500">로그인 후 이용할 수 있어요.</p>
        <Button asChild className="mt-6">
          <Link href="/login">로그인하러 가기</Link>
        </Button>
      </div>
      </div>
    );
  }

  const conversations = await getMyConversations();
  // 대화를 고르지 않았으면 빈 "새 대화" 화면 — 첫 메시지를 보낼 때 대화가 만들어진다.
  const detail = requestedId ? await getConversationDetail(requestedId) : null;
  const activeId = detail ? requestedId : null;
  const geminiReady = isGeminiConfigured();

  const today = seoulDate(new Date().toISOString());
  const todays = conversations.filter((c) => seoulDate(c.createdAt) === today);
  const older = conversations.filter((c) => seoulDate(c.createdAt) !== today);

  const banners = (
    <>
      {!geminiReady && (
        <p className="rounded-2xl bg-[#FFEEDD] px-4 py-3 text-sm text-[#B4530A]">
          AI 연결을 준비하고 있어요. 답변을 받을 수 없다면 관리자에게 문의해 주세요.
        </p>
      )}
      {notice && <p className="rounded-2xl bg-[#FFE4DE] px-4 py-3 text-sm text-[#BE3A2A]">{notice}</p>}
    </>
  );

  return (
    <div className="min-h-[calc(100vh-4rem)] font-[350] tracking-[-0.025em] bg-[linear-gradient(135deg,#FFECD0_0%,#F4F9FD_30%,#DCEEFF_68%,#F6FAFD_100%)]">
      <div className="mx-auto flex w-full max-w-[1440px] flex-col gap-6 px-4 py-6 lg:h-[calc(100vh-4rem)] lg:flex-row lg:px-8">
        {/* 대화 기록 사이드바 — 모바일에선 본문 아래로 내려간다. */}
        <aside className="order-2 flex shrink-0 flex-col rounded-3xl border border-white bg-white/80 p-4 shadow-sm shadow-neutral-900/5 backdrop-blur lg:order-1 lg:w-60">
          <div className="flex items-center justify-between px-2">
            <h2 className="text-sm font-normal text-neutral-950">대화 기록</h2>
            <Link
              href="/ai"
              aria-label="새 대화"
              title="새 대화"
              className="flex size-6 items-center justify-center rounded-full border border-neutral-200 text-neutral-500 transition duration-200 ease-out hover:rotate-90 hover:border-brand/40 hover:text-brand active:scale-90"
            >
              <Plus className="size-3.5" />
            </Link>
          </div>
          <div className="mt-4 flex flex-1 flex-col gap-6 overflow-y-auto">
            {conversations.length === 0 && <p className="px-2 text-[13px] text-neutral-400">아직 대화가 없어요.</p>}
            {todays.length > 0 && <ConversationGroup label="오늘" items={todays} activeId={activeId} />}
            {older.length > 0 && <ConversationGroup label="이전 대화" items={older} activeId={activeId} />}
          </div>
          <Link
            href="/store"
            className="group mt-4 flex items-center gap-2 rounded-full px-3 py-2 text-[13px] text-neutral-600 transition-colors duration-200 hover:bg-white hover:text-brand"
          >
            <ExternalLink className="size-3.5" />
            내 가게로 이동
            <ChevronRight className="ml-auto size-3.5 text-neutral-400 transition-transform duration-200 ease-out group-hover:translate-x-1" />
          </Link>
        </aside>

        <main className="order-1 flex min-h-[70vh] min-w-0 flex-1 flex-col lg:order-2 lg:min-h-0">
          {!detail || detail.messages.length === 0 ? (
            <div className="mx-auto flex w-full max-w-2xl flex-1 flex-col items-center justify-center gap-6 py-12 text-center motion-safe:animate-fade-up">
              <BotIcon className="size-20 text-brand" />
              <div>
                <h1 className="text-3xl font-normal leading-[1.21] text-neutral-950 sm:text-4xl">어떤 도움이 필요하세요?</h1>
              </div>
              <div className="flex w-full flex-col gap-2 text-left">{banners}</div>
              <form action={sendMessage} className="flex w-full flex-col gap-6">
                {activeId && <input type="hidden" name="conversation_id" value={activeId} />}
                <div className="flex items-end gap-3 rounded-[28px] border border-white bg-white p-2 pl-6 shadow-lg shadow-brand/10 transition-shadow duration-200 focus-within:shadow-xl focus-within:shadow-brand/15">
                  <MessageInput />
                  <SendMessageButton />
                </div>
                <SuggestionChips />
              </form>
            </div>
          ) : (
            <div className="mx-auto flex min-h-0 w-full max-w-3xl flex-1 flex-col">
              <div className="flex flex-1 flex-col gap-6 overflow-y-auto pb-6">
                {detail.messages.map((m) =>
                  m.role === "assistant" ? (
                    <div key={m.id} className="flex min-w-0 items-start gap-3 motion-safe:animate-fade-up">
                      <BotIcon className="hidden size-9 text-brand sm:inline-block" />
                      <div className="flex min-w-0 max-w-full flex-1 flex-col items-start gap-2 sm:max-w-[90%]">
                        <div className="w-full min-w-0 rounded-3xl bg-white p-4 shadow-sm shadow-neutral-900/5 sm:px-6 sm:py-5">
                          <MessageContent content={m.content} />
                        </div>
                        {m.cited_sources && m.cited_sources.length > 0 && (
                          <details className="w-full min-w-0 px-1 text-xs text-neutral-600">
                            <summary className="cursor-pointer rounded py-1 font-normal focus-visible:outline-2 focus-visible:outline-brand">참고한 출처 {m.cited_sources.length}개</summary>
                            <div className="mt-2 flex flex-col gap-2">
                            {m.cited_sources.map((s, i) =>
                              s.url ? (
                                <a
                                  key={i}
                                  href={s.url}
                                  target="_blank"
                                  rel="noreferrer"
                                  className="flex min-w-0 items-center gap-1 text-xs text-neutral-600 hover:text-brand"
                                >
                                  <ExternalLink className="size-3 shrink-0" />
                                  <span className="truncate">{s.title}</span>
                                </a>
                              ) : (
                                <span key={i} className="text-xs text-neutral-600">
                                  {s.title}
                                </span>
                              )
                            )}
                            </div>
                          </details>
                        )}
                        <span className="px-1 text-[11px] text-neutral-400">{formatTime(m.created_at)}</span>
                      </div>
                    </div>
                  ) : (
                    <div key={m.id} className="flex justify-end motion-safe:animate-fade-up">
                      <div className="flex max-w-[80%] flex-col items-end gap-1">
                        <p className="whitespace-pre-wrap break-words rounded-3xl bg-brand px-5 py-2 text-sm leading-7 text-white [overflow-wrap:anywhere]">
                          {m.content}
                        </p>
                        <span className="px-1 text-[11px] text-neutral-400">{formatTime(m.created_at)}</span>
                      </div>
                    </div>
                  )
                )}
              </div>
              <div className="flex flex-col gap-2">{banners}</div>
              <form
                action={sendMessage}
                className="mt-2 flex items-end gap-3 rounded-[28px] border border-white bg-white p-2 pl-6 shadow-lg shadow-brand/10 transition-shadow duration-200 focus-within:shadow-xl focus-within:shadow-brand/15"
              >
                <input type="hidden" name="conversation_id" value={activeId!} />
                <MessageInput />
                <SendMessageButton />
              </form>
            </div>
          )}
        </main>
      </div>
    </div>
  );
}

function ConversationGroup({ label, items, activeId }: { label: string; items: ConversationSummary[]; activeId: string | null }) {
  return (
    <div>
      <p className="mb-1 px-2 text-xs text-neutral-400">{label}</p>
      <ul className="flex flex-col gap-0.5">
        {items.map((c) => (
          <li
            key={c.id}
            className={cn(
              "group flex items-center rounded-full transition-colors duration-200 ease-out hover:bg-white/70",
              c.id === activeId && "bg-white shadow-sm shadow-neutral-900/5 hover:bg-white"
            )}
          >
            <Link
              href={`/ai?c=${c.id}`}
              className={cn("min-w-0 flex-1 truncate py-2 pl-3 text-[13px] text-neutral-600", c.id === activeId && "text-brand")}
            >
              {c.title ?? "새 대화"}
            </Link>
            {/* ⋮ 메뉴 — 지금은 삭제만. 데스크톱에선 마우스를 올리거나 선택된 대화일 때만 보인다. */}
            <details
              className={cn(
                "relative transition-opacity duration-200 open:opacity-100 focus-within:opacity-100 lg:opacity-0 lg:group-hover:opacity-100",
                c.id === activeId && "lg:opacity-100"
              )}
            >
              <summary
                aria-label="대화 메뉴"
                className="flex size-7 cursor-pointer list-none items-center justify-center rounded-full text-neutral-400 transition-colors duration-200 hover:text-neutral-900 [&::-webkit-details-marker]:hidden"
              >
                <MoreVertical className="size-3.5" />
              </summary>
              <form action={deleteConversation} className="absolute right-0 z-10 mt-1 rounded-2xl border border-neutral-100 bg-white p-1 shadow-lg motion-safe:animate-fade-up">
                <input type="hidden" name="conversation_id" value={c.id} />
                <button
                  type="submit"
                  className="flex items-center gap-2 whitespace-nowrap rounded-full px-4 py-2 text-[13px] text-[#BE3A2A] transition-colors duration-200 hover:bg-[#FFE4DE]"
                >
                  <Trash2 className="size-3.5" />삭제
                </button>
              </form>
            </details>
          </li>
        ))}
      </ul>
    </div>
  );
}

/** ISO 타임스탬프 -> 서울 기준 "YYYY-MM-DD". */
function seoulDate(iso: string): string {
  return new Date(iso).toLocaleDateString("en-CA", { timeZone: "Asia/Seoul" });
}

/** ISO 타임스탬프 -> "오후 3:42" 같은 표시용 시각. */
function formatTime(iso: string): string {
  return new Date(iso).toLocaleTimeString("ko-KR", {
    hour: "numeric",
    minute: "2-digit",
    timeZone: "Asia/Seoul",
  });
}
