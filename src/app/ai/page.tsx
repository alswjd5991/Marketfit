import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { getCurrentUser } from "@/features/store/data";
import { getMyConversations, getConversationDetail } from "@/features/ai/data";
import { isGeminiConfigured } from "@/features/ai/gemini";
import { startConversation, deleteConversation, sendMessage } from "@/features/ai/actions";
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
        내가 실제로 기록한 참가·판매 데이터를 근거로만 답해요. 기록에 없는 숫자는 지어내지 않아요.
      </p>

      {!geminiReady && (
        <p className="mt-4 rounded-lg bg-amber-50 px-3 py-2 text-sm text-amber-800">
          아직 GEMINI_API_KEY가 설정되지 않아서 실제 답변은 받을 수 없어요. <code>.env.local</code>에 키를 추가하면
          바로 동작해요.
        </p>
      )}
      {notice && <p className="mt-4 rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">{notice}</p>}

      <div className="mt-6 flex flex-wrap items-center gap-2">
        <form action={startConversation}>
          <Button type="submit" variant="outline" size="sm">
            + 새 대화
          </Button>
        </form>
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

      {!detail ? (
        <Card className="mt-4">
          <CardContent className="py-10 text-center text-sm text-neutral-400">
            {conversations.length === 0
              ? "아직 대화가 없어요. “+ 새 대화”로 시작해 보세요."
              : "왼쪽 목록에서 대화를 선택하거나 새 대화를 시작해 보세요."}
          </CardContent>
        </Card>
      ) : (
        <>
          <Card className="mt-4">
            <CardContent className="flex flex-col gap-3 py-4">
              {detail.messages.length === 0 ? (
                <p className="py-6 text-center text-sm text-neutral-400">
                  궁금한 걸 물어보세요. 예: &ldquo;내가 참가한 행사 중 순이익이 제일 높았던 건 뭐야?&rdquo;
                </p>
              ) : (
                detail.messages.map((m) => (
                  <div
                    key={m.id}
                    className={cn("flex", m.role === "user" ? "justify-end" : "justify-start")}
                  >
                    <p
                      className={cn(
                        "max-w-[85%] whitespace-pre-wrap rounded-2xl px-4 py-2.5 text-sm",
                        m.role === "user"
                          ? "bg-brand text-white"
                          : "bg-neutral-100 text-neutral-900"
                      )}
                    >
                      {m.content}
                    </p>
                  </div>
                ))
              )}
            </CardContent>
          </Card>

          <form action={sendMessage} className="mt-3 flex items-end gap-2">
            <input type="hidden" name="conversation_id" value={activeId!} />
            <textarea
              name="content"
              rows={2}
              placeholder="메시지를 입력하세요"
              className="flex-1 rounded-xl border border-neutral-200 px-3 py-2 text-sm"
            />
            <Button type="submit">보내기</Button>
          </form>

          <form action={deleteConversation} className="mt-2 text-right">
            <input type="hidden" name="conversation_id" value={activeId!} />
            <Button type="submit" variant="ghost" size="sm">
              이 대화 삭제
            </Button>
          </form>
        </>
      )}
    </div>
  );
}
