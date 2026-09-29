"use client";

// AI 도우미 폼들의 제출 버튼/입력창 — 전송 중(pending)엔 비활성화 + 로딩 표시로 바꿔서
// 사용자가 응답을 기다리다 무의식적으로 다시 눌러 요청이 중복 발사되는 걸 막는다.
// (무료 등급 RPM이 5로 낮아서, 중복 클릭 몇 번만으로도 Gemini API 429를 유발할 수 있었음.)
// useFormStatus는 <form> 하위의 클라이언트 컴포넌트에서만 쓸 수 있어 별도 파일로 분리.

import { useFormStatus } from "react-dom";
import { Loader2, Plus, Send } from "lucide-react";
import { Button } from "@/components/ui/button";

/** 헤더의 "새 대화 시작" 원형 아이콘 버튼. */
export function NewChatIconButton() {
  const { pending } = useFormStatus();
  return (
    <button
      type="submit"
      aria-label="새 대화 시작"
      title="새 대화 시작"
      disabled={pending}
      className="flex size-9 shrink-0 items-center justify-center rounded-full text-neutral-400 transition-colors hover:bg-neutral-100 hover:text-neutral-700 disabled:pointer-events-none disabled:opacity-50"
    >
      {pending ? <Loader2 className="size-5 animate-spin" /> : <Plus className="size-5" />}
    </button>
  );
}

/** 메시지 입력창 — 전송 중엔 다시 입력 못 하게 비활성화. */
export function MessageInput() {
  const { pending } = useFormStatus();
  return (
    <input
      name="content"
      autoComplete="off"
      placeholder={pending ? "답변을 기다리는 중..." : "메시지를 입력하세요"}
      disabled={pending}
      className="flex-1 rounded-full border border-neutral-200 px-4 py-2.5 text-sm outline-none focus:border-brand disabled:cursor-not-allowed disabled:bg-neutral-50 disabled:text-neutral-400"
    />
  );
}

/** 메시지 입력창 옆 원형 전송 버튼. */
export function SendMessageButton() {
  const { pending } = useFormStatus();
  return (
    <button
      type="submit"
      aria-label="보내기"
      disabled={pending}
      className="flex size-10 shrink-0 items-center justify-center rounded-full bg-brand text-white transition-colors hover:bg-brand-dark disabled:pointer-events-none disabled:opacity-50"
    >
      {pending ? <Loader2 className="size-4 animate-spin" /> : <Send className="size-4" />}
    </button>
  );
}

/** 대화가 아직 없을 때 보여주는 전체너비 "새 대화 시작" 버튼. */
export function StartConversationButton() {
  const { pending } = useFormStatus();
  return (
    <Button type="submit" disabled={pending} className="w-full">
      {pending ? (
        <>
          <Loader2 className="size-4 animate-spin" />
          시작하는 중...
        </>
      ) : (
        "새 대화 시작"
      )}
    </Button>
  );
}
